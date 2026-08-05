import React from 'react';
import { BootEntry } from '../types';
import { HardDrive, Disc, ShieldAlert, Check, Power, Clock } from 'lucide-react';
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
    <div className="space-y-10 w-full pb-16 font-sans">
      {/* SECTION 1: Default Boot Target */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-xs font-bold tracking-widest text-indigo-300 uppercase flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" /> Default Startup Entry
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {activeEntries.length} Active {activeEntries.length === 1 ? 'Target' : 'Targets'}
          </span>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {activeEntries.map((entry) => {
            const originalIdx = bootEntries.indexOf(entry);
            const isSelected = currentDefault === entry.id || currentDefault === originalIdx.toString();
            const isRecovery = (entry.id || '').toLowerCase().includes('recovery') || entry.title.toLowerCase().includes('recovery');
            const isWindows = entry.title.toLowerCase().includes('windows');

            return (
              <motion.div
                key={entry.id || originalIdx}
                whileHover={{ scale: 1.003 }}
                whileTap={{ scale: 0.998 }}
                onClick={() => onChange('GRUB_DEFAULT', entry.id || originalIdx.toString())}
                className={`selection-card ${isSelected ? 'active' : ''}`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`icon-box ${isSelected ? 'active' : 'default'}`}>
                    {isWindows ? <HardDrive className="w-5 h-5" /> : isRecovery ? <ShieldAlert className="w-5 h-5" /> : <Disc className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold text-base truncate ${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                      {entry.title}
                    </div>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  isSelected ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40' : 'border border-white/20'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Countdown Delay */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-xs font-bold tracking-widest text-indigo-300 uppercase flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Countdown Delay
          </h3>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isTimerEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'}`}>
            {isTimerEnabled ? `Active (${timeoutVal}s)` : 'Disabled (Infinite)'}
          </span>
        </div>

        <div className="space-y-4 pt-1">
          {/* Master Toggle Card */}
          <div 
            onClick={() => onChange('GRUB_TIMEOUT', isTimerEnabled ? '-1' : '5')}
            className={`toggle-card ${isTimerEnabled ? 'active' : ''}`}
          >
            <span className="font-semibold text-base text-white flex items-center gap-3">
              <Power className={`w-5 h-5 ${isTimerEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              Enable Automatic Countdown
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch 
                checked={isTimerEnabled} 
                onCheckedChange={(val) => onChange('GRUB_TIMEOUT', val ? '5' : '-1')} 
              />
            </div>
          </div>

          {/* Duration Preset & Scrub Module */}
          {isTimerEnabled && (
            <div className="rounded-2xl bg-[#0d1428]/70 border border-white/[0.08] p-6 space-y-6 shadow-lg backdrop-blur-xl">
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">Quick Presets</span>
                <div className="grid grid-cols-5 gap-2.5">
                  {quickTimers.map((val) => {
                    const isActive = timeoutVal === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => onChange('GRUB_TIMEOUT', val.toString())}
                        className={`py-3 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/35 border border-indigo-400/30' 
                            : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/[0.06]'
                        }`}
                      >
                        {val === 0 ? '0s (Immediate)' : `${val}s`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">Custom Duration</span>
                  <span className="text-indigo-300 font-bold bg-indigo-500/15 px-3 py-1 rounded-lg border border-indigo-500/25">
                    {timeoutVal} Seconds
                  </span>
                </div>
                <Slider
                  value={[Math.max(0, timeoutVal)]}
                  onValueChange={(vals) => onChange('GRUB_TIMEOUT', vals[0].toString())}
                  max={60}
                  step={1}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
