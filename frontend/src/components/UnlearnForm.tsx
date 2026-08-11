'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Flame,
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Layers,
} from 'lucide-react';
import { ingestData, ingestBatchData, triggerUnlearn } from '@/lib/api';
import { IngestResponse, UnlearnResponse } from '@/types';

interface UnlearnFormProps {
  activeEntityIds?: string[];
  selectedEntityId?: string;
  onIngestSuccess?: (res: IngestResponse) => void;
  onUnlearnSuccess?: (res: UnlearnResponse) => void;
}

export const UnlearnForm: React.FC<UnlearnFormProps> = ({
  activeEntityIds = [],
  selectedEntityId,
  onIngestSuccess,
  onUnlearnSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'ingest' | 'unlearn' | 'batch'>('ingest');

  // Ingest state
  const [ingestId, setIngestId] = useState('');
  const [ingestEntityId, setIngestEntityId] = useState('');
  const [ingestText, setIngestText] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);

  // Batch Ingest state
  const [batchJson, setBatchJson] = useState('');
  const [isBatchIngesting, setIsBatchIngesting] = useState(false);

  // Unlearn state
  const [unlearnEntityId, setUnlearnEntityId] = useState('');
  const [isUnlearning, setIsUnlearning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (selectedEntityId) {
      setUnlearnEntityId(selectedEntityId);
      setActiveTab('unlearn');
    }
  }, [selectedEntityId]);

  // Notification Toast State
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    detail?: string;
  } | null>(null);

  const triggerToast = (type: 'success' | 'error', message: string, detail?: string) => {
    setToast({ type, message, detail });
    setTimeout(() => setToast(null), 5000);
  };

  // Sample data generators
  const sampleEntities = [
    {
      id: 'doc_user_9012',
      entityId: 'user_9012',
      text: 'User 9012 is located in Paris and manages financial portfolio index ALPHA-9.',
    },
    {
      id: 'doc_patient_3310',
      entityId: 'patient_3310',
      text: 'Patient 3310 was diagnosed with hypertension and prescribed Medication Zeta in Q3.',
    },
    {
      id: 'doc_client_7741',
      entityId: 'client_7741',
      text: 'Client 7741 operates software systems in Frankfurt and subscribed to Tier 1 Cloud Security.',
    },
  ];

  const fillSampleData = () => {
    const randomIndex = Math.floor(Math.random() * sampleEntities.length);
    const sample = sampleEntities[randomIndex];
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedEntityId = `${sample.entityId}_${uniqueSuffix}`;

    setIngestId(`${sample.id}_${uniqueSuffix}`);
    setIngestEntityId(generatedEntityId);
    setUnlearnEntityId(generatedEntityId);
    setIngestText(sample.text);
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestId.trim() || !ingestEntityId.trim() || !ingestText.trim()) {
      triggerToast('error', 'Validation Error', 'All ingestion fields are required.');
      return;
    }

    setIsIngesting(true);
    try {
      const res = await ingestData({
        id: ingestId.trim(),
        entity_id: ingestEntityId.trim(),
        text: ingestText.trim(),
      });

      triggerToast(
        'success',
        'Data Ingested Successfully',
        `Assigned to SISA Shard #${res.shard_id} (${res.triplets_extracted} triplets extracted)`
      );

      if (onIngestSuccess) onIngestSuccess(res);

      // Reset form
      setIngestId('');
      setIngestEntityId('');
      setIngestText('');
    } catch (err: any) {
      triggerToast('error', 'Ingest Failed', err?.message || 'Server error occurred.');
    } finally {
      setIsIngesting(false);
    }
  };

  const loadSampleBatchJson = () => {
    const sampleBatch = [
      {
        id: 'doc_user_101',
        entity_id: 'user_101',
        text: 'User 101 manages European network infrastructure in Berlin.',
      },
      {
        id: 'doc_user_102',
        entity_id: 'user_102',
        text: 'User 102 holds subscription to Tier-2 Security Operations in London.',
      },
      {
        id: 'doc_patient_205',
        entity_id: 'patient_205',
        text: 'Patient 205 requested health records transfer to Stockholm Medical Center.',
      },
    ];
    setBatchJson(JSON.stringify(sampleBatch, null, 2));
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchJson.trim()) {
      triggerToast('error', 'Validation Error', 'Batch JSON content cannot be empty.');
      return;
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(batchJson);
      if (!Array.isArray(parsedItems)) throw new Error('Root element must be a JSON array.');
    } catch (err: any) {
      triggerToast('error', 'JSON Format Error', err?.message || 'Invalid JSON format.');
      return;
    }

    setIsBatchIngesting(true);
    try {
      const res = await ingestBatchData(parsedItems);
      triggerToast(
        'success',
        'Batch Ingestion Complete',
        `Processed ${res.total_processed} entities concurrently via tokio JoinSet.`
      );
      if (onIngestSuccess) {
        res.results.forEach((r) => onIngestSuccess(r));
      }
      setBatchJson('');
    } catch (err: any) {
      triggerToast('error', 'Batch Ingestion Failed', err?.message || 'Server error.');
    } finally {
      setIsBatchIngesting(false);
    }
  };

  const confirmAndExecuteUnlearn = async () => {
    setShowConfirmModal(false);
    if (!unlearnEntityId.trim()) return;

    setIsUnlearning(true);
    try {
      const res = await triggerUnlearn({ entity_id: unlearnEntityId.trim() });

      triggerToast(
        'success',
        'Entity Purged & Verified',
        `Purged from Shard #${res.shard_id}. SHA-256 Merkle root hash generated.`
      );

      if (onUnlearnSuccess) onUnlearnSuccess(res);
      setUnlearnEntityId('');
    } catch (err: any) {
      triggerToast('error', 'Unlearning Execution Failed', err?.message || 'Server error.');
    } finally {
      setIsUnlearning(false);
    }
  };

  return (
    <div className="w-full glass-panel rounded-xl border border-white/10 shadow-glass overflow-hidden flex flex-col h-full">
      {/* Toast Notification Container */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 mx-4 mt-4 rounded-lg border text-xs flex items-start gap-3 shadow-lg z-50 ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-sm">{toast.message}</div>
              {toast.detail && <div className="text-xs opacity-80 mt-0.5">{toast.detail}</div>}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Header & Tabs */}
      <div className="p-4 border-b border-white/10 bg-surface/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-subtle/60 border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('ingest')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'ingest'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-neon-cyan'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>1. Data Ingestion</span>
          </button>
          <button
            onClick={() => setActiveTab('unlearn')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'unlearn'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-neon-rose'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>2. Machine Unlearn</span>
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'batch'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-neon-violet'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Batch Ingest</span>
          </button>
        </div>

        {activeTab === 'ingest' && (
          <button
            type="button"
            onClick={fillSampleData}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sample Data</span>
          </button>
        )}

        {activeTab === 'batch' && (
          <button
            type="button"
            onClick={loadSampleBatchJson}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-violet-300 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Sample Batch</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-5 flex-1 overflow-y-auto">
        {activeTab === 'batch' ? (
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-gray-400">
                  Batch Ingest JSON Array (<span className="text-violet-400">Vec&lt;IngestRequest&gt;</span>)
                </label>
                <button
                  type="button"
                  onClick={loadSampleBatchJson}
                  className="sm:hidden text-[11px] text-violet-400 underline font-mono"
                >
                  Load Sample Batch
                </button>
              </div>
              <textarea
                rows={7}
                value={batchJson}
                onChange={(e) => setBatchJson(e.target.value)}
                placeholder='[&#10;  { "id": "doc_101", "entity_id": "user_101", "text": "Fact statement..." }&#10;]'
                className="w-full px-3 py-2 text-xs rounded-lg bg-background/80 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all text-white placeholder-gray-600 resize-none font-mono"
              />
            </div>

            <div className="pt-1 flex items-center justify-between">
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                Processes embeddings & triplets concurrently via tokio::task::JoinSet.
              </p>
              <button
                type="submit"
                disabled={isBatchIngesting || !batchJson.trim()}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-xs font-semibold flex items-center gap-2 shadow-neon-violet transition-all disabled:opacity-50"
              >
                {isBatchIngesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Executing Batch...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Submit Batch Ingest</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : activeTab === 'ingest' ? (
          <form onSubmit={handleIngestSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  Document ID (<span className="text-cyan-400">id</span>)
                </label>
                <input
                  type="text"
                  value={ingestId}
                  onChange={(e) => setIngestId(e.target.value)}
                  placeholder="e.g. doc_101"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-background/80 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all text-white placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  Entity ID (<span className="text-cyan-400">entity_id</span>)
                </label>
                <input
                  type="text"
                  value={ingestEntityId}
                  onChange={(e) => setIngestEntityId(e.target.value)}
                  placeholder="e.g. user_9012"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-background/80 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all text-white placeholder-gray-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-gray-400">
                  Text Content (For Vector & Triplet Extraction)
                </label>
                <button
                  type="button"
                  onClick={fillSampleData}
                  className="sm:hidden text-[11px] text-cyan-400 underline font-mono"
                >
                  Auto Fill Sample
                </button>
              </div>
              <textarea
                rows={4}
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
                placeholder="Insert text containing entity facts (e.g. User 9012 operates server cluster in Frankfurt...)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-background/80 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all text-white placeholder-gray-600 resize-none font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                Routes vector to SISA shard & triplets to SurrealDB property graph.
              </p>
              <button
                type="submit"
                disabled={isIngesting}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-semibold flex items-center gap-2 shadow-neon-cyan transition-all disabled:opacity-50"
              >
                {isIngesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Ingesting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ingest Data</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-rose-300">Irreversible Machine Unlearning</div>
                <p className="text-gray-400 text-[11px] mt-0.5">
                  Purges all entity vectors from assigned SISA shard in LanceDB, deletes SurrealDB graph triplets, and constructs an immutable SHA-256 Merkle proof receipt.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">
                Target Entity ID to Unlearn (<span className="text-rose-400">entity_id</span>)
              </label>
              <input
                type="text"
                value={unlearnEntityId}
                onChange={(e) => setUnlearnEntityId(e.target.value)}
                placeholder="e.g. user_9012_5040"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg bg-background/80 border border-white/10 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all text-white placeholder-gray-600"
              />

              {activeEntityIds.length > 0 && (
                <div className="mt-2.5">
                  <div className="text-[11px] font-mono text-gray-400 mb-1 flex items-center justify-between">
                    <span>Active Ingested Entities ({activeEntityIds.length}):</span>
                    <span className="text-[10px] text-gray-500">Click to select</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {activeEntityIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setUnlearnEntityId(id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all border ${
                          unlearnEntityId === id
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold shadow-neon-rose'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40'
                        }`}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  if (unlearnEntityId.trim()) setShowConfirmModal(true);
                  else triggerToast('error', 'Validation Error', 'Target entity_id cannot be empty.');
                }}
                disabled={isUnlearning || !unlearnEntityId.trim()}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-neon-rose transition-all disabled:opacity-50 tracking-wide uppercase"
              >
                {isUnlearning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Executing SISA Purge...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-rose-200" />
                    <span>Execute Machine Unlearn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unlearn Confirmation Modal Drawer */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel max-w-md w-full rounded-xl border border-rose-500/40 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm Machine Unlearning</h3>
                  <p className="text-xs text-gray-400">SISA Shard Micro-Purge Protocol</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Are you sure you want to execute unlearning for target entity{' '}
                <span className="font-mono text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                  {unlearnEntityId}
                </span>
                ?
              </p>

              <div className="p-3 rounded-lg bg-surface/80 border border-white/10 text-xs font-mono space-y-1 text-gray-400">
                <div>• LanceDB Vector Shard: Deleting vector embeddings</div>
                <div>• SurrealDB Property Graph: Detaching knowledge triplets</div>
                <div>• Audit Ledger: Generating SHA-256 Merkle certificate</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-subtle hover:bg-surface-subtle/80 text-gray-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAndExecuteUnlearn}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-neon-rose transition-all"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Confirm & Purge</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
