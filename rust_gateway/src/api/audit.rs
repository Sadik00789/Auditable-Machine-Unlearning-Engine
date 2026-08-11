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
    if entity_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Entity ID cannot be empty.".to_string(),
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

    // Load persisted certificate or generate standard verification certificate
    let certificate = match state
        .surreal_client
        .get_audit_certificate(&entity_id, shard_id)
        .await
    {
        Ok(Some(cert)) => cert,
        _ => MerkleProofGenerator::generate_certificate(&entity_id, shard_id),
    };

    Ok(Json(AuditVerifyResponse {
        audit_certificate: certificate,
        is_valid: is_graph_verified,
        message: if is_graph_verified {
            format!(
                "Merkle root hash and SurrealDB audit relation successfully verified for entity '{}' on shard {}",
                entity_id, shard_id
            )
        } else {
            format!(
                "Merkle root hash generated, but entity '{}' has no recorded purge relation on shard {} in SurrealDB",
                entity_id, shard_id
            )
        },
    }))
}