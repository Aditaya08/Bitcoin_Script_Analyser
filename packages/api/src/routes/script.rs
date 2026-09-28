use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrevoutInput {
    pub script_pub_key: String,
    pub value: u64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugRequest {
    pub script_sig: String,
    pub script_pubkey: String,
    pub witness: Option<Vec<String>>,
    pub raw_tx_hex: Option<String>,
    pub input_index: Option<usize>,
    pub prevout_value: Option<u64>,
    pub prevouts: Option<Vec<PrevoutInput>>,
}

pub async fn debug_script_handler(
    Json(payload): Json<DebugRequest>,
) -> impl IntoResponse {
    let witness = payload.witness.unwrap_or_default();
    let prevouts_vec = payload.prevouts.map(|vec| {
        vec.into_iter()
            .map(|p| (p.script_pub_key, p.value))
            .collect::<Vec<_>>()
    });
    match btc_core::debugger::engine::debug_script(
        &payload.script_sig,
        &payload.script_pubkey,
        &witness,
        payload.raw_tx_hex.as_deref(),
        payload.input_index,
        payload.prevout_value,
        prevouts_vec,
    ) {
        Ok(steps) => (StatusCode::OK, Json(steps)).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}
