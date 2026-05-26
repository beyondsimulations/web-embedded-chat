FROM rust:1-bookworm AS builder

WORKDIR /app

# Cache dependencies: copy manifests and build a dummy project
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src/bin \
    && echo "fn main() {}" > src/main.rs \
    && echo "fn main() {}" > src/bin/hash_password.rs \
    && cargo build --release --bin chatbot \
    && rm -rf src

# Copy real source and static assets (needed at compile time by include_str!)
COPY src ./src
COPY static ./static
RUN touch src/main.rs && cargo build --release --bin chatbot

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app -s /sbin/nologin app

COPY --from=builder /app/target/release/chatbot /usr/local/bin/chatbot
COPY static /app/static
COPY sql /app/sql

WORKDIR /app
USER app

EXPOSE 3000

CMD ["chatbot"]
