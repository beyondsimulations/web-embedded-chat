mod ai_client;
mod auth;
mod client_ip;
mod config;
mod dto;
mod error;
mod rate_limit;
mod routes;
mod telemetry;
mod tracking;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, Method};
use axum::routing::{get, post};
use axum::response::{IntoResponse, Redirect};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::{Json, Router};
use futures::stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tower_sessions::cookie::SameSite;
use tower_sessions::{Expiry, SessionManagerLayer};
use tower_sessions_memory_store::MemoryStore;

use crate::ai_client::{send_chat_request, send_chat_request_streaming};
use crate::config::Config;
use crate::dto::{ChatRequest, StreamEvent, SseDeltaData, SseDoneData, SseSourcesData, SseErrorData};
use crate::error::AppError;
use crate::rate_limit::rate_limit_middleware;
use crate::routes::telemetry_routes;
use crate::telemetry::{DbClient, ChatbotLogger, TelemetryContext, init_tracing};
use crate::tracking::hash_user_id;

#[tokio::main]
async fn main() {
    init_tracing();

    let config = Config::from_env().await.unwrap();
    let shared_config = Arc::new(config.clone());

    let cors = CorsLayer::new()
        .allow_origin(
            config
                .allowed_origins
                .iter()
                .map(|origin| origin.parse().unwrap())
                .collect::<Vec<_>>(),
        )
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // In-memory session store — sessions lost on restart (you just log in again)
    let session_store = MemoryStore::default();
    let secure_cookies = std::env::var("SECURE_COOKIES").unwrap_or_default() != "false";
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(secure_cookies)
        .with_same_site(if secure_cookies { SameSite::Strict } else { SameSite::Lax })
        .with_http_only(true)
        .with_expiry(Expiry::OnInactivity(time::Duration::hours(8)));

    // Public: chat endpoint with CORS + rate limiting
    let chat_routes = Router::new()
        .route("/chat", post(chat_request_handler))
        .layer(axum::middleware::from_fn(rate_limit_middleware))
        .layer(cors);

    // Public routes (no auth required)
    let auth_routes = Router::new()
        .route("/", get(|| async { Redirect::permanent("/login") }))
        .route("/health", get(|| async { Json(serde_json::json!({"status": "ok"})) }))
        .route("/login", get(auth::login_page).post(auth::login_handler))
        .route("/logout", get(auth::logout_handler));

    // Protected: telemetry dashboard + API
    let protected_routes = telemetry_routes()
        .route_layer(axum::middleware::from_fn(auth::require_auth));

    let app = Router::new()
        .merge(chat_routes)
        .merge(auth_routes)
        .merge(protected_routes)
        .layer(session_layer)
        .with_state(shared_config);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl+c");
    tracing::info!("Shutdown signal received, draining connections...");
}

