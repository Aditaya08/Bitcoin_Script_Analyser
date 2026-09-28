use axum::{http::StatusCode, response::IntoResponse, Json};

pub async fn health_handler() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({ "ok": true, "service": "scriptscope-api" })))
}