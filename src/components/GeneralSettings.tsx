import React from 'react';
import { BootEntry } from '../types';
import { Monitor, Clock, ShieldCheck, HardDrive, AlertTriangle } from 'lucide-react';

interface GeneralSettingsProps {
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
  bootEntries: BootEntry[];
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ config, onChange, bootEntries }) => {
  const timeoutVal = parseInt(config["GRUB_TIMEOUT"] || "5", 10);
  const gfxMode = config["GRUB_GFXMODE"] || "1920x1080x32,auto";
  const osProberDisabled = config["GRUB_DISABLE_OS_PROBER"] === "true";
  const saveDefault = config["GRUB_SAVEDEFAULT"] === "true";
  const currentDefault = config["GRUB_DEFAULT"] || "0";

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          General Bootloader Settings
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Configure default behavior, boot timers, and display modes safely without risking syntax corruption in /etc/default/grub.
        </p>
      </div>

      {/* Default OS & Timeout Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-4">
          <HardDrive className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-lg text-slate-100">Boot Selection & Timers</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Default Boot Entry (GRUB_DEFAULT)
            </label>
            <select
              value={currentDefault}
              onChange={(e) => onChange("GRUB_DEFAULT", e.target.value)}
              className="input-glass cursor-pointer"
            >
              <option value="0" className="bg-slate-900">0 - First Menu Option (Recommended Default)</option>
              <option value="saved" className="bg-slate-900">saved - Remember Last Chosen Boot Option</option>
              {bootEntries.map((entry, idx) => (
                <option key={idx} value={idx.toString()} className="bg-slate-900">
                  {idx} - {entry.title}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 block mt-1">
              Select which operating system or partition boots automatically after timeout.
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" /> Timeout Countdown:
              </label>
              <span className="text-cyan-400 font-mono font-bold text-sm bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/50">
                {timeoutVal} seconds
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={timeoutVal}
              onChange={(e) => onChange("GRUB_TIMEOUT", e.target.value)}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>0s (Instant)</span>
              <span>10s</span>
              <span>20s</span>
              <span>30s</span>
            </div>
          </div>
        </div>

        {/* Save Default & OS Prober Switches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <label className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 cursor-pointer transition-all">
            <div>
              <span className="text-sm font-medium text-slate-200 block">Remember Last Selected OS</span>
              <span className="text-xs text-slate-400 block mt-0.5">Sets GRUB_SAVEDEFAULT=true in bootloader env</span>
            </div>
            <input
              type="checkbox"
              checked={saveDefault}
              onChange={(e) => onChange("GRUB_SAVEDEFAULT", e.target.checked ? "true" : "false")}
              className="w-5 h-5 rounded accent-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 cursor-pointer transition-all">
            <div>
              <span className="text-sm font-medium text-slate-200 block">Enable Dual-Boot Discovery</span>
              <span className="text-xs text-slate-400 block mt-0.5">Allow os-prober to scan Windows/Fedora partitions</span>
            </div>
            <input
              type="checkbox"
              checked={!osProberDisabled}
              onChange={(e) => onChange("GRUB_DISABLE_OS_PROBER", (!e.target.checked).toString())}
              className="w-5 h-5 rounded accent-emerald-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Display & Resolution Config */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-4">
          <Monitor className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-lg text-slate-100">Display & Resolution Mode</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Menu Screen Resolution (GRUB_GFXMODE)
            </label>
            <select
              value={gfxMode}
              onChange={(e) => onChange("GRUB_GFXMODE", e.target.value)}
              className="input-glass cursor-pointer font-mono text-sm"
            >
              <option value="auto" className="bg-slate-900">auto - Default UEFI Native Resolution</option>
              <option value="1920x1080x32,auto" className="bg-slate-900">1920x1080x32 (Full HD 1080p + Auto Fallback)</option>
              <option value="2560x1440x32,auto" className="bg-slate-900">2560x1440x32 (2K QHD Display)</option>
              <option value="3840x2160x32,auto" className="bg-slate-900">3840x2160x32 (4K Ultra HD Display)</option>
              <option value="1280x720x32,auto" className="bg-slate-900">1280x720x32 (720p HD)</option>
              <option value="1024x768x32,auto" className="bg-slate-900">1024x768x32 (Legacy XGA 4:3)</option>
            </select>
            <span className="text-[11px] text-slate-400 block mt-1">
              Controls visual clarity of graphical themes. Ensure your graphics card firmware supports the chosen resolution.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Terminal Render Engine (GRUB_TERMINAL_OUTPUT)
            </label>
            <select
              value={config["GRUB_TERMINAL_OUTPUT"] || "gfxterm"}
              onChange={(e) => onChange("GRUB_TERMINAL_OUTPUT", e.target.value)}
              className="input-glass cursor-pointer font-mono text-sm"
            >
              <option value="gfxterm" className="bg-slate-900">gfxterm - Graphical Display & Bitmap Themes (Required for Themes)</option>
              <option value="console" className="bg-slate-900">console - Plain VGA Text Mode (No Icons/Themes)</option>
            </select>
          </div>
        </div>

        {config["GRUB_TERMINAL_OUTPUT"] === "console" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Warning: Selecting <code>console</code> disables graphical themes and font rendering. Change to <code>gfxterm</code> to enjoy visual themes!</span>
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 to-blue-950/20 text-sm text-slate-300">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <strong className="text-emerald-300 font-semibold">Non-Destructive Protection:</strong> Unlike legacy tools, GrubEditor modifies only key-value pairs without renaming or wrapping scripts in <code>/etc/grub.d/</code>. Your package updates will continue seamlessly!
        </div>
      </div>
    </div>
  );
};
