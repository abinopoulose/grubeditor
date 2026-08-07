import React from 'react';
import { BootEntry } from '../types';
import { HardDrive, Disc, ShieldAlert, Check, Power, Clock, Info, Cpu, Sparkles } from 'lucide-react';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { motion } from 'framer-motion';

interface GeneralSettingsProps {
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
  bootEntries: BootEntry[];
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  config,
  onChange,
  bootEntries,
}) => {
  const currentDefault = config['GRUB_DEFAULT'] || '0';
  const rawTimeout = config['GRUB_TIMEOUT'] ?? '5';
  const timeoutVal = parseInt(rawTimeout, 10);
  const isTimerEnabled = timeoutVal !== -1;

  const activeEntries = bootEntries.filter(e => e.enabled !== false && !e.deleted);
  const quickTimers = [0, 3, 5, 10, 15];

  return (
    <div className="space-y-12 w-full pb-20 font-sans">
      {/* SECTION 1: Default Boot Target */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide text-white">Default Startup Entry</h3>
              <p className="text-[12px] text-slate-400">Select which kernel or operating system launches automatically upon system power-up</p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-800/80 text-indigo-300 border border-white/[0.08] shadow-sm">
            {activeEntries.length} Active {activeEntries.length === 1 ? 'Target' : 'Targets'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 pt-1">
          {activeEntries.length === 0 && (
            <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-400 opacity-80" />
              <div>
                <h4 className="text-rose-300 font-bold text-base">No Boot Entries Found</h4>
                <p className="text-slate-400 text-sm mt-1 max-w-md">
                  We could not detect any parseable Linux or Windows boot entries on your system. 
                  This may occur if the boot partition is strictly isolated or missing.
                </p>
              </div>
            </div>
          )}

          {activeEntries.map((entry) => {
            const originalIdx = bootEntries.indexOf(entry);
            const isSelected = currentDefault === entry.id || currentDefault === originalIdx.toString();
            const safeTitle = (entry.title || '').toLowerCase();
            const isRecovery = (entry.id || '').toLowerCase().includes('recovery') || safeTitle.includes('recovery');
            const isWindows = safeTitle.includes('windows');
            const isUefi = safeTitle.includes('uefi') || entry.type === 'efi';

            const cardStyle = isSelected ? (
              isWindows ? '!bg-gradient-to-r !from-sky-950/80 !to-[#0d152a] !border-sky-400/80 !shadow-[0_0_30px_rgba(56,189,248,0.3)]' :
              isRecovery ? '!bg-gradient-to-r !from-amber-950/80 !to-[#0d152a] !border-amber-400/80 !shadow-[0_0_30px_rgba(251,191,36,0.3)]' :
              isUefi ? '!bg-gradient-to-r !from-purple-950/80 !to-[#0d152a] !border-purple-400/80 !shadow-[0_0_30px_rgba(192,132,252,0.3)]' :
              '!bg-gradient-to-r !from-indigo-950/80 !to-[#0d152a] !border-indigo-400/80 !shadow-[0_0_30px_rgba(99,102,241,0.35)]'
            ) : (
              isWindows ? 'hover:!border-sky-500/50 hover:!bg-[#111c38]/80 hover:!shadow-[0_0_22px_rgba(56,189,248,0.2)]' :
              isRecovery ? 'hover:!border-amber-500/50 hover:!bg-[#1c1a24]/80 hover:!shadow-[0_0_22px_rgba(251,191,36,0.2)]' :
              isUefi ? 'hover:!border-purple-500/50 hover:!bg-[#1a1532]/80 hover:!shadow-[0_0_22px_rgba(192,132,252,0.2)]' :
              'hover:!border-indigo-500/50 hover:!bg-[#141f42]/80 hover:!shadow-[0_0_22px_rgba(99,102,241,0.25)]'
            );

            return (
              <motion.div
                key={entry.id || originalIdx}
                whileHover={{ scale: 1.004 }}
                whileTap={{ scale: 0.998 }}
                onClick={() => onChange('GRUB_DEFAULT', entry.id || originalIdx.toString())}
                className={`selection-card !p-5 ${cardStyle} ${isSelected ? 'active' : ''}`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`icon-box !w-14 !h-14 ${isSelected ? (
                    isWindows ? '!bg-sky-500/20 !border-sky-400/50 !shadow-[0_0_15px_rgba(56,189,248,0.4)]' :
                    isRecovery ? '!bg-amber-500/20 !border-amber-400/50 !shadow-[0_0_15px_rgba(251,191,36,0.4)]' :
                    isUefi ? '!bg-purple-500/20 !border-purple-400/50 !shadow-[0_0_15px_rgba(192,132,252,0.4)]' :
                    '!bg-indigo-500/20 !border-indigo-400/50 !shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  ) : 'default'}`}>
                    {isWindows ? <HardDrive className="w-6 h-6 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" /> : isRecovery ? <ShieldAlert className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" /> : isUefi ? <Cpu className="w-6 h-6 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" /> : <Disc className="w-6 h-6 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className={`font-bold text-base truncate ${isSelected ? 'text-white font-extrabold text-lg' : 'text-slate-200'}`}>
                        {entry.title}
                      </div>
                      {isWindows && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]">Windows OS</span>
                      )}
                      {isRecovery && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(251,191,36,0.2)]">Recovery Kernel</span>
                      )}
                      {(!isWindows && !isRecovery && !isUefi) && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]">Linux Kernel</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400 flex items-center gap-2 truncate">
                      <span>Index: #{originalIdx}</span>
                      {entry.options && <span className="text-slate-500 truncate">• {entry.options}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 shrink-0">
                  {isSelected && (
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide shadow-md border ${
                      isWindows ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.3)]' :
                      isRecovery ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]' :
                      isUefi ? 'bg-purple-500/20 text-purple-300 border-purple-400/50 shadow-[0_0_15px_rgba(192,132,252,0.3)]' :
                      'bg-indigo-500/20 text-indigo-300 border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    }`}>
                      <Sparkles className="w-4 h-4 animate-pulse" /> DEFAULT TARGET
                    </span>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isSelected ? (
                      isWindows ? 'bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.7)]' :
                      isRecovery ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white shadow-[0_0_15px_rgba(251,191,36,0.7)]' :
                      isUefi ? 'bg-gradient-to-tr from-purple-600 to-fuchsia-500 text-white shadow-[0_0_15px_rgba(192,132,252,0.7)]' :
                      'bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.7)]'
                    ) : 'border border-white/20 bg-slate-900/60 hover:border-white/40'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Countdown Delay */}
      <section className="space-y-5 pt-4">
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide text-white">Countdown Delay & Timeout</h3>
              <p className="text-[12px] text-slate-400">Configure duration before automatic booting proceeds without user interaction</p>
            </div>
          </div>
          <span className={`text-xs font-extrabold px-3.5 py-1 rounded-full shadow-md flex items-center gap-1.5 ${
            isTimerEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isTimerEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {isTimerEnabled ? `Active (${timeoutVal}s)` : 'Disabled (Infinite Wait)'}
          </span>
        </div>

        <div className="space-y-4 pt-1">
          {/* Master Toggle Card */}
          <div 
            onClick={() => onChange('GRUB_TIMEOUT', isTimerEnabled ? '-1' : '5')}
            className={`toggle-card !p-5 ${isTimerEnabled ? 'active shadow-[0_0_25px_rgba(99,102,241,0.2)]' : ''}`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-xl border ${isTimerEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-slate-800/60 text-slate-500 border-white/10'}`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base text-white block">Enable Automatic Startup Countdown</span>
                <span className="text-xs text-slate-400 block mt-0.5">When disabled, boot menu halts indefinitely until a kernel is manually selected</span>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch 
                checked={isTimerEnabled} 
                onCheckedChange={(val) => onChange('GRUB_TIMEOUT', val ? '5' : '-1')} 
              />
            </div>
          </div>

          {/* Duration Preset & Scrub Module */}
          {isTimerEnabled && (
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl bg-[#0b1022]/85 border border-white/[0.12] p-7 space-y-7 shadow-[0_10px_35px_-10px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">Quick Duration Presets</span>
                  <span className="text-[11px] text-slate-400 font-medium">Click to select rapid timeout profile</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {quickTimers.map((val) => {
                    const isActive = timeoutVal === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => onChange('GRUB_TIMEOUT', val.toString())}
                        className={`py-3.5 rounded-xl font-sans text-xs font-black transition-all duration-200 cursor-pointer ${
                          isActive 
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-white/25 scale-105' 
                            : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        {val === 0 ? '0s (Instant)' : `${val}s`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-5 border-t border-white/[0.08]">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-extrabold tracking-wide uppercase text-xs">Precision Slider</span>
                  <span className="text-indigo-300 font-black text-sm bg-indigo-500/20 px-3.5 py-1.5 rounded-xl border border-indigo-400/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                    {timeoutVal} {timeoutVal === 1 ? 'Second' : 'Seconds'}
                  </span>
                </div>
                <div className="py-2">
                  <Slider
                    value={[Math.max(0, timeoutVal)]}
                    onValueChange={(vals) => onChange('GRUB_TIMEOUT', vals[0].toString())}
                    max={60}
                    step={1}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono font-bold">
                  <span>0s (Immediate)</span>
                  <span>30s (Extended Wait)</span>
                  <span>60s (Maximum)</span>
                </div>
              </div>

              {timeoutVal === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-start gap-3 shadow-sm">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-white">Caution: Zero-Second Timeout</strong>
                    Setting an immediate 0s timeout bypasses the boot menu completely. To enter recovery mode during boot, you may need to repeatedly press <code className="bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-200 font-mono">ESC</code> or <code className="bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-200 font-mono">SHIFT</code> upon system power-up.
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};
