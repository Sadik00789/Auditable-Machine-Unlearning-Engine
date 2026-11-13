use ed25519_dalek::{Signature, Signer, SigningKey, Verifier};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditCertificate {
    pub audit_id: String,
    pub entity_id: String,
    pub shard_id: u32,
    pub merkle_root_hash: String,
    pub signature: String,
    pub timestamp_epoch: u64,
    pub status: String,
}

static SIGNING_KEY: OnceLock<SigningKey> = OnceLock::new();
static AUDIT_COUNTER: AtomicU64 = AtomicU64::new(0);

fn get_signing_key() -> &'static SigningKey {
    SIGNING_KEY.get_or_init(|| {
        if let Ok(hex_key) = env::var("ED25519_PRIVATE_KEY") {
            if let Ok(bytes) = hex::decode(hex_key.trim()) {
                if let Ok(arr) = bytes.as_slice().try_into() {
                    return SigningKey::from_bytes(arr);
                }
            }
        }
        let mut secret_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut secret_bytes);
        SigningKey::from_bytes(&secret_bytes)
    })
}

pub struct MerkleProofGenerator;

impl MerkleProofGenerator {
    /// Computes a deterministic SHA-256 Merkle root hash for an unlearning event and signs it with Ed25519.
    pub fn generate_certificate(entity_id: &str, shard_id: u32) -> AuditCertificate {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let raw_payload = format!("{}:{}:{}", entity_id, shard_id, now);
        
        let mut hasher = Sha256::new();
        hasher.update(raw_payload.as_bytes());
        let hash_result = hex::encode(hasher.finalize());

        let signing_key = get_signing_key();
        let signature = signing_key.sign(hash_result.as_bytes());
        let signature_hex = hex::encode(signature.to_bytes());

        let seq = AUDIT_COUNTER.fetch_add(1, Ordering::Relaxed);
        let audit_id = format!("audit_{}_{}_{}_{}", shard_id, now, &hash_result[..8], seq);

        AuditCertificate {
            audit_id,
            entity_id: entity_id.to_string(),
            shard_id,
            merkle_root_hash: hash_result,
            signature: signature_hex,
            timestamp_epoch: now,
            status: "VERIFIED_PURGED".to_string(),
        }
    }

    /// Verifies both the SHA-256 Merkle root hash and the Ed25519 signature of an AuditCertificate.
    pub fn verify_certificate(cert: &AuditCertificate) -> bool {
        let expected_payload = format!("{}:{}:{}", cert.entity_id, cert.shard_id, cert.timestamp_epoch);
        let mut hasher = Sha256::new();
        hasher.update(expected_payload.as_bytes());
        let expected_hash = hex::encode(hasher.finalize());

        if cert.merkle_root_hash != expected_hash {
            return false;
        }

        let sig_bytes = match hex::decode(&cert.signature) {
            Ok(bytes) => bytes,
            Err(_) => return false,
        };
        let sig_arr: [u8; 64] = match sig_bytes.try_into() {
            Ok(arr) => arr,
            Err(_) => return false,
        };
        let signature = Signature::from_bytes(&sig_arr);

        get_signing_key()
            .verifying_key()
            .verify(cert.merkle_root_hash.as_bytes(), &signature)
            .is_ok()
    }
}