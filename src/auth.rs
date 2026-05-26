use std::net::{IpAddr, SocketAddr};
use std::sync::LazyLock;

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::body::Body;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::Form;
use serde::Deserialize;
use std::sync::Arc;
use tower_sessions::Session;

use crate::client_ip::resolve_client_ip;
use crate::config::Config;
use crate::rate_limit::RateLimiter;

const LOGIN_HTML: &str = include_str!("../static/login.html");

static LOGIN_LIMITER: LazyLock<RateLimiter<IpAddr>> =
    LazyLock::new(|| RateLimiter::new(5, 60));

#[derive(Deserialize)]
pub struct LoginForm {
    username: String,
    password: String,
}

/// Middleware: redirect to /login if session is not authenticated
pub async fn require_auth(session: Session, req: Request<Body>, next: Next) -> Response {
    match session.get::<bool>("authenticated").await {
        Ok(Some(true)) => next.run(req).await,
        _ => {
            if req.uri().path().starts_with("/api/") {
                StatusCode::UNAUTHORIZED.into_response()
            } else {
                Redirect::to("/login").into_response()
            }
        }
    }
}

/// GET /login — render the login page
pub async fn login_page() -> Html<&'static str> {
    Html(LOGIN_HTML)
}

/// POST /login — verify credentials, create session
pub async fn login_handler(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    session: Session,
    State(config): State<Arc<Config>>,
    Form(form): Form<LoginForm>,
) -> Response {
    let client_ip = resolve_client_ip(&headers, &addr);
    if LOGIN_LIMITER.is_limited(&client_ip) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Html("Too many login attempts. Try again in a minute."),
        )
            .into_response();
    }

    let hash = match PasswordHash::new(&config.dashboard_password_hash) {
        Ok(h) => h,
        Err(_) => {
            tracing::error!("Invalid DASHBOARD_PASSWORD_HASH format");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    if form.username == config.dashboard_user
        && Argon2::default()
            .verify_password(form.password.as_bytes(), &hash)
            .is_ok()
    {
        let _ = session.cycle_id().await;
        let _ = session.insert("authenticated", true).await;
        Redirect::to("/telemetry/").into_response()
    } else {
        Html(login_page_with_error("Invalid username or password")).into_response()
    }
}

/// GET /logout — destroy session
pub async fn logout_handler(session: Session) -> Redirect {
    let _ = session.delete().await;
    Redirect::to("/login")
}

fn login_page_with_error(error: &str) -> String {
    LOGIN_HTML.replace(
        "<!--ERROR_PLACEHOLDER-->",
        // role=alert ensures screen readers announce authentication errors
        // immediately on page load (WCAG 4.1.3 Status Messages).
        &format!(r#"<div class="error-message" role="alert">{}</div>"#, error),
    )
}
