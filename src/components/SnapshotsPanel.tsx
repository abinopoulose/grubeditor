import React, { useState, useEffect } from 'react';
import { Snapshot, BootEntry } from '../types';
import { ApiService, formatSnapshotDate } from '../services/api';
import { RotateCcw, Clock, CheckCircle2, Shield, History, Sparkles, Eye, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SnapshotsPanelProps {
  onRestore: () => void;
}

export const SnapshotsPanel: React.FC<SnapshotsPanelProps> = ({ onRestore }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [loadingDetailsId, setLoadingDetailsId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [viewingSnapshot, setViewingSnapshot] = useState<{snap: Snapshot, details: any} | null>(null);
  const [diffingSnapshot, setDiffingSnapshot] = useState<{snap: Snapshot, details: any, liveConfig: any, liveEntries: BootEntry[]} | null>(null);

  const loadSnaps = () => {
    ApiService.getSnapshots().then(data => setSnapshots(data));
  };

  useEffect(() => {
    loadSnaps();
  }, []);

  const handleView = async (snap: Snapshot) => {
    setLoadingDetailsId(snap.timestamp);
    try {
      const details = await ApiService.getSnapshotDetails(snap.timestamp);
      setViewingSnapshot({ snap, details });
    } catch (e: any) {
      setNotification(`Failed to load details: ${e.message}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoadingDetailsId(null);
    }
  };

  const handleDiff = async (snap: Snapshot) => {
    setLoadingDetailsId(snap.timestamp);
    try {
      const details = await ApiService.getSnapshotDetails(snap.timestamp);
      const liveConfig = await ApiService.getGrubConfig();
      const liveEntries = await ApiService.getBootEntries();
      setDiffingSnapshot({ snap, details, liveConfig, liveEntries });
    } catch (e: any) {
      setNotification(`Failed to load diff: ${e.message}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoadingDetailsId(null);
    }
  };

  const executeRestore = async (snap: Snapshot) => {
    setDiffingSnapshot(null);
    setRestoringId(snap.timestamp);
    try {
      await new Promise(res => setTimeout(res, 800));
      await ApiService.restoreSnapshot(snap.timestamp);
      setNotification(`Successfully restored configuration from ${snap.date_string}`);
      loadSnaps();
      onRestore();
    } catch (e: any) {
      setNotification(`Failed to restore snapshot: ${e.message || 'Unknown error occurred'}`);
    } finally {
      setRestoringId(null);
    }
    setTimeout(() => setNotification(null), 5000);
  };

  const renderConfigDiff = () => {
    if (!diffingSnapshot) return null;
    const { details, liveConfig } = diffingSnapshot;
    const snapConfig = details.config || {};
    
    const allKeys = Array.from(new Set([...Object.keys(snapConfig), ...Object.keys(liveConfig)])).sort();
    const changes: any[] = [];
    
    allKeys.forEach(k => {
      let liveVal = liveConfig[k] ?? '(none)';
      let snapVal = snapConfig[k] ?? '(none)';
      
      if (liveVal !== snapVal) {
        let name = k;
        if (k === 'GRUB_DEFAULT') name = 'Default Boot Option';
        if (k === 'GRUB_TIMEOUT') {
          name = 'Default Boot Timer';
          liveVal = (liveVal === '-1' || liveVal === -1) ? 'Disabled' : `${liveVal}s`;
          snapVal = (snapVal === '-1' || snapVal === -1) ? 'Disabled' : `${snapVal}s`;
        }
        if (k === 'GRUB_TIMEOUT_STYLE') {
          name = 'Boot Menu Visibility';
          const mapStyle = (v: any) => v === 'hidden' ? 'Hidden' : (v === 'menu' ? 'Always Show Menu' : (v === 'countdown' ? 'Countdown Only' : v));
          liveVal = mapStyle(liveVal);
          snapVal = mapStyle(snapVal);
        }
        if (k === 'GRUB_CMDLINE_LINUX_DEFAULT') name = 'Default Kernel Arguments';
        if (k === 'GRUB_DISABLE_OS_PROBER') {
          name = 'OS Prober (Dual Boot)';
          liveVal = liveVal === 'false' ? 'Enabled' : 'Disabled';
          snapVal = snapVal === 'false' ? 'Enabled' : 'Disabled';
        }
        if (k === 'GRUB_THEME') {
          name = 'Active GRUB Theme';
          liveVal = liveVal || 'Default Theme';
          snapVal = snapVal || 'Default Theme';
        }

        changes.push({ key: k, name, old: liveVal, new: snapVal });
      }
    });

    if (changes.length === 0) {
      return <div className="text-slate-400 text-sm italic py-2">No changes in GRUB general configuration.</div>;
    }

    return (
      <div className="space-y-2">
        {changes.map(c => (
          <div key={c.key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-black/20 border border-white/5 text-sm">
            <span className="font-mono text-indigo-300 font-bold min-w-[140px]">{c.name}</span>
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
              <span className="text-slate-400 truncate strike-through line-through opacity-70">{c.old}</span>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="text-emerald-400 font-bold truncate">{c.new}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderBootEntriesDiff = () => {
    if (!diffingSnapshot) return null;
    const { details, liveEntries } = diffingSnapshot;
    const snapOverrides: any[] = details.bootEntries || [];
    
    if (snapOverrides.length === 0) {
      return <div className="text-slate-400 text-sm italic py-2">No boot menu overrides in this checkpoint.</div>;
    }

    const changes: any[] = [];
    snapOverrides.forEach((override) => {
      // Find the corresponding live entry to see what will change
      const live = liveEntries.find(e => e.id === override.id);
      
      const liveTitle = live ? live.title : '(default)';
      const liveHidden = live ? live.deleted : false;
      
      let titleChanged = override.title !== liveTitle && override.title !== override.originalTitle;
      let hiddenChanged = override.deleted !== liveHidden;
      
      if (titleChanged || hiddenChanged) {
        changes.push({
          id: override.id,
          name: override.originalTitle || override.title || override.id,
          titleChanged: titleChanged ? { old: liveTitle, new: override.title } : null,
          hiddenChanged: hiddenChanged ? { old: liveHidden, new: override.deleted } : null,
        });
      }
    });

    if (changes.length === 0) {
      return <div className="text-slate-400 text-sm italic py-2">Restoring this checkpoint won't change current boot entry overrides.</div>;
    }

    return (
      <div className="space-y-2">
        {changes.map(c => (
          <div key={c.id} className="p-3 rounded-lg bg-black/20 border border-white/5 space-y-2 text-sm">
            <div className="font-bold text-slate-200">{c.name}</div>
            {c.titleChanged && (
              <div className="flex items-center gap-3 pl-4">
                <span className="text-slate-400 text-xs">Title:</span>
                <span className="text-slate-400 line-through truncate max-w-[100px]">{c.titleChanged.old}</span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className="text-emerald-400 truncate">{c.titleChanged.new}</span>
              </div>
            )}
            {c.hiddenChanged && (
              <div className="flex items-center gap-3 pl-4">
                <span className="text-slate-400 text-xs">Visibility:</span>
                <span className="text-slate-400 line-through">{c.hiddenChanged.old ? 'Hidden' : 'Visible'}</span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className={c.hiddenChanged.new ? 'text-rose-400' : 'text-emerald-400'}>{c.hiddenChanged.new ? 'Hidden' : 'Visible'}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-12 w-full pb-20 font-sans">
      {/* Diff Modal */}
      <AnimatePresence>
        {diffingSnapshot && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0b1022] border border-indigo-500/30 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Review Rollback Changes</h2>
                    <p className="text-xs text-slate-400">The following modifications will be applied to your live system.</p>
                  </div>
                </div>
                <button onClick={() => setDiffingSnapshot(null)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <section>
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> General Configuration
                  </h3>
                  {renderConfigDiff()}
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Boot Menu Overrides
                  </h3>
                  {renderBootEntriesDiff()}
                </section>
              </div>
              <div className="p-5 border-t border-white/10 bg-black/40 flex justify-end gap-3">
                <button onClick={() => setDiffingSnapshot(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button onClick={() => executeRestore(diffingSnapshot.snap)} className="px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-900/50 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Confirm & Rollback
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewingSnapshot && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0b1022] border border-blue-500/30 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Checkpoint Inspection</h2>
                    <p className="text-xs text-slate-400">Viewing all properties stored in {formatSnapshotDate(viewingSnapshot.snap.timestamp)}</p>
                  </div>
                </div>
                <button onClick={() => setViewingSnapshot(null)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <section>
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Saved Configuration Values
                  </h3>
                  {Object.keys(viewingSnapshot.details.config || {}).length === 0 ? (
                    <div className="text-slate-500 text-sm italic">No configuration values found.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(viewingSnapshot.details.config).map(([k, v]) => {
                        let name = k;
                        let readableValue = String(v);

                        if (k === 'GRUB_DEFAULT') name = 'Default Boot Option';
                        if (k === 'GRUB_TIMEOUT') {
                          name = 'Default Boot Timer';
                          if (v === '-1' || v === -1) readableValue = 'Disabled (Wait indefinitely)';
                          else readableValue = `${v} seconds`;
                        }
                        if (k === 'GRUB_TIMEOUT_STYLE') {
                          name = 'Boot Menu Visibility';
                          if (v === 'hidden') readableValue = 'Hidden';
                          if (v === 'menu') readableValue = 'Always Show Menu';
                          if (v === 'countdown') readableValue = 'Show Countdown Only';
                        }
                        if (k === 'GRUB_CMDLINE_LINUX_DEFAULT') name = 'Default Kernel Arguments';
                        if (k === 'GRUB_DISABLE_OS_PROBER') {
                          name = 'OS Prober (Dual Boot Detection)';
                          readableValue = v === 'false' ? 'Enabled' : 'Disabled';
                        }
                        if (k === 'GRUB_THEME') {
                          name = 'Active GRUB Theme';
                          readableValue = String(v) || 'Default Theme';
                        }

                        return (
                          <div key={k} className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col gap-1">
                            <span className="text-xs font-bold text-indigo-400/70">{name}</span>
                            <span className="text-sm text-slate-200 font-mono break-all">{readableValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Saved Boot Menu Entries
                  </h3>
                  {(!viewingSnapshot.details.bootEntries || viewingSnapshot.details.bootEntries.length === 0) ? (
                    <div className="text-slate-500 text-sm italic">No boot menu entries were overridden in this checkpoint.</div>
                  ) : (
                    <div className="space-y-3">
                      {viewingSnapshot.details.bootEntries.map((e: any) => (
                        <div key={e.id} className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-200">{e.title || e.originalTitle || e.id}</span>
                            <span className="text-xs text-slate-500 font-mono">{e.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {e.deleted && <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 uppercase tracking-wider">Hidden</span>}
                            {!e.deleted && <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">Visible</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-3 shadow-[0_0_25px_rgba(16,185,129,0.25)] backdrop-blur-xl"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-pulse" />
          <span className="text-sm font-extrabold text-white">{notification}</span>
        </motion.div>
      )}

      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide text-white">Recorded Configuration Vault</h3>
              <p className="text-[12px] text-slate-400">Chronological history of bootloader modifications preserved for safe system rollbacks</p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-800/80 text-indigo-300 border border-white/[0.08] shadow-sm">
            {snapshots.length} Available {snapshots.length === 1 ? 'Archive' : 'Archives'}
          </span>
        </div>

        <div className="relative pt-2 pl-4 sm:pl-6">
          {snapshots.length > 1 && (
            <div className="absolute left-[27px] sm:left-[35px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-indigo-500 via-blue-600 to-slate-800" />
          )}

          <div className="flex flex-col gap-6">
            {snapshots.length === 0 ? (
              <div className="selection-card justify-center p-16 !cursor-default bg-[#0b1022]/60 border-dashed border-white/[0.1]">
                <div className="flex flex-col items-center justify-center text-center space-y-2 w-full">
                  <History className="w-10 h-10 text-slate-600 mx-auto animate-bounce" />
                  <span className="text-slate-400 font-sans text-sm font-semibold block text-center">No recovery checkpoints recorded yet in the vault.</span>
                  <p className="text-xs text-slate-500 text-center">Snapshots are automatically generated whenever you deploy modifications.</p>
                </div>
              </div>
            ) : (
              snapshots.map((snap, index) => {
                const isLatest = index === 0;
                const isRestoring = restoringId === snap.timestamp;
                const isLoadingDiff = loadingDetailsId === snap.timestamp;

                return (
                  <div key={snap.timestamp} className="relative flex items-start gap-4 sm:gap-6 group">
                    <div className={`relative z-10 w-6 h-6 mt-6 rounded-full flex items-center justify-center shrink-0 border-[3px] transition-all ${
                      isLatest 
                        ? 'bg-emerald-500 border-[#0a0f22] shadow-[0_0_18px_rgba(16,185,129,0.8)] scale-110' 
                        : 'bg-indigo-600 border-[#0a0f22] shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-110'
                    }`}>
                      {isLatest && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.998 }}
                      className={`selection-card flex-1 !p-6 flex-col items-stretch justify-between gap-6 !bg-[#0b1022]/85 hover:!bg-[#101834] transition-all border shadow-lg backdrop-blur-2xl ${
                        isLatest ? 'border-indigo-500/50 shadow-[0_10px_35px_-5px_rgba(99,102,241,0.25)]' : 'border-white/[0.12]'
                      }`}
                    >
                      <div className="space-y-2.5 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-black text-lg text-white tracking-tight truncate">{snap.description}</span>
                          {isLatest && (
                            <span className="px-3 py-0.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 font-sans text-[11px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} /> LATEST CHECKPOINT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                          <span className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-white/[0.06] font-bold text-indigo-300">
                            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> {formatSnapshotDate(snap.timestamp)}
                          </span>
                          <span className="text-slate-500">Timestamp ID: #{snap.timestamp}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-white/5 sm:border-t-0">
                        <button
                          type="button"
                          onClick={() => handleView(snap)}
                          disabled={isLoadingDiff}
                          className="w-full sm:w-auto px-5 py-3 rounded-xl font-sans text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-white/10"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                          <span>View Checkpoint</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDiff(snap)}
                          disabled={isRestoring || isLoadingDiff}
                          className={`w-full sm:w-auto px-6 py-3 rounded-xl font-sans text-xs font-black flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-lg ${
                            isLatest 
                              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] border border-white/25' 
                              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 hover:border-white/20'
                          }`}
                        >
                          <RotateCcw className={`w-4 h-4 ${isRestoring || isLoadingDiff ? 'animate-spin text-white' : 'text-indigo-300 group-hover:-rotate-45 transition-transform duration-300'}`} />
                          <span>{isRestoring ? 'Restoring Pipeline...' : isLoadingDiff ? 'Loading...' : 'Rollback to Checkpoint'}</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
