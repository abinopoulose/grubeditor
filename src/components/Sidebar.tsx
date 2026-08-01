import React from 'react';
import { BootloaderConfig } from '../types';
import { Settings, Cpu, LayoutTemplate, RotateCcw, Save, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  distro: BootloaderConfig | null;
  hasPendingChanges: boolean;
  onApplyChanges: () => void;
  isApplying: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  distro,
  hasPendingChanges,
  onApplyChanges,
  isApplying,
}) => {
  const navItems = [
    { id: 'general', label: 'General & Timers', icon: Settings },
    { id: 'kernel', label: 'Kernel Tuning', icon: Cpu },
    { id: 'themes', label: 'Theme Studio', icon: LayoutTemplate },
    { id: 'snapshots', label: 'Recovery Shield', icon: RotateCcw },
  ];

  return (
    <aside className="w-[280px] sm:w-[300px] pro-sidebar h-screen flex flex-col justify-between p-7 pb-8 shrink-0 select-none relative z-20 shadow-[20px_0_50px_rgba(0,0,0,0.75)]">
      <div className="space-y-12">
        {/* App Branding */}
        <div className="flex items-center gap-4 px-1 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-blue-500 p-[1px] shadow-lg shadow-indigo-500/25 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-[#050712] rounded-[15px] flex items-center justify-center">
              <Terminal className="w-6 h-6 text-indigo-400 filter drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-2xl text-white tracking-tight">
                Grub<span className="text-indigo-400">Editor</span>
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 text-[9px] font-mono font-extrabold">PRO</span>
            </div>
            <span className="text-xs text-slate-400 font-semibold block mt-0.5">
              Linux Desktop Boot Utility
            </span>
          </div>
        </div>

        {/* Navigation Dock */}
        <nav className="space-y-2">
          <div className="px-3 pb-2.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 font-sans">
            System Preferences
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-pill ${isActive ? 'active' : ''}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 bg-indigo-500/20 border border-indigo-400/35 rounded-[16px] shadow-[0_4px_20px_-3px_rgba(99,102,241,0.3)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <div className={`p-2.5 rounded-xl transition-all relative z-10 ${
                  isActive ? 'bg-indigo-500/30 text-indigo-300 shadow-md shadow-indigo-500/20' : 'text-slate-400'
                }`}>
                  <Icon className="w-5 h-5 nav-icon" />
                </div>
                <span className="relative z-10 font-bold text-[15px]">{item.label}</span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Atmospheric Footer & Deploy Controls with balanced padding */}
      <div className="space-y-5 pt-6 border-t border-white/[0.07]">
        <div className="px-2 space-y-1">
          <span className="text-xs font-semibold text-slate-400 block font-mono">Host Workstation:</span>
          <span className="font-extrabold text-sm text-white block truncate" title={String(distro?.distro_name || 'Ubuntu Linux')}>
            {String(distro?.distro_name || 'Ubuntu Linux')}
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={onApplyChanges}
          disabled={!hasPendingChanges || isApplying}
          className={`w-full justify-center py-4 text-xs font-extrabold transition-all rounded-2xl flex items-center gap-2.5 ${
            hasPendingChanges 
              ? 'btn-luminous animate-pulse shadow-xl shadow-indigo-500/35 text-white' 
              : 'bg-white/[0.035] text-slate-400 border border-white/[0.07] cursor-not-allowed shadow-inner font-bold'
          }`}
        >
          {isApplying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Deploying...</span>
            </>
          ) : hasPendingChanges ? (
            <>
              <Save className="w-4 h-4" />
              <span>Deploy Configurations</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
              <span>System Synchronized</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
