use rust_gateway::sisa::shard_manager::SisaShardManager;
use tempfile::tempdir;

#[tokio::test]
async fn test_deterministic_shard_mapping() {
    let tmp = tempdir().expect("create tempdir");
    let conn = lancedb::connect(tmp.path().to_str().unwrap())
        .execute()
        .await
        .expect("lance connect");
    let manager = SisaShardManager::new(conn, 4, 384);

    let entity_id = "customer_9942";
    let shard_first = manager.get_shard_id(entity_id);
    let shard_second = manager.get_shard_id(entity_id);
    let shard_third = manager.get_shard_id(entity_id);

    assert_eq!(shard_first, shard_second);
    assert_eq!(shard_second, shard_third);
    assert!(shard_first < 4);
}

#[tokio::test]
async fn test_shard_id_bounds_across_distributions() {
    let tmp = tempdir().expect("create tempdir");
    let conn = lancedb::connect(tmp.path().to_str().unwrap())
        .execute()
        .await
        .expect("lance connect");

    for num_shards in [2, 4, 8, 16] {
        let manager = SisaShardManager::new(conn.clone(), num_shards, 384);
        for i in 0..100 {
            let entity_id = format!("entity_sample_{}", i);
            let shard_id = manager.get_shard_id(&entity_id);
            assert!(
                shard_id < num_shards,
                "Shard ID {} must be strictly less than num_shards {}",
                shard_id,
                num_shards
            );
        }
    }
}

#[tokio::test]
async fn test_shard_locks_concurrency() {
    let tmp = tempdir().expect("create tempdir");
    let conn = lancedb::connect(tmp.path().to_str().unwrap())
        .execute()
        .await
        .expect("lance connect");
    let manager = SisaShardManager::new(conn, 4, 384);

    let lock0 = manager.get_shard_lock(0);
    let lock1 = manager.get_shard_lock(1);

    // Acquire read lock on shard 0
    let read_guard1 = lock0.read().await;
    // Multiple readers allowed on shard 0
    let read_guard2 = lock0.read().await;

    // Different shard lock is independent
    let write_guard1 = lock1.write().await;

    drop(read_guard1);
    drop(read_guard2);
    drop(write_guard1);
}

#[tokio::test]
async fn test_lancedb_vector_insert_exist_and_purge() {
    let tmp = tempdir().expect("create tempdir");
    let conn = lancedb::connect(tmp.path().to_str().unwrap())
        .execute()
        .await
        .expect("lance connect");
    let dim = 8; // Small dimension for unit test
    let manager = SisaShardManager::new(conn, 4, dim);

    let entity_id = "patient_alpha";
    let doc_id = "doc_001";
    let vector: Vec<f32> = vec![0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

    // Entity does not exist initially
    let exists_before = manager.entity_exists(entity_id).await.expect("query exists");
    assert!(!exists_before);

    // Insert vector
    let assigned_shard = manager
        .insert_vector(doc_id, entity_id, &vector)
        .await
        .expect("insert vector");
    assert_eq!(assigned_shard, manager.get_shard_id(entity_id));

    // Entity must now exist
    let exists_after = manager.entity_exists(entity_id).await.expect("query exists");
    assert!(exists_after);

    // Purge entity
    let purged_shard = manager.purge_entity(entity_id).await.expect("purge entity");
    assert_eq!(purged_shard, assigned_shard);

    // Entity must no longer exist
    let exists_post_purge = manager.entity_exists(entity_id).await.expect("query exists");
    assert!(!exists_post_purge);
}
