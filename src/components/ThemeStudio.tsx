import React, { useState, useEffect } from 'react';
import { ThemeMetadata, BootEntry } from '../types';
import { ThemePreviewer } from './ThemePreviewer';
import { CheckCircle2, AlertTriangle, XCircle, FileCheck, Palette, Folder } from 'lucide-react';
import { ApiService } from '../services/api';
import { motion } from 'framer-motion';

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
    <div className="space-y-16 w-full">
      <div className="space-y-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Theme Studio & Verification
        </h2>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
          Preview interactive bootloader graphical themes before rebooting your hardware. Simultaneously audits bitmap font availability (.pf2) and filesystem readability.
        </p>
      </div>

      {/* Live Simulation Monitor */}
      <ThemePreviewer theme={selectedTheme} bootEntries={bootEntries} timeout={timeout} />

      {/* Discovered Themes Grid */}
      <section className="space-y-8 section-divider">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Palette className="w-5 h-5 text-indigo-400" /> Discovered Boot Themes ({themes.length})
            </h3>
            <p className="text-sm text-slate-400">Click any card to inspect layout on the simulator above, or deploy directly to storage.</p>
          </div>
          <span className="code-tag flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400" /> Directory: <strong className="text-indigo-300">/boot/grub/themes/</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="selection-card justify-center p-20">
            <span className="text-slate-400 font-mono text-sm">Scanning root storage drives for installed GRUB themes...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {themes.map((t) => {
              const isSelected = selectedTheme?.name === t.name;
              const isActiveInGrub = currentThemePath.includes(t.name);

              return (
                <motion.div
                  key={t.name}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => setSelectedTheme(t)}
                  className={`selection-card !flex-col !items-stretch !p-0 overflow-hidden ${isSelected ? 'active' : ''}`}
                >
                  {/* Theme name header */}
                  <div className="flex justify-between items-center gap-4 p-7 pb-5">
                    <h4 className="font-extrabold text-2xl text-white truncate">{t.name}</h4>
                    {isActiveInGrub && (
                      <span className="badge emerald shrink-0">Active Boot Theme</span>
                    )}
                  </div>

                  {/* Diagnostic Audit Box */}
                  <div className="mx-7 mb-7">
                    <div className="diagnostic-box">
                      <div className="diagnostic-header">
                        <FileCheck className="w-4 h-4 text-indigo-400" /> Asset Health Diagnostics
                      </div>
                      
                      <div className="diagnostic-row">
                        <span className="text-slate-400 font-medium">Theme Descriptor:</span>
                        {t.validation_errors.some(e => e.toLowerCase().includes('theme.txt')) ? (
                          <span className="text-red-400 font-extrabold flex items-center gap-1.5">
                            <XCircle className="w-4 h-4" /> Missing theme.txt
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Valid theme.txt
                          </span>
                        )}
                      </div>

                      <div className="diagnostic-row">
                        <span className="text-slate-400 font-medium">PF2 Bitmap Fonts:</span>
                        {t.has_pf2_fonts ? (
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Found & Ready
                          </span>
                        ) : (
                          <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" /> Missing (.pf2)
                          </span>
                        )}
                      </div>

                      <div className="diagnostic-row">
                        <span className="text-slate-400 font-medium">Read Permissions:</span>
                        {t.is_valid ? (
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> 0755 Readable
                          </span>
                        ) : (
                          <span className="text-red-400 font-extrabold flex items-center gap-1.5">
                            <XCircle className="w-4 h-4" /> Restricted Access
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="px-7 pb-7">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleApply(t); }}
                      disabled={!t.is_valid || isActiveInGrub}
                      className={`w-full py-4 text-xs font-extrabold rounded-2xl transition-all ${
                        isActiveInGrub 
                          ? 'bg-slate-900/90 text-slate-500 border border-white/10 cursor-default' 
                          : t.is_valid ? 'btn-luminous' : 'bg-slate-950 text-slate-600 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {isActiveInGrub ? "Configured in System Bootloader" : t.is_valid ? "Apply as Active Theme" : "Cannot Deploy (Incomplete Assets)"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
