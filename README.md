# Chat Backend

A small Rust service that sits between an embedded chat widget and any OpenAI-compatible API. It rate-limits, logs anonymized telemetry to PostgreSQL, and ships a dashboard for looking at what students are actually asking.

Built for use in university teaching. It is not a product; it is infrastructure for a research project, described below.

## Funding and research context

The work is funded by the [Claussen-Simon-Stiftung](https://www.claussen-simon-stiftung.de/) under the project *"Weiterentwicklung eines Chatbots zur Förderung des selbstgesteuerten Lernens und kritischen Denkens im Modul 'Applied Optimization'"* at the University of Hamburg Business School (September 2025 to March 2026).

The aim is a Socratic tutoring chatbot for the *Applied Optimization* module that prompts students to reason through optimization modelling rather than handing them solutions. The live deployment is at https://beyondsimulations.github.io/Applied-Optimization/.

I run this as a **design-based research (DBR) project**. In practice that means the chatbot gets designed, deployed in actual teaching, studied (focus groups at three points in the semester, an anonymous feedback channel, and the telemetry this backend collects), and then revised before the next cycle. That iteration loop is why the backend looks the way it does. I needed something I could deploy across semesters and audit, and a black-box widget pointed at a vendor would not have given me that.

## What this repo is, and what it isn't

The delivery layer. A Rust service that authenticates the widget, rate-limits abuse, logs telemetry, and forwards chat requests upstream.

The Socratic prompting, the question typology, the course content, and the retrieval setup all live elsewhere. The pedagogy gets reworked between DBR cycles, and the infrastructure should not have to move with it.

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

The prompt is only half the work. The model behind it matters at least as much: a weaker model reads this as a vague set of preferences and ignores most of it, while a stronger one actually conducts something that looks like a Socratic dialogue. A surprising share of the DBR iteration is spent on which model the backend points at, not only on what to put in this prompt.

## Features

- **OpenAI-compatible proxy** - forwards chat requests to any API that speaks the OpenAI Chat Completions format
- **Streaming** - SSE streaming when the upstream supports it; non-streaming fallback otherwise
- **Telemetry logging** - every request/response pair is logged to PostgreSQL with trace IDs, latency, and token counts
- **Telemetry dashboard** - single-page app with overview stats, conversation browser, analytics (heatmaps, latency distribution, engagement metrics), full-text search, and data export
- **Semester-scoped pseudonymous IDs** - user IDs are SHA-256 hashes of (IP + semester); a new semester means new IDs, so prior cohorts cannot be joined to the current one
- **Rate limiting** - 50 req/min per IP on chat, 5 attempts/min on login
- **Embeddable widget** - `floating-chat.js` provides a drop-in chat UI with 40+ customization options, markdown, LaTeX, and code blocks
- **Optional database** - runs without PostgreSQL (telemetry silently disabled)

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

## Privacy

A few constraints are baked into the service because it talks to students, and I did not want them to be deployer-configurable:

- The telemetry user ID is `SHA-256(IP + semester string)`. Change the semester string and yesterday's IDs cannot be joined to today's. That is also how the DBR cycles get cleanly separated.
- Raw IPs are never written to the database. They go into the hash above and into the rate limiter, and that is the end of them.
- Sessions live in process memory. A restart wipes them; there is no persistent session store.
- The telemetry layer is opt-in. Omit `DATABASE_URL` and the backend serves chat without writing anything to disk.

## Acknowledgments

Thanks to the Claussen-Simon-Stiftung for funding the wider research project this infrastructure is part of, and to the student assistant working with me from September 2025 through March 2026 on prompt iteration, focus group sessions, and integrating the course content.

The Socratic side of the system draws on the standard typology of Socratic questions (clarification, assumptions, reasons, perspectives, implications) adapted to the specific places where students get stuck in optimization modelling.

## License

MIT --- see [LICENSE](LICENSE).
