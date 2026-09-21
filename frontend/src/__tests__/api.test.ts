import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ingestData,
  ingestBatchData,
  triggerUnlearn,
  verifyAudit,
  checkHealth,
} from '@/lib/api';

describe('Frontend API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ingestData sends POST request with correct payload', async () => {
    const mockResponse = {
      id: 'doc_101',
      entity_id: 'user_42',
      shard_id: 1,
      triplets_extracted: 3,
      status: 'INGESTED',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await ingestData({
      id: 'doc_101',
      entity_id: 'user_42',
      text: 'Sample test record for unlearning',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ingest'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'doc_101',
          entity_id: 'user_42',
          text: 'Sample test record for unlearning',
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('ingestData throws an error on failure response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid payload identifier',
    });

    await expect(
      ingestData({ id: 'bad', entity_id: 'bad', text: 'fail' })
    ).rejects.toThrow('Invalid payload identifier');
  });

  it('ingestBatchData sends POST to /api/v1/ingest/batch', async () => {
    const mockBatchResponse = {
      results: [
        {
          id: 'doc_1',
          entity_id: 'user_1',
          shard_id: 0,
          triplets_extracted: 2,
          status: 'INGESTED',
        },
      ],
      total_processed: 1,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBatchResponse,
    });

    const batch = [
      { id: 'doc_1', entity_id: 'user_1', text: 'Batch content' },
    ];
    const result = await ingestBatchData(batch);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ingest/batch'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(result.total_processed).toBe(1);
  });

  it('triggerUnlearn sends POST to /api/v1/unlearn', async () => {
    const mockUnlearnResponse = {
      entity_id: 'target_entity',
      shard_id: 2,
      audit_certificate: {
        audit_id: 'audit_2_100',
        entity_id: 'target_entity',
        shard_id: 2,
        merkle_root_hash: 'a'.repeat(64),
        timestamp_epoch: 12345678,
        status: 'VERIFIED_PURGED',
      },
      status: 'PURGED',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUnlearnResponse,
    });

    const result = await triggerUnlearn({ entity_id: 'target_entity' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/unlearn'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entity_id: 'target_entity' }),
      })
    );
    expect(result.status).toBe('PURGED');
    expect(result.audit_certificate.status).toBe('VERIFIED_PURGED');
  });

  it('verifyAudit sends GET to /api/v1/audit/:entityId/:shardId', async () => {
    const mockVerifyResponse = {
      audit_certificate: {
        audit_id: 'audit_1_001',
        entity_id: 'entity/special',
        shard_id: 1,
        merkle_root_hash: 'b'.repeat(64),
        timestamp_epoch: 12345679,
        status: 'VERIFIED_PURGED',
      },
      is_valid: true,
      message: 'Merkle certificate verified successfully',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerifyResponse,
    });

    const result = await verifyAudit('entity/special', 1);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/entity%2Fspecial/1'),
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
    expect(result.is_valid).toBe(true);
  });

  it('checkHealth returns running text on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'Auditable Unlearning Gateway is running.',
    });

    const result = await checkHealth();
    expect(result.status).toBe('Auditable Unlearning Gateway is running.');
  });

  it('checkHealth returns OFFLINE on network rejection', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await checkHealth();
    expect(result.status).toBe('OFFLINE');
  });
});
