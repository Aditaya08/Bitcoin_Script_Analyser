use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use crate::services::fetcher::TxFetcher;

pub mod tx;
pub mod script;

pub fn create_router() -> Router {
    let fetcher = Arc::new(TxFetcher::new());
    
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/tx/:txid", get(tx::get_tx_handler))
        .route("/api/script/debug", post(script::debug_script_handler))
        .with_state(fetcher)
        .layer(cors)
}
