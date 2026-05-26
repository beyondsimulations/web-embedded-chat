use axum::http::HeaderMap;
use std::net::{IpAddr, SocketAddr};

/// Extract the real client IP from proxy headers, falling back to the socket address.
/// Priority: X-Forwarded-For (first entry) → X-Real-IP → socket IP.
pub fn resolve_client_ip(headers: &HeaderMap, addr: &SocketAddr) -> IpAddr {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            if let Ok(ip) = first.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }

    if let Some(xri) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        if let Ok(ip) = xri.trim().parse::<IpAddr>() {
            return ip;
        }
    }

    addr.ip()
}
