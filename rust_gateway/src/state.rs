use crate::audit::merkle_proof::AuditCertificate;
use crate::graph::GraphClient;
use crate::grpc_client::MlClient;
use crate::sisa::shard_manager::SisaShardManager;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsEvent {
    NodeIngested {
        id: String,
        entity_id: String,
        shard_id: u32,
    },
    NodeDeleted {
        entity_id: String,
        shard_id: u32,
    },
    AuditGenerated {
        audit_certificate: AuditCertificate,
    },
}

pub struct AppState {
    pub ml_client: MlClient,
    pub shard_manager: SisaShardManager,
    pub surreal_client: GraphClient,
    pub ws_sender: broadcast::Sender<WsEvent>,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub async fn new(
        grpc_endpoint: String,
        lance_uri: &str,
        surreal_db_path: &str,
        num_shards: u32,
        embedding_dim: usize,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        tracing::info!("Connecting to gRPC ML Worker at {}", grpc_endpoint);
        let ml_client = MlClient::connect(grpc_endpoint).await?;

        tracing::info!("Connecting to LanceDB at {}", lance_uri);
        let lance_conn = lancedb::connect(lance_uri).execute().await?;
        let shard_manager = SisaShardManager::new(lance_conn, num_shards, embedding_dim);

        tracing::info!("Connecting to SurrealDB at {}", surreal_db_path);
        let surreal_client = GraphClient::new(surreal_db_path).await?;

        let (ws_sender, _) = broadcast::channel(256);

        Ok(Self {
            ml_client,
            shard_manager,
            surreal_client,
            ws_sender,
        })
    }
}