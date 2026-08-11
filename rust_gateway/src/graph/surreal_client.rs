use serde::{Deserialize, Serialize};
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use std::sync::Arc;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct EntityNode {
    pub entity_id: String,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct ShardNode {
    pub shard_id: u32,
}

#[derive(Clone)]
pub struct GraphClient {
    db: Arc<Surreal<Db>>,
}

impl GraphClient {
    /// Initializes an embedded SurrealDB instance backed by SurrealKV on local disk
    pub async fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let db = Surreal::new::<SurrealKv>(db_path).await?;
        
        db.use_ns("unlearning_engine")
          .use_db("audit_graph")
          .await?;

        Ok(Self {
            db: Arc::new(db),
        })
    }

    /// Inserts an extracted NLP knowledge triplet into SurrealDB graph
    pub async fn insert_triplet(
        &self,
        subject: &str,
        predicate: &str,
        object: &str,
        shard_id: u32,
        entity_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            LET $sub = type::thing('concept', $subject);
            LET $obj = type::thing('concept', $object);
            UPSERT $sub SET name = $subject, entity_id = $entity_id;
            UPSERT $obj SET name = $object, entity_id = $entity_id;
            RELATE $sub->KNOWLEDGE->$obj SET predicate = $predicate, shard_id = $shard_id, entity_id = $entity_id, timestamp = time::now();
        ";

        self.db
            .query(sql)
            .bind(("subject", subject.to_string()))
            .bind(("predicate", predicate.to_string()))
            .bind(("object", object.to_string()))
            .bind(("shard_id", shard_id))
            .bind(("entity_id", entity_id.to_string()))
            .await?;

        Ok(())
    }

    /// Purges all knowledge subgraphs and concept nodes associated with an entity ID
    pub async fn purge_entity_subgraph(
        &self,
        entity_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            DELETE KNOWLEDGE WHERE entity_id = $entity_id;
            DELETE concept WHERE entity_id = $entity_id;
        ";

        self.db
            .query(sql)
            .bind(("entity_id", entity_id.to_string()))
            .await?;

        Ok(())
    }

    /// Records an unlearning/purge relation between an entity and a SISA shard
    pub async fn record_unlearn_relation(
        &self,
        entity_id: &str,
        shard_id: u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            LET $from = type::thing('entity', $entity_id);
            LET $to = type::thing('shard', $shard_id);
            UPSERT $from SET entity_id = $entity_id, updated_at = time::now();
            UPSERT $to SET shard_id = $shard_id, updated_at = time::now();
            RELATE $from->PURGED_FROM->$to SET timestamp = time::now();
        ";

        self.db
            .query(sql)
            .bind(("entity_id", entity_id.to_string()))
            .bind(("shard_id", shard_id))
            .await?;

        Ok(())
    }

    /// Queries all shards connected to an entity for audit verification
    pub async fn get_affected_shards(
        &self,
        entity_id: &str,
    ) -> Result<Vec<u32>, Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            SELECT VALUE ->PURGED_FROM->shard.shard_id 
            FROM entity 
            WHERE entity_id = $entity_id;
        ";

        let mut response = self
            .db
            .query(sql)
            .bind(("entity_id", entity_id.to_string()))
            .await?;

        let shards_nested: Vec<Vec<u32>> = response.take(0).unwrap_or_default();
        let shards: Vec<u32> = shards_nested.into_iter().flatten().collect();
        Ok(shards)
    }

    /// Checks if an entity exists in SurrealDB property graph
    pub async fn entity_exists(
        &self,
        entity_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            SELECT count() FROM concept WHERE entity_id = $entity_id GROUP ALL;
        ";

        let mut response = self
            .db
            .query(sql)
            .bind(("entity_id", entity_id.to_string()))
            .await?;

        #[derive(Deserialize)]
        struct CountResult {
            count: usize,
        }

        let results: Vec<CountResult> = response.take(0).unwrap_or_default();
        let count = results.first().map(|r| r.count).unwrap_or(0);
        Ok(count > 0)
    }

    /// Saves an AuditCertificate to SurrealDB audit_certificates table
    pub async fn save_audit_certificate(
        &self,
        cert: &crate::audit::merkle_proof::AuditCertificate,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            CREATE audit_certificates CONTENT {
                audit_id: $audit_id,
                entity_id: $entity_id,
                shard_id: $shard_id,
                merkle_root_hash: $merkle_root_hash,
                signature: $signature,
                timestamp_epoch: $timestamp_epoch,
                status: $status
            };
        ";

        self.db
            .query(sql)
            .bind(("audit_id", cert.audit_id.clone()))
            .bind(("entity_id", cert.entity_id.clone()))
            .bind(("shard_id", cert.shard_id))
            .bind(("merkle_root_hash", cert.merkle_root_hash.clone()))
            .bind(("signature", cert.signature.clone()))
            .bind(("timestamp_epoch", cert.timestamp_epoch))
            .bind(("status", cert.status.clone()))
            .await?;

        Ok(())
    }

    /// Fetches an AuditCertificate from SurrealDB audit_certificates table
    pub async fn get_audit_certificate(
        &self,
        entity_id: &str,
        shard_id: u32,
    ) -> Result<Option<crate::audit::merkle_proof::AuditCertificate>, Box<dyn std::error::Error + Send + Sync>> {
        let sql = "
            SELECT * FROM audit_certificates 
            WHERE entity_id = $entity_id AND shard_id = $shard_id 
            ORDER BY timestamp_epoch DESC LIMIT 1;
        ";

        let mut response = self
            .db
            .query(sql)
            .bind(("entity_id", entity_id.to_string()))
            .bind(("shard_id", shard_id))
            .await?;

        let certs: Vec<crate::audit::merkle_proof::AuditCertificate> = response.take(0).unwrap_or_default();
        Ok(certs.into_iter().next())
    }
}