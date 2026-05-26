use std::hash::Hash;
use std::net::{IpAddr, SocketAddr};
use std::sync::LazyLock;
use std::time::{Duration, Instant};

use axum::{
    body::Body, extract::ConnectInfo, http::{HeaderMap, Request}, middleware::Next,
    response::IntoResponse, response::Response,
};
use dashmap::DashMap;

use crate::client_ip::resolve_client_ip;
use crate::error::AppError::TooManyRequests;

pub struct RateLimiter<K: Eq + Hash> {
    map: DashMap<K, (u32, Instant)>,
    max_requests: u32,
    window: Duration,
}

impl<K: Eq + Hash + Clone> RateLimiter<K> {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            map: DashMap::new(),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub fn is_limited(&self, key: &K) -> bool {
        let now = Instant::now();
        let mut entry = self.map.entry(key.clone()).or_insert((0, now));

        if entry.1.elapsed() >= self.window {
            *entry = (0, now);
        }

        entry.0 += 1;
        entry.0 > self.max_requests
    }
}

static CHAT_LIMITER: LazyLock<RateLimiter<IpAddr>> =
    LazyLock::new(|| RateLimiter::new(50, 60));

pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    req: Request<Body>,
    next: Next,
) -> Response {
    let client_ip = resolve_client_ip(&headers, &addr);
    if CHAT_LIMITER.is_limited(&client_ip) {
        return TooManyRequests.into_response();
    }
    next.run(req).await
}
