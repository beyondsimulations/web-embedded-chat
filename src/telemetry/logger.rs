use crate::telemetry::database::DbClient;
use crate::telemetry::models::{ChatbotLog, SeverityLevel};
use std::sync::Arc;
use tracing::subscriber::set_global_default;
use tracing::{error, info};
use tracing_subscriber::{Registry, layer::SubscriberExt, EnvFilter, fmt};
use uuid::Uuid;

/// OpenTelemetry context for a chatbot conversation
pub struct TelemetryContext {
    pub trace_id: String,
    pub session_id: String,
    pub conversation_id: Option<String>,
    pub user_id: Option<String>,
}

impl TelemetryContext {
    pub fn new(session_id: String) -> Self {
        Self {
            trace_id: generate_trace_id(),
            session_id,
            conversation_id: None,
            user_id: None,
        }
    }

    pub fn with_user(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }

    pub fn with_conversation(mut self, conversation_id: String) -> Self {
        self.conversation_id = Some(conversation_id);
        self
    }
}

/// Logger that integrates with OpenTelemetry and PostgreSQL
pub struct ChatbotLogger {
    pub db_client: Arc<DbClient>,
}

impl ChatbotLogger {
    pub fn new(db_client: Arc<DbClient>) -> Self {
        Self { db_client }
    }

    pub async fn log_user_message(
        &self,
        context: &TelemetryContext,
        message: &str,
        service_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let span_id = generate_span_id();

        info!(
            trace_id = %context.trace_id,
            span_id = %span_id,
            session_id = %context.session_id,
            "User message received"
        );

        let mut log = ChatbotLog::new_user_message(
            context.session_id.clone(),
            message.to_string(),
            context.trace_id.clone(),
            span_id,
            service_name.to_string(),
        );

        log.user_id = context.user_id.clone();
        log.conversation_id = context.conversation_id.clone();

        self.db_client.insert_log(&log).await?;
        Ok(())
    }

    pub async fn log_assistant_message(
        &self,
        context: &TelemetryContext,
        message: &str,
        parent_span_id: Option<String>,
        model_name: Option<String>,
        latency_ms: Option<i32>,
        time_to_first_token_ms: Option<i32>,
        token_count: Option<i32>,
        service_name: &str,
        attributes: Option<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let span_id = generate_span_id();

        info!(
            trace_id = %context.trace_id,
            span_id = %span_id,
            parent_span_id = ?parent_span_id,
            session_id = %context.session_id,
            latency_ms = ?latency_ms,
            time_to_first_token_ms = ?time_to_first_token_ms,
            tokens = ?token_count,
            "Assistant response generated"
        );

        let mut log = ChatbotLog::new_assistant_message(
            context.session_id.clone(),
            message.to_string(),
            context.trace_id.clone(),
            span_id,
            parent_span_id,
            service_name.to_string(),
            model_name,
            latency_ms,
            token_count,
        );

        log.user_id = context.user_id.clone();
        log.conversation_id = context.conversation_id.clone();

        // Store TTFT in attributes JSONB
        let mut attrs = match attributes {
            Some(serde_json::Value::Object(m)) => m,
            _ => serde_json::Map::new(),
        };
        if let Some(ttft) = time_to_first_token_ms {
            attrs.insert("time_to_first_token_ms".to_string(), serde_json::Value::Number(ttft.into()));
        }
        if !attrs.is_empty() {
            log.attributes = serde_json::Value::Object(attrs);
        }

        self.db_client.insert_log(&log).await?;
        Ok(())
    }

    pub async fn log_error(
        &self,
        context: &TelemetryContext,
        error_msg: &str,
        stack_trace: Option<String>,
        service_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let span_id = generate_span_id();

        error!(
            trace_id = %context.trace_id,
            span_id = %span_id,
            session_id = %context.session_id,
            error = %error_msg,
            "Error occurred"
        );

        let mut log = ChatbotLog::new_user_message(
            context.session_id.clone(),
            error_msg.to_string(),
            context.trace_id.clone(),
            span_id,
            service_name.to_string(),
        );

        log.severity_level = SeverityLevel::Error;
        log.error_message = Some(error_msg.to_string());
        log.stack_trace = stack_trace;
        log.user_id = context.user_id.clone();
        log.conversation_id = context.conversation_id.clone();

        self.db_client.insert_log(&log).await?;
        Ok(())
    }
}

/// Generate a trace ID (32 hex characters)
pub fn generate_trace_id() -> String {
    format!("{:032x}", Uuid::new_v4().as_u128())
}

/// Generate a span ID (16 hex characters)
pub fn generate_span_id() -> String {
    format!("{:016x}", Uuid::new_v4().as_u128() & 0xFFFFFFFFFFFFFFFF)
}

/// Initialize tracing
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let fmt_layer = fmt::layer().pretty();
    let subscriber = Registry::default().with(filter).with(fmt_layer);
    set_global_default(subscriber).expect("Failed to set global tracing subscriber");
}
