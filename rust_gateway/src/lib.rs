#![recursion_limit = "512"]

pub mod api;
pub mod audit;
pub mod config;
pub mod graph;
pub mod grpc_client;
pub mod sisa;
pub mod state;
pub mod ws;

pub async fn health_check() -> &'static str {
    "Auditable Unlearning Gateway is running."
}
