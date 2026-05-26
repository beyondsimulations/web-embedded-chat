use crate::{config::Config, error::AppError};
use crate::dto::{ChatRequest, ChatResponse, AiApiRequest, AiApiResponse, Message, Role, StreamEvent, Usage};
use futures::stream::{self, Stream, StreamExt};
use std::pin::Pin;

/// Prepares messages and dispatches the HTTP request to the upstream AI service.
/// Shared by both streaming and non-streaming paths.
async fn dispatch_ai_request(
    config: &Config,
    request: &ChatRequest,
    origin: Option<&str>,
    stream: bool,
) -> Result<reqwest::Response, AppError> {
    let mut messages = request.history.clone().unwrap_or_default();
    messages.push(Message {
        role: Role::User,
        content: request.message.clone(),
    });

    let ai_request = AiApiRequest {
        model: request.model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: config.max_tokens,
        stream,
    };

    let mut req_builder = config
        .http_client
        .post(&config.openai_api_url)
        .header("Authorization", format!("Bearer {}", config.openai_api_key));

    if let Some(origin_value) = origin {
        req_builder = req_builder.header("X-Forwarded-Origin", origin_value);
    }

    let res = req_builder
        .json(&ai_request)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to AI service: {e}");
            AppError::UpstreamServiceError(format!("Failed to connect to AI service: {e}"))
        })?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        tracing::error!(status = %status, body = %body, "AI service returned error");
        return Err(AppError::UpstreamServiceError(format!(
            "AI service returned {status}: {body}"
        )));
    }

    Ok(res)
}

pub async fn send_chat_request(
    config: &Config,
    request: ChatRequest,
    origin: Option<String>,
) -> Result<ChatResponse, AppError> {
    let model = request.model.clone();
    let trace_id = request.trace_id.clone();
    let session_id = request.session_id.clone();

    let res = dispatch_ai_request(config, &request, origin.as_deref(), false).await?;

    let body = res.text().await
        .map_err(|e| AppError::UpstreamServiceError(format!("Failed to read response: {e}")))?;

    let openai_response: AiApiResponse = serde_json::from_str(&body)
        .map_err(|e| {
            tracing::error!(body = %body, "Failed to parse AI service response: {e}");
            AppError::UpstreamServiceError(format!("Invalid response from AI service: {e}"))
        })?;

    if let Some(err) = &openai_response.error {
        tracing::error!(error = %err, "AI service returned error in response body");
        let msg = err
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| err.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| err.to_string());
        return Err(AppError::UpstreamServiceError(format!("AI service error: {msg}")));
    }

    let finish_reason = openai_response
        .choices
        .as_ref()
        .and_then(|choices| choices.first())
        .and_then(|c| c.finish_reason.clone());

    let content = openai_response
        .choices
        .as_ref()
        .and_then(|choices| choices.first())
        .and_then(|c| c.message.content.clone())
        .or_else(|| openai_response.response.clone())
        .unwrap_or_else(|| "No response produced".to_string());

    let reasoning_content = openai_response
        .choices
        .as_ref()
        .and_then(|choices| choices.first())
        .and_then(|c| c.message.reasoning_content.clone());

    let total_tokens = openai_response.usage.as_ref()
        .and_then(|u| u.total_tokens).unwrap_or(0) as i32;
    let prompt_tokens = openai_response.usage.as_ref()
        .and_then(|u| u.prompt_tokens);
    let completion_tokens = openai_response.usage.as_ref()
        .and_then(|u| u.completion_tokens);

    let trace = trace_id.clone();

    match serde_json::from_str::<ChatResponse>(&content) {
        Ok(mut parsed) => {
            parsed.source = parsed.source.or(openai_response.source.clone());
            parsed.sources = parsed.sources.or(openai_response.sources.clone());
            parsed.trace_id = parsed.trace_id.or(trace.clone());
            parsed.session_id = parsed.session_id.or(session_id.clone());
            parsed.prompt_tokens = parsed.prompt_tokens.or(prompt_tokens);
            parsed.completion_tokens = parsed.completion_tokens.or(completion_tokens);
            parsed.finish_reason = parsed.finish_reason.or(finish_reason);
            parsed.reasoning_content = parsed.reasoning_content.or(reasoning_content);
            parsed.tool_calls = parsed.tool_calls.or(openai_response.tool_calls);
            if parsed.token_count == 0 {
                parsed.token_count = total_tokens;
            }
            Ok(parsed)
        }
        Err(_) => Ok(ChatResponse {
            response: content.to_string(),
            trace_id: trace.clone(),
            session_id: session_id.clone(),
            model: model.clone(),
            token_count: total_tokens,
            prompt_tokens,
            completion_tokens,
            finish_reason,
            source: openai_response.source,
            sources: openai_response.sources,
            reasoning_content,
            tool_calls: openai_response.tool_calls,
        }),
    }
}

