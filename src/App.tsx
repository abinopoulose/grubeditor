import { useState, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { GeneralSettings } from './components/GeneralSettings';
import { KernelParams } from './components/KernelParams';
import { ThemeStudio } from './components/ThemeStudio';
import { SnapshotsPanel } from './components/SnapshotsPanel';
import { BootloaderConfig, BootEntry } from './types';
import { ApiService } from './services/api';
import { Terminal, CheckCircle2, RefreshCw, Layers } from 'lucide-react';

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
      await ApiService.saveGrubConfig(config, "User clicked Apply Changes in GUI");
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
    <div className="min-h-screen flex text-slate-100 bg-[var(--bg-primary)]">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        distro={distro}
        hasPendingChanges={hasPendingChanges}
        onApplyChanges={handleApplyChanges}
        isApplying={isApplying}
      />

      {/* Main Content Pane */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        {/* Top Header Information bar */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Root Bootloader Sandbox Active
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>Config File: <strong className="text-slate-300">{distro?.default_grub_path || "/etc/default/grub"}</strong></span>
            <span className="text-slate-600">•</span>
            <button onClick={reloadData} className="hover:text-cyan-400 flex items-center gap-1 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Synchronize
            </button>
          </div>
        </header>

        {/* Tab content display */}
        <div className="pb-16">
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
        </div>
      </main>

      {/* Polkit Execution Generator Output Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-6 space-y-4 border border-cyan-500/40 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-3">
              <div className="flex items-center gap-2 text-lg font-bold text-slate-100">
                <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span>Polkit Helper: Bootloader Configuration Update</span>
              </div>
              {!isApplying && (
                <span className="status-pill emerald">
                  <CheckCircle2 className="w-4 h-4" /> Finished Successfully
                </span>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                {isApplying
                  ? "Prompting for administrator authorization via OS Polkit dialog and generating grub configuration..."
                  : "Modifications saved to /etc/default/grub and bootloader generator complete!"}
              </p>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-xs text-emerald-400 max-h-80 overflow-y-auto space-y-1 shadow-inner">
                {regenOutput ? (
                  <pre className="whitespace-pre-wrap leading-relaxed">{regenOutput}</pre>
                ) : (
                  <div className="flex items-center gap-2 text-cyan-400 py-6 justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Executing `{distro?.regen_command.join(' ')}` with elevated Polkit privileges...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={isApplying}
                className="glow-btn px-6 py-2 text-xs"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
