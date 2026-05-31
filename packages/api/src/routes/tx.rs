use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::services::fetcher::TxFetcher;

pub async fn get_tx_handler(
    Path(txid): Path<String>,
    State(fetcher): State<Arc<TxFetcher>>,
) -> impl IntoResponse {
    match fetcher.fetch_tx_analysis(&txid).await {
        Ok(analysis) => (StatusCode::OK, Json(analysis)).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}
