# Chat Backend

A small Rust service that sits between an embedded chat widget and any OpenAI-compatible API. It rate-limits, logs anonymized telemetry to PostgreSQL, and ships a dashboard for looking at what students are actually asking.

Built for use in university teaching. It is not a product; it is infrastructure for a research project, described below.

## Funding and research context

The work is funded by the [Claussen-Simon-Stiftung](https://www.claussen-simon-stiftung.de/) under the project *"Weiterentwicklung eines Chatbots zur Förderung des selbstgesteuerten Lernens und kritischen Denkens im Modul 'Applied Optimization'"* at the University of Hamburg Business School (September 2025 to March 2026).

The aim is a Socratic tutoring chatbot for the *Applied Optimization* module that prompts students to reason through optimization modelling rather than handing them solutions. The live deployment is at https://beyondsimulations.github.io/Applied-Optimization/.

I run this as a **design-based research (DBR) project**. In practice that means the chatbot gets designed, deployed in actual teaching, studied, and then revised before the next cycle.

The project is based on [OpenWebUI](https://openwebui.com/), which serves as the chat backend itself: it exposes the OpenAI-compatible API the embedded widget talks to and handles the RAG integration over the course materials. That was enough to put the tutor in front of students quickly and start collecting feedback.

This repo is a separate layer that sits in front of the backend and gives me the telemetry, rate limiting, semester-scoped pseudonymous IDs, and audit hooks. The chat intelligence, system prompts, RAG, model choice, still lives in the upstream backend; none of it happens in this proxy.

### Example: the current Socratic system prompt

To make the separation concrete, here is the system prompt the *Applied Optimization* tutor is running with at the time of writing. It is exactly the kind of artefact that lives outside this repo, gets revised between DBR iterations, and is part of what students experience without ever seeing it directly:

```text
You are a personal tutor in applied optimization with the programming language Julia.

## Personality & conversational style
- Be approachable, curious, and encouraging — like a knowledgeable peer, not a lecturer
- Keep answers brief so a real conversation can emerge
- Don't write long answers instead, use the opportunity to include the students in the conversation and ask questions
- Teach through dialogue: ask guiding questions, give hints, nudge toward insights rather than handing out solutions
- Foster academic integrity — help users understand concepts, don't just provide answers
- Use at most one emoji per message
- Use the document library tool to answer each question, unless it is super generic

## What makes a good response
- Succinct: answer the core question, then stop
- Inquisitive: end with a follow-up question that deepens understanding or checks comprehension
- Grounded: reference course material when relevant
- Honest: if something is tricky or a common pitfall, say so

## Math formatting (strict rules)
- Inline math: use $...$ on a single line (e.g., $x_i$, $\mathcal{R}_{e,t}$)
- Display math: always use $$...$$ (double dollar), never single $ for multi-line formulas
- For multi-line equations: $$\begin{aligned}...\end{aligned}$$
- Always wrap ALL math symbols, variables, subscripts, and operators in $...$ — never use Unicode math characters (ℛ, ₑ, ₜ, ∀, ∈, ∑, →, ≤, ≥)
- Format all mathematical expressions using LaTeX with no spaces between the dollar sign delimiters and the content.
- Keep delimiters on the same line as content, never on their own line

The user has already been shown this welcome message: "How can I help?" Do not repeat it. The conversation starts with the user's first message.
```

The prompt is only half the work. The model behind it matters at least as much: a weaker model reads this as a vague set of preferences and ignores most of it, while a stronger one actually conducts something that looks like a Socratic dialogue. Currently, I'm really happy with Mistral Medium 3.5.

## Features

- **OpenAI-compatible proxy** - forwards chat requests to any API that speaks the OpenAI Chat Completions format
- **Streaming** - SSE streaming when the upstream supports it; non-streaming fallback otherwise
- **Telemetry logging** - every request/response pair is logged to PostgreSQL with trace IDs, latency, and token counts
- **Telemetry dashboard** - single-page app with overview stats, conversation browser, analytics (heatmaps, latency distribution, engagement metrics), full-text search, and data export
- **Semester-scoped pseudonymous IDs** - rotated per teaching semester (see [Privacy](#privacy) below)
- **Rate limiting** - 50 req/min per IP on chat, 5 attempts/min on login
- **Embeddable widget** - `floating-chat.js` provides a drop-in chat UI with 40+ customization options, markdown, LaTeX, and code blocks

## Quick Start

### With Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your values
docker-compose up --build
```

This starts two services:
- **Chatbot** at `http://localhost:3000` -- chat API + telemetry dashboard
- **PostgreSQL** - database for telemetry logs

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
| `ALLOWED_ORIGINS` | No | `Any` | Comma-separated CORS origins; `Any` or `*` opens CORS to any origin |
| `POSTGRES_PASSWORD` | Docker only | -- | PostgreSQL password (docker-compose builds `DATABASE_URL` from this) |
| `DATABASE_URL` | No | -- | PostgreSQL connection string (omit to disable telemetry) |
| `DASHBOARD_USER` | No | `admin` | Telemetry dashboard login username |
| `DASHBOARD_PASSWORD` | Yes* | -- | Telemetry dashboard login password (*or provide `DASHBOARD_PASSWORD_HASH`) |
| `DASHBOARD_PASSWORD_HASH` | No | -- | Pre-computed Argon2 hash (use `cargo run --bin hash_password`) |
| `SEMESTER` | No | empty | Salt mixed into the SHA-256 user ID hash; rotate between semesters to give each cohort a disjoint ID space (a warning is logged if unset) |
| `MAX_TOKENS` | No | `10000` | Cap on `max_tokens` forwarded to the upstream |
| `REQUEST_TIMEOUT_SECS` | No | `240` | HTTP client timeout for upstream calls |
| `SECURE_COOKIES` | No | `true` | Set to `false` for local HTTP development |

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
| `/api/telemetry/logs` | GET | Query logs (params: `sessionId`, `userId`, `conversationId`, `severityLevel`, `startTime`, `endTime`, `search`, `limit`, `offset`) |
| `/api/telemetry/logs` | POST | Batch insert logs |
| `/api/telemetry/logs/cleanup` | DELETE | Delete logs before a timestamp |
| `/api/telemetry/trace/{traceId}` | GET / DELETE | Get all logs for a trace, or delete the whole trace |
| `/api/telemetry/session/{sessionId}` | GET | Get all logs for a session |
| `/api/telemetry/conversations` | GET | Recent conversation summaries |
| `/api/telemetry/stats/overview` | GET | Aggregate counters used by the overview view |
| `/api/telemetry/stats/usage` | GET | Requests and tokens bucketed over time |
| `/api/telemetry/stats/models` | GET | Per-model usage breakdown |
| `/api/telemetry/stats/latency` | GET | Latency distribution |
| `/api/telemetry/stats/ttft` | GET | Time-to-first-token distribution for streamed responses |
| `/api/telemetry/stats/heatmap` | GET | Peak-hour heatmap (day-of-week × hour) |
| `/api/telemetry/stats/engagement` | GET | User engagement metrics (sessions, messages per user) |
| `/api/telemetry/stats/errors` | GET | Error rate over time |
| `/api/telemetry/search` | GET | Full-text search across message content |
| `/api/telemetry/export` | GET | Export logs as CSV/JSON |

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

## Privacy

A few constraints are baked into the service because it talks to students, and I did not want them to be deployer-configurable:

- The telemetry user ID is `SHA-256(IP || "|" || SEMESTER)`. The literal `|` is in there so a value like `1.2.3.4` + `WS` cannot collide with `1.2.3.` + `4WS`. Rotate the `SEMESTER` env var between teaching semesters and the new cohort gets a disjoint ID space; last semester's records cannot be joined to this one. That is also how the DBR cycles get cleanly separated. If `SEMESTER` is unset, the service logs a warning at startup and runs with an empty salt.
- Raw IPs are never written to the database. They go into the hash above and into the rate limiter, and that is the end of them.
- Sessions live in process memory. A restart wipes them; there is no persistent session store.
- The telemetry layer is opt-in. Omit `DATABASE_URL` and the backend serves chat without writing anything to disk.

## Acknowledgments

Thanks to the student assistant working with me from September 2025 through March 2026 on prompt iteration, focus group sessions, and integrating the course content.

The Socratic side of the system draws on the standard typology of Socratic questions (clarification, assumptions, reasons, perspectives, implications) adapted to the specific places where students get stuck in optimization modelling.

## License

MIT, see [LICENSE](LICENSE).
