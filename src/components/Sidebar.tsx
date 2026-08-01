import React from 'react';
import { Settings, Cpu, Palette, History, ShieldAlert, Terminal } from 'lucide-react';
import { BootloaderConfig } from '../types';

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
  isApplying
}) => {
  const tabs = [
    { id: 'general', label: 'General Settings', icon: Settings },
    { id: 'kernel', label: 'Kernel Parameters', icon: Cpu },
    { id: 'themes', label: 'Theme Studio & Preview', icon: Palette },
    { id: 'snapshots', label: 'Recovery & Snapshots', icon: History },
  ];

  return (
    <div className="w-72 border-r border-[var(--border-glass)] bg-[rgba(10,14,23,0.85)] backdrop-blur-2xl flex flex-col justify-between p-5 select-none shrink-0 h-screen sticky top-0">
      <div>
        {/* App Title Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Terminal className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              GrubEditor
            </h1>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Wayland & Polkit Safe
            </span>
          </div>
        </div>

        {/* Host OS & Distro Badge */}
        {distro && (
          <div className="mb-6 p-3 rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.1)] to-[rgba(6,182,212,0.05)] border border-[rgba(59,130,246,0.25)] text-xs">
            <div className="font-semibold text-cyan-300 flex items-center justify-between">
              <span>{distro.distro_name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-blue-500/20 text-blue-300 font-mono">
                {distro.family}
              </span>
            </div>
            <div className="text-slate-400 mt-2 flex items-center gap-1 font-mono text-[11px] truncate">
              <span className="text-slate-500">$</span> {distro.regen_command.join(' ')}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="space-y-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer / Apply CTA */}
      <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Privilege helper invokes <strong className="text-slate-200">pkexec</strong> for atomic upgrades.</span>
        </div>

        <button
          onClick={onApplyChanges}
          disabled={!hasPendingChanges || isApplying}
          className="glow-btn w-full justify-center text-sm py-3 relative overflow-hidden"
        >
          {isApplying ? (
            <span>Running Generator...</span>
          ) : hasPendingChanges ? (
            <span>Apply to /etc/default/grub</span>
          ) : (
            <span>Config Synchronized</span>
          )}
        </button>
      </div>
    </div>
  );
};
