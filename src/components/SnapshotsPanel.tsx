import React, { useState, useEffect } from 'react';
import { Snapshot } from '../types';
import { ApiService } from '../services/api';
import { History, RotateCcw, ShieldCheck, Clock, CheckCircle } from 'lucide-react';

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
    await new Promise(res => setTimeout(res, 800)); // Emulate file restoration time
    await ApiService.restoreSnapshot(snap.timestamp);
    setRestoringId(null);
    setNotification(`Successfully reverted bootloader configuration to state from ${snap.date_string}`);
    loadSnaps();
    onRestore();
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-200 to-slate-300 bg-clip-text text-transparent">
          Atomic Rollback & Recovery Snapshots
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          GrubEditor automatically archives timestamped snapshots of <code>/etc/default/grub</code> and compiled boot configurations prior to every modification.
        </p>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <div className="glass-card p-6 space-y-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Automatic Safety Shield
          </h3>
          <span className="text-xs text-slate-500 font-mono">Storage: /var/lib/grub-editor/backups/</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          If an incompatible kernel flag or graphical display mode causes visual flicker during boot, you can effortlessly restore an earlier snapshot here in one click, or invoke our emergency CLI tool directly from terminal recovery TTY: <code className="text-cyan-300">sudo grub-editor-helper restore-snapshot &lt;TIMESTAMP&gt;</code>.
        </p>
      </div>

      <div className="space-y-4 pt-2">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" /> Snapshot Log History ({snapshots.length})
        </h3>

        {snapshots.length === 0 ? (
          <div className="text-slate-500 p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
            No snapshots recorded yet. Make a modification in General Settings or Theme Studio to generate an automatic safety backup!
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snap, index) => {
              const isLatest = index === 0;
              const isRestoring = restoringId === snap.timestamp;

              return (
                <div
                  key={snap.timestamp}
                  className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-blue-500/40"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-200">{snap.description}</span>
                      {isLatest && (
                        <span className="status-pill emerald text-[10px]">
                          Current State
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> {snap.date_string}
                      </span>
                      <span>ID: #{snap.timestamp}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate max-w-lg">
                      Backup: {snap.default_grub_backup}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(snap)}
                    disabled={isRestoring}
                    className="glow-btn px-4 py-2 text-xs md:w-auto w-full justify-center shrink-0 border border-cyan-500/30"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Restoring Files...' : 'Revert to This Snapshot'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
