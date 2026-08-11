use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::state::{SharedState, WsEvent};

#[derive(Deserialize)]
pub struct IngestRequest {
    pub id: String,
    pub text: String,
    pub entity_id: String,
}

#[derive(Serialize)]
pub struct IngestResponse {
    pub id: String,
    pub entity_id: String,
    pub shard_id: u32,
    pub triplets_extracted: usize,
    pub status: String,
}

use regex::Regex;
use std::sync::OnceLock;

static ID_REGEX: OnceLock<Regex> = OnceLock::new();

pub fn validate_identifier(val: &str) -> bool {
    let re = ID_REGEX.get_or_init(|| Regex::new(r"^[a-zA-Z0-9_-]{3,64}$").unwrap());
    re.is_match(val)
}

pub async fn handle_ingest(
    State(state): State<SharedState>,
    Json(payload): Json<IngestRequest>,
) -> Result<Json<IngestResponse>, (StatusCode, String)> {
    if payload.text.trim().is_empty() || payload.entity_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Request payload 'text' and 'entity_id' cannot be empty.".to_string(),
        ));
    }

    if !validate_identifier(&payload.id) || !validate_identifier(&payload.entity_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid 'id' or 'entity_id'. Must be 3-64 characters (alphanumeric, '_', '-').".to_string(),
        ));
    }

    info!("Processing ingest request for Entity: '{}'", payload.entity_id);

    // 1. Fetch vector embedding from Python ML Worker via gRPC
    let vector = state
        .ml_client
        .get_embedding(payload.text.clone())
        .await
        .map_err(|e| {
            error!("gRPC embedding generation failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("ML Worker error: {}", e),
            )
        })?;

    // 2. Insert vector into assigned LanceDB SISA shard
    let shard_id = state
        .shard_manager
        .insert_vector(&payload.id, &payload.entity_id, &vector)
        .await
        .map_err(|e| {
            error!("LanceDB shard insertion failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("LanceDB storage error: {}", e),
            )
        })?;

    // 3. Extract NLP triplets from Python ML Worker via gRPC
    let triplets = state
        .ml_client
        .extract_triplets(payload.text.clone())
        .await
        .map_err(|e| {
            error!("gRPC triplet extraction failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("ML Worker error: {}", e),
            )
        })?;

    // 4. Insert extracted triplets into SurrealDB property graph
    for triplet in &triplets {
        state
            .surreal_client
            .insert_triplet(
                &triplet.subject,
                &triplet.predicate,
                &triplet.object,
                shard_id,
                &payload.entity_id,
            )
            .await
            .map_err(|e| {
                error!("SurrealDB triplet insertion failed: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("SurrealDB storage error: {}", e),
                )
            })?;
    }

    // 5. Broadcast real-time WebSocket event to Next.js frontend
    let _ = state.ws_sender.send(WsEvent::NodeIngested {
        id: payload.id.clone(),
        entity_id: payload.entity_id.clone(),
        shard_id,
    });

    Ok(Json(IngestResponse {
        id: payload.id,
        entity_id: payload.entity_id,
        shard_id,
        triplets_extracted: triplets.len(),
        status: "SUCCESSFULLY_INGESTED".to_string(),
    }))
}

#[derive(Serialize)]
pub struct BatchIngestResponse {
    pub results: Vec<IngestResponse>,
    pub total_processed: usize,
    pub status: String,
}

pub async fn handle_batch_ingest(
    State(state): State<SharedState>,
    Json(payload): Json<Vec<IngestRequest>>,
) -> Result<Json<BatchIngestResponse>, (StatusCode, String)> {
    if payload.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Batch payload cannot be empty.".to_string(),
        ));
    }

    let mut join_set = tokio::task::JoinSet::new();

    for req in payload {
        let state_clone = state.clone();
        join_set.spawn(async move {
            handle_ingest(State(state_clone), Json(req)).await
        });
    }

    let mut results = Vec::new();
    while let Some(res) = join_set.join_next().await {
        match res {
            Ok(Ok(Json(resp))) => results.push(resp),
            Ok(Err((code, msg))) => error!("Batch item failed: {} - {}", code, msg),
            Err(e) => error!("Batch task join error: {}", e),
        }
    }

    let total = results.len();
    Ok(Json(BatchIngestResponse {
        results,
        total_processed: total,
        status: "BATCH_COMPLETED".to_string(),
    }))
}