use serde::{Deserialize, Serialize};

// ============================================================
// FRONTEND → WORKER (Request Body)
// ============================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub message: String,
    pub model: String,
    pub trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    pub history: Option<Vec<Message>>,
    pub private_mode: Option<bool>,
    #[serde(default = "default_stream")]
    pub stream: bool,
}

fn default_stream() -> bool {
    false
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
}

// ============================================================
// WORKER → KI-API (Outgoing Request)
// ============================================================

#[derive(Debug, Serialize)]
pub struct AiApiRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub stream: bool,
}

// ============================================================
// KI-API → WORKER (Response)
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AiApiResponse {
    pub choices: Option<Vec<Choice>>,
    pub usage: Option<Usage>,
    pub response: Option<String>,
    pub source: Option<serde_json::Value>,
    pub sources: Option<Vec<serde_json::Value>>,
    pub tool_calls: Option<Vec<serde_json::Value>>,
    pub error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: ChoiceMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChoiceMessage {
    pub content: Option<String>,
    pub reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Usage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

// ============================================================
// WORKER → FRONTEND (Response Body)
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub response: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub model: String,
    pub token_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
}

// ============================================================
// SSE STREAMING TYPES
// ============================================================

/// Events emitted by the streaming AI client
#[derive(Debug)]
pub enum StreamEvent {
    Delta(String),
    Sources(Vec<serde_json::Value>),
    Done {
        model: String,
        usage: Option<Usage>,
    },
    Error(String),
}

/// SSE "delta" event data sent to the widget
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SseDeltaData {
    pub content: String,
}

/// SSE "done" event data sent to the widget
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SseDoneData {
    pub trace_id: String,
    pub session_id: String,
    pub model: String,
    pub token_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u32>,
}

/// SSE "sources" event data sent to the widget
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SseSourcesData {
    pub sources: Vec<serde_json::Value>,
}

/// SSE "error" event data sent to the widget
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SseErrorData {
    pub error: String,
}