import { useState, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { GeneralSettings } from './components/GeneralSettings';
import { KernelParams } from './components/KernelParams';
import { ThemeStudio } from './components/ThemeStudio';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { BootloaderConfig, BootEntry } from './types';
import { ApiService } from './services/api';
import { Terminal, RefreshCw, Shield, Check, HardDrive } from 'lucide-react';
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

  const handleThemeSelect = (_themeName: string, path: string) => {
    setConfig(prev => ({ ...prev, "GRUB_THEME": path, "GRUB_TERMINAL_OUTPUT": "gfxterm" }));
    setHasPendingChanges(true);
  };

  const handleApplyChanges = async () => {
    setIsApplying(true);
    setShowModal(true);
    setRegenOutput(null);
    try {
      await ApiService.saveGrubConfig(config, "User deployed modifications via GrubEditor GUI");
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
    <div className="min-h-screen flex bg-[#03050c] text-slate-100 antialiased overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Dock */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        distro={distro}
        hasPendingChanges={hasPendingChanges}
        onApplyChanges={handleApplyChanges}
        isApplying={isApplying}
      />

      {/* Main Workspace: Widened container (max-w-[1360px]) to perfectly utilize widescreen monitors while centering smoothly */}
      <main className="flex-1 h-screen overflow-y-auto flex flex-col items-center px-6 sm:px-12 md:px-16 xl:px-20 py-12 sm:py-16 relative z-10 w-full">
        <div className="w-full max-w-[1360px] flex flex-col space-y-12">
          {/* Top Header */}
          <header className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3.5 text-xs font-mono text-slate-400">
              <span className="font-extrabold text-white font-sans text-base sm:text-lg tracking-tight capitalize">{activeTab} Preferences</span>
              <span className="text-slate-600 font-extrabold">/</span>
              <span className="flex items-center gap-2 text-indigo-300 font-mono text-xs bg-slate-900/80 px-3.5 py-2 rounded-xl border border-white/[0.06]">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> {distro?.default_grub_path || "/etc/default/grub"}
              </span>
              <span className="text-slate-600 font-extrabold">/</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/15 px-3.5 py-2 rounded-xl border border-emerald-500/30 text-xs">
                <Shield className="w-3.5 h-3.5" /> Polkit Protected
              </span>
            </div>

            <button 
              onClick={reloadData} 
              className="btn-glass text-xs font-bold px-5 py-2.5"
              title="Synchronize state from system boot partition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Rescan Partition
            </button>
          </header>

          {/* Animated View Deck */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="pb-36 w-full"
            >
              {activeTab === 'general' && (
                <GeneralSettings config={config} onChange={handleConfigChange} bootEntries={bootEntries} />
              )}
              {activeTab === 'kernel' && (
                <KernelParams config={config} onChange={handleConfigChange} />
              )}
              {activeTab === 'themes' && (
                <ThemeStudio
                  currentThemePath={config["GRUB_THEME"] || ""}
                  onThemeSelect={handleThemeSelect}
                  bootEntries={bootEntries}
                  timeout={parseInt(config["GRUB_TIMEOUT"] || "5", 10)}
                />
              )}
              {activeTab === 'snapshots' && (
                <SnapshotsPanel onRestore={reloadData} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Radix UI Accessible Deployment Dialog Modal */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md transition-opacity animate-pro" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-indigo-500/40 bg-[#070b16] p-8 shadow-2xl focus:outline-none animate-pro">
            <Dialog.Title className="flex items-center justify-between border-b border-white/[0.07] pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
                  <Terminal className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-white">Deploying Bootloader</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Compiling system instructions via Polkit root helper</p>
                </div>
              </div>
              {!isApplying && (
                <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Synchronized
                </span>
              )}
            </Dialog.Title>

            <Dialog.Description className="sr-only">
              System terminal log showing the real-time compilation output of the grub regeneration command.
            </Dialog.Description>

            <div className="my-6 bg-[#020409] p-6 rounded-2xl border border-white/[0.06] font-mono text-xs text-slate-300 max-h-80 overflow-y-auto space-y-1.5 shadow-inner">
              {regenOutput ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400 font-mono text-xs">{regenOutput}</pre>
              ) : (
                <div className="flex items-center gap-3.5 text-indigo-400 py-12 justify-center font-bold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Executing `{distro?.regen_command.join(' ')}`...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isApplying}
                className="btn-luminous px-8 py-3.5 text-xs font-bold rounded-2xl"
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
