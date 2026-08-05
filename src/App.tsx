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

  const reloadData = async () => {
    const loadedDistro = await ApiService.getDistro();
    const loadedConfig = await ApiService.getGrubConfig();
    const loadedEntries = await ApiService.getBootEntries();
    setDistro(loadedDistro);
    setConfig(loadedConfig);
    setBootEntries(loadedEntries);
    setHasPendingChanges(false);
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
    setRegenOutput(null);
    const snapTitle = customSnapshotName || "Manual configuration modification";
    try {
      await ApiService.saveGrubConfig(config, snapTitle, true);
      await ApiService.saveBootEntries(bootEntries, "User deployed boot menu option modifications via GrubEditor GUI", false);
      const result = await ApiService.triggerRegen();
      setRegenOutput(result.output);
      setHasPendingChanges(false);
    } catch (e: any) {
      setRegenOutput(`Error applying configuration: ${e.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c16] text-slate-100 antialiased font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Deck */}
      <header className="sticky top-0 z-40 w-full bg-[#0a0f1d]/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 shadow-xl">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 p-[1px] shadow-md shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0d1224] rounded-[11px] flex items-center justify-center">
                <Terminal className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <h1 className="font-extrabold text-2xl text-white tracking-tight">
              Grub<span className="text-indigo-400 font-bold">Editor</span>
            </h1>
          </div>

          {/* 3-Page Navigation Switcher */}
          <div className="segmented-track shadow-inner">
            <button
              onClick={() => setActiveTab('general')}
              className={`segmented-pill flex items-center gap-2 ${activeTab === 'general' ? 'active' : ''}`}
            >
              <Settings className="w-4 h-4" />
              <span>Boot Defaults & Timer</span>
            </button>
            <button
              onClick={() => setActiveTab('entries')}
              className={`segmented-pill flex items-center gap-2 ${activeTab === 'entries' ? 'active' : ''}`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Boot Menu Options</span>
            </button>
            <button
              onClick={() => setActiveTab('snapshots')}
              className={`segmented-pill flex items-center gap-2 ${activeTab === 'snapshots' ? 'active' : ''}`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recovery Snapshots</span>
            </button>
          </div>

          {/* Action Deck */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={reloadData} 
              className="btn-glass !py-2 !px-3.5 text-xs"
              title="Rescan storage partitions and reload system defaults"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> 
              <span>Rescan</span>
            </button>

            <button
              type="button"
              disabled={!hasPendingChanges || isApplying}
              onClick={() => {
                setSnapshotNameInput('Manual boot configuration update');
                setShowSnapshotDialog(true);
              }}
              className={`px-5 py-2.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                hasPendingChanges 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]' 
                  : 'bg-slate-800/80 text-slate-500 border border-white/[0.05] !cursor-not-allowed'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${hasPendingChanges ? 'animate-bounce' : ''}`} />
              <span>Deploy</span>
              {hasPendingChanges && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Workspace */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
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
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-white/[0.12] bg-[#0d1428] p-8 shadow-2xl focus:outline-none animate-pro text-slate-100 font-sans">
            <Dialog.Title className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white">Name Configuration Snapshot</h3>
                <p className="text-xs text-slate-400 mt-0.5">Recorded in Recovery Vault for risk-free rollback</p>
              </div>
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-300 pt-5 leading-relaxed font-medium">
              Before committing modifications to system boot partitions, please provide a title for this recovery checkpoint:
            </Dialog.Description>
            <div className="my-5">
              <input
                type="text"
                value={snapshotNameInput}
                onChange={(e) => setSnapshotNameInput(e.target.value)}
                placeholder="e.g., Adjusted startup countdown to 10s"
                className="text-input w-full text-sm !bg-[#070b16] !p-4 rounded-xl font-sans text-white"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowSnapshotDialog(false)}
                className="btn-glass !py-2.5 !px-5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSnapshotDialog(false);
                  handleApplyChanges(snapshotNameInput.trim() || 'Manual boot configuration checkpoint');
                }}
                className="btn-luminous !py-2.5 !px-6 text-xs"
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity animate-pro" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-white/[0.12] bg-[#0d1428] p-8 shadow-2xl focus:outline-none animate-pro text-slate-100 font-sans">
            <Dialog.Title className="flex items-center justify-between border-b border-white/[0.08] pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  <Terminal className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Deploying Bootloader</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Compiling system instructions via Polkit root helper</p>
                </div>
              </div>
              {!isApplying && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Synchronized
                </span>
              )}
            </Dialog.Title>

            <Dialog.Description className="sr-only">
              System terminal log showing the real-time compilation output of the grub regeneration command.
            </Dialog.Description>

            <div className="my-6 bg-[#050812] p-5 rounded-2xl border border-white/[0.08] font-mono text-xs text-slate-300 max-h-80 overflow-y-auto space-y-1.5 shadow-inner">
              {regenOutput ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400 font-mono text-xs">{regenOutput}</pre>
              ) : (
                <div className="flex items-center gap-3 text-indigo-400 py-12 justify-center font-semibold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Executing `{distro?.regen_command.join(' ')}`...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isApplying}
                className="btn-luminous !py-2.5 !px-8 text-xs"
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
