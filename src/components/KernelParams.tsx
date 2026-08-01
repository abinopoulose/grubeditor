import React, { useState } from 'react';
import { Cpu, Zap, AlertCircle, CheckCircle, Plus } from 'lucide-react';

interface KernelParamsProps {
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

interface KnownFlag {
  id: string;
  name: string;
  desc: string;
  category: 'performance' | 'graphics' | 'power' | 'general';
  risk: 'safe' | 'caution' | 'expert';
}

const KNOWN_FLAGS: KnownFlag[] = [
  { id: 'quiet', name: 'Quiet Boot', desc: 'Suppresses lengthy text startup log messages during Linux initialization.', category: 'general', risk: 'safe' },
  { id: 'splash', name: 'Boot Splash Screen', desc: 'Enables graphical plymouth loading animations during boot sequence.', category: 'general', risk: 'safe' },
  { id: 'nvidia-drm.modeset=1', name: 'NVIDIA DRM Modeset', desc: 'Essential for Wayland sessions and smooth tear-free rendering on NVIDIA GPUs.', category: 'graphics', risk: 'safe' },
  { id: 'nomodeset', name: 'No KMS Mode Setting', desc: 'Disables kernel display mode setting. Safe recovery fallback when drivers fail.', category: 'graphics', risk: 'caution' },
  { id: 'processor.max_cstate=1', name: 'Disable CPU Deep C-States', desc: 'Prevents CPU sleep states. Fixes audio production jitter and random idle freezes on Ryzen.', category: 'power', risk: 'caution' },
  { id: 'mitigations=off', name: 'Disable CPU Mitigations', desc: 'Disables Spectre/Meltdown hardware patches for up to 15% CPU speedup. Trades security for speed.', category: 'performance', risk: 'expert' },
  { id: 'iommu=pt', name: 'IOMMU Pass-Through', desc: 'Improves PCIe GPU virtualization pass-through performance without translation overhead.', category: 'performance', risk: 'safe' },
  { id: 'transparent_hugepage=never', name: 'Disable Huge Pages', desc: 'Required by specialized databases and real-time audio workloads to prevent latency spikes.', category: 'performance', risk: 'safe' },
];

export const KernelParams: React.FC<KernelParamsProps> = ({ config, onChange }) => {
  const [customFlag, setCustomFlag] = useState('');
  
  const rawParams = config["GRUB_CMDLINE_LINUX_DEFAULT"] || "";
  const currentFlags = rawParams
    .split(" ")
    .map(s => s.trim())
    .filter(Boolean);

  const toggleFlag = (flagId: string) => {
    let newFlags = [...currentFlags];
    if (newFlags.includes(flagId)) {
      newFlags = newFlags.filter(f => f !== flagId);
    } else {
      // Remove conflicting flags if needed (e.g. nomodeset vs nvidia-drm.modeset=1)
      if (flagId === 'nomodeset') {
        newFlags = newFlags.filter(f => f !== 'nvidia-drm.modeset=1');
      }
      newFlags.push(flagId);
    }
    onChange("GRUB_CMDLINE_LINUX_DEFAULT", newFlags.join(" "));
  };

  const addCustomFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFlag.trim()) return;
    if (!currentFlags.includes(customFlag.trim())) {
      const updated = [...currentFlags, customFlag.trim()].join(" ");
      onChange("GRUB_CMDLINE_LINUX_DEFAULT", updated);
    }
    setCustomFlag('');
  };

  const getRiskBadge = (risk: KnownFlag['risk']) => {
    switch(risk) {
      case 'safe': return <span className="status-pill emerald">Recommended</span>;
      case 'caution': return <span className="status-pill amber">Notice</span>;
      case 'expert': return <span className="status-pill red">Advanced</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Kernel Command-Line Parameters
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Fine-tune boot arguments (<code>GRUB_CMDLINE_LINUX_DEFAULT</code>) to optimize graphics drivers, Wayland display modes, and power usage.
        </p>
      </div>

      {/* Live String Preview & Advanced Editor */}
      <div className="glass-card p-6 border-l-4 border-l-blue-500 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Active Boot Arguments:
          </label>
          <span className="text-xs text-slate-500 font-mono">GRUB_CMDLINE_LINUX_DEFAULT</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={rawParams}
            onChange={(e) => onChange("GRUB_CMDLINE_LINUX_DEFAULT", e.target.value)}
            className="input-glass font-mono text-sm tracking-wide py-3 px-4 bg-slate-950/80 border-cyan-900/60 focus:border-cyan-400 shadow-inner"
            placeholder="quiet splash ..."
          />
        </div>

        <form onSubmit={addCustomFlag} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={customFlag}
            onChange={(e) => setCustomFlag(e.target.value)}
            placeholder="Type custom parameter (e.g. acpi_osi=Linux)"
            className="input-glass text-xs py-2"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-xs flex items-center gap-1 border border-slate-700 shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Flag
          </button>
        </form>
      </div>

      {/* Curated Interactive Flag Matrix */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Quick Toggle Presets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KNOWN_FLAGS.map((flag) => {
            const isEnabled = currentFlags.includes(flag.id);
            return (
              <div
                key={flag.id}
                onClick={() => toggleFlag(flag.id)}
                className={`glass-card p-4 cursor-pointer transition-all border ${
                  isEnabled
                    ? 'border-cyan-500/60 bg-gradient-to-tr from-cyan-950/40 via-slate-900/60 to-blue-950/40 shadow-lg shadow-cyan-500/5'
                    : 'border-slate-800/80 bg-slate-900/30 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-semibold text-sm text-slate-100 block flex items-center gap-2">
                      {flag.name}
                      {isEnabled && <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 inline" />}
                    </span>
                    <code className="text-xs font-mono text-cyan-300/90 block mt-0.5">{flag.id}</code>
                  </div>
                  {getRiskBadge(flag.risk)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {flag.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expert Mitigations Warning */}
      {currentFlags.includes("mitigations=off") && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
          <div>
            <strong className="font-bold text-red-200 block">Security Warning:</strong>
            You have enabled <code>mitigations=off</code>. While this dramatically boosts gaming and compile performance on pre-2019 CPUs, it disables speculative execution safeguards (Meltdown/Spectre).
          </div>
        </div>
      )}
    </div>
  );
};
