use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChatbotLog {
    pub id: Option<Uuid>,
    pub trace_id: String,
    pub span_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_span_id: Option<String>,

    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i32>,

    #[serde(default = "default_service_name")]
    pub service_name: String,
    #[serde(default = "default_severity")]
    pub severity_level: SeverityLevel,

    pub message_direction: MessageDirection,
    pub message_content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_version: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<i32>,

    #[serde(default)]
    pub attributes: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack_trace: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "message_direction", rename_all = "lowercase")]
pub enum MessageDirection {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[serde(rename_all = "UPPERCASE")]
#[sqlx(type_name = "severity_level", rename_all = "UPPERCASE")]
pub enum SeverityLevel {
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

impl std::str::FromStr for SeverityLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "DEBUG" => Ok(SeverityLevel::Debug),
            "INFO" => Ok(SeverityLevel::Info),
            "WARN" => Ok(SeverityLevel::Warn),
            "ERROR" => Ok(SeverityLevel::Error),
            "FATAL" => Ok(SeverityLevel::Fatal),
            other => Err(format!("unknown severity level: {other}")),
        }
    }
}

// ── Query types ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity_level: Option<SeverityLevel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_time: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<DateTime<Utc>>,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default)]
    pub offset: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
    pub trace_id: String,
    pub user_id: Option<String>,
    pub model_name: Option<String>,
    pub started_at: DateTime<Utc>,
    pub last_message_at: DateTime<Utc>,
    pub message_count: i64,
    pub user_messages: i64,
    pub assistant_messages: i64,
    pub avg_latency_ms: Option<f64>,
    pub total_tokens: Option<i64>,
}

// ── Analytics response types ──────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UsageTimeSeries {
    pub period: String,
    pub message_count: i64,
    pub token_total: i64,
    pub unique_users: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsageStats {
    pub model_name: Option<String>,
    pub message_count: i64,
    pub token_total: i64,
    pub avg_latency_ms: Option<f64>,
    pub conversation_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyStats {
    pub percentiles: LatencyPercentiles,
    pub histogram: Vec<LatencyBucket>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LatencyPercentiles {
    pub p50: Option<f64>,
    pub p90: Option<f64>,
    pub p95: Option<f64>,
    pub p99: Option<f64>,
    pub avg: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LatencyBucket {
    pub bucket: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtftStats {
    pub percentiles: LatencyPercentiles,
    pub histogram: Vec<LatencyBucket>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapCell {
    pub day_of_week: i32,
    pub hour_of_day: i32,
    pub message_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserEngagement {
    pub total_conversations: i64,
    pub total_unique_users: i64,
    pub returning_users: i64,
    pub avg_messages_per_conversation: f64,
    pub median_messages_per_conversation: f64,
    pub avg_conversation_duration_seconds: f64,
    pub messages_per_conversation_distribution: Vec<BucketCount>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BucketCount {
    pub bucket: String,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ErrorTimeSeries {
    pub period: String,
    pub error_count: i64,
    pub total_count: i64,
    pub error_rate: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub results: Vec<ChatbotLog>,
    pub total_count: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AggregateStats {
    pub total_conversations: i64,
    pub total_messages: i64,
    pub unique_users: i64,
    pub total_tokens: i64,
    pub avg_latency_ms: Option<f64>,
    pub error_count: i64,
}

fn default_service_name() -> String {
    "chatbot-service".to_string()
}

fn default_severity() -> SeverityLevel {
    SeverityLevel::Info
}

fn default_limit() -> i32 {
    100
}

impl ChatbotLog {
    pub fn new_user_message(
        session_id: String,
        message: String,
        trace_id: String,
        span_id: String,
        service_name: String,
    ) -> Self {
        Self {
            id: None,
            trace_id,
            span_id,
            parent_span_id: None,
            timestamp: Utc::now(),
            duration_ms: None,
            service_name,
            severity_level: SeverityLevel::Info,
            message_direction: MessageDirection::User,
            message_content: message,
            user_id: None,
            session_id,
            conversation_id: None,
            model_name: None,
            model_version: None,
            token_count: None,
            latency_ms: None,
            attributes: serde_json::json!({}),
            error_message: None,
            stack_trace: None,
            created_at: None,
            updated_at: None,
        }
    }

    pub fn new_assistant_message(
        session_id: String,
        message: String,
        trace_id: String,
        span_id: String,
        parent_span_id: Option<String>,
        service_name: String,
        model_name: Option<String>,
        latency_ms: Option<i32>,
        token_count: Option<i32>,
    ) -> Self {
        Self {
            id: None,
            trace_id,
            span_id,
            parent_span_id,
            timestamp: Utc::now(),
            duration_ms: None,
            service_name,
            severity_level: SeverityLevel::Info,
            message_direction: MessageDirection::Assistant,
            message_content: message,
            user_id: None,
            session_id,
            conversation_id: None,
            model_name,
            model_version: None,
            token_count,
            latency_ms,
            attributes: serde_json::json!({}),
            error_message: None,
            stack_trace: None,
            created_at: None,
            updated_at: None,
        }
    }
}
