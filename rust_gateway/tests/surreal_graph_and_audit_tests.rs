use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use rust_gateway::api::audit::handle_verify_audit;
use rust_gateway::api::unlearn::{handle_unlearn, UnlearnRequest};
use rust_gateway::audit::merkle_proof::MerkleProofGenerator;
use rust_gateway::graph::GraphClient;
use rust_gateway::grpc_client::MlClient;
use rust_gateway::sisa::shard_manager::SisaShardManager;
use rust_gateway::state::AppState;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::broadcast;

#[tokio::test]
async fn test_surreal_multi_entity_concept_isolation_and_audit() {
    let tmp = tempdir().expect("create tempdir");
    let db_path = tmp.path().join("surreal_db");
    let client = GraphClient::new(db_path.to_str().unwrap())
        .await
        .expect("connect surreal");

    // Two entities share the exact same concept name "Paris"
    client
        .insert_triplet("Alice", "LIVES_IN", "Paris", 1, "entity_alice")
        .await
        .expect("insert alice triplet");
    client
        .insert_triplet("Bob", "VISITED", "Paris", 2, "entity_bob")
        .await
        .expect("insert bob triplet");

    assert!(client.entity_exists("entity_alice").await.expect("alice exists"));
    assert!(client.entity_exists("entity_bob").await.expect("bob exists"));

    // Purge Bob's subgraph — Alice's subgraph and shared "Paris" concept must remain intact
    client
        .purge_entity_subgraph("entity_bob")
        .await
        .expect("purge bob");

    assert!(!client.entity_exists("entity_bob").await.expect("bob gone"));
    assert!(client.entity_exists("entity_alice").await.expect("alice intact"));

    // Record unlearn relation and audit certificate for Bob
    client
        .record_unlearn_relation("entity_bob", 2)
        .await
        .expect("record unlearn relation");

    let shards = client
        .get_affected_shards("entity_bob")
        .await
        .expect("affected shards");
    assert_eq!(shards, vec![2]);

    let cert = MerkleProofGenerator::generate_certificate("entity_bob", 2);
    client
        .save_audit_certificate(&cert)
        .await
        .expect("save audit certificate");

    let fetched = client
        .get_audit_certificate("entity_bob", 2)
        .await
        .expect("fetch audit certificate")
        .expect("certificate must exist");
    assert_eq!(fetched.audit_id, cert.audit_id);
    assert_eq!(fetched.merkle_root_hash, cert.merkle_root_hash);
    assert_eq!(fetched.signature, cert.signature);
    assert!(MerkleProofGenerator::verify_certificate(&fetched));
}

#[tokio::test]
async fn test_unlearn_and_audit_verify_handlers_end_to_end() {
    let tmp = tempdir().expect("create tempdir");
    let lance_path = tmp.path().join("lancedb");
    let surreal_path = tmp.path().join("surreal_db");

    let lance_conn = lancedb::connect(lance_path.to_str().unwrap())
        .execute()
        .await
        .expect("lance connect");
    let shard_manager = SisaShardManager::new(lance_conn, 4, 4);
    let surreal_client = GraphClient::new(surreal_path.to_str().unwrap())
        .await
        .expect("surreal connect");
    let ml_client = MlClient::connect("http://127.0.0.1:50051".to_string())
        .await
        .expect("lazy ml client");
    let (ws_sender, _) = broadcast::channel(16);

    let state = Arc::new(AppState {
        ml_client,
        shard_manager,
        surreal_client,
        ws_sender,
    });

    // Seed entity into LanceDB + SurrealDB directly
    let entity_id = "user_e2e_1";
    let shard_id = state
        .shard_manager
        .insert_vector("doc_e2e_1", entity_id, &[0.1, 0.2, 0.3, 0.4])
        .await
        .expect("insert vector");
    state
        .surreal_client
        .insert_triplet("User", "OWNS", "Portfolio", shard_id, entity_id)
        .await
        .expect("insert triplet");

    // Audit verification before unlearn must return is_valid == false
    let Json(pre_audit) = handle_verify_audit(
        State(state.clone()),
        Path((entity_id.to_string(), shard_id)),
    )
    .await
    .expect("pre-unlearn audit call");
    assert!(!pre_audit.is_valid);
    assert_eq!(pre_audit.audit_certificate.status, "UNVERIFIED");

    // Execute unlearn
    let Json(unlearn_resp) = handle_unlearn(
        State(state.clone()),
        Json(UnlearnRequest {
            entity_id: entity_id.to_string(),
        }),
    )
    .await
    .expect("unlearn succeeds");
    assert_eq!(unlearn_resp.shard_id, shard_id);
    assert_eq!(unlearn_resp.status, "PURGED_AND_VERIFIED");
    assert!(MerkleProofGenerator::verify_certificate(
        &unlearn_resp.audit_certificate
    ));

    // Audit verification after unlearn must return is_valid == true
    let Json(post_audit) = handle_verify_audit(
        State(state.clone()),
        Path((entity_id.to_string(), shard_id)),
    )
    .await
    .expect("post-unlearn audit call");
    assert!(post_audit.is_valid);
    assert_eq!(
        post_audit.audit_certificate.audit_id,
        unlearn_resp.audit_certificate.audit_id
    );

    // Unlearning again must return 404 NOT_FOUND
    let second_unlearn = handle_unlearn(
        State(state.clone()),
        Json(UnlearnRequest {
            entity_id: entity_id.to_string(),
        }),
    )
    .await;
    assert!(matches!(second_unlearn, Err((StatusCode::NOT_FOUND, _))));
}

