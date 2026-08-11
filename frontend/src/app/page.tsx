'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MetricsHeader } from '@/components/MetricsHeader';
import { UnlearnForm } from '@/components/UnlearnForm';
import { GraphCanvas } from '@/components/GraphCanvas';
import { AuditLogs } from '@/components/AuditLogs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { checkHealth } from '@/lib/api';
import {
  GraphNode,
  GraphLink,
  AuditCertificate,
  EngineMetrics,
  IngestResponse,
  UnlearnResponse,
} from '@/types';

export default function DashboardPage() {
  const { status: wsStatus, events, lastEvent } = useWebSocket();

  // Graph state (SISA Shards + Ingested Entities)
  const [nodes, setNodes] = useState<GraphNode[]>(() => {
    // Initial 4 SISA Shards
    return [0, 1, 2, 3].map((shardId) => ({
      id: `shard_${shardId}`,
      label: `SISA Shard #${shardId}`,
      type: 'shard',
      shardId,
      status: 'active',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 22,
      createdAt: Date.now(),
    }));
  });

  const [links, setLinks] = useState<GraphLink[]>([]);
  const [certificates, setCertificates] = useState<AuditCertificate[]>([]);
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);

  // Poll Health
  useEffect(() => {
    const pollHealth = async () => {
      const res = await checkHealth();
      setIsBackendHealthy(res.status !== 'OFFLINE' && res.status !== 'ERROR');
    };
    pollHealth();
    const interval = setInterval(pollHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Process incoming WebSocket events to update graph & audit state in real-time
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'NodeIngested') {
      const { id, entity_id, shard_id } = lastEvent.payload;

      setNodes((prevNodes) => {
        // Prevent duplicate node
        const nodeId = `entity_${entity_id}_${id}`;
        if (prevNodes.some((n) => n.id === nodeId)) return prevNodes;

        const newNode: GraphNode = {
          id: nodeId,
          label: entity_id,
          type: 'entity',
          shardId: shard_id,
          entityId: entity_id,
          status: 'active',
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          radius: 12,
          createdAt: Date.now(),
        };

        return [...prevNodes, newNode];
      });

      setLinks((prevLinks) => {
        const linkId = `link_${entity_id}_shard_${shard_id}`;
        if (prevLinks.some((l) => l.source === `shard_${shard_id}` && l.target === `entity_${entity_id}_${id}`)) {
          return prevLinks;
        }
        return [
          ...prevLinks,
          {
            source: `shard_${shard_id}`,
            target: `entity_${entity_id}_${id}`,
          },
        ];
      });
    } else if (lastEvent.type === 'NodeDeleted') {
      const { entity_id } = lastEvent.payload;

      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.entityId === entity_id) {
            return { ...n, status: 'purged' };
          }
          return n;
        })
      );
    } else if (lastEvent.type === 'AuditGenerated') {
      const { audit_certificate } = lastEvent.payload;
      setCertificates((prev) => {
        if (prev.some((c) => c.audit_id === audit_certificate.audit_id)) return prev;
        return [audit_certificate, ...prev];
      });
    }
  }, [lastEvent]);

  // Direct success handlers from form actions
  const handleIngestSuccess = useCallback((res: IngestResponse) => {
    const nodeId = `entity_${res.entity_id}_${res.id}`;
    setNodes((prev) => {
      if (prev.some((n) => n.id === nodeId)) return prev;
      return [
        ...prev,
        {
          id: nodeId,
          label: res.entity_id,
          type: 'entity',
          shardId: res.shard_id,
          entityId: res.entity_id,
          status: 'active',
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          vx: 0,
          vy: 0,
          radius: 12,
          createdAt: Date.now(),
        },
      ];
    });

    setLinks((prev) => [
      ...prev,
      {
        source: `shard_${res.shard_id}`,
        target: nodeId,
      },
    ]);
  }, []);

  const handleUnlearnSuccess = useCallback((res: UnlearnResponse) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.entityId === res.entity_id) {
          return { ...n, status: 'purged' };
        }
        return n;
      })
    );

    if (res.audit_certificate) {
      setCertificates((prev) => [res.audit_certificate, ...prev]);
    }
  }, []);

  // Compute Metrics & Active Entities
  const activeEntities = nodes.filter((n) => n.type === 'entity' && n.status === 'active');
  const purgedEntities = nodes.filter((n) => n.type === 'entity' && n.status === 'purged');

  const activeEntityIds = Array.from(
    new Set(activeEntities.map((n) => n.entityId).filter((id): id is string => Boolean(id)))
  );

  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);

  const latestMerkleRoot = certificates[0]?.merkle_root_hash || '';

  const metrics: EngineMetrics = {
    wsStatus,
    activeShardsCount: 4,
    ingestedEntitiesCount: activeEntities.length + purgedEntities.length,
    purgedEntitiesCount: purgedEntities.length,
    latestMerkleRoot,
    isBackendHealthy,
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1700px] mx-auto flex flex-col">
      {/* Top Telemetry & Header */}
      <MetricsHeader metrics={metrics} />

      {/* Main Grid Layout (60% Left Visualizer, 40% Right Controls & Audit Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
        {/* Left Column: Interactive Force-Directed Canvas (60% width -> 7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-[520px] lg:h-[720px]">
          <GraphCanvas
            nodes={nodes}
            links={links}
            onSelectEntity={(entityId) => setSelectedEntityId(entityId)}
          />
        </div>

        {/* Right Column: Stacked Ingest/Unlearn Form & Audit Ledger (40% width -> 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 h-[720px]">
          {/* Top Half: Form Controls */}
          <div className="h-[340px] shrink-0">
            <UnlearnForm
              activeEntityIds={activeEntityIds}
              selectedEntityId={selectedEntityId}
              onIngestSuccess={handleIngestSuccess}
              onUnlearnSuccess={handleUnlearnSuccess}
            />
          </div>

          {/* Bottom Half: Cryptographic Audit Ledger */}
          <div className="flex-1 min-h-[340px]">
            <AuditLogs events={events} certificates={certificates} />
          </div>
        </div>
      </div>
    </main>
  );
}
