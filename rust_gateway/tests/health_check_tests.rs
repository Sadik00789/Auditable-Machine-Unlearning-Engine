use rust_gateway::health_check;

#[tokio::test]
async fn test_health_check_response() {
    let status = health_check().await;
    assert_eq!(status, "Auditable Unlearning Gateway is running.");
}
