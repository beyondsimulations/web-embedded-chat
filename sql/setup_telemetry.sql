-- Setup for telemetry tables and views used by the ChatBotBackend
-- Creates table `chatbot_logs` and a `recent_conversations` view.
-- Safe to run multiple times (uses IF NOT EXISTS where possible).

-- Enable helpful extensions (pgcrypto provides gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- fallback if needed

-- Create custom enum types for message direction and severity
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
        CREATE TYPE message_direction AS ENUM ('user', 'assistant');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_level') THEN
        CREATE TYPE severity_level AS ENUM ('DEBUG','INFO','WARN','ERROR','FATAL');
    END IF;
END$$;

-- Create the main telemetry table
CREATE TABLE IF NOT EXISTS chatbot_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id text NOT NULL,
    span_id text NOT NULL,
    parent_span_id text NULL,
    timestamp timestamptz NOT NULL DEFAULT now(),
    duration_ms integer NULL,
    service_name text NOT NULL DEFAULT 'chatbot-service',
    severity_level severity_level NOT NULL DEFAULT 'INFO',
    message_direction message_direction NOT NULL,
    message_content text NOT NULL,
    user_id text NULL,
    session_id text NOT NULL,
    conversation_id text NULL,
    model_name text NULL,
    model_version text NULL,
    token_count integer NULL,
    latency_ms integer NULL,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message text NULL,
    stack_trace text NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL
);

-- Indexes to support common queries used by the app
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_trace_id ON chatbot_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_session_id ON chatbot_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_conversation_id ON chatbot_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_timestamp ON chatbot_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_user_id ON chatbot_logs(user_id);

-- A view that summarizes recent conversations (used by get_recent_conversations)
-- Groups by trace_id which is the reliable conversation identifier
-- (session_id was previously not persisted by the frontend widget)
DROP VIEW IF EXISTS recent_conversations;
CREATE VIEW recent_conversations AS
SELECT
    trace_id,
    MAX(user_id) AS user_id,
    MAX(model_name) AS model_name,
    MIN(timestamp) AS started_at,
    MAX(timestamp) AS last_message_at,
    COUNT(*)::bigint AS message_count,
    SUM(CASE WHEN message_direction = 'user' THEN 1 ELSE 0 END)::bigint AS user_messages,
    SUM(CASE WHEN message_direction = 'assistant' THEN 1 ELSE 0 END)::bigint AS assistant_messages,
    AVG(latency_ms)::float8 AS avg_latency_ms,
    SUM(COALESCE(token_count,0))::bigint AS total_tokens
FROM chatbot_logs
GROUP BY trace_id;

-- Add time_to_first_token_ms column (streaming latency metric)
ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS time_to_first_token_ms integer NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_ttft
    ON chatbot_logs(time_to_first_token_ms) WHERE time_to_first_token_ms IS NOT NULL;

-- Composite indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_timestamp_model
    ON chatbot_logs(timestamp, model_name);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_severity_timestamp
    ON chatbot_logs(severity_level, timestamp);

-- Trigram index for full-text search on message content
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_content_trgm
    ON chatbot_logs USING gin (message_content gin_trgm_ops);

-- Optional: a simple housekeeping function to delete old logs
CREATE OR REPLACE FUNCTION cleanup_old_chatbot_logs(cutoff timestamptz)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM chatbot_logs WHERE timestamp < cutoff;
END; $$;

-- Done

-- Notes:
-- 1) If you prefer uuid_generate_v4() instead of gen_random_uuid(), ensure uuid-ossp is enabled and change the DEFAULT.
-- 2) This SQL is safe to run against a Supabase/Postgres instance backing the app.
