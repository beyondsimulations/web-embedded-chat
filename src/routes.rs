use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get},
    Json, Router,
};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use axum::http::HeaderValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::config::Config;
use crate::telemetry::models::{
    AggregateStats, ChatbotLog, ConversationSummary, ErrorTimeSeries, HeatmapCell, LatencyStats,
    LogQuery, ModelUsageStats, SearchResults, TtftStats, UsageTimeSeries, UserEngagement,
};
use crate::error::AppError;
use crate::telemetry::DbClient;

pub fn telemetry_routes() -> Router<Arc<Config>> {
    let api_routes = Router::new()
        .route("/api/telemetry/logs", get(get_logs).post(batch_insert_logs))
        .route("/api/telemetry/logs/cleanup", delete(cleanup_logs))
        .route("/api/telemetry/trace/{trace_id}", get(get_trace_logs).delete(delete_trace))
        .route("/api/telemetry/session/{session_id}", get(get_session_logs))
        .route("/api/telemetry/conversations", get(get_conversations))
        .route("/api/telemetry/stats/overview", get(get_overview_stats))
        .route("/api/telemetry/stats/usage", get(get_usage_over_time))
        .route("/api/telemetry/stats/models", get(get_model_usage))
        .route("/api/telemetry/stats/latency", get(get_latency_stats))
        .route("/api/telemetry/stats/ttft", get(get_ttft_stats))
        .route("/api/telemetry/stats/heatmap", get(get_peak_hours))
        .route("/api/telemetry/stats/engagement", get(get_user_engagement))
        .route("/api/telemetry/stats/errors", get(get_error_rate))
        .route("/api/telemetry/search", get(search_logs))
        .route("/api/telemetry/export", get(export_logs));

    let static_files = Router::new()
        .nest_service(
            "/telemetry",
            ServeDir::new("static").precompressed_br().precompressed_gzip(),
        )
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=3600"),
        ));

    api_routes.merge(static_files)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogQueryParams {
    session_id: Option<String>,
    user_id: Option<String>,
    conversation_id: Option<String>,
    severity_level: Option<String>,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    search: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
}

fn get_db_client(config: &Config) -> Result<DbClient, AppError> {
    let pool = config
        .db
        .as_ref()
        .ok_or_else(|| AppError::InternalServerError("Database not configured".to_string()))?;
    Ok(DbClient::new(pool.clone()))
}

async fn get_logs(
    State(config): State<Arc<Config>>,
    Query(params): Query<LogQueryParams>,
) -> Result<Json<Vec<ChatbotLog>>, AppError> {
    let db = get_db_client(&config)?;

    if let Some(ref search_query) = params.search {
        if !search_query.is_empty() {
            let results = db.search_logs(search_query, 1, params.limit.unwrap_or(100)).await?;
            return Ok(Json(results.results));
        }
    }

    let severity = params.severity_level.and_then(|s| s.parse().ok());

    let query = LogQuery {
        session_id: params.session_id,
        user_id: params.user_id,
        conversation_id: params.conversation_id,
        severity_level: severity,
        start_time: params.start_time,
        end_time: params.end_time,
        limit: params.limit.unwrap_or(100),
        offset: params.offset.unwrap_or(0),
    };

    let logs = db.query_logs(&query).await?;
    Ok(Json(logs))
}

async fn get_trace_logs(
    State(config): State<Arc<Config>>,
    Path(trace_id): Path<String>,
) -> Result<Json<Vec<ChatbotLog>>, AppError> {
    let db = get_db_client(&config)?;
    let logs = db.get_logs_by_trace(&trace_id).await?;
    Ok(Json(logs))
}

async fn delete_trace(
    State(config): State<Arc<Config>>,
    Path(trace_id): Path<String>,
) -> Result<Json<CleanupResponse>, AppError> {
    let db = get_db_client(&config)?;
    let deleted = db.delete_logs_by_trace(&trace_id).await?;
    Ok(Json(CleanupResponse { deleted }))
}

async fn get_session_logs(
    State(config): State<Arc<Config>>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<ChatbotLog>>, AppError> {
    let db = get_db_client(&config)?;
    let logs = db.get_session_logs(&session_id).await?;
    Ok(Json(logs))
}

async fn get_conversations(
    State(config): State<Arc<Config>>,
    Query(params): Query<LogQueryParams>,
) -> Result<Json<Vec<ConversationSummary>>, AppError> {
    let db = get_db_client(&config)?;
    let limit = params.limit.unwrap_or(50) as i64;
    let summaries = db.get_recent_conversations(limit).await?;
    Ok(Json(summaries))
}

#[derive(Deserialize)]
struct CleanupParams {
    before: DateTime<Utc>,
}

#[derive(Serialize)]
struct CleanupResponse {
    deleted: u64,
}

async fn cleanup_logs(
    State(config): State<Arc<Config>>,
    Query(params): Query<CleanupParams>,
) -> Result<Json<CleanupResponse>, AppError> {
    let db = get_db_client(&config)?;
    let deleted = db.delete_logs_before(params.before).await?;
    Ok(Json(CleanupResponse { deleted }))
}

async fn batch_insert_logs(
    State(config): State<Arc<Config>>,
    Json(logs): Json<Vec<ChatbotLog>>,
) -> Result<Json<BatchInsertResponse>, AppError> {
    let db = get_db_client(&config)?;
    let count = logs.len();
    db.insert_logs_batch(&logs).await?;
    Ok(Json(BatchInsertResponse { inserted: count }))
}

#[derive(Serialize)]
struct BatchInsertResponse {
    inserted: usize,
}

// ── Analytics endpoints ───────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeRangeParams {
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
    granularity: Option<String>,
}

