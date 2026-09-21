use rust_gateway::config::Config;
use std::env;

#[test]
fn test_config_lifecycle() {
    // 1. Ensure clean environment to test default fallback values
    env::remove_var("SERVER_PORT");
    env::remove_var("SERVER_HOST");
    env::remove_var("NUM_SISA_SHARDS");
    env::remove_var("GRPC_ML_WORKER_ENDPOINT");

    let config = Config::from_env();
    assert_eq!(config.server_host, "127.0.0.1");
    assert_eq!(config.server_port, 8080);
    assert_eq!(config.server_addr(), "127.0.0.1:8080");
    assert_eq!(config.num_sisa_shards, 4);
    assert_eq!(config.grpc_ml_worker_endpoint, "http://127.0.0.1:50051");

    // 2. Set custom environment overrides
    env::set_var("SERVER_PORT", "9090");
    env::set_var("SERVER_HOST", "0.0.0.0");
    env::set_var("NUM_SISA_SHARDS", "8");

    let custom = Config::from_env();
    assert_eq!(custom.server_host, "0.0.0.0");
    assert_eq!(custom.server_port, 9090);
    assert_eq!(custom.server_addr(), "0.0.0.0:9090");
    assert_eq!(custom.num_sisa_shards, 8);

    // 3. Clean up environment
    env::remove_var("SERVER_PORT");
    env::remove_var("SERVER_HOST");
    env::remove_var("NUM_SISA_SHARDS");
}
