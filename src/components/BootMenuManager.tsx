import React from 'react';
import { BootEntry } from '../types';
import { 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  HardDrive, 
  ShieldAlert, 
  Disc, 
  Cpu, 
  Settings2, 
  RotateCcw, 
  Lock, 
  ShieldCheck,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BootMenuManagerProps {
  entries: BootEntry[];
  onChange: (entries: BootEntry[]) => void;
}

export const BootMenuManager: React.FC<BootMenuManagerProps> = ({ entries, onChange }) => {
  const activeEntries = entries
    .map((entry, originalIdx) => ({ entry, originalIdx }))
    .filter(({ entry }) => !entry.deleted);

  const removedEntries = entries
    .map((entry, originalIdx) => ({ entry, originalIdx }))
    .filter(({ entry }) => entry.deleted);

  const handleMove = (activeIdx: number, direction: 'up' | 'down') => {
    const targetActiveIdx = direction === 'up' ? activeIdx - 1 : activeIdx + 1;
    if (targetActiveIdx < 0 || targetActiveIdx >= activeEntries.length) return;

    const fromOrigIdx = activeEntries[activeIdx].originalIdx;
    const toOrigIdx = activeEntries[targetActiveIdx].originalIdx;

    console.log(`[GrubEditor BootMenu] MOVE: "${entries[fromOrigIdx].title}" ${direction} (swap positions ${fromOrigIdx} <-> ${toOrigIdx})`);
    const updated = [...entries];
    const temp = updated[fromOrigIdx];
    updated[fromOrigIdx] = updated[toOrigIdx];
    updated[toOrigIdx] = temp;
    onChange(updated);
  };

  const handleUpdateEntry = (originalIdx: number, field: keyof BootEntry, value: any) => {
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], [field]: value };
    onChange(updated);
  };

  const handleDeleteEntry = (originalIdx: number) => {
    if (entries[originalIdx]?.isCurrent) return;
    console.log(`[GrubEditor BootMenu] DELETE: "${entries[originalIdx].title}" (id="${entries[originalIdx].id}", origTitle="${(entries[originalIdx] as any).originalTitle}")`);
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], deleted: true, enabled: false };
    onChange(updated);
  };

  const handleRestoreEntry = (originalIdx: number) => {
    console.log(`[GrubEditor BootMenu] RESTORE: "${entries[originalIdx].title}" (id="${entries[originalIdx].id}")`);
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], deleted: false, enabled: true };
    onChange(updated);
  };

  const getIcon = (entry: BootEntry, isSelected = false) => {
    const type = entry.type || (
      entry.title.toLowerCase().includes('windows') ? 'windows' :
      entry.title.toLowerCase().includes('recovery') ? 'recovery' :
      entry.title.toLowerCase().includes('uefi') ? 'efi' : 'linux'
    );
    const className = `w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`;
    switch (type) {
      case 'windows': return <HardDrive className={className} />;
      case 'recovery': return <ShieldAlert className={className} />;
      case 'efi': return <Settings2 className={className} />;
      case 'custom': return <Cpu className={className} />;
      default: return <Disc className={className} />;
    }
  };

  return (
    <div className="space-y-10 w-full pb-16 font-sans">
      {/* SECTION 1: Menu Hierarchy */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-xs font-bold tracking-widest text-indigo-300 uppercase flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-indigo-400" /> Menu Hierarchy & Ordering
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {activeEntries.length} Active {activeEntries.length === 1 ? 'Option' : 'Options'}
          </span>
        </div>

        <div className="flex flex-col gap-3.5 pt-1">
          <AnimatePresence mode="popLayout">
            {activeEntries.map(({ entry, originalIdx }, activeIdx) => {
              const isTop = activeIdx === 0;
              const isBottom = activeIdx === activeEntries.length - 1;

              return (
                <motion.div
                  key={entry.id || originalIdx}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="selection-card !p-5 !flex-col sm:!flex-row !items-stretch sm:!items-center gap-4 bg-[#0d1428]/70 hover:bg-[#111933] border border-white/[0.08] shadow-lg"
                >
                  {/* Left Ordering Controls */}
                  <div className="flex items-center gap-1 bg-[#060a15] p-1 rounded-xl border border-white/[0.06] shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleMove(activeIdx, 'up')}
                      disabled={isTop}
                      className={`p-1.5 rounded-lg transition-all ${isTop ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white cursor-pointer'}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 font-sans text-xs font-extrabold text-slate-400">
                      #{activeIdx}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMove(activeIdx, 'down')}
                      disabled={isBottom}
                      className={`p-1.5 rounded-lg transition-all ${isBottom ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white cursor-pointer'}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon & Title Input */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="icon-box default !w-11 !h-11 shrink-0">
                      {getIcon(entry, true)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        type="text"
                        value={entry.title}
                        onChange={(e) => handleUpdateEntry(originalIdx, 'title', e.target.value)}
                        placeholder="Display Title"
                        className="text-input w-full text-sm font-semibold !py-2.5 !px-4 bg-[#060a15] text-white border-white/[0.1] focus:border-indigo-500/80 rounded-xl font-sans"
                      />
                      {(entry.options !== undefined || entry.type === 'linux' || entry.type === 'custom') && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/35 border border-white/[0.05] text-[11px] font-mono text-slate-400 truncate">
                          <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{entry.options || 'default root kernel commands'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                    {entry.isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-sans text-xs font-bold shadow-sm">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Protected (Active Kernel)</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(originalIdx)}
                        className="p-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25 transition-all font-sans text-xs flex items-center gap-2 font-semibold cursor-pointer shadow-md shadow-rose-500/5"
                        title="Move to Recycle Bin"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden">Delete</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* SECTION 2: Recycle Bin (Rollback Repository) */}
      {removedEntries.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-white/[0.08]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-xs font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" /> Recycle Bin (Rollback Repository)
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {removedEntries.length} {removedEntries.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <AnimatePresence mode="popLayout">
              {removedEntries.map(({ entry, originalIdx }) => (
                <motion.div
                  key={entry.id || originalIdx}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="selection-card !p-4 !flex-col sm:!flex-row !items-stretch sm:!items-center gap-4 bg-[#070b16]/90 border border-amber-500/25 opacity-85 hover:opacity-100 transition-all shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="icon-box default !w-10 !h-10 !bg-amber-500/15 !text-amber-400 !border-amber-500/30 shrink-0">
                      {getIcon(entry, false)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-400 truncate line-through decoration-rose-500/70">
                        {entry.title}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleRestoreEntry(originalIdx)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/30 transition-all font-sans text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
};
