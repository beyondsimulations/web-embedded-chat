use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Internal Server Error: {0}")]
    InternalServerError(String),

    #[error("Bad Request: {0}")]
    BadRequest(String),

    #[error("Upstream Service Error: {0}")]
    UpstreamServiceError(String),

    #[error("Too Many Requests")]
    TooManyRequests,
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::InternalServerError(err.to_string())
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::InternalServerError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::UpstreamServiceError(msg) => (StatusCode::BAD_GATEWAY, msg),
            AppError::TooManyRequests => (StatusCode::TOO_MANY_REQUESTS, self.to_string()),
        };

        let error_response = ErrorResponse {
            error: error_message,
        };

        (status, Json(error_response)).into_response()
    }
}