fn validate_granularity(g: &Option<String>) -> Result<String, AppError> {
    let granularity = g.as_deref().unwrap_or("day");
    match granularity {
        "day" | "week" | "month" => Ok(granularity.to_string()),
        _ => Err(AppError::BadRequest(
            "granularity must be 'day', 'week', or 'month'".to_string(),
        )),
    }
}

fn default_time_range(
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> (DateTime<Utc>, DateTime<Utc>) {
    let end = end.unwrap_or_else(Utc::now);
    let start = start.unwrap_or_else(|| end - chrono::Duration::days(30));
    (start, end)
}

async fn get_overview_stats(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<AggregateStats>, AppError> {
    let db = get_db_client(&config)?;
    let stats = db.get_aggregate_stats(params.start, params.end).await?;
    Ok(Json(stats))
}

async fn get_usage_over_time(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<Vec<UsageTimeSeries>>, AppError> {
    let db = get_db_client(&config)?;
    let granularity = validate_granularity(&params.granularity)?;
    let (start, end) = default_time_range(params.start, params.end);
    let rows = db.get_usage_over_time(&granularity, start, end).await?;
    Ok(Json(rows))
}

async fn get_model_usage(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<Vec<ModelUsageStats>>, AppError> {
    let db = get_db_client(&config)?;
    let rows = db.get_model_usage(params.start, params.end).await?;
    Ok(Json(rows))
}

async fn get_latency_stats(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<LatencyStats>, AppError> {
    let db = get_db_client(&config)?;
    let stats = db.get_latency_stats(params.start, params.end).await?;
    Ok(Json(stats))
}

async fn get_ttft_stats(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<TtftStats>, AppError> {
    let db = get_db_client(&config)?;
    let stats = db.get_ttft_stats(params.start, params.end).await?;
    Ok(Json(stats))
}

async fn get_peak_hours(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<Vec<HeatmapCell>>, AppError> {
    let db = get_db_client(&config)?;
    let rows = db.get_peak_hours(params.start, params.end).await?;
    Ok(Json(rows))
}

async fn get_user_engagement(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<UserEngagement>, AppError> {
    let db = get_db_client(&config)?;
    let engagement = db.get_user_engagement(params.start, params.end).await?;
    Ok(Json(engagement))
}

async fn get_error_rate(
    State(config): State<Arc<Config>>,
    Query(params): Query<TimeRangeParams>,
) -> Result<Json<Vec<ErrorTimeSeries>>, AppError> {
    let db = get_db_client(&config)?;
    let granularity = validate_granularity(&params.granularity)?;
    let (start, end) = default_time_range(params.start, params.end);
    let rows = db.get_error_rate(&granularity, start, end).await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchParams {
    q: String,
    page: Option<i32>,
    page_size: Option<i32>,
}

async fn search_logs(
    State(config): State<Arc<Config>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResults>, AppError> {
    let db = get_db_client(&config)?;
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(50).min(200);
    let results = db.search_logs(&params.q, page, page_size).await?;
    Ok(Json(results))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportParams {
    format: Option<String>,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
    model_name: Option<String>,
    user_id: Option<String>,
}

async fn export_logs(
    State(config): State<Arc<Config>>,
    Query(params): Query<ExportParams>,
) -> Result<Response, AppError> {
    let db = get_db_client(&config)?;
    let logs = db
        .export_logs(
            params.start,
            params.end,
            params.model_name.as_deref(),
            params.user_id.as_deref(),
        )
        .await?;

    let format = params.format.as_deref().unwrap_or("json");

    match format {
        "csv" => {
            let mut wtr = csv::Writer::from_writer(vec![]);
            wtr.write_record([
                "timestamp",
                "trace_id",
                "session_id",
                "user_id",
                "message_direction",
                "message_content",
                "model_name",
                "token_count",
                "latency_ms",
                "severity_level",
            ])
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            for log in &logs {
                wtr.write_record([
                    log.timestamp.to_rfc3339(),
                    log.trace_id.clone(),
                    log.session_id.clone(),
                    log.user_id.clone().unwrap_or_default(),
                    format!("{:?}", log.message_direction),
                    log.message_content.clone(),
                    log.model_name.clone().unwrap_or_default(),
                    log.token_count.map(|t| t.to_string()).unwrap_or_default(),
                    log.latency_ms.map(|l| l.to_string()).unwrap_or_default(),
                    format!("{:?}", log.severity_level),
                ])
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            }

            let csv_bytes = wtr
                .into_inner()
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            Ok((
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "text/csv"),
                    (
                        header::CONTENT_DISPOSITION,
                        "attachment; filename=\"telemetry-export.csv\"",
                    ),
                ],
                csv_bytes,
            )
                .into_response())
        }
        _ => {
            let json = serde_json::to_vec(&logs)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            Ok((
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "application/json"),
                    (
                        header::CONTENT_DISPOSITION,
                        "attachment; filename=\"telemetry-export.json\"",
                    ),
                ],
                json,
            )
                .into_response())
        }
    }
}