async fn chat_request_handler(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(config): State<Arc<Config>>,
    headers: HeaderMap,
    Json(payload): Json<ChatRequest>,
) -> Result<axum::response::Response, AppError> {
    if payload.message.is_empty() {
        return Err(AppError::BadRequest("message cannot be empty".to_string()));
    }

    let session_id = payload
        .session_id
        .clone()
        .unwrap_or_else(|| format!("session-{}", uuid::Uuid::new_v4()));

    let client_ip = client_ip::resolve_client_ip(&headers, &addr);
    let user_id = hash_user_id(client_ip);
    let service_name = payload.model.clone();

    let mut context = TelemetryContext::new(session_id.clone())
        .with_user(user_id);

    if let Some(tid) = &payload.trace_id {
        context.trace_id = tid.clone();
    }
    if let Some(cid) = &payload.conversation_id {
        context = context.with_conversation(cid.clone());
    }

    let logger = config.db.as_ref().map(|pool| {
        ChatbotLogger::new(Arc::new(DbClient::new(pool.clone())))
    });

    // Log user message (redact content in private mode)
    if let Some(logger) = &logger {
        let log_content = if payload.private_mode.unwrap_or(false) {
            "[private]"
        } else {
            &payload.message
        };
        let _ = logger
            .log_user_message(&context, log_content, &service_name)
            .await;
    }

    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let is_streaming = payload.stream;

    // ── Non-streaming path (unchanged) ──────────────────────
    if !is_streaming {
        let start_time = Instant::now();
        let result = send_chat_request(&config, payload, origin).await;
        let latency_ms = start_time.elapsed().as_millis() as i32;

        match result {
            Ok(mut response) => {
                if let Some(logger) = &logger {
                    let mut attrs = serde_json::Map::new();
                    if let Some(ref thinking) = response.reasoning_content {
                        attrs.insert("thinking".to_string(), serde_json::Value::String(thinking.clone()));
                    }
                    if let Some(ref tc) = response.tool_calls {
                        if !tc.is_empty() {
                            attrs.insert("tool_calls".to_string(), serde_json::Value::Array(tc.clone()));
                        }
                    }
                    let attributes = if attrs.is_empty() { None } else { Some(serde_json::Value::Object(attrs)) };

                    if let Err(e) = logger
                        .log_assistant_message(
                            &context,
                            &response.response,
                            None,
                            Some(response.model.clone()),
                            Some(latency_ms),
                            None, // time_to_first_token_ms
                            Some(response.token_count),
                            &service_name,
                            attributes,
                        )
                        .await
                    {
                        tracing::warn!("Failed to log assistant message (non-fatal): {e}");
                    }
                }

                response.trace_id = Some(context.trace_id);
                response.session_id = Some(session_id);
                Ok(Json(response).into_response())
            }
            Err(err) => {
                if let Some(logger) = &logger {
                    let _ = logger
                        .log_error(&context, &err.to_string(), None, &service_name)
                        .await;
                }
                Err(err)
            }
        }
    } else {
        // ── Streaming path ──────────────────────────────────────
        let start_time = Instant::now();
        let event_stream = send_chat_request_streaming(&config, payload, origin).await?;

        let trace_id = context.trace_id.clone();
        let session_id_clone = session_id.clone();
        let service_name_clone = service_name.clone();

        // Shared mutable state for the stream
        let mut accumulated_content = String::new();
        let mut first_token_time: Option<Instant> = None;

        let sse_stream = event_stream.map(move |event_result| -> Result<Event, std::convert::Infallible> {
            match event_result {
                Ok(StreamEvent::Delta(content)) => {
                    if first_token_time.is_none() {
                        first_token_time = Some(Instant::now());
                    }
                    accumulated_content.push_str(&content);
                    let data = SseDeltaData { content };
                    Ok(Event::default()
                        .event("delta")
                        .json_data(data)
                        .unwrap_or_else(|_| Event::default().event("delta").data("{}")))
                }
                Ok(StreamEvent::Sources(sources)) => {
                    let data = SseSourcesData { sources };
                    Ok(Event::default()
                        .event("sources")
                        .json_data(data)
                        .unwrap_or_else(|_| Event::default().event("sources").data("{}")))
                }
                Ok(StreamEvent::Done { model, usage }) => {
                    let total_latency_ms = start_time.elapsed().as_millis() as i32;
                    let ttft_ms = first_token_time
                        .map(|t| (t - start_time).as_millis() as i32);

                    let total_tokens = usage.as_ref()
                        .and_then(|u| u.total_tokens).unwrap_or(0) as i32;
                    let prompt_tokens = usage.as_ref().and_then(|u| u.prompt_tokens);
                    let completion_tokens = usage.as_ref().and_then(|u| u.completion_tokens);

                    let done_data = SseDoneData {
                        trace_id: trace_id.clone(),
                        session_id: session_id_clone.clone(),
                        model: model.clone(),
                        token_count: total_tokens,
                        prompt_tokens,
                        completion_tokens,
                    };

                    // Spawn telemetry logging in background
                    if let Some(ref logger) = logger {
                        let log_logger = ChatbotLogger::new(logger.db_client.clone());
                        let log_context_trace = trace_id.clone();
                        let log_context_session = session_id_clone.clone();
                        let log_context_user = context.user_id.clone();
                        let log_context_conversation = context.conversation_id.clone();
                        let log_content = accumulated_content.clone();
                        let log_model = model.clone();
                        let log_service = service_name_clone.clone();

                        tokio::spawn(async move {
                            let ctx = TelemetryContext {
                                trace_id: log_context_trace,
                                session_id: log_context_session,
                                conversation_id: log_context_conversation,
                                user_id: log_context_user,
                            };
                            if let Err(e) = log_logger
                                .log_assistant_message(
                                    &ctx,
                                    &log_content,
                                    None,
                                    Some(log_model),
                                    Some(total_latency_ms),
                                    ttft_ms,
                                    Some(total_tokens),
                                    &log_service,
                                    None,
                                )
                                .await
                            {
                                tracing::warn!("Failed to log streaming assistant message: {e}");
                            }
                        });
                    }

                    Ok(Event::default()
                        .event("done")
                        .json_data(done_data)
                        .unwrap_or_else(|_| Event::default().event("done").data("{}")))
                }
                Ok(StreamEvent::Error(msg)) => {
                    // Log error in background
                    if let Some(ref logger) = logger {
                        let log_logger = ChatbotLogger::new(logger.db_client.clone());
                        let err_trace = trace_id.clone();
                        let err_session = session_id_clone.clone();
                        let err_user = context.user_id.clone();
                        let err_conversation = context.conversation_id.clone();
                        let err_msg = msg.clone();
                        let err_service = service_name_clone.clone();

                        tokio::spawn(async move {
                            let ctx = TelemetryContext {
                                trace_id: err_trace,
                                session_id: err_session,
                                conversation_id: err_conversation,
                                user_id: err_user,
                            };
                            let _ = log_logger.log_error(&ctx, &err_msg, None, &err_service).await;
                        });
                    }

                    let data = SseErrorData { error: msg };
                    Ok(Event::default()
                        .event("error")
                        .json_data(data)
                        .unwrap_or_else(|_| Event::default().event("error").data("{}")))
                }
                Err(e) => {
                    let data = SseErrorData { error: e.to_string() };
                    Ok(Event::default()
                        .event("error")
                        .json_data(data)
                        .unwrap_or_else(|_| Event::default().event("error").data("{}")))
                }
            }
        });

        Ok(Sse::new(sse_stream)
            .keep_alive(KeepAlive::default())
            .into_response())
    }
}
