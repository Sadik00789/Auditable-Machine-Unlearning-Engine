import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsHeader } from '@/components/MetricsHeader';
import { AuditLogs } from '@/components/AuditLogs';
import { EngineMetrics, AuditCertificate } from '@/types';

describe('MetricsHeader Component', () => {
  const mockMetrics: EngineMetrics = {
    wsStatus: 'CONNECTED',
    activeShardsCount: 4,
    ingestedEntitiesCount: 120,
    purgedEntitiesCount: 15,
    latestMerkleRoot: '7d3f8a00b12e3456789abcdef0123456789abcdef0123456789abcdef0123456',
    isBackendHealthy: true,
  };

  it('renders all telemetry metrics accurately', () => {
    render(<MetricsHeader metrics={mockMetrics} />);

    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
    expect(screen.getByText(/4 Active/i)).toBeInTheDocument();
    expect(screen.getByText(/120 Total/i)).toBeInTheDocument();
    expect(screen.getByText(/15 Purged/i)).toBeInTheDocument();
    expect(screen.getByText(/7d3f8a00b1/)).toBeInTheDocument();
  });

  it('renders disconnected indicator when disconnected', () => {
    const offlineMetrics: EngineMetrics = {
      ...mockMetrics,
      wsStatus: 'DISCONNECTED',
      isBackendHealthy: false,
    };

    render(<MetricsHeader metrics={offlineMetrics} />);
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
  });
});

describe('AuditLogs Component', () => {
  const mockCerts: AuditCertificate[] = [
    {
      audit_id: 'audit_0_123',
      entity_id: 'patient_alpha',
      shard_id: 0,
      merkle_root_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      timestamp_epoch: 1690000000,
      status: 'VERIFIED_PURGED',
      signature: '1234abcd',
    },
  ];

  it('renders empty placeholder when no certificates exist', () => {
    render(<AuditLogs events={[]} certificates={[]} />);
    expect(
      screen.getByText('No Merkle Audit Certificates generated yet.')
    ).toBeInTheDocument();
  });

  it('renders cryptographic audit certificates', () => {
    render(<AuditLogs events={[]} certificates={mockCerts} />);
    expect(screen.getByText('patient_alpha')).toBeInTheDocument();
    expect(screen.getByText(/#Shard-0/i)).toBeInTheDocument();
    expect(screen.getByText('VERIFIED_PURGED')).toBeInTheDocument();
  });
});
