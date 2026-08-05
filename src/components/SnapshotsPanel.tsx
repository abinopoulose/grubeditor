import React, { useState, useEffect } from 'react';
import { Snapshot } from '../types';
import { ApiService } from '../services/api';
import { RotateCcw, Clock, CheckCircle2, Shield } from 'lucide-react';
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
    <div className="space-y-8 w-full pb-16 font-sans">
      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-3 shadow-lg shadow-emerald-500/10"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </motion.div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-xs font-bold tracking-widest text-indigo-300 uppercase flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" /> Recorded Configuration Vault
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {snapshots.length} Available {snapshots.length === 1 ? 'Archive' : 'Archives'}
          </span>
        </div>

        <div className="flex flex-col gap-4 pt-1">
          {snapshots.length === 0 ? (
            <div className="selection-card justify-center p-16 !cursor-default">
              <span className="text-slate-400 font-sans text-xs">No safety snapshots recorded yet.</span>
            </div>
          ) : (
            snapshots.map((snap, index) => {
              const isLatest = index === 0;
              const isRestoring = restoringId === snap.timestamp;

              return (
                <motion.div
                  key={snap.timestamp}
                  whileHover={{ scale: 1.002 }}
                  whileTap={{ scale: 0.998 }}
                  className="selection-card !p-6 !flex-col sm:!flex-row !items-stretch sm:!items-center justify-between gap-6 !bg-[#0d1428]/75 hover:!bg-[#111a36] transition-all border border-white/[0.08] shadow-lg"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-extrabold text-lg text-white truncate">{snap.description}</span>
                      {isLatest && (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-sans text-[11px] font-bold uppercase tracking-wider">
                          Latest Checkpoint
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-300 font-mono">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" /> {snap.date_string}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(snap)}
                    disabled={isRestoring}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-bold flex items-center justify-center gap-2.5 shrink-0 transition-all cursor-pointer shadow-md shadow-indigo-500/25"
                  >
                    <RotateCcw className={`w-4 h-4 text-indigo-200 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Restoring...' : 'Rollback'}</span>
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
