use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugRequest {
    pub script_sig: String,
    pub script_pubkey: String,
    pub witness: Option<Vec<String>>,
}

pub async fn debug_script_handler(
    Json(payload): Json<DebugRequest>,
) -> impl IntoResponse {
    let witness = payload.witness.unwrap_or_default();
    match btc_core::debugger::engine::debug_script(&payload.script_sig, &payload.script_pubkey, &witness) {
        Ok(steps) => (StatusCode::OK, Json(steps)).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}
