use rust_gateway::api::ingest::validate_identifier;

#[test]
fn test_valid_identifiers() {
    assert!(validate_identifier("user_123"));
    assert!(validate_identifier("doc-456"));
    assert!(validate_identifier("entity_alpha_beta"));
    assert!(validate_identifier("SHARD-99"));
    assert!(validate_identifier("abc")); // Minimum valid length: 3
    assert!(validate_identifier(&"a".repeat(64))); // Maximum valid length: 64
}

#[test]
fn test_invalid_identifiers_length() {
    assert!(!validate_identifier(""));
    assert!(!validate_identifier("a"));
    assert!(!validate_identifier("ab"));
    assert!(!validate_identifier(&"a".repeat(65))); // Exceeds 64 chars
}

#[test]
fn test_invalid_identifiers_characters() {
    assert!(!validate_identifier("user@123"));
    assert!(!validate_identifier("user 123"));
    assert!(!validate_identifier("user.name"));
    assert!(!validate_identifier("user$id"));
    assert!(!validate_identifier("entity#42"));
    assert!(!validate_identifier("<script>"));
    assert!(!validate_identifier("user;DROP TABLE"));
}
