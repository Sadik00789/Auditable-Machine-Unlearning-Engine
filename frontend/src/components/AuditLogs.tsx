'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  ShieldCheck,
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Loader2,
  Lock,
  GitCommit,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { WsEvent, AuditCertificate, AuditVerifyResponse } from '@/types';
import { verifyAudit } from '@/lib/api';

interface AuditLogsProps {
  events: WsEvent[];
  certificates: AuditCertificate[];
  onVerifyProof?: (cert: AuditCertificate) => void;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ events, certificates }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'certificates' | 'telemetry'>('certificates');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modal / Drawer state for Merkle proof verification
  const [verifyingCert, setVerifyingCert] = useState<AuditCertificate | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificates;
    const q = searchQuery.toLowerCase();
    return certificates.filter(
      (c) =>
        c.entity_id.toLowerCase().includes(q) ||
        c.shard_id.toString().includes(q) ||
        c.audit_id.toLowerCase().includes(q) ||
        c.merkle_root_hash.toLowerCase().includes(q)
    );
  }, [certificates, searchQuery]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
  }, [events, searchQuery]);

  const handleVerifyClick = async (cert: AuditCertificate) => {
    setVerifyingCert(cert);
    setVerifyResult(null);
    setIsVerifying(true);

    try {
      const res = await verifyAudit(cert.entity_id, cert.shard_id);
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({
        audit_certificate: cert,
        is_valid: false,
        message: err?.message || 'Verification call failed',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const exportAuditJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(certificates, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_certificates_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full glass-panel rounded-xl border border-white/10 shadow-glass overflow-hidden flex flex-col h-full">
      {/* Terminal Header */}
      <div className="p-4 border-b border-white/10 bg-surface/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Cryptographic Audit Ledger
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                SHA-256 Merkle Proofs
              </span>
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Tab Selector */}
          <div className="flex items-center p-0.5 rounded-lg bg-surface-subtle/80 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setSelectedTab('certificates')}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedTab === 'certificates'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Certificates ({certificates.length})
            </button>
            <button
              onClick={() => setSelectedTab('telemetry')}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedTab === 'telemetry'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              WS Log ({events.length})
            </button>
          </div>

          <button
            onClick={exportAuditJSON}
            disabled={certificates.length === 0}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors disabled:opacity-40"
            title="Export Certificates JSON"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-background/50 flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter audit log by entity_id, shard_id, or hash..."
          className="w-full bg-transparent text-xs font-mono text-white outline-none placeholder-gray-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-gray-500 hover:text-gray-300">
            Clear
          </button>
        )}
      </div>

      {/* Logs Body */}
      <div className="p-4 flex-1 overflow-y-auto min-h-[220px] font-mono text-xs space-y-3">
        {selectedTab === 'certificates' ? (
          filteredCertificates.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-500 text-center">
              <Lock className="w-8 h-8 text-gray-600 mb-2 opacity-50" />
              <p>No Merkle Audit Certificates generated yet.</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Execute a Machine Unlearn request to mint cryptographic receipts.
              </p>
            </div>
          ) : (
            filteredCertificates.map((cert) => (
              <motion.div
                key={cert.audit_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg bg-surface/60 border border-white/10 hover:border-emerald-500/40 transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {cert.status}
                    </span>
                    {cert.signature && (
                      <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono text-[10px] border border-violet-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-violet-400" />
                        <span>Ed25519 Signed</span>
                      </span>
                    )}
                    <span className="text-gray-300 font-semibold">{cert.audit_id}</span>
                  </div>
                  <span className="text-gray-500">
                    {new Date(cert.timestamp_epoch * 1000).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Entity:</span>{' '}
                    <span className="text-emerald-300 font-bold">{cert.entity_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">SISA Shard:</span>{' '}
                    <span className="text-cyan-300 font-bold">#Shard-{cert.shard_id}</span>
                  </div>
                </div>

                {/* Hash & Signature Code Block */}
                <div className="relative group/hash space-y-1">
                  <div className="p-2 rounded bg-background/80 border border-white/10 text-[11px] text-gray-300 break-all hover:border-emerald-500/30 transition-colors">
                    <span className="text-gray-500 mr-2">root:</span>
                    {cert.merkle_root_hash}
                  </div>
                  {cert.signature && (
                    <div className="p-1.5 rounded bg-background/60 border border-violet-500/20 text-[10px] font-mono text-violet-300/80 break-all">
                      <span className="text-gray-500 mr-2">sig:</span>
                      {cert.signature}
                    </div>
                  )}
                  <button
                    onClick={() => copyHash(cert.merkle_root_hash)}
                    className="absolute right-2 top-2 p-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 opacity-0 group-hover/hash:opacity-100 transition-opacity"
                    title="Copy full hash"
                  >
                    {copiedHash === cert.merkle_root_hash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Actions: Verify Proof & Export Receipt */}
                <div className="pt-1 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cert, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', `receipt_${cert.audit_id}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] font-semibold transition-all"
                    title="Export Compliance Receipt JSON"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>Export Receipt</span>
                  </button>
                  <button
                    onClick={() => handleVerifyClick(cert)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-all shadow-neon-emerald"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Verify Proof Path</span>
                  </button>
                </div>
              </motion.div>
            ))
          )
        ) : (
          /* Telemetry WS Events Tab */
          filteredEvents.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500">
              No live WebSocket events received yet.
            </div>
          ) : (
            filteredEvents.map((evt, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-background/60 border border-white/5 hover:border-cyan-500/30 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-cyan-400 font-bold">[{evt.type}]</span>
                  <span className="text-gray-500">{evt.timestamp || 'now'}</span>
                </div>
                <pre className="text-[10px] text-gray-300 overflow-x-auto p-1 bg-surface/50 rounded">
                  {JSON.stringify(evt, null, 2)}
                </pre>
              </div>
            ))
          )
        )}
      </div>

      {/* Proof Tree Drawer / Modal */}
      <AnimatePresence>
        {verifyingCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel max-w-lg w-full rounded-xl border border-emerald-500/40 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Merkle Cryptographic Proof Verification</span>
                </div>
                <button
                  onClick={() => setVerifyingCert(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {isVerifying ? (
                <div className="py-8 flex flex-col items-center justify-center text-cyan-400 space-y-3 font-mono text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <p>Querying SurrealDB property graph & recalculating Merkle root...</p>
                </div>
              ) : verifyResult ? (
                <div className="space-y-4 text-xs font-mono">
                  {/* Status Banner */}
                  <div
                    className={`p-3 rounded-lg border flex items-start gap-3 ${
                      verifyResult.is_valid
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {verifyResult.is_valid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {verifyResult.is_valid ? 'PROOF VERIFIED & VALID' : 'VERIFICATION WARNING'}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">{verifyResult.message}</div>
                    </div>
                  </div>

                  {/* Merkle Tree Proof Path Visualization */}
                  <div className="p-3 rounded-lg bg-surface/80 border border-white/10 space-y-2">
                    <div className="text-gray-400 font-bold flex items-center gap-1 text-[11px]">
                      <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Merkle Tree Path Verification</span>
                    </div>

                    <div className="pl-2 border-l-2 border-cyan-500/40 space-y-2 pt-1">
                      <div>
                        <span className="text-gray-500">Root Node:</span>{' '}
                        <span className="text-emerald-400 break-all">{verifyingCert.merkle_root_hash}</span>
                      </div>
                      <div className="pl-3 border-l border-white/10 space-y-1">
                        <div>
                          <span className="text-gray-500">Leaf Node (Entity):</span>{' '}
                          <span className="text-cyan-300">{verifyingCert.entity_id}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Leaf Node (Shard):</span>{' '}
                          <span className="text-cyan-300">#Shard-{verifyingCert.shard_id}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">SurrealDB Graph Audit:</span>{' '}
                          <span className="text-emerald-400">RECORDED_PURGED_RELATION</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setVerifyingCert(null)}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                    >
                      Close Verification
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
