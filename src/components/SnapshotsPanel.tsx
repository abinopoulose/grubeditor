import React, { useState, useEffect } from 'react';
import { Snapshot } from '../types';
import { ApiService } from '../services/api';
import { RotateCcw, ShieldCheck, Clock, CheckCircle2, FileText, Folder } from 'lucide-react';
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
    await new Promise(res => setTimeout(res, 800));
    await ApiService.restoreSnapshot(snap.timestamp);
    setRestoringId(null);
    setNotification(`Successfully restored system bootloader configuration from snapshot created on ${snap.date_string}`);
    loadSnaps();
    onRestore();
    setTimeout(() => setNotification(null), 6000);
  };

  return (
    <div className="space-y-16 w-full">
      <div className="space-y-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Recovery Shield & Snapshots
        </h2>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
          GrubEditor automatically records timestamped configuration archives prior to every system deployment for zero-risk recovery and absolute rollback assurance.
        </p>
      </div>

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="selection-card active !cursor-default" style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(16, 185, 129, 0.1)' }}
        >
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 text-sm font-extrabold">{notification}</span>
          </div>
        </motion.div>
      )}

      {/* Assurance Vault Box */}
      <div className="info-banner">
        <div className="ui-card-header flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="ui-card-title">
            <ShieldCheck className="w-6 h-6 text-emerald-400" /> Pre-Modification Rollback Assurance
          </div>
          <span className="code-tag flex items-center gap-2 shrink-0">
            <Folder className="w-4 h-4 text-emerald-400" /> Vault Path: <strong className="text-emerald-300">/var/lib/grub-editor/backups/</strong>
          </span>
        </div>
        <div className="ui-card-content">
          <p className="ui-card-description text-sm">
            If a custom kernel flag or display resolution ever impedes normal workstation booting, you can revert instantaneously with a single click below or execute our terminal helper from a recovery TTY session: <code className="code-tag inline-block mt-2">sudo grub-editor-helper restore-snapshot &lt;TIMESTAMP&gt;</code>
          </p>
        </div>
      </div>

      {/* Recorded Backups Deck */}
      <section className="space-y-6 section-divider">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-400" /> Recorded Configuration Vault ({snapshots.length})
          </h3>
          <p className="text-sm text-slate-400">Select any archived configuration point to immediately restore system files to their exact historical state.</p>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          {snapshots.length === 0 ? (
            <div className="selection-card justify-center p-20 !cursor-default">
              <span className="text-slate-400 font-mono text-sm text-center">No safety snapshots recorded yet. Deploy a modification in General Settings to generate your first automatic backup archive!</span>
            </div>
          ) : (
            snapshots.map((snap, index) => {
              const isLatest = index === 0;
              const isRestoring = restoringId === snap.timestamp;

              return (
                <motion.div
                  key={snap.timestamp}
                  whileHover={{ scale: 1.008 }}
                  whileTap={{ scale: 0.995 }}
                  className="snapshot-card flex-col sm:flex-row"
                >
                  <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="font-extrabold text-xl text-white">{snap.description}</span>
                      {isLatest && (
                        <span className="badge emerald">Active Live Snapshot</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-2 text-slate-300 font-semibold">
                        <Clock className="w-4 h-4 text-indigo-400" /> {snap.date_string}
                      </span>
                      <span>Vault ID: <strong className="text-indigo-300 font-bold">#{snap.timestamp}</strong></span>
                    </div>
                    <div className="text-xs font-mono text-slate-500 truncate max-w-2xl">
                      Archive File: <span className="text-slate-300 font-semibold">{snap.default_grub_backup}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(snap)}
                    disabled={isRestoring}
                    className="btn-luminous shrink-0 px-8 py-4 text-xs font-bold"
                  >
                    <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Restoring System...' : 'Revert to Snapshot'}</span>
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
