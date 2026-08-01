import React from 'react';
import { BootEntry } from '../types';
import { Clock, Monitor, Eye, HardDrive, Sparkles, Disc, ShieldAlert, Check } from 'lucide-react';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
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
  const timeoutVal = parseInt(config['GRUB_TIMEOUT'] || '5', 10);
  const gfxMode = config['GRUB_GFXMODE'] || 'auto';
  const styleVal = config['GRUB_TIMEOUT_STYLE'] || 'menu';
  const isHidden = styleVal === 'hidden';
  const disableOsProber = config['GRUB_DISABLE_OS_PROBER'] === 'true';

  const resolutions = [
    { label: 'Auto (Native Monitor)', value: 'auto', sub: 'Detected by UEFI firmware' },
    { label: '1920×1080 (Full HD)', value: '1920x1080x32', sub: '16:9 Standard 1080p' },
    { label: '2560×1440 (WQHD 1440p)', value: '2560x1440x32', sub: '16:9 Widescreen QHD' },
    { label: '3840×2160 (4K Ultra HD)', value: '3840x2160x32', sub: '16:9 2160p Display' },
  ];
  const quickTimers = [0, 3, 5, 10, 15];

  return (
    <div className="space-y-16 w-full">
      {/* Page Title */}
      <div className="space-y-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          General Preferences & Timers
        </h2>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
          Manage startup operating system priorities, graphical boot screen countdown durations, and display resolutions with zero-risk root sandboxing.
        </p>
      </div>

      {/* SECTION 1: Default Boot Target */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-indigo-400" /> Default Startup Target
            </h3>
            <p className="text-sm text-slate-400">Select which operating system gets highlighted automatically during boot.</p>
          </div>
          <span className="badge indigo font-mono">{bootEntries.length} Boot Targets Discovered</span>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          {bootEntries.length === 0 ? (
            <div className="selection-card justify-center p-16">
              <span className="text-slate-400 font-mono text-xs">Interrogating UEFI partitions and MBR tables for installed operating systems...</span>
            </div>
          ) : (
            bootEntries.map((entry, idx) => {
              const isSelected = currentDefault === entry.id || currentDefault === idx.toString() || (idx === 0 && currentDefault === '0');
              const isRecovery = (entry.id || '').toLowerCase().includes('recovery') || entry.title.toLowerCase().includes('recovery');
              const isWindows = entry.title.toLowerCase().includes('windows');

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.008 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => onChange('GRUB_DEFAULT', idx.toString())}
                  className={`selection-card ${isSelected ? 'active' : ''}`}
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className={`icon-box ${isSelected ? 'active' : 'default'}`}>
                      {isWindows ? <HardDrive className="w-6 h-6" /> : isRecovery ? <ShieldAlert className="w-6 h-6" /> : <Disc className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className={`font-extrabold text-lg truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {entry.title}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 font-mono">
                        <span className="code-tag !py-1 !px-2.5 !text-[11px] !rounded-md">INDEX #{idx}</span>
                        <span className="text-slate-600">•</span>
                        <span className={isSelected ? 'text-indigo-300 font-bold' : 'text-slate-500'}>
                          {isWindows ? 'Windows EFI Bootloader' : isRecovery ? 'Recovery Diagnostic Mode' : 'Linux Monolithic Kernel'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`check-indicator ${isSelected ? 'active' : 'default'}`}>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 2: Timers & Framebuffer - 2-Column Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-divider">
        {/* Countdown Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle><Clock className="w-6 h-6 text-indigo-400" /> Boot Countdown Delay</CardTitle>
            <CardDescription>Adjust how long GRUB pauses on the bootloader screen before automatically booting your primary operating system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <span className="status-label block">Quick Preset Buttons</span>
              <div className="segmented-track flex-wrap w-full justify-between">
                {quickTimers.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange('GRUB_TIMEOUT', val.toString())}
                    className={`segmented-pill flex-1 font-mono text-center ${timeoutVal === val ? 'bg-indigo-500 text-white font-extrabold shadow-lg' : ''}`}
                  >
                    {val}s
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400 font-bold">Precision Touch Scrub</span>
                <span className="code-tag !bg-indigo-500/20 !text-indigo-300 !border-indigo-500/35">
                  {timeoutVal} Seconds
                </span>
              </div>
              <Slider
                value={[timeoutVal]}
                onValueChange={(vals) => onChange('GRUB_TIMEOUT', vals[0].toString())}
                max={30}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resolution Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle><Monitor className="w-6 h-6 text-indigo-400" /> Framebuffer Display Standard</CardTitle>
            <CardDescription>Configure the graphical monitor resolution for the GRUB console to ensure crisp artwork without distortion.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resolutions.map((res) => {
                const active = gfxMode === res.value;
                return (
                  <div
                    key={res.value}
                    onClick={() => onChange('GRUB_GFXMODE', res.value)}
                    className={`selection-card !rounded-2xl !p-4 !flex-col !items-start !gap-2 ${active ? 'active' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-extrabold text-sm">{res.label}</span>
                      <div className={`check-indicator !w-5 !h-5 ${active ? 'active' : 'default'}`}>
                        {active && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">{res.sub}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECTION 3: Startup Behaviour Switches */}
      <section className="space-y-6 section-divider">
        <h3 className="text-xl font-bold text-white flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400" /> Advanced Startup Behaviors
        </h3>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-2">
          {/* Hide GRUB Menu */}
          <div 
            onClick={() => onChange('GRUB_TIMEOUT_STYLE', isHidden ? 'menu' : 'hidden')}
            className={`toggle-card ${isHidden ? 'active' : ''}`}
          >
            <div className="space-y-2">
              <span className="font-extrabold text-xl text-white flex items-center gap-3">
                <Eye className="w-5 h-5 text-indigo-400 shrink-0" /> Hide GRUB Selection Screen
              </span>
              <p className="text-sm text-slate-400 leading-relaxed pt-1">
                Bypass graphical menu rendering and boot instantly into primary OS. Hold <kbd className="code-tag !py-0.5 !px-2 !text-xs !rounded-md">ESC</kbd> or <kbd className="code-tag !py-0.5 !px-2 !text-xs !rounded-md">SHIFT</kbd> during BIOS check to force menu display.
              </p>
            </div>
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="status-label">Status: {isHidden ? "Hidden Menu" : "Standard GUI Menu"}</span>
              <Switch checked={isHidden} onCheckedChange={(val) => onChange('GRUB_TIMEOUT_STYLE', val ? 'hidden' : 'menu')} />
            </div>
          </div>

          {/* Dual-Boot OS Prober */}
          <div 
            onClick={() => onChange('GRUB_DISABLE_OS_PROBER', !disableOsProber ? 'false' : 'true')}
            className={`toggle-card ${!disableOsProber ? 'active' : ''}`}
          >
            <div className="space-y-2">
              <span className="font-extrabold text-xl text-white flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" /> Dual-Boot OS Prober Engine
              </span>
              <p className="text-sm text-slate-400 leading-relaxed pt-1">
                Automatically interrogate SATA, NVMe, and USB disk drives for co-existing Windows, macOS, and secondary Linux installations.
              </p>
            </div>
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="status-label">Status: {!disableOsProber ? "Active Probing" : "Prober Disabled"}</span>
              <Switch checked={!disableOsProber} onCheckedChange={(val) => onChange('GRUB_DISABLE_OS_PROBER', !val ? 'true' : 'false')} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
