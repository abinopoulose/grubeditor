import React, { useState, useEffect } from 'react';
import { Snapshot } from '../types';
import { ApiService } from '../services/api';
import { RotateCcw, Clock, CheckCircle2, Shield, History, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface SnapshotsPanelProps {
  onRestore: () => void;
}

export const SnapshotsPanel: React.FC<SnapshotsPanelProps> = ({ onRestore }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadSnaps = () => {
    ApiService.getSnapshots().then(data => setSnapshots(data));
  };

  useEffect(() => {
    loadSnaps();
  }, []);

  const handleRestore = async (snap: Snapshot) => {
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

  return (
    <div className="space-y-12 w-full pb-20 font-sans">
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
          {/* Vertical timeline connector */}
          {snapshots.length > 1 && (
            <div className="absolute left-[27px] sm:left-[35px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-indigo-500 via-blue-600 to-slate-800" />
          )}

          <div className="flex flex-col gap-6">
            {snapshots.length === 0 ? (
              <div className="selection-card justify-center p-16 !cursor-default bg-[#0b1022]/60 border-dashed border-white/[0.1]">
                <div className="text-center space-y-2">
                  <History className="w-10 h-10 text-slate-600 mx-auto animate-bounce" />
                  <span className="text-slate-400 font-sans text-sm font-semibold block">No recovery checkpoints recorded yet in the vault.</span>
                  <p className="text-xs text-slate-500">Snapshots are automatically generated whenever you deploy modifications.</p>
                </div>
              </div>
            ) : (
              snapshots.map((snap, index) => {
                const isLatest = index === 0;
                const isRestoring = restoringId === snap.timestamp;

                return (
                  <div key={snap.timestamp} className="relative flex items-start gap-4 sm:gap-6 group">
                    {/* Timeline node marker */}
                    <div className={`relative z-10 w-6 h-6 mt-6 rounded-full flex items-center justify-center shrink-0 border-[3px] transition-all ${
                      isLatest 
                        ? 'bg-emerald-500 border-[#0a0f22] shadow-[0_0_18px_rgba(16,185,129,0.8)] scale-110' 
                        : 'bg-indigo-600 border-[#0a0f22] shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-110'
                    }`}>
                      {isLatest && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </div>

                    {/* Snapshot Card */}
                    <motion.div
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.998 }}
                      className={`selection-card flex-1 !p-6 !flex-col sm:!flex-row !items-stretch sm:!items-center justify-between gap-6 !bg-[#0b1022]/85 hover:!bg-[#101834] transition-all border shadow-lg backdrop-blur-2xl ${
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
                            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> {snap.date_string}
                          </span>
                          <span className="text-slate-500">Timestamp ID: #{snap.timestamp}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestore(snap)}
                        disabled={isRestoring}
                        className={`px-6 py-3.5 rounded-xl font-sans text-xs font-black flex items-center justify-center gap-2.5 shrink-0 transition-all duration-200 cursor-pointer shadow-lg ${
                          isLatest 
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] border border-white/25' 
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                      >
                        <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin text-white' : 'text-indigo-300 group-hover:-rotate-45 transition-transform duration-300'}`} />
                        <span>{isRestoring ? 'Restoring Pipeline...' : 'Rollback to Checkpoint'}</span>
                      </button>
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
