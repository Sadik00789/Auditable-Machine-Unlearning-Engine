use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use tracing::{error, info};

use crate::audit::merkle_proof::{AuditCertificate, MerkleProofGenerator};
use crate::state::SharedState;

#[derive(Serialize)]
pub struct AuditVerifyResponse {
    pub audit_certificate: AuditCertificate,
    pub is_valid: bool,
    pub message: String,
}

/// Handles GET /api/v1/audit/:entity_id/:shard_id
/// Generates and verifies a cryptographic SHA-256 Merkle proof receipt for a purged entity.
pub async fn handle_verify_audit(
    State(state): State<SharedState>,
    Path((entity_id, shard_id)): Path<(String, u32)>,
) -> Result<Json<AuditVerifyResponse>, (StatusCode, String)> {
    if entity_id.trim().is_empty() || !crate::api::ingest::validate_identifier(&entity_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid 'entity_id'. Must be 3-64 characters (alphanumeric, '_', '-').".to_string(),
        ));
    }

    info!(
        "Verifying Merkle proof audit receipt for entity '{}' in shard {}",
        entity_id, shard_id
    );

    // Query SurrealDB graph for recorded unlearn relationships
    let affected_shards = state
        .surreal_client
        .get_affected_shards(&entity_id)
        .await
        .map_err(|e| {
            error!("Failed to query SurrealDB for audit verification: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("SurrealDB query error: {}", e),
            )
        })?;

    let is_graph_verified = affected_shards.contains(&shard_id);

    // Ensure entity is actually purged from both LanceDB and SurrealDB active storage
    let exists_in_shard = state
        .shard_manager
        .entity_exists(&entity_id)
        .await
        .unwrap_or(false);
    let exists_in_graph = state
        .surreal_client
        .entity_exists(&entity_id)
        .await
        .unwrap_or(false);

    // Load persisted certificate and verify its SHA-256 Merkle hash + Ed25519 signature
    let persisted_cert = state
        .surreal_client
        .get_audit_certificate(&entity_id, shard_id)
        .await
        .map_err(|e| {
            error!("Failed to query SurrealDB for audit certificate: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("SurrealDB certificate query error: {}", e),
            )
        })?;

    let (certificate, is_cert_valid) = match persisted_cert {
        Some(cert) => {
            let valid = MerkleProofGenerator::verify_certificate(&cert);
            (cert, valid)
        }
        None => (
            AuditCertificate {
                audit_id: format!("unverified_{}_{}", shard_id, entity_id),
                entity_id: entity_id.clone(),
                shard_id,
                merkle_root_hash: String::new(),
                signature: String::new(),
                timestamp_epoch: 0,
                status: "UNVERIFIED".to_string(),
            },
            false,
        ),
    };

    let is_valid = is_graph_verified && !exists_in_shard && !exists_in_graph && is_cert_valid;

    let message = if is_valid {
        format!(
            "Merkle root hash, Ed25519 signature, and SurrealDB audit relation successfully verified for entity '{}' on shard {}",
            entity_id, shard_id
        )
    } else if !is_graph_verified {
        format!(
            "Entity '{}' has no recorded purge relation on shard {} in SurrealDB",
            entity_id, shard_id
        )
    } else if exists_in_shard || exists_in_graph {
        format!(
            "Entity '{}' still has active data in storage and is not fully purged",
            entity_id
        )
    } else {
        format!(
            "Missing or cryptographically invalid audit certificate for entity '{}' on shard {}",
            entity_id, shard_id
        )
    };

    Ok(Json(AuditVerifyResponse {
        audit_certificate: certificate,
        is_valid,
        message,
    }))
}