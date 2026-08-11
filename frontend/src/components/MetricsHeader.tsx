'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Radio,
  Layers,
  Database,
  Trash2,
  Copy,
  Check,
  Activity,
  Cpu,
} from 'lucide-react';
import { EngineMetrics } from '@/types';

interface MetricsHeaderProps {
  metrics: EngineMetrics;
}

export const MetricsHeader: React.FC<MetricsHeaderProps> = ({ metrics }) => {
  const [copied, setCopied] = useState(false);

  const copyMerkleRoot = () => {
    if (!metrics.latestMerkleRoot) return;
    navigator.clipboard.writeText(metrics.latestMerkleRoot);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedHash = metrics.latestMerkleRoot
    ? `${metrics.latestMerkleRoot.slice(0, 10)}...${metrics.latestMerkleRoot.slice(-8)}`
    : '0x00000000...00000000';

  const getStatusColor = () => {
    switch (metrics.wsStatus) {
      case 'CONNECTED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'RECONNECTING':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const getStatusDot = () => {
    switch (metrics.wsStatus) {
      case 'CONNECTED':
        return 'bg-emerald-400 shadow-[0_0_10px_#10B981]';
      case 'RECONNECTING':
        return 'bg-amber-400 shadow-[0_0_10px_#F59E0B] animate-ping';
      default:
        return 'bg-rose-500 shadow-[0_0_10px_#F43F5E]';
    }
  };

  return (
    <div className="w-full glass-panel rounded-xl p-4 sm:p-5 border border-white/10 shadow-glass relative overflow-hidden">
      {/* Top Background Glow Accent */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-24 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Title & Engine Status */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-400 shadow-neon-cyan">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Auditable Machine Unlearning Engine
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
                v1.0 Rust-Axum
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
              <span>SISA Architecture</span>
              <span>•</span>
              <span>SurrealDB Property Graph</span>
              <span>•</span>
              <span>SHA-256 Merkle Proof Receipts</span>
            </p>
          </div>
        </div>

        {/* Real-time Telemetry Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
          {/* Status Metric */}
          <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border backdrop-blur-md ${getStatusColor()}`}>
            <div className="relative flex items-center justify-center">
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDot()}`} />
              {metrics.wsStatus === 'CONNECTED' && (
                <span className="absolute w-4 h-4 rounded-full bg-emerald-400/40 animate-ping" />
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider opacity-80 flex items-center gap-1">
                <Radio className="w-3 h-3" /> WS Engine
              </div>
              <div className="text-xs font-semibold font-mono tracking-wide">
                {metrics.wsStatus}
              </div>
            </div>
          </div>

          {/* SISA Shards */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-surface-subtle/40 border border-white/10 text-cyan-300">
            <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-gray-400 tracking-wider">
                SISA Shards
              </div>
              <div className="text-xs font-bold font-mono">
                {metrics.activeShardsCount} Active
              </div>
            </div>
          </div>

          {/* Ingested Entities */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-surface-subtle/40 border border-white/10 text-violet-300">
            <div className="p-1.5 rounded bg-violet-500/10 text-violet-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-gray-400 tracking-wider">
                Ingested Nodes
              </div>
              <div className="text-xs font-bold font-mono text-violet-300">
                {metrics.ingestedEntitiesCount} Total
              </div>
            </div>
          </div>

          {/* Purged Entities */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-surface-subtle/40 border border-white/10 text-rose-300">
            <div className="p-1.5 rounded bg-rose-500/10 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-gray-400 tracking-wider">
                Unlearned
              </div>
              <div className="text-xs font-bold font-mono text-rose-300">
                {metrics.purgedEntitiesCount} Purged
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merkle Root Hash Banner Bar */}
      <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-gray-400">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Latest Merkle Root Hash:</span>
          <span className="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            {truncatedHash}
          </span>
        </div>

        <button
          onClick={copyMerkleRoot}
          disabled={!metrics.latestMerkleRoot}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors disabled:opacity-50 text-xs"
          title="Copy full Merkle Root Hash"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied Hash</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span>Copy Merkle Root</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
