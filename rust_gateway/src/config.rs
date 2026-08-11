use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_host: String,
    pub server_port: u16,
    pub grpc_ml_worker_endpoint: String,
    pub lancedb_uri: String,
    pub surreal_db_path: String,
    pub num_sisa_shards: u32,
}

impl Config {
    /// Loads configuration variables from environment variables with fallback production defaults.
    pub fn from_env() -> Self {
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());

        let server_port = env::var("SERVER_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);

        let grpc_ml_worker_endpoint = env::var("GRPC_ML_WORKER_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:50051".to_string());

        let lancedb_uri = env::var("LANCEDB_URI")
            .unwrap_or_else(|_| "../data/lancedb_shards".to_string());

        let surreal_db_path = env::var("SURREAL_DB_PATH")
            .unwrap_or_else(|_| "../data/surreal_graph".to_string());

        let num_sisa_shards = env::var("NUM_SISA_SHARDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4);

        Self {
            server_host,
            server_port,
            grpc_ml_worker_endpoint,
            lancedb_uri,
            surreal_db_path,
            num_sisa_shards,
        }
    }

    /// Returns the formatted TCP socket address string.
    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}