# Changelog

All notable changes to the **Auditable Machine Unlearning Engine** are documented in this file.

## [v1.0.0] - 2026-11-16

### Features
- **Rust Axum Gateway (`rust_gateway`)**: REST API (`/api/v1/ingest`, `/api/v1/ingest/batch`, `/api/v1/unlearn`, `/api/v1/unlearn/batch`, `/api/v1/audit/:entity_id/:shard_id`, `/health`) and real-time WebSocket telemetry (`/ws` with 30s ping heartbeats).
- **SISA Sharded Vector Storage**: Deterministic entity-to-shard partitioning backed by LanceDB (`shard_0`..`shard_3`) with per-shard `RwLock` concurrency control and micro-purge support.
- **SurrealDB Property Graph**: Entity-isolated `concept` and `KNOWLEDGE` triplet storage with `PURGED_FROM` relation tracking and persistent `audit_certificates` ledger.
- **Cryptographic Audit Receipts**: SHA-256 Merkle root digests signed and verified with Ed25519 (`MerkleProofGenerator::generate_certificate` and `verify_certificate`).
- **Python ML gRPC Worker (`ml_worker`)**: `SentenceTransformer` (`all-MiniLM-L6-v2`, 384-d normalized embeddings) and spaCy (`en_core_web_sm`) NLP triplet extraction over gRPC.
- **Next.js Dashboard (`frontend`)**: Interactive SISA topology graph canvas with purge disintegration particles, ingestion/unlearn/batch forms, and cryptographic Merkle audit verification drawer.
- **Container & CI Infrastructure**: Multi-stage Dockerfiles, `docker-compose.yml`, `Makefile`, protobuf generation script, and GitHub Actions CI pipeline.

### Security & Stability Fixes
- Enforced Ed25519 signature, SHA-256 digest, and active-storage purge verification in `GET /api/v1/audit/:entity_id/:shard_id`, plus unique collision-free `audit_id` generation.
- Scoped SurrealDB `concept` IDs per `entity_id`, enabled SurrealQL `.check()?` error propagation, and switched `insert_vector` to exclusive shard write locks with dimension validation and idempotent document upsert.
- Added batch input validation, concurrent `JoinSet` batch unlearning, gRPC `INVALID_ARGUMENT` handling for empty batch texts, and copular (`AUX`/`attr`/`oprd`) triplet extraction.
- Fixed frontend certificate/link deduplication, one-shot particle purge animations, and unmount-safe WebSocket cleanup.
