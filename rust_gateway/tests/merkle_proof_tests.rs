use ed25519_dalek::Signature;
use rust_gateway::audit::merkle_proof::MerkleProofGenerator;
use std::convert::TryInto;

#[test]
fn test_merkle_proof_generation_fields() {
    let entity_id = "patient_9012";
    let shard_id = 2;
    let cert = MerkleProofGenerator::generate_certificate(entity_id, shard_id);

    assert_eq!(cert.entity_id, entity_id);
    assert_eq!(cert.shard_id, shard_id);
    assert_eq!(cert.status, "VERIFIED_PURGED");
    assert!(cert.audit_id.starts_with("audit_2_"));
    assert!(cert.timestamp_epoch > 0);

    // Merkle root hash must be a 64-character SHA-256 hex string
    assert_eq!(cert.merkle_root_hash.len(), 64);
    assert!(hex::decode(&cert.merkle_root_hash).is_ok());

    // Ed25519 signature must be a 128-character hex string (64 bytes)
    assert_eq!(cert.signature.len(), 128);
    assert!(hex::decode(&cert.signature).is_ok());
}

#[test]
fn test_merkle_proof_signature_format_and_entropy() {
    let cert1 = MerkleProofGenerator::generate_certificate("entity_alpha", 0);
    let cert2 = MerkleProofGenerator::generate_certificate("entity_beta", 1);

    // Different entities on different shards must have distinct hashes and signatures
    assert_ne!(cert1.merkle_root_hash, cert2.merkle_root_hash);
    assert_ne!(cert1.signature, cert2.signature);
    assert_ne!(cert1.audit_id, cert2.audit_id);

    // Signatures must decode to exactly 64-byte Ed25519 signatures
    let sig1_bytes = hex::decode(&cert1.signature).expect("valid hex");
    let sig1_arr: [u8; 64] = sig1_bytes.try_into().expect("64 bytes");
    let _signature = Signature::from_bytes(&sig1_arr);
}

#[test]
fn test_merkle_root_hash_determinism() {
    use sha2::{Digest, Sha256};

    let entity_id = "user_4040";
    let shard_id = 3;
    let cert = MerkleProofGenerator::generate_certificate(entity_id, shard_id);

    // Reconstruct the raw payload from the certificate's timestamp
    let expected_payload = format!("{}:{}:{}", entity_id, shard_id, cert.timestamp_epoch);
    let mut hasher = Sha256::new();
    hasher.update(expected_payload.as_bytes());
    let expected_hash = hex::encode(hasher.finalize());

    assert_eq!(cert.merkle_root_hash, expected_hash);
}

#[test]
fn test_merkle_certificate_verification_and_tamper_detection() {
    let cert = MerkleProofGenerator::generate_certificate("patient_verify_1", 1);
    assert!(MerkleProofGenerator::verify_certificate(&cert));

    // Tampered entity_id must fail verification
    let mut tampered_entity = cert.clone();
    tampered_entity.entity_id = "patient_verify_2".to_string();
    assert!(!MerkleProofGenerator::verify_certificate(&tampered_entity));

    // Tampered merkle_root_hash must fail verification
    let mut tampered_hash = cert.clone();
    tampered_hash.merkle_root_hash = "0".repeat(64);
    assert!(!MerkleProofGenerator::verify_certificate(&tampered_hash));

    // Tampered signature must fail verification
    let mut tampered_sig = cert.clone();
    tampered_sig.signature = "f".repeat(128);
    assert!(!MerkleProofGenerator::verify_certificate(&tampered_sig));
}

#[test]
fn test_unique_audit_ids_within_same_second() {
    let cert_a = MerkleProofGenerator::generate_certificate("entity_same_sec_a", 0);
    let cert_b = MerkleProofGenerator::generate_certificate("entity_same_sec_b", 0);
    let cert_a_again = MerkleProofGenerator::generate_certificate("entity_same_sec_a", 0);

    assert_ne!(cert_a.audit_id, cert_b.audit_id);
    assert_ne!(cert_a.audit_id, cert_a_again.audit_id);
}
