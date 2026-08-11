use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::audit::merkle_proof::{AuditCertificate, MerkleProofGenerator};
use crate::state::{SharedState, WsEvent};

#[derive(Deserialize)]
pub struct UnlearnRequest {
    pub entity_id: String,
}

#[derive(Serialize)]
pub struct UnlearnResponse {
    pub entity_id: String,
    pub shard_id: u32,
    pub audit_certificate: AuditCertificate,
    pub status: String,
}

#[derive(Serialize)]
pub struct UnlearnErrorResponse {
    pub error: String,
    pub message: String,
}

pub async fn handle_unlearn(
    State(state): State<SharedState>,
    Json(payload): Json<UnlearnRequest>,
) -> Result<Json<UnlearnResponse>, (StatusCode, Json<UnlearnErrorResponse>)> {
    if payload.entity_id.trim().is_empty() || !crate::api::ingest::validate_identifier(&payload.entity_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(UnlearnErrorResponse {
                error: "INVALID_INPUT".to_string(),
                message: "Invalid 'entity_id'. Must be 3-64 characters (alphanumeric, '_', '-').".to_string(),
            }),
        ));
    }

    info!("Executing unlearning request for Entity: '{}'", payload.entity_id);

    // Verify that target entity exists in LanceDB or SurrealDB before unlearning
    let exists_in_shard = state
        .shard_manager
        .entity_exists(&payload.entity_id)
        .await
        .unwrap_or(false);

    let exists_in_graph = state
        .surreal_client
        .entity_exists(&payload.entity_id)
        .await
        .unwrap_or(false);

    if !exists_in_shard && !exists_in_graph {
        error!("Entity '{}' not found in SISA shards or property graph", payload.entity_id);
        return Err((
            StatusCode::NOT_FOUND,
            Json(UnlearnErrorResponse {
                error: "ENTITY_NOT_FOUND".to_string(),
                message: format!("Entity '{}' does not exist in graph or vector storage.", payload.entity_id),
            }),
        ));
    }

    // 1. Purge target entity vectors from assigned LanceDB SISA shard
    let shard_id = state
        .shard_manager
        .purge_entity(&payload.entity_id)
        .await
        .map_err(|e| {
            error!("LanceDB shard purge failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(UnlearnErrorResponse {
                    error: "PURGE_FAILED".to_string(),
                    message: format!("LanceDB purge error: {}", e),
                }),
            )
        })?;

    // 2. Detach and delete entity subgraph from SurrealDB
    state
        .surreal_client
        .purge_entity_subgraph(&payload.entity_id)
        .await
        .map_err(|e| {
            error!("SurrealDB graph purge failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(UnlearnErrorResponse {
                    error: "GRAPH_PURGE_FAILED".to_string(),
                    message: format!("SurrealDB graph purge error: {}", e),
                }),
            )
        })?;

    // 3. Record audit unlearn relation in SurrealDB graph
    state
        .surreal_client
        .record_unlearn_relation(&payload.entity_id, shard_id)
        .await
        .map_err(|e| {
            error!("SurrealDB record unlearn relation failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(UnlearnErrorResponse {
                    error: "AUDIT_RECORD_FAILED".to_string(),
                    message: format!("SurrealDB audit record error: {}", e),
                }),
            )
        })?;

    // 3. Generate cryptographic SHA-256 Merkle proof receipt with Ed25519 signature
    let certificate = MerkleProofGenerator::generate_certificate(&payload.entity_id, shard_id);

    // Save persistent audit certificate to SurrealDB table
    if let Err(e) = state.surreal_client.save_audit_certificate(&certificate).await {
        error!("Failed to persist audit certificate in SurrealDB: {}", e);
    }

    // 4. Broadcast deletion and audit events over WebSockets
    let _ = state.ws_sender.send(WsEvent::NodeDeleted {
        entity_id: payload.entity_id.clone(),
        shard_id,
    });

    let _ = state.ws_sender.send(WsEvent::AuditGenerated {
        audit_certificate: certificate.clone(),
    });

    Ok(Json(UnlearnResponse {
        entity_id: payload.entity_id,
        shard_id,
        audit_certificate: certificate,
        status: "PURGED_AND_VERIFIED".to_string(),
    }))
}

#[derive(Serialize)]
pub struct BatchUnlearnResponse {
    pub results: Vec<UnlearnResponse>,
    pub total_processed: usize,
    pub status: String,
}

pub async fn handle_batch_unlearn(
    State(state): State<SharedState>,
    Json(payload): Json<Vec<String>>,
) -> Result<Json<BatchUnlearnResponse>, (StatusCode, String)> {
    if payload.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Batch unlearn payload cannot be empty.".to_string(),
        ));
    }

    let mut results = Vec::new();
    for entity_id in payload {
        let req = UnlearnRequest { entity_id };
        match handle_unlearn(State(state.clone()), Json(req)).await {
            Ok(Json(resp)) => results.push(resp),
            Err((_, err_json)) => error!("Batch unlearn item failed: {}", err_json.message),
        }
    }

    let total = results.len();
    Ok(Json(BatchUnlearnResponse {
        results,
        total_processed: total,
        status: "BATCH_UNLEARN_COMPLETED".to_string(),
    }))
}