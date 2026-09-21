use axum::{
    routing::{get, post},
    Router,
};
use rust_gateway::config::Config;
use rust_gateway::state::AppState;
use rust_gateway::{api, ws};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rust_gateway=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Booting Auditable Unlearning Engine (Rust Gateway)...");

    let config = Config::from_env();
    tracing::info!("Loaded Config: {:?}", config);

    let app_state = match AppState::new(
        config.grpc_ml_worker_endpoint.clone(),
        &config.lancedb_uri,
        &config.surreal_db_path,
        config.num_sisa_shards,
        384, // Embedding dimension for all-MiniLM-L6-v2
    )
    .await
    {
        Ok(state) => Arc::new(state),
        Err(e) => {
            tracing::error!("Failed to initialize AppState: {}", e);
            std::process::exit(1);
        }
    };

    // Configure CORS to allow frontend requests from http://localhost:3000
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws::ws_handler))
        .route("/api/v1/ingest", post(api::ingest::handle_ingest))
        .route("/api/v1/ingest/batch", post(api::ingest::handle_batch_ingest))
        .route("/api/v1/unlearn", post(api::unlearn::handle_unlearn))
        .route("/api/v1/unlearn/batch", post(api::unlearn::handle_batch_unlearn))
        .route(
            "/api/v1/audit/:entity_id/:shard_id",
            get(api::audit::handle_verify_audit),
        )
        .with_state(app_state)
        .layer(cors);

    let listener = TcpListener::bind(config.server_addr()).await?;
    tracing::info!("Rust Axum Gateway listening on http://{}", config.server_addr());

    axum::serve(listener, app).await?;
    Ok(())
}

use rust_gateway::health_check;