pub async fn send_chat_request_streaming(
    config: &Config,
    request: ChatRequest,
    origin: Option<String>,
) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent, AppError>> + Send>>, AppError> {
    let model = request.model.clone();

    let res = dispatch_ai_request(config, &request, origin.as_deref(), true).await?;

    let content_type = res
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Fallback: if upstream returned JSON instead of SSE, parse as non-streaming
    if !content_type.contains("text/event-stream") {
        let body = res.text().await
            .map_err(|e| AppError::UpstreamServiceError(format!("Failed to read response: {e}")))?;

        let openai_response: AiApiResponse = serde_json::from_str(&body)
            .map_err(|e| AppError::UpstreamServiceError(format!("Invalid response: {e}")))?;

        let content = openai_response
            .choices.as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.message.content.clone())
            .or_else(|| openai_response.response.clone())
            .unwrap_or_default();

        let sources = openai_response.sources.clone().unwrap_or_default();
        let usage = openai_response.usage;

        let mut events: Vec<Result<StreamEvent, AppError>> = vec![
            Ok(StreamEvent::Delta(content)),
        ];
        if !sources.is_empty() {
            events.push(Ok(StreamEvent::Sources(sources)));
        }
        events.push(Ok(StreamEvent::Done { model, usage }));

        return Ok(Box::pin(stream::iter(events)));
    }

    // Streaming path: parse SSE from reqwest byte stream
    let byte_stream = res.bytes_stream();
    let model_for_stream = model;

    let event_stream = {
        // UTF-8 decoder that handles multi-byte chars split across chunks
        let mut utf8_buffer: Vec<u8> = Vec::new();
        let mut line_buffer = String::new();
        let mut final_usage: Option<Usage> = None;
        let mut sources: Option<Vec<serde_json::Value>> = None;
        let mut finished = false;
        let mut received_content = false;

        byte_stream
            .map(move |chunk_result| {
                match chunk_result {
                    Err(e) => {
                        vec![Err(AppError::UpstreamServiceError(format!("Stream read error: {e}")))]
                    }
                    Ok(bytes) => {
                        utf8_buffer.extend_from_slice(&bytes);
                        let mut events = Vec::new();

                        // Decode as much valid UTF-8 as possible, keeping incomplete
                        // trailing sequences in the buffer for the next chunk
                        let valid_up_to = match std::str::from_utf8(&utf8_buffer) {
                            Ok(s) => {
                                line_buffer.push_str(s);
                                utf8_buffer.len()
                            }
                            Err(e) => {
                                let valid = e.valid_up_to();
                                if valid > 0 {
                                    // Safety: from_utf8 confirmed these bytes are valid
                                    line_buffer.push_str(
                                        unsafe { std::str::from_utf8_unchecked(&utf8_buffer[..valid]) }
                                    );
                                }
                                valid
                            }
                        };
                        if valid_up_to > 0 {
                            utf8_buffer.drain(..valid_up_to);
                        }

                        // Process complete lines without reallocating the buffer each time
                        while let Some(newline_pos) = line_buffer.find('\n') {
                            let line: String = line_buffer[..newline_pos].trim().to_string();
                            // Efficient: drain processed bytes instead of reallocating
                            line_buffer.drain(..=newline_pos);

                            if line.is_empty() || line.starts_with(':') {
                                continue;
                            }

                            if let Some(data) = line.strip_prefix("data: ") {
                                let data = data.trim();
                                if data == "[DONE]" {
                                    if !finished {
                                        finished = true;
                                        if !received_content {
                                            events.push(Ok(StreamEvent::Error(
                                                "AI service returned no content".to_string(),
                                            )));
                                        }
                                        if let Some(s) = sources.take() {
                                            events.push(Ok(StreamEvent::Sources(s)));
                                        }
                                        events.push(Ok(StreamEvent::Done {
                                            model: model_for_stream.clone(),
                                            usage: final_usage.take(),
                                        }));
                                    }
                                    continue;
                                }

                                if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
                                    if value.get("object").and_then(|o| o.as_str()) == Some("chat.completion.sources") {
                                        if let Some(s) = value.get("sources") {
                                            sources = Some(
                                                s.as_array().cloned().unwrap_or_default()
                                            );
                                        }
                                        continue;
                                    }

                                    if let Some(err_val) = value.get("error") {
                                        let msg = err_val
                                            .as_str()
                                            .map(|s| s.to_string())
                                            .or_else(|| err_val.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
                                            .unwrap_or_else(|| err_val.to_string());
                                        events.push(Ok(StreamEvent::Error(msg)));
                                        continue;
                                    }

                                    if let Some(usage_val) = value.get("usage") {
                                        if let Ok(u) = serde_json::from_value::<Usage>(usage_val.clone()) {
                                            final_usage = Some(u);
                                        }
                                    }

                                    if let Some(content) = value
                                        .get("choices")
                                        .and_then(|c| c.as_array())
                                        .and_then(|c| c.first())
                                        .and_then(|c| c.get("delta"))
                                        .and_then(|d| d.get("content"))
                                        .and_then(|c| c.as_str())
                                    {
                                        if !content.is_empty() {
                                            received_content = true;
                                            events.push(Ok(StreamEvent::Delta(content.to_string())));
                                        }
                                    }
                                }
                            }
                        }

                        events
                    }
                }
            })
            .flat_map(stream::iter)
    };

    Ok(Box::pin(event_stream))
}
