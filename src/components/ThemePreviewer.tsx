import React from 'react';
import { ThemeMetadata, BootEntry } from '../types';
import { Monitor, Terminal } from 'lucide-react';

interface ThemePreviewerProps {
  theme: ThemeMetadata | null;
  bootEntries: BootEntry[];
  timeout: number;
}

export const ThemePreviewer: React.FC<ThemePreviewerProps> = ({ theme, bootEntries, timeout }) => {
  if (!theme) {
    return (
      <div className="h-[420px] w-full rounded-3xl border border-white/[0.07] bg-[#050710]/80 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-3 font-mono text-xs shadow-2xl">
        <Monitor className="w-10 h-10 text-slate-600 animate-pulse" />
        <span>Select an installed theme from the studio grid below to launch the UEFI graphical monitor simulation...</span>
      </div>
    );
  }

  const defaultEntries: BootEntry[] = [
    { id: '0', title: 'Ubuntu 24.04.4 LTS (Monolithic Kernel 6.8.0-45)' },
    { id: '1', title: 'Ubuntu 24.04.4 LTS (Recovery & Advanced Diagnostics)' },
    { id: '2', title: 'Windows 11 Pro (on /dev/nvme0n1p1 via OS-Prober)' },
    { id: '3', title: 'UEFI Firmware & NVRAM System Setup' },
  ];

  const displayEntries = bootEntries.length > 0 ? bootEntries : defaultEntries;

  return (
    <div className="rounded-3xl border border-indigo-500/40 bg-gradient-to-b from-[#0b1022] to-[#04060c] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative overflow-hidden text-slate-100 ring-1 ring-white/[0.1]">
      {/* Monitor frame header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 animate-ping" />
          <span className="font-extrabold font-mono text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-400" /> LIVE UEFI SIMULATOR: <strong className="text-indigo-300">{theme.name}</strong>
          </span>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-black/60 px-3 py-1 rounded-lg border border-white/[0.08]">
          Resolution: <strong>1920x1080x32 (GFXTERM)</strong>
        </span>
      </div>

      {/* Simulated Display Screen */}
      <div className="relative rounded-2xl bg-[#020308] border border-white/[0.1] h-[360px] sm:h-[400px] flex flex-col justify-between p-8 sm:p-12 shadow-inner overflow-hidden">
        {/* Subtle background glow mimicking distributor branding */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          <div className="text-center space-y-1 pb-4 border-b border-white/[0.05]">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-widest uppercase font-mono drop-shadow-md">
              GNU GRUB version 2.06-2ubuntu14.4
            </h3>
            <span className="text-[11px] font-mono text-indigo-300 font-semibold block">
              Theme Profile: {theme.path}/theme.txt
            </span>
          </div>

          {/* Menu list items */}
          <div className="space-y-3 max-w-3xl mx-auto font-mono text-xs sm:text-sm">
            {displayEntries.slice(0, 4).map((entry, idx) => {
              const isSelected = idx === 0;
              return (
                <div
                  key={idx}
                  className={`px-6 py-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-extrabold border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.6)] scale-[1.01]'
                      : 'bg-white/[0.02] border-transparent text-slate-300 opacity-80'
                  }`}
                >
                  <span className="truncate"> * {entry.title} </span>
                  {isSelected && <span className="text-[10px] uppercase tracking-wider bg-black/40 px-2.5 py-0.5 rounded text-indigo-200">AUTO-BOOT</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer screen help instructions */}
        <div className="text-center font-mono text-[11px] text-slate-400 relative z-10 pt-4 border-t border-white/[0.05] flex flex-wrap justify-between items-center gap-4">
          <span>Use the <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/[0.1] text-indigo-300 font-bold">↑</kbd> and <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/[0.1] text-indigo-300 font-bold">↓</kbd> keys to select which entry is highlighted.</span>
          <span className="text-indigo-300 font-extrabold bg-indigo-950/80 px-3 py-1 rounded-md border border-indigo-500/30">
            The highlighted entry will execute automatically in {timeout}s.
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-2 font-mono">
        <span className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-indigo-400" /> PF2 bitmap fonts will render natively without pixelation during hardware cold-boot.</span>
        <span>Status: <strong>{theme.is_valid ? 'Verified' : 'Missing Assets'}</strong></span>
      </div>
    </div>
  );
};
