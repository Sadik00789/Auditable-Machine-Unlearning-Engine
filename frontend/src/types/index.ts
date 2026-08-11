export type WsConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface IngestRequest {
  id: string;
  entity_id: string;
  text: string;
}

export interface IngestResponse {
  id: string;
  entity_id: string;
  shard_id: number;
  triplets_extracted: number;
  status: string;
}

export interface UnlearnRequest {
  entity_id: string;
}

export interface AuditCertificate {
  audit_id: string;
  entity_id: string;
  shard_id: number;
  merkle_root_hash: string;
  signature?: string;
  timestamp_epoch: number;
  status: string;
}

export interface UnlearnResponse {
  entity_id: string;
  shard_id: number;
  audit_certificate: AuditCertificate;
  status: string;
}

export interface AuditVerifyResponse {
  audit_certificate: AuditCertificate;
  is_valid: boolean;
  message: string;
}

export type WsEventType = 'NodeIngested' | 'NodeDeleted' | 'AuditGenerated' | 'CONNECTED';

export interface NodeIngestedPayload {
  id: string;
  entity_id: string;
  shard_id: number;
}

export interface NodeDeletedPayload {
  entity_id: string;
  shard_id: number;
}

export interface AuditGeneratedPayload {
  audit_certificate: AuditCertificate;
}

export type WsEvent =
  | { type: 'NodeIngested'; payload: NodeIngestedPayload; timestamp?: string }
  | { type: 'NodeDeleted'; payload: NodeDeletedPayload; timestamp?: string }
  | { type: 'AuditGenerated'; payload: AuditGeneratedPayload; timestamp?: string }
  | { type: 'CONNECTED'; status: string; timestamp: string };

export interface GraphNode {
  id: string;
  label: string;
  type: 'shard' | 'entity';
  shardId: number;
  entityId?: string;
  status: 'active' | 'purging' | 'purged';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  createdAt: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
}

export interface EngineMetrics {
  wsStatus: WsConnectionStatus;
  activeShardsCount: number;
  ingestedEntitiesCount: number;
  purgedEntitiesCount: number;
  latestMerkleRoot: string;
  isBackendHealthy: boolean;
}
