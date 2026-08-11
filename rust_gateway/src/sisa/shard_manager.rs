use arrow_array::{
    FixedSizeListArray, Float32Array, RecordBatch, RecordBatchIterator, StringArray, UInt32Array,
};
use arrow_schema::{DataType, Field, Schema};
use lancedb::connection::Connection;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{info, warn};

#[derive(Error, Debug)]
pub enum SisaError {
    #[error("LanceDB error: {0}")]
    Lance(#[from] lancedb::Error),
    #[error("Arrow array error: {0}")]
    Arrow(#[from] arrow_schema::ArrowError),
}

#[derive(Clone)]
pub struct SisaShardManager {
    conn: Connection,
    num_shards: u32,
    dimension: usize,
    locks: Arc<HashMap<u32, Arc<RwLock<()>>>>,
}

impl SisaShardManager {
    pub fn new(conn: Connection, num_shards: u32, dimension: usize) -> Self {
        let mut locks = HashMap::new();
        for id in 0..num_shards {
            locks.insert(id, Arc::new(RwLock::new(())));
        }

        Self {
            conn,
            num_shards,
            dimension,
            locks: Arc::new(locks),
        }
    }

    /// Returns the per-shard RwLock for concurrency control.
    pub fn get_shard_lock(&self, shard_id: u32) -> Arc<RwLock<()>> {
        self.locks
            .get(&shard_id)
            .cloned()
            .unwrap_or_else(|| Arc::new(RwLock::new(())))
    }

    /// Determines which SISA shard an entity belongs to using a deterministic hash function.
    pub fn get_shard_id(&self, entity_id: &str) -> u32 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        entity_id.hash(&mut hasher);
        (hasher.finish() % self.num_shards as u64) as u32
    }

    /// Gets or creates the Arrow schema for LanceDB shards.
    fn schema(&self) -> Arc<Schema> {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("entity_id", DataType::Utf8, false),
            Field::new(
                "vector",
                DataType::FixedSizeList(
                    Arc::new(Field::new("item", DataType::Float32, true)),
                    self.dimension as i32,
                ),
                false,
            ),
            Field::new("shard_id", DataType::UInt32, false),
        ]))
    }

    /// Inserts a vector embedding into its assigned SISA shard table.
    pub async fn insert_vector(
        &self,
        id: &str,
        entity_id: &str,
        vector: &[f32],
    ) -> Result<u32, SisaError> {
        let shard_id = self.get_shard_id(entity_id);
        let lock = self.get_shard_lock(shard_id);
        let _read_guard = lock.read().await;

        let table_name = format!("shard_{}", shard_id);

        let schema = self.schema();
        let id_array = Arc::new(StringArray::from(vec![id]));
        let entity_array = Arc::new(StringArray::from(vec![entity_id]));
        let shard_array = Arc::new(UInt32Array::from(vec![shard_id]));

        let vector_values = Arc::new(Float32Array::from(vector.to_vec()));
        let item_field = Arc::new(Field::new("item", DataType::Float32, true));
        let vector_array = Arc::new(FixedSizeListArray::try_new(
            item_field,
            self.dimension as i32,
            vector_values,
            None,
        )?);

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![id_array, entity_array, vector_array, shard_array],
        )?;

        let reader = RecordBatchIterator::new(vec![Ok(batch)], schema.clone());

        let table_names = self.conn.table_names().execute().await?;
        if table_names.contains(&table_name) {
            let table = self.conn.open_table(&table_name).execute().await?;
            table.add(reader).execute().await?;
        } else {
            self.conn
                .create_table(&table_name, reader)
                .execute()
                .await?;
        }

        info!("Inserted vector {} into shard table '{}'", id, table_name);
        Ok(shard_id)
    }

    /// Micro-purges all vector entries matching an entity_id from a specific SISA shard.
    pub async fn purge_entity(&self, entity_id: &str) -> Result<u32, SisaError> {
        let shard_id = self.get_shard_id(entity_id);
        let lock = self.get_shard_lock(shard_id);
        let _write_guard = lock.write().await;

        let table_name = format!("shard_{}", shard_id);

        let table_names = self.conn.table_names().execute().await?;
        if !table_names.contains(&table_name) {
            warn!("Shard table '{}' does not exist; skipping vector purge.", table_name);
            return Ok(shard_id);
        }

        let table = self.conn.open_table(&table_name).execute().await?;
        let delete_clause = format!("entity_id = '{}'", entity_id);

        table.delete(&delete_clause).await?;
        info!("Successfully purged entity '{}' from LanceDB shard '{}'", entity_id, table_name);

        Ok(shard_id)
    }

    /// Checks if an entity exists in any LanceDB SISA shard table
    pub async fn entity_exists(&self, entity_id: &str) -> Result<bool, SisaError> {
        let shard_id = self.get_shard_id(entity_id);
        let table_name = format!("shard_{}", shard_id);

        let table_names = self.conn.table_names().execute().await?;
        if !table_names.contains(&table_name) {
            return Ok(false);
        }

        let table = self.conn.open_table(&table_name).execute().await?;
        let filter = format!("entity_id = '{}'", entity_id);

        let count = table.count_rows(Some(filter)).await?;
        Ok(count > 0)
    }
}