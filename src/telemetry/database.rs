use crate::telemetry::models::{
    AggregateStats, BucketCount, ChatbotLog, ConversationSummary, ErrorTimeSeries, HeatmapCell,
    LatencyBucket, LatencyPercentiles, LatencyStats, LogQuery, ModelUsageStats, SearchResults,
    TtftStats, UsageTimeSeries, UserEngagement,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;

macro_rules! select_logs {
    ($where_and_rest:expr) => {
        concat!(
            "SELECT id, trace_id, span_id, parent_span_id, timestamp, duration_ms, ",
            "service_name, severity_level, message_direction, message_content, ",
            "user_id, session_id, conversation_id, model_name, model_version, ",
            "token_count, latency_ms, attributes, error_message, stack_trace, ",
            "created_at, updated_at ",
            "FROM chatbot_logs ",
            $where_and_rest
        )
    };
}

fn granularity_to_interval(granularity: &str) -> &str {
    match granularity {
        "hour" => "1 hour",
        "day" => "1 day",
        "week" => "1 week",
        "month" => "1 month",
        _ => "1 day",
    }
}

pub struct DbClient {
    pool: PgPool,
}

impl DbClient {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── Core CRUD ─────────────────────────────────────────────

    pub async fn insert_log(&self, log: &ChatbotLog) -> Result<ChatbotLog, sqlx::Error> {
        let inserted = sqlx::query_as::<_, ChatbotLog>(
            r#"INSERT INTO chatbot_logs
                (trace_id, span_id, parent_span_id, timestamp, duration_ms,
                 service_name, severity_level, message_direction, message_content,
                 user_id, session_id, conversation_id, model_name, model_version,
                 token_count, latency_ms, attributes, error_message, stack_trace)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *"#,
        )
        .bind(&log.trace_id)
        .bind(&log.span_id)
        .bind(&log.parent_span_id)
        .bind(log.timestamp)
        .bind(log.duration_ms)
        .bind(&log.service_name)
        .bind(&log.severity_level)
        .bind(&log.message_direction)
        .bind(&log.message_content)
        .bind(&log.user_id)
        .bind(&log.session_id)
        .bind(&log.conversation_id)
        .bind(&log.model_name)
        .bind(&log.model_version)
        .bind(log.token_count)
        .bind(log.latency_ms)
        .bind(&log.attributes)
        .bind(&log.error_message)
        .bind(&log.stack_trace)
        .fetch_one(&self.pool)
        .await?;

        Ok(inserted)
    }

    pub async fn insert_logs_batch(&self, logs: &[ChatbotLog]) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        for log in logs {
            sqlx::query(
                r#"INSERT INTO chatbot_logs
                    (trace_id, span_id, parent_span_id, timestamp, duration_ms,
                     service_name, severity_level, message_direction, message_content,
                     user_id, session_id, conversation_id, model_name, model_version,
                     token_count, latency_ms, attributes, error_message, stack_trace)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)"#,
            )
            .bind(&log.trace_id)
            .bind(&log.span_id)
            .bind(&log.parent_span_id)
            .bind(log.timestamp)
            .bind(log.duration_ms)
            .bind(&log.service_name)
            .bind(&log.severity_level)
            .bind(&log.message_direction)
            .bind(&log.message_content)
            .bind(&log.user_id)
            .bind(&log.session_id)
            .bind(&log.conversation_id)
            .bind(&log.model_name)
            .bind(&log.model_version)
            .bind(log.token_count)
            .bind(log.latency_ms)
            .bind(&log.attributes)
            .bind(&log.error_message)
            .bind(&log.stack_trace)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn query_logs(&self, query: &LogQuery) -> Result<Vec<ChatbotLog>, sqlx::Error> {
        let severity_str = query.severity_level.as_ref().map(|s| format!("{:?}", s).to_uppercase());

        let logs = sqlx::query_as::<_, ChatbotLog>(
            select_logs!(
                "WHERE ($1::text IS NULL OR session_id = $1) \
                   AND ($2::text IS NULL OR user_id = $2) \
                   AND ($3::text IS NULL OR conversation_id = $3) \
                   AND ($5::timestamptz IS NULL OR timestamp >= $5) \
                   AND ($6::timestamptz IS NULL OR timestamp <= $6) \
                   AND ($7::text IS NULL OR severity_level::text = $7) \
                 ORDER BY timestamp DESC \
                 LIMIT $4 OFFSET $8"
            ),
        )
        .bind(&query.session_id)
        .bind(&query.user_id)
        .bind(&query.conversation_id)
        .bind(query.limit)
        .bind(query.start_time)
        .bind(query.end_time)
        .bind(&severity_str)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(logs)
    }

    pub async fn get_session_logs(
        &self,
        session_id: &str,
    ) -> Result<Vec<ChatbotLog>, sqlx::Error> {
        let logs = sqlx::query_as::<_, ChatbotLog>(
            select_logs!("WHERE session_id = $1 ORDER BY timestamp ASC"),
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(logs)
    }

    pub async fn get_logs_by_trace(
        &self,
        trace_id: &str,
    ) -> Result<Vec<ChatbotLog>, sqlx::Error> {
        let logs = sqlx::query_as::<_, ChatbotLog>(
            select_logs!("WHERE trace_id = $1 ORDER BY timestamp ASC"),
        )
        .bind(trace_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(logs)
    }

    pub async fn get_recent_conversations(
        &self,
        limit: i64,
    ) -> Result<Vec<ConversationSummary>, sqlx::Error> {
        let summaries = sqlx::query_as::<_, ConversationSummary>(
            r#"SELECT
                trace_id, user_id, model_name,
                started_at, last_message_at, message_count,
                user_messages, assistant_messages,
                avg_latency_ms, total_tokens
            FROM recent_conversations
            ORDER BY last_message_at DESC
            LIMIT $1"#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(summaries)
    }

    pub async fn delete_logs_by_trace(&self, trace_id: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM chatbot_logs WHERE trace_id = $1")
            .bind(trace_id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    pub async fn delete_logs_before(&self, before: DateTime<Utc>) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM chatbot_logs WHERE timestamp < $1")
            .bind(before)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    // ── Analytics ─────────────────────────────────────────────

    pub async fn get_aggregate_stats(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<AggregateStats, sqlx::Error> {
        let stats = sqlx::query_as::<_, AggregateStats>(
            r#"SELECT
                COUNT(DISTINCT trace_id)::bigint AS total_conversations,
                COUNT(*)::bigint AS total_messages,
                COUNT(DISTINCT user_id)::bigint AS unique_users,
                COALESCE(SUM(COALESCE(token_count, 0)), 0)::bigint AS total_tokens,
                AVG(latency_ms)::float8 AS avg_latency_ms,
                SUM(CASE WHEN severity_level IN ('ERROR', 'FATAL') THEN 1 ELSE 0 END)::bigint AS error_count
            FROM chatbot_logs
            WHERE ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)"#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await?;

        Ok(stats)
    }

    pub async fn get_usage_over_time(
        &self,
        granularity: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<UsageTimeSeries>, sqlx::Error> {
        let interval = granularity_to_interval(granularity);
        let rows = sqlx::query_as::<_, UsageTimeSeries>(
            r#"SELECT
                TO_CHAR(gs.period, 'YYYY-MM-DD') AS period,
                COALESCE(COUNT(cl.id), 0)::bigint AS message_count,
                COALESCE(SUM(COALESCE(cl.token_count, 0)), 0)::bigint AS token_total,
                COUNT(DISTINCT cl.user_id)::bigint AS unique_users
            FROM generate_series(
                date_trunc($1, $2::timestamptz),
                date_trunc($1, $3::timestamptz),
                $4::interval
            ) AS gs(period)
            LEFT JOIN chatbot_logs cl
                ON date_trunc($1, cl.timestamp) = gs.period
                AND cl.timestamp BETWEEN $2 AND $3
            GROUP BY gs.period
            ORDER BY gs.period ASC"#,
        )
        .bind(granularity)
        .bind(start)
        .bind(end)
        .bind(interval)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_model_usage(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<Vec<ModelUsageStats>, sqlx::Error> {
        let rows = sqlx::query_as::<_, ModelUsageStats>(
            r#"SELECT
                model_name,
                COUNT(*)::bigint AS message_count,
                COALESCE(SUM(COALESCE(token_count, 0)), 0)::bigint AS token_total,
                AVG(latency_ms)::float8 AS avg_latency_ms,
                COUNT(DISTINCT trace_id)::bigint AS conversation_count
            FROM chatbot_logs
            WHERE message_direction = 'assistant'
              AND ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)
            GROUP BY model_name
            ORDER BY message_count DESC"#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_latency_stats(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<LatencyStats, sqlx::Error> {
        let percentiles = sqlx::query_as::<_, LatencyPercentiles>(
            r#"SELECT
                (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms))::float8 AS p50,
                (PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency_ms))::float8 AS p90,
                (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms))::float8 AS p95,
                (PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms))::float8 AS p99,
                AVG(latency_ms)::float8 AS avg
            FROM chatbot_logs
            WHERE latency_ms IS NOT NULL
              AND ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)"#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await?;

        let histogram = sqlx::query_as::<_, LatencyBucket>(
            r#"SELECT
                CASE
                    WHEN latency_ms < 500 THEN '0-500'
                    WHEN latency_ms < 1000 THEN '500-1000'
                    WHEN latency_ms < 2000 THEN '1000-2000'
                    WHEN latency_ms < 5000 THEN '2000-5000'
                    WHEN latency_ms < 10000 THEN '5000-10000'
                    ELSE '10000+'
                END AS bucket,
                COUNT(*)::bigint AS count
            FROM chatbot_logs
            WHERE latency_ms IS NOT NULL
              AND ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)
            GROUP BY bucket
            ORDER BY MIN(latency_ms) ASC"#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await?;

        Ok(LatencyStats {
            percentiles,
            histogram,
        })
    }

    pub async fn get_ttft_stats(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<TtftStats, sqlx::Error> {
        let percentiles = sqlx::query_as::<_, LatencyPercentiles>(
            r#"SELECT
                (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (attributes->>'time_to_first_token_ms')::int))::float8 AS p50,
                (PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (attributes->>'time_to_first_token_ms')::int))::float8 AS p90,
                (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (attributes->>'time_to_first_token_ms')::int))::float8 AS p95,
                (PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (attributes->>'time_to_first_token_ms')::int))::float8 AS p99,
                AVG((attributes->>'time_to_first_token_ms')::int)::float8 AS avg
            FROM chatbot_logs
            WHERE attributes->>'time_to_first_token_ms' IS NOT NULL
              AND ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)"#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await?;

        let histogram = sqlx::query_as::<_, LatencyBucket>(
            r#"SELECT
                CASE
                    WHEN (attributes->>'time_to_first_token_ms')::int < 200 THEN '0-200'
                    WHEN (attributes->>'time_to_first_token_ms')::int < 500 THEN '200-500'
                    WHEN (attributes->>'time_to_first_token_ms')::int < 1000 THEN '500-1000'
                    WHEN (attributes->>'time_to_first_token_ms')::int < 2000 THEN '1000-2000'
                    WHEN (attributes->>'time_to_first_token_ms')::int < 5000 THEN '2000-5000'
                    ELSE '5000+'
                END AS bucket,
                COUNT(*)::bigint AS count
            FROM chatbot_logs
            WHERE attributes->>'time_to_first_token_ms' IS NOT NULL
              AND ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)
            GROUP BY bucket
            ORDER BY MIN((attributes->>'time_to_first_token_ms')::int) ASC"#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await?;

        Ok(TtftStats {
            percentiles,
            histogram,
        })
    }

    pub async fn get_peak_hours(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<Vec<HeatmapCell>, sqlx::Error> {
        let rows = sqlx::query_as::<_, HeatmapCell>(
            r#"SELECT
                EXTRACT(DOW FROM timestamp)::int AS day_of_week,
                EXTRACT(HOUR FROM timestamp)::int AS hour_of_day,
                COUNT(*)::bigint AS message_count
            FROM chatbot_logs
            WHERE ($1::timestamptz IS NULL OR timestamp >= $1)
              AND ($2::timestamptz IS NULL OR timestamp <= $2)
            GROUP BY day_of_week, hour_of_day
            ORDER BY day_of_week, hour_of_day"#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_user_engagement(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
    ) -> Result<UserEngagement, sqlx::Error> {
        let row = sqlx::query_as::<_, (i64, i64, i64, f64, f64, f64)>(
            r#"WITH conversations AS (
                SELECT
                    trace_id,
                    MAX(user_id) AS user_id,
                    COUNT(*) AS msg_count,
                    EXTRACT(EPOCH FROM MAX(timestamp) - MIN(timestamp)) AS duration_secs
                FROM chatbot_logs
                WHERE ($1::timestamptz IS NULL OR timestamp >= $1)
                  AND ($2::timestamptz IS NULL OR timestamp <= $2)
                GROUP BY trace_id
            )
            SELECT
                COUNT(*)::bigint AS total_conversations,
                COUNT(DISTINCT user_id)::bigint AS total_unique_users,
                (SELECT COUNT(*)::bigint FROM (
                    SELECT user_id FROM conversations GROUP BY user_id HAVING COUNT(*) > 1
                ) AS r) AS returning_users,
                COALESCE(AVG(msg_count), 0)::float8 AS avg_messages_per_conversation,
                COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY msg_count), 0)::float8 AS median_messages_per_conversation,
                COALESCE(AVG(duration_secs), 0)::float8 AS avg_conversation_duration_seconds
            FROM conversations"#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await?;

        let distribution = sqlx::query_as::<_, BucketCount>(
            r#"WITH conversations AS (
                SELECT trace_id, COUNT(*) AS msg_count
                FROM chatbot_logs
                WHERE ($1::timestamptz IS NULL OR timestamp >= $1)
                  AND ($2::timestamptz IS NULL OR timestamp <= $2)
                GROUP BY trace_id
            )
            SELECT
                CASE
                    WHEN msg_count = 1 THEN '1'
                    WHEN msg_count BETWEEN 2 AND 3 THEN '2-3'
                    WHEN msg_count BETWEEN 4 AND 5 THEN '4-5'
                    WHEN msg_count BETWEEN 6 AND 10 THEN '6-10'
                    ELSE '11+'
                END AS bucket,
                COUNT(*)::bigint AS count
            FROM conversations
            GROUP BY bucket
            ORDER BY MIN(msg_count) ASC"#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await?;

        Ok(UserEngagement {
            total_conversations: row.0,
            total_unique_users: row.1,
            returning_users: row.2,
            avg_messages_per_conversation: row.3,
            median_messages_per_conversation: row.4,
            avg_conversation_duration_seconds: row.5,
            messages_per_conversation_distribution: distribution,
        })
    }

    pub async fn get_error_rate(
        &self,
        granularity: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<ErrorTimeSeries>, sqlx::Error> {
        let interval = granularity_to_interval(granularity);
        let rows = sqlx::query_as::<_, ErrorTimeSeries>(
            r#"SELECT
                TO_CHAR(gs.period, 'YYYY-MM-DD') AS period,
                COALESCE(SUM(CASE WHEN cl.severity_level IN ('ERROR', 'FATAL') THEN 1 ELSE 0 END), 0)::bigint AS error_count,
                COALESCE(COUNT(cl.id), 0)::bigint AS total_count,
                (CASE WHEN COUNT(cl.id) > 0
                     THEN SUM(CASE WHEN cl.severity_level IN ('ERROR', 'FATAL') THEN 1 ELSE 0 END)::float8 / COUNT(cl.id)
                     ELSE 0.0
                END)::float8 AS error_rate
            FROM generate_series(
                date_trunc($1, $2::timestamptz),
                date_trunc($1, $3::timestamptz),
                $4::interval
            ) AS gs(period)
            LEFT JOIN chatbot_logs cl
                ON date_trunc($1, cl.timestamp) = gs.period
                AND cl.timestamp BETWEEN $2 AND $3
            GROUP BY gs.period
            ORDER BY gs.period ASC"#,
        )
        .bind(granularity)
        .bind(start)
        .bind(end)
        .bind(interval)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    // ── Search & Export ───────────────────────────────────────

    pub async fn search_logs(
        &self,
        query: &str,
        page: i32,
        page_size: i32,
    ) -> Result<SearchResults, sqlx::Error> {
        let offset = (page - 1) * page_size;

        let total_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::bigint FROM chatbot_logs WHERE message_content ILIKE '%' || $1 || '%'",
        )
        .bind(query)
        .fetch_one(&self.pool)
        .await?;

        let results = sqlx::query_as::<_, ChatbotLog>(
            select_logs!(
                "WHERE message_content ILIKE '%' || $1 || '%' \
                 ORDER BY timestamp DESC \
                 LIMIT $2 OFFSET $3"
            ),
        )
        .bind(query)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(SearchResults {
            results,
            total_count: total_count.0,
            page,
            page_size,
        })
    }

    pub async fn export_logs(
        &self,
        start: Option<DateTime<Utc>>,
        end: Option<DateTime<Utc>>,
        model_name: Option<&str>,
        user_id: Option<&str>,
    ) -> Result<Vec<ChatbotLog>, sqlx::Error> {
        let logs = sqlx::query_as::<_, ChatbotLog>(
            select_logs!(
                "WHERE ($1::timestamptz IS NULL OR timestamp >= $1) \
                   AND ($2::timestamptz IS NULL OR timestamp <= $2) \
                   AND ($3::text IS NULL OR model_name = $3) \
                   AND ($4::text IS NULL OR user_id = $4) \
                 ORDER BY timestamp DESC \
                 LIMIT 50000"
            ),
        )
        .bind(start)
        .bind(end)
        .bind(model_name)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(logs)
    }
}
