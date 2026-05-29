# Chat Backend

A Rust-based chat backend that proxies messages to any OpenAI-compatible API, with built-in telemetry logging to PostgreSQL and an analytics dashboard. Designed for university lecture deployments, where instructors need a small, auditable layer between a public chat widget and a commercial LLM provider.

> ### Funded by the Claussen-Simon-Stiftung
>
> This project is supported by the [**Claussen-Simon-Stiftung**](https://www.claussen-simon-stiftung.de/) as part of the initiative *"Weiterentwicklung eines Chatbots zur Förderung des selbstgesteuerten Lernens und kritischen Denkens im Modul 'Applied Optimization'"* at the **University of Hamburg Business School** (September 2025 -- March 2026). The funding enables the development of a Socratic tutoring chatbot that promotes critical thinking and self-directed learning in higher education, with this backend providing the privacy-aware, telemetry-enabled infrastructure underneath it.
>
> A live deployment of the resulting tutor for *Applied Optimization* is available at <https://beyondsimulations.github.io/Applied-Optimization/>.

## What this is (and isn't)

This repository is just the **delivery layer**: a thin Rust service that authenticates the widget, rate-limits requests, logs anonymized telemetry, and forwards chat completions to whatever upstream you configure. It deliberately does **not** include any of the Socratic prompting, RAG indexing, or retrieval logic -- those live in the upstream model, system prompts, and course content. That separation keeps the backend reusable for any course and any OpenAI-compatible provider.

## Features

- **OpenAI-compatible proxy** -- forwards chat requests to any API that speaks the OpenAI Chat Completions format
- **Streaming** -- SSE streaming when the upstream supports it; non-streaming fallback otherwise
- **Telemetry logging** -- every request/response pair is logged to PostgreSQL with trace IDs, latency, and token counts
- **Telemetry dashboard** -- single-page app with overview stats, conversation browser, analytics (heatmaps, latency distribution, engagement metrics), full-text search, and data export
- **Privacy by design** -- user IDs are SHA-256 hashes of (IP + semester), making cross-semester tracking impossible by construction
- **Rate limiting** -- 50 req/min per IP on chat, 5 attempts/min on login
- **Embeddable widget** -- `floating-chat.js` provides a drop-in chat UI with 40+ customization options, markdown, LaTeX, and code blocks
- **Optional database** -- runs without PostgreSQL (telemetry silently disabled)

## Quick Start

### With Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your values
docker-compose up --build
```

This starts two services:
- **Chatbot** at `http://localhost:3000` -- chat API + telemetry dashboard
- **PostgreSQL** -- database for telemetry logs

Point `OPENAI_API_URL` at any OpenAI-compatible upstream (OpenAI, Groq, Together, vLLM, Ollama, ...).

### Without Docker

Requires the Rust toolchain. Telemetry is disabled without a database.

```bash
cp .env.example .env
# Set OPENAI_API_URL and OPENAI_API_KEY to your provider of choice
cargo run --bin chatbot
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | -- | Bearer token for the upstream AI API |
| `OPENAI_API_URL` | Yes | -- | Chat completions endpoint URL |
| `PORT` | No | `3000` | Server listen port |
| `ALLOWED_ORIGINS` | No | `Any` | Comma-separated CORS origins |
| `POSTGRES_PASSWORD` | Docker only | -- | PostgreSQL password (docker-compose builds `DATABASE_URL` from this) |
| `DATABASE_URL` | No | -- | PostgreSQL connection string (omit to disable telemetry) |
| `DASHBOARD_USER` | No | `admin` | Telemetry dashboard login username |
| `DASHBOARD_PASSWORD` | Yes* | -- | Telemetry dashboard login password (*or provide `DASHBOARD_PASSWORD_HASH`) |
| `DASHBOARD_PASSWORD_HASH` | No | -- | Pre-computed Argon2 hash (use `cargo run --bin hash_password`) |

## API

All JSON request and response fields use **camelCase**.

### POST /chat

Send a chat message through the proxy.

**Request:**

```json
{
  "message": "Hello, how are you?",
  "model": "gpt-4o-mini",
  "traceId": "optional-trace-id",
  "sessionId": "optional-session-id",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

**Response:**

```json
{
  "response": "I'm doing well, thanks for asking!",
  "traceId": "a1b2c3d4e5f6...",
  "sessionId": "session-uuid",
  "model": "gpt-4o-mini",
  "tokenCount": 42,
  "promptTokens": 12,
  "completionTokens": 30,
  "finishReason": "stop"
}
```

If the upstream returns a `sources` array (citation chunks) or `reasoningContent`, those fields are passed through; otherwise they're omitted.

### GET /health

Returns `{"status": "ok"}`.

### Telemetry API (auth required)

| Endpoint | Method | Description |
|---|---|---|
| `/api/telemetry/logs` | GET | Query logs (params: `sessionId`, `userId`, `limit`) |
| `/api/telemetry/logs` | POST | Batch insert logs |
| `/api/telemetry/logs/cleanup` | DELETE | Delete logs before a timestamp |
| `/api/telemetry/trace/{traceId}` | GET | Get all logs for a trace |
| `/api/telemetry/session/{sessionId}` | GET | Get all logs for a session |
| `/api/telemetry/conversations` | GET | Recent conversation summaries |
| `/api/telemetry/stats` | GET | Aggregate statistics |
| `/api/telemetry/analytics/*` | GET | Usage over time, heatmaps, latency, engagement, models |
| `/api/telemetry/search` | GET | Full-text search across message content |

## Embeddable Chat Widget

Include `floating-chat.js` on any page to add a chat button:

```html
<script src="https://your-domain.com/static/floating-chat.js"></script>
<script>
  new UniversalChatWidget({
    apiEndpoint: "https://your-domain.com/chat",
    model: "gpt-4o-mini",
    title: "Chat Assistant",
    welcomeMessage: "Hi! How can I help you?",
    position: "bottom-right",
    titleBackgroundColor: "#1a1a2e",
    userColor: "#00ffd5",
  });
</script>
```

The widget supports 40+ options for colors, sizing, behavior, and history management. It renders markdown, LaTeX (KaTeX), code blocks with copy buttons, citation links with reference sections, and adapts to mobile. See the JSDoc in `floating-chat.js` for the full option list.

## Architecture

```
Browser / Widget
     |
     | POST /chat   (camelCase JSON, rate-limited)
     v
+--------------------+
|   Rust Backend     |
|   (Axum :3000)     |
|                    |
| - Rate limiting    |
| - Telemetry log    |---> PostgreSQL 16 (chatbot_logs)
| - Session auth     |
+--------------------+
     |
     | OpenAI Chat Completions  (set via OPENAI_API_URL)
     v
     OpenAI / Groq / vLLM / Ollama / ...
```

The Rust backend doesn't care what's on the other side of `OPENAI_API_URL`, as long as it speaks Chat Completions.

- **Rust backend:** Axum 0.8, Tokio, sqlx, Argon2, tower-sessions (in-memory)
- **Database:** PostgreSQL 16
- **Frontend:** Alpine.js 3, Chart.js, no build step

## Privacy & Data Protection

The chat widget is designed for use in a university teaching context, so a few constraints are baked in rather than left as deployment choices:

- **No persistent user identifiers.** The user ID stored in telemetry is `SHA-256(IP + semester string)`. Once the semester string changes, the hash space changes, and last semester's identifiers cannot be linked to this semester's.
- **No raw IPs at rest.** IPs are only used as an input to the hash above and for rate limiting; they are not written to the database.
- **Session state is in-memory.** Server restarts wipe sessions; there is no long-lived session store.
- **Telemetry is optional.** Omit `DATABASE_URL` and the backend serves chat without writing anything to disk.

## Acknowledgments

This project is part of an initiative funded by the **Claussen-Simon-Stiftung** to develop a Socratic chatbot that promotes self-directed learning and critical thinking in the *Applied Optimization* module at the **University of Hamburg Business School**. The foundation's support for innovative, interactive, and sustainable teaching formats made this work possible.

The pedagogical concept builds on established principles of Socratic dialogue systems -- context-aware interaction and a typology of Socratic question types (clarification, assumptions, reasons, perspectives, implications) -- adapted to the specific learning hurdles of optimization modelling.

## License

MIT --- see [LICENSE](LICENSE).
