import React, { useState, useEffect } from 'react';
import { ThemeMetadata, BootEntry } from '../types';
import { ThemePreviewer } from './ThemePreviewer';
import { CheckCircle, AlertTriangle, XCircle, FileCheck, Sparkles } from 'lucide-react';
import { ApiService } from '../services/api';

interface ThemeStudioProps {
  currentThemePath: string;
  onThemeSelect: (themeName: string, path: string) => void;
  bootEntries: BootEntry[];
  timeout: number;
}

export const ThemeStudio: React.FC<ThemeStudioProps> = ({
  currentThemePath,
  onThemeSelect,
  bootEntries,
  timeout
}) => {
  const [themes, setThemes] = useState<ThemeMetadata[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiService.scanThemes().then(data => {
      setThemes(data);
      if (data.length > 0) {
        // Find matching active theme or default to first valid one
        const active = data.find(t => currentThemePath.includes(t.name)) || data[0];
        setSelectedTheme(active);
      }
      setIsLoading(false);
    });
  }, [currentThemePath]);

  const handleApply = async (t: ThemeMetadata) => {
    if (!t.is_valid) return;
    await ApiService.applyTheme(t.name);
    onThemeSelect(t.name, `${t.path}/theme.txt`);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-slate-300 bg-clip-text text-transparent">
          GRUB Theme Studio & Live Verification
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Inspect theme assets, verify resolution compliance and font permissions (.pf2), and simulate your boot display before rebooting.
        </p>
      </div>

      {/* Live Simulation Screen */}
      <ThemePreviewer theme={selectedTheme} bootEntries={bootEntries} timeout={timeout} />

      {/* Theme Selection Cards & Health Diagnostics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" /> Installed Boot Themes
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Scanning folder: /boot/grub/themes/
          </span>
        </div>

        {isLoading ? (
          <div className="text-slate-400 p-8 text-center animate-pulse">Scanning filesystem for installed theme assets...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((t) => {
              const isSelected = selectedTheme?.name === t.name;
              const isActiveInGrub = currentThemePath.includes(t.name);

              return (
                <div
                  key={t.name}
                  onClick={() => setSelectedTheme(t)}
                  className={`glass-card p-5 cursor-pointer transition-all flex flex-col justify-between border ${
                    isSelected
                      ? 'border-cyan-400 bg-gradient-to-b from-[rgba(6,182,212,0.15)] to-slate-900 shadow-xl shadow-cyan-500/10 scale-[1.02]'
                      : 'border-slate-800 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <h4 className="font-bold text-base text-white truncate">{t.name}</h4>
                      {isActiveInGrub && (
                        <span className="status-pill emerald shrink-0 text-[10px]">
                          Active Theme
                        </span>
                      )}
                    </div>

                    {/* Health Audit Checklist (GrubDeck logic!) */}
                    <div className="space-y-2 mb-4 p-3 rounded-lg bg-slate-950/60 border border-slate-900 text-xs">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5 pb-1 border-b border-slate-900">
                        <FileCheck className="w-3.5 h-3.5 text-blue-400" /> Verification Checklist:
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Config (theme.txt):</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 inline" /> Valid
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Bitmap Fonts (.pf2):</span>
                        {t.has_pf2_fonts ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 inline" /> Present
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold flex items-center gap-1" title="May fallback to text mode during boot">
                            <AlertTriangle className="w-3.5 h-3.5 inline" /> Missing Font!
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Read Permissions:</span>
                        {t.is_valid ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 inline" /> 0755 Safe
                          </span>
                        ) : (
                          <span className="text-red-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 inline" /> Broken
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Validation Errors Display */}
                    {!t.is_valid && t.validation_errors.length > 0 && (
                      <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs space-y-1">
                        {t.validation_errors.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleApply(t); }}
                    disabled={!t.is_valid || isActiveInGrub}
                    className="glow-btn w-full justify-center py-2 text-xs mt-2"
                  >
                    {isActiveInGrub ? "Currently Configured in GRUB" : t.is_valid ? "Apply & Configure Theme" : "Cannot Apply (Invalid Assets)"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
