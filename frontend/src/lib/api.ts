import {
  IngestRequest,
  IngestResponse,
  UnlearnRequest,
  UnlearnResponse,
  AuditVerifyResponse,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const errorText = await response.text();
  if (!errorText) return fallback;
  try {
    const parsed = JSON.parse(errorText);
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // Plain-text error response
  }
  return errorText;
}

export async function ingestData(data: IngestRequest): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `Ingest failed with status ${response.status}`));
  }

  return response.json();
}

export async function ingestBatchData(items: IngestRequest[]): Promise<{ results: IngestResponse[]; total_processed: number }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ingest/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `Batch ingest failed with status ${response.status}`));
  }

  return response.json();
}

export async function triggerUnlearn(data: UnlearnRequest): Promise<UnlearnResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/unlearn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `Unlearn execution failed with status ${response.status}`));
  }

  return response.json();
}

export async function verifyAudit(
  entityId: string,
  shardId: number
): Promise<AuditVerifyResponse> {
  const encodedEntity = encodeURIComponent(entityId);
  const response = await fetch(`${API_BASE_URL}/api/v1/audit/${encodedEntity}/${shardId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `Audit verification failed with status ${response.status}`));
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) return { status: 'ERROR' };
    const text = await response.text();
    return { status: text };
  } catch (err) {
    return { status: 'OFFLINE' };
  }
}
