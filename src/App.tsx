import { useState, useEffect } from 'react';
import './App.css';
import { GeneralSettings } from './components/GeneralSettings';
import { BootMenuManager } from './components/BootMenuManager';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { BootloaderConfig, BootEntry } from './types';
import { ApiService } from './services/api';
import { Terminal, RefreshCw, Shield, Check, Save, Settings, ListOrdered, RotateCcw } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [distro, setDistro] = useState<BootloaderConfig | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [bootEntries, setBootEntries] = useState<BootEntry[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [regenOutput, setRegenOutput] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState<boolean>(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState<string>('Manual configuration modification');
  const [authError, setAuthError] = useState<string | null>(null);

  const reloadData = async () => {
    try {
      setAuthError(null);
      const loadedDistro = await ApiService.getDistro();
      const loadedConfig = await ApiService.getGrubConfig();
      const loadedEntries = await ApiService.getBootEntries();
      setDistro(loadedDistro);
      setConfig(loadedConfig);
      setBootEntries(loadedEntries);
      setHasPendingChanges(false);
    } catch (err: any) {
      console.error('[GrubEditor] Initialization failed:', err);
      setAuthError(err.message || 'Unknown authorization error occurred');
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleConfigChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasPendingChanges(true);
  };

  const handleBootEntriesChange = (updatedEntries: BootEntry[]) => {
    setBootEntries(updatedEntries);
    setHasPendingChanges(true);
  };

  const handleApplyChanges = async (customSnapshotName?: string) => {
    setIsApplying(true);
    setShowModal(true);
    const snapTitle = customSnapshotName || "Manual configuration modification";
    setRegenOutput(`[Deploy] Initializing deployment pipeline...\n[Deploy] Snapshot Target: "${snapTitle}"\n[Deploy] Authenticating via Polkit...`);
    
    console.log('[GrubEditor Deploy] Starting deploy pipeline...');
    try {
      setRegenOutput(prev => prev + `\n[Deploy] Applying System Configuration (Single Batched Operation)...\n[Deploy] Please authenticate when prompted.`);
      console.log('[GrubEditor Deploy] Calling unified deploy pipeline...');
      const result = await ApiService.deployPipeline(config, bootEntries, snapTitle);
      
      setRegenOutput(prev => prev + `\n\n[System Output]:\n${result.output}\n\n[Deploy] ★ Pipeline completed successfully!`);
      console.log('[GrubEditor Deploy] Deploy complete.');
      setHasPendingChanges(false);
    } catch (e: any) {
      console.error('[GrubEditor Deploy] Deploy FAILED:', e);
      setRegenOutput(prev => prev + `\n\n[ERROR] Pipeline Aborted: ${e.message}\n[Deploy] System state remains protected. Authentication may have been dismissed or failed.`);
    } finally {
      setIsApplying(false);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050811] text-slate-100 antialiased font-sans relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-xl w-full mx-auto p-10 bg-[#0a0f1e]/80 backdrop-blur-2xl border border-rose-500/30 rounded-3xl shadow-[0_20px_60px_-15px_rgba(225,29,72,0.3)] text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/40 shadow-[0_0_30px_rgba(225,29,72,0.4)]">
            <Shield className="w-10 h-10 text-rose-400" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white tracking-tight">Authorization Required</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              GrubEditor requires root privileges to read and modify system bootloader configurations.
              The operation was cancelled or the PolicyKit daemon denied the request.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-left text-xs font-mono text-rose-300 break-words">
            {authError}
          </div>

          <button 
            onClick={reloadData}
            className="w-full mt-4 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all flex items-center justify-center gap-3 group"
          >
            <Shield className="w-5 h-5 text-indigo-200 group-hover:scale-110 transition-transform" />
            Authenticate & Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050811] text-slate-100 antialiased font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Ambient decorative lighting orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '7s' }} />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

      {/* Top Navigation Deck */}
      <header className="sticky top-0 z-40 w-full bg-[#080c1a]/80 backdrop-blur-2xl border-b border-white/[0.1] px-8 py-3 shadow-[0_10px_35px_-10px_rgba(0,0,0,0.7)] transition-all">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-6 flex-wrap lg:flex-nowrap">
          {/* Branding */}
          <div className="flex items-center gap-4 group cursor-pointer" onClick={reloadData}>
            <div className="relative w-11 h-11 rounded-2xl bg-[#090e1f] p-[2px] shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all group-hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] group-hover:scale-105 overflow-hidden border border-indigo-500/30">
              <img src="/app_logo.png" alt="GrubEditor Logo" className="w-full h-full object-cover rounded-[14px]" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-1">
                Grub<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 font-black">Editor</span>
              </h1>
            </div>
          </div>

          {/* 3-Page Navigation Switcher with Framer Motion Pill */}
          <div className="segmented-track shadow-2xl">
            <button
              onClick={() => setActiveTab('general')}
              className={`segmented-pill ${activeTab === 'general' ? 'active text-white font-bold' : 'text-slate-400'}`}
            >
              {activeTab === 'general' && (
                <motion.div
                  layoutId="navPill"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-[0_4px_16px_-2px_rgba(99,102,241,0.5)] border border-white/20 -z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Boot Defaults & Timer</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('entries')}
              className={`segmented-pill ${activeTab === 'entries' ? 'active text-white font-bold' : 'text-slate-400'}`}
            >
              {activeTab === 'entries' && (
                <motion.div
                  layoutId="navPill"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-[0_4px_16px_-2px_rgba(99,102,241,0.5)] border border-white/20 -z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <ListOrdered className="w-4 h-4" />
                <span>Boot Menu Options</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('snapshots')}
              className={`segmented-pill ${activeTab === 'snapshots' ? 'active text-white font-bold' : 'text-slate-400'}`}
            >
              {activeTab === 'snapshots' && (
                <motion.div
                  layoutId="navPill"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-[0_4px_16px_-2px_rgba(99,102,241,0.5)] border border-white/20 -z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>Recovery Snapshots</span>
              </span>
            </button>
          </div>

          {/* Action Deck */}
          <div className="flex items-center gap-3">
            <button 
              onClick={reloadData} 
              className="btn-glass !py-2.5 !px-4 text-xs font-bold group hover:border-indigo-400/40"
              title="Rescan storage partitions and reload system defaults"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-180 transition-transform duration-500" /> 
              <span>Rescan</span>
            </button>

            <button
              type="button"
              disabled={!hasPendingChanges || isApplying}
              onClick={() => {
                setSnapshotNameInput('Manual boot configuration update');
                setShowSnapshotDialog(true);
              }}
              className={`px-5 py-2.5 rounded-xl font-sans text-xs font-extrabold flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${
                hasPendingChanges 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_28px_rgba(16,185,129,0.6)] border border-emerald-400/50 scale-[1.02]' 
                  : 'bg-slate-800/60 text-slate-500 border border-white/[0.06] !cursor-not-allowed'
              }`}
            >
              <Save className={`w-4 h-4 ${hasPendingChanges ? 'animate-bounce text-emerald-200' : ''}`} />
              <span>Deploy Changes</span>
              {hasPendingChanges && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {activeTab === 'general' && (
              <GeneralSettings config={config} onChange={handleConfigChange} bootEntries={bootEntries} />
            )}
            {activeTab === 'entries' && (
              <BootMenuManager entries={bootEntries} onChange={handleBootEntriesChange} />
            )}
            {activeTab === 'snapshots' && (
              <SnapshotsPanel onRestore={reloadData} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Radix UI Snapshot Naming Prompt Dialog */}
      <Dialog.Root open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity animate-pro" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-white/[0.15] bg-[#0a1024]/95 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl focus:outline-none animate-pro text-slate-100 font-sans">
            <Dialog.Title className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-white tracking-tight">Name Configuration Snapshot</h3>
                <p className="text-xs text-slate-400 mt-0.5">Recorded in Recovery Vault for instant risk-free rollback</p>
              </div>
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-300 pt-5 leading-relaxed font-medium">
              Before committing bootloader modifications to root partitions, please provide a descriptive title for this recovery checkpoint:
            </Dialog.Description>
            <div className="my-5">
              <input
                type="text"
                value={snapshotNameInput}
                onChange={(e) => setSnapshotNameInput(e.target.value)}
                placeholder="e.g., Adjusted startup countdown to 10s"
                className="text-input w-full text-sm !bg-[#060a15] !p-4 rounded-xl font-sans text-white border-white/[0.15] focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-5 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowSnapshotDialog(false)}
                className="btn-glass !py-2.5 !px-5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSnapshotDialog(false);
                  handleApplyChanges(snapshotNameInput.trim() || 'Manual boot configuration checkpoint');
                }}
                className="btn-luminous !bg-gradient-to-r !from-emerald-600 !to-teal-600 !shadow-[0_0_20px_rgba(16,185,129,0.4)] !border-emerald-400/40 !py-2.5 !px-7 text-xs font-extrabold hover:!from-emerald-500 hover:!to-teal-500"
              >
                Confirm & Deploy
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Radix UI Accessible Deployment Dialog Modal */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg transition-opacity animate-pro" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-white/[0.15] bg-[#0a1024]/95 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl focus:outline-none animate-pro text-slate-100 font-sans">
            <Dialog.Title className="flex items-center justify-between border-b border-white/[0.08] pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                  <Terminal className="w-6 h-6 animate-pulse text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-white tracking-tight">Deploying Bootloader</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Compiling system instructions via Polkit root helper</p>
                </div>
              </div>
              {!isApplying && (
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Check className="w-4 h-4 stroke-[3]" /> Synchronized
                </span>
              )}
            </Dialog.Title>

            <Dialog.Description className="sr-only">
              System terminal log showing the real-time compilation output of the grub regeneration command.
            </Dialog.Description>

            <div className="my-6 bg-[#040711] p-5 rounded-2xl border border-white/[0.12] font-mono text-xs text-slate-300 max-h-80 overflow-y-auto space-y-2 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3 text-[11px] text-slate-500 font-semibold tracking-wider uppercase">
                <span>Kernel Terminal Pipeline</span>
                <span className="flex items-center gap-1.5 text-indigo-400 font-mono">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> /boot/grub/
                </span>
              </div>
              {regenOutput ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400 font-mono text-xs font-medium">{regenOutput}</pre>
              ) : (
                <div className="flex flex-col items-center gap-4 text-indigo-300 py-12 justify-center font-bold text-sm">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
                  <span className="tracking-wide">Executing `{distro?.regen_command.join(' ')}`...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isApplying}
                className="btn-luminous !py-2.5 !px-8 text-xs font-extrabold"
              >
                Return to Workspace
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
