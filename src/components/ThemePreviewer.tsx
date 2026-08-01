import React, { useState, useEffect } from 'react';
import { ThemeMetadata, BootEntry } from '../types';
import { Monitor, ArrowUp, ArrowDown, CornerDownLeft, Sparkles } from 'lucide-react';

interface ThemePreviewerProps {
  theme: ThemeMetadata | null;
  bootEntries: BootEntry[];
  timeout: number;
}

export const ThemePreviewer: React.FC<ThemePreviewerProps> = ({ theme, bootEntries, timeout }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timer, setTimer] = useState(timeout || 5);

  useEffect(() => {
    setTimer(timeout || 5);
    const interval = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeout, theme]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : bootEntries.length - 1));
      setTimer(0);
    } else if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev < bootEntries.length - 1 ? prev + 1 : 0));
      setTimer(0);
    }
  };

  const moveUp = () => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : bootEntries.length - 1));
    setTimer(0);
  };

  const moveDown = () => {
    setSelectedIndex(prev => (prev < bootEntries.length - 1 ? prev + 1 : 0));
    setTimer(0);
  };

  const bgStyle = theme && theme.background_image ? {
    background: `radial-gradient(ellipse at center, rgba(13,27,42,0.85) 0%, rgba(3,7,18,0.95) 100%), linear-gradient(135deg, #0f172a 0%, #061122 50%, #030712 100%)`,
  } : {
    backgroundColor: '#030712',
  };

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <Monitor className="w-4 h-4" /> Live Boot Monitor Simulator (Interactive)
        </span>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>Use buttons or click monitor + arrow keys to test menu:</span>
          <button onClick={moveUp} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1">
            <ArrowUp className="w-3 h-3" /> Up
          </button>
          <button onClick={moveDown} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1">
            <ArrowDown className="w-3 h-3" /> Down
          </button>
        </div>
      </div>

      {/* Outer Monitor Frame */}
      <div 
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="rounded-2xl border-4 border-slate-800 p-2 bg-slate-950 shadow-2xl shadow-black/80 outline-none focus:border-cyan-500/50 transition-all relative overflow-hidden"
      >
        {/* UEFI Header Sim */}
        <div className="bg-black text-[10px] text-slate-500 px-3 py-1 flex justify-between items-center font-mono border-b border-slate-900">
          <span>UEFI Boot Manager v2.4 (GfxTerm Engine Active)</span>
          <span>Resolution: 1920x1080x32 • Font: {theme?.has_pf2_fonts ? "PF2 Vector" : "VGA Standard"}</span>
        </div>

        {/* Simulated GRUB Canvas screen */}
        <div 
          style={bgStyle}
          className="min-h-[440px] p-8 flex flex-col justify-between relative overflow-hidden border border-slate-900 rounded-lg"
        >
          {/* Cyberpunk grid overlay simulation */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Theme Title Header */}
          <div className="text-center z-10 my-4">
            <h1 className="text-3xl font-extrabold tracking-wide font-mono" style={{ color: theme ? theme.selected_item_color : '#ffffff' }}>
              {theme?.title_text || "GNU GRUB version 2.12"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Use the ↑ and ↓ keys to select which entry is highlighted.
            </p>
          </div>

          {/* Menu Selection Box */}
          <div className="z-10 max-w-2xl mx-auto w-full space-y-2 my-6 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 backdrop-blur-md">
            {bootEntries.map((entry, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={idx}
                  onClick={() => { setSelectedIndex(idx); setTimer(0); }}
                  style={{
                    backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                    borderColor: isSelected ? theme?.selected_item_color || '#06b6d4' : 'transparent',
                    color: isSelected ? theme?.selected_item_color || '#ffffff' : theme?.item_color || '#94a3b8'
                  }}
                  className={`px-4 py-3 rounded-lg font-mono text-sm cursor-pointer transition-all border flex items-center justify-between ${
                    isSelected ? 'shadow-lg shadow-cyan-500/10 font-bold' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
                    <span>{entry.title}</span>
                  </div>
                  {isSelected && <CornerDownLeft className="w-4 h-4 opacity-75 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Footer & Countdown Progress */}
          <div className="z-10 text-center space-y-3 pt-4 border-t border-slate-900/80">
            <p className="text-xs font-mono text-slate-400">
              Press enter to boot the selected OS, 'e' to edit the commands before booting, or 'c' for a command-line.
            </p>
            {timer > 0 ? (
              <div className="w-64 mx-auto space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-cyan-400">
                  <span>Auto-booting in {timer}s...</span>
                  <span>{Math.round((timer / (timeout || 5)) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                    style={{ width: `${(timer / (timeout || 5)) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs font-mono text-amber-400/90 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Countdown paused by user intervention
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
