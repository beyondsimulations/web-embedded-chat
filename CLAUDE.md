# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rust-based chat backend that proxies messages to an OpenAI-compatible API, with built-in telemetry logging to PostgreSQL and a protected admin dashboard. Used in a university lecture context.

## Build & Run Commands

```bash
# Build
cargo build --release --bin chatbot

# Run locally (requires .env or exported env vars)
cargo run --bin chatbot

# Run with Docker (PostgreSQL + chatbot)
docker-compose up --build

# Password hash utility (interactive, for pre-computing DASHBOARD_PASSWORD_HASH)
cargo run --bin hash_password
```

There are no tests or linting configured in this project.

## Architecture

**Framework:** Axum 0.8 on Tokio async runtime

**Three route groups in `main.rs`:**
- **Public chat** (`/chat`) — rate-limited (50 req/min/IP), proxies to OpenAI API
- **Public auth** (`/health`, `/login`, `/logout`) — form-based login with Argon2 + tower-sessions
- **Protected** (`/telemetry/`, `/api/telemetry/*`) — dashboard and log query API, guarded by session auth middleware

**Request flow for `/chat`:**
1. Rate limit check → extract IP → create `TelemetryContext` with trace/session IDs
2. Log user message → forward to OpenAI via `ai_client.rs` → log assistant response
3. Return response with `traceId`, `sessionId`, token counts (all camelCase)

**Key design decisions:**
- **camelCase API:** All public-facing JSON uses `#[serde(rename_all = "camelCase")]` on request/response structs. Internal Rust fields remain snake_case; database columns remain snake_case. Only the JSON wire format is camelCase.
- **Optional database:** If `DATABASE_URL` is not set, telemetry logging is silently disabled; the app still serves chat requests
- **In-memory sessions:** Sessions are lost on restart (tower-sessions MemoryStore, 8-hour expiry)
- **Semester-based anonymization:** User IDs are SHA-256 of (IP + semester string), making cross-semester tracking impossible by design
- **Eager password hashing:** Dashboard password is hashed once at startup via `config.rs`, not per login request
- **Trace/span IDs:** Generated as 32 hex chars (trace) and 16 hex chars (span) from UUID v4, matching OpenTelemetry format

## Rate Limiting

- **Chat endpoint** (`/chat`): 50 requests/min per IP (DashMap with 60s window)
- **Login endpoint** (`/login`): 5 attempts/min per IP (separate DashMap)

## Telemetry Dashboard

A single-page app served at `/telemetry/` with four views: Overview, Conversations, Analytics, Operations.

**Frontend architecture:** Alpine.js + Chart.js, modular JS files, separate CSS.

| File | Role |
|---|---|
| `static/index.html` | Slim Alpine.js shell with sidebar navigation and `<template x-if>` routing |
| `static/css/dashboard.css` | Design system: glassmorphism cards, Inter + Azeret Mono fonts, CSS variables |
| `static/js/app.js` | Alpine stores (`router`, `ui`) and utility functions (`formatDate`, `timeSince`, etc.) |
| `static/js/lib/api.js` | Fetch wrapper with 401 redirect to `/login` |
| `static/js/lib/charts.js` | Chart.js helper for consistent styling |
| `static/js/views/overview.js` | Stats cards, usage chart, model breakdown, recent conversations |
| `static/js/views/conversations.js` | Sortable/searchable table, click-through to conversation detail with chat thread |
| `static/js/views/analytics.js` | Usage over time, heatmap, latency distribution, engagement metrics |
| `static/js/views/operations.js` | Error rate chart, agent health, full-text search, export, cleanup |

## Key Files (Rust Backend)

| File | Role |
|---|---|
| `src/main.rs` | App init, routing setup, chat request handler |
| `src/config.rs` | Env var loading, DB pool creation |
| `src/dto.rs` | Request/response types (`ChatRequest`, `ChatResponse`) with camelCase serialization |
| `src/auth.rs` | Login/logout handlers, session auth middleware, login rate limiting |
| `src/ai_client.rs` | OpenAI API client, request/response translation |
| `src/error.rs` | `AppError` enum with HTTP status mapping (400, 429, 500, 502) |
| `src/rate_limit.rs` | Chat endpoint rate limiter (DashMap-backed) |
| `src/tracking.rs` | User anonymization: SHA-256(IP + semester string) |
| `src/routes.rs` | Telemetry dashboard + REST API handlers |
| `src/telemetry/` | Logger, DB client (sqlx), log models |
| `src/bin/hash_password.rs` | CLI utility for pre-computing Argon2 password hashes |
| `sql/setup_telemetry.sql` | PostgreSQL schema: `chatbot_logs` table, indexes, `recent_conversations` view |
| `floating-chat.js` | Embeddable chat widget (`UniversalChatWidget` class, 40+ options, iframe mode, citation links) |
| `Dockerfile` | Multi-stage build: rust:1-bookworm → debian:bookworm-slim |
| `docker-compose.yml` | PostgreSQL 16 + chatbot service orchestration |

## Frontend / Styling

- When modifying CSS or frontend styles, always verify WCAG 2.2 AA contrast compliance before considering the task complete. Calculate contrast ratios (≥4.5:1 for normal text, ≥3:1 for large text/UI components) and confirm compliance before applying color changes.
- Present color choices with their contrast ratios before applying them. Do not guess — calculate first.
- Avoid warm tones (rose, gold) for backgrounds unless explicitly requested.
- Prefer iterative small changes over large palette overhauls.

## Deployment / DevOps

- After making changes to Dockerized services, always rebuild containers (`docker compose up --build`) before testing. Never assume changes are live without verification.
- For frontend CSS/JS changes served by Docker, remind the user to clear browser cache or append a cache-buster query parameter.
- When changes appear not to work, check cache/rebuild state before debugging the code itself.

## Environment Variables

See `.env.example` for the full list. Critical ones:
- `OPENAI_API_KEY`, `OPENAI_API_URL` — upstream AI service
- `DATABASE_URL` — PostgreSQL connection (optional; omit to disable telemetry persistence)
- `ALLOWED_ORIGINS` — comma-separated CORS origins
- `DASHBOARD_USER`, `DASHBOARD_PASSWORD` — telemetry dashboard credentials
- `DASHBOARD_PASSWORD_HASH` — optional pre-computed Argon2 hash (skips runtime hashing)
