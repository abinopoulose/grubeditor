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
  ListOrdered,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';

interface BootMenuManagerProps {
  entries: BootEntry[];
  onChange: (entries: BootEntry[]) => void;
  logAction?: (msg: string) => void;
}

export const BootMenuManager: React.FC<BootMenuManagerProps> = ({ entries, onChange, logAction }) => {
  const [infoEntry, setInfoEntry] = React.useState<BootEntry | null>(null);

  const activeEntries = entries
    .map((entry, originalIdx) => ({ entry, originalIdx }))
    .filter(({ entry }) => !entry.deleted);

  const removedEntries = entries
    .map((entry, originalIdx) => ({ entry, originalIdx }))
    .filter(({ entry }) => entry.deleted);

  const isEntryRecovery = (entry: BootEntry) => {
    const safeTitle = (entry.title || '').toLowerCase();
    return entry.type === 'recovery' || (entry.id || '').toLowerCase().includes('recovery') || safeTitle.includes('recovery');
  };

  const activeKernelsCount = activeEntries.filter(({ entry }) => entry.isCurrent && !isEntryRecovery(entry)).length;

  const handleMove = (activeIdx: number, direction: 'up' | 'down') => {
    const targetActiveIdx = direction === 'up' ? activeIdx - 1 : activeIdx + 1;
    if (targetActiveIdx < 0 || targetActiveIdx >= activeEntries.length) return;

    const fromOrigIdx = activeEntries[activeIdx].originalIdx;
    const toOrigIdx = activeEntries[targetActiveIdx].originalIdx;

    console.log(`[GrubEditor BootMenu] MOVE: "${entries[fromOrigIdx].title}" ${direction} (swap positions ${fromOrigIdx} <-> ${toOrigIdx})`);
    if (logAction) logAction(`Moved entry "${entries[fromOrigIdx].title}" ${direction} in the boot order.`);
    const updated = [...entries];
    const temp = updated[fromOrigIdx];
    updated[fromOrigIdx] = updated[toOrigIdx];
    updated[toOrigIdx] = temp;
    onChange(updated);
  };

  const handleUpdateEntry = (originalIdx: number, field: keyof BootEntry, value: any) => {
    if (logAction && field === 'title') {
      logAction(`Renamed entry from "${entries[originalIdx].title}" to "${value}".`);
    }
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], [field]: value };
    onChange(updated);
  };

  const handleDeleteEntry = (originalIdx: number) => {
    const entry = entries[originalIdx];
    if (entry?.isCurrent && !isEntryRecovery(entry) && activeKernelsCount <= 1) return;
    console.log(`[GrubEditor BootMenu] DELETE: "${entries[originalIdx].title}" (id="${entries[originalIdx].id}", origTitle="${(entries[originalIdx] as any).originalTitle}")`);
    if (logAction) logAction(`Deleted (suppressed) entry "${entries[originalIdx].title}".`);
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], deleted: true, enabled: false };
    onChange(updated);
  };

  const handleRestoreEntry = (originalIdx: number) => {
    console.log(`[GrubEditor BootMenu] RESTORE: "${entries[originalIdx].title}" (id="${entries[originalIdx].id}")`);
    if (logAction) logAction(`Restored entry "${entries[originalIdx].title}" from Recycle Bin.`);
    const updated = [...entries];
    updated[originalIdx] = { ...updated[originalIdx], deleted: false, enabled: true };
    onChange(updated);
  };

  const getIcon = (entry: BootEntry, isSelected = false) => {
    const type = entry.type || (
      (entry.title || '').toLowerCase().includes('windows') ? 'windows' :
      (entry.title || '').toLowerCase().includes('recovery') ? 'recovery' :
      (entry.title || '').toLowerCase().includes('uefi') ? 'efi' : 'linux'
    );
    const className = `w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`;
    switch (type) {
      case 'windows': return <HardDrive className={isSelected ? 'w-5 h-5 text-sky-400' : 'w-5 h-5 text-sky-500/70'} />;
      case 'recovery': return <ShieldAlert className={isSelected ? 'w-5 h-5 text-amber-400' : 'w-5 h-5 text-amber-500/70'} />;
      case 'efi': return <Settings2 className={isSelected ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-500/70'} />;
      case 'custom': return <Cpu className={className} />;
      default: return <Disc className={className} />;
    }
  };

  return (
    <div className="space-y-12 w-full pb-20 font-sans">
      {/* SECTION 1: Menu Hierarchy */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide text-white">Boot Menu Hierarchy & Ordering</h3>
              <p className="text-[12px] text-slate-400">Reorder boot entries or edit custom display labels shown on system startup</p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-800/80 text-indigo-300 border border-white/[0.08] shadow-sm">
            {activeEntries.length} Active {activeEntries.length === 1 ? 'Option' : 'Options'}
          </span>
        </div>

        <div className="flex flex-col gap-4 pt-1">
          {activeEntries.length === 0 && (
            <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-400 opacity-80" />
              <div>
                <h4 className="text-rose-300 font-bold text-base">No Boot Entries Found</h4>
                <p className="text-slate-400 text-sm mt-1 max-w-md">
                  We could not detect any active boot targets to reorder or edit. 
                  If you expect entries here, there may be a filesystem permission error preventing GRUB parsing.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {activeEntries.map(({ entry, originalIdx }, activeIdx) => {
              const isTop = activeIdx === 0;
              const isBottom = activeIdx === activeEntries.length - 1;
              const formattedNum = activeIdx < 10 ? `0${activeIdx}` : `${activeIdx}`;
              const safeTitle = (entry.title || '').toLowerCase();
              const isWindows = safeTitle.includes('windows');
              const isRecovery = isEntryRecovery(entry);
              const isUefi = safeTitle.includes('uefi') || entry.type === 'efi';

              const hoverGlow = isWindows ? 'hover:!border-sky-500/60 hover:!shadow-[0_0_25px_rgba(56,189,248,0.25)]' :
                isRecovery ? 'hover:!border-amber-500/60 hover:!shadow-[0_0_25px_rgba(251,191,36,0.25)]' :
                isUefi ? 'hover:!border-purple-500/60 hover:!shadow-[0_0_25px_rgba(192,132,252,0.25)]' :
                'hover:!border-indigo-500/60 hover:!shadow-[0_0_25px_rgba(99,102,241,0.3)]';

              return (
                <motion.div
                  key={entry.id || originalIdx}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className={`selection-card !p-5 !flex-col sm:!flex-row !items-stretch sm:!items-center gap-5 bg-[#0b1022]/85 hover:bg-[#111936] border border-white/[0.12] ${hoverGlow} transition-all duration-300`}
                >
                  {/* Left Ordering Controls */}
                  <div className="flex items-center gap-1.5 bg-[#050813] p-1.5 rounded-xl border border-white/[0.08] shrink-0 self-start sm:self-center shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleMove(activeIdx, 'up')}
                      disabled={isTop}
                      className={`p-2 rounded-lg transition-all ${isTop ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:bg-white/[0.1] hover:text-white cursor-pointer hover:scale-105'}`}
                      title="Move up in boot order"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="px-3 font-mono text-xs font-black text-indigo-400 bg-indigo-500/10 py-1 rounded-lg border border-indigo-500/20">
                      #{formattedNum}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMove(activeIdx, 'down')}
                      disabled={isBottom}
                      className={`p-2 rounded-lg transition-all ${isBottom ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:bg-white/[0.1] hover:text-white cursor-pointer hover:scale-105'}`}
                      title="Move down in boot order"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon & Title Input */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="icon-box default !w-12 !h-12 shrink-0 !bg-slate-900/90 !border-white/10 shadow-md">
                      {getIcon(entry, true)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.title}
                          onChange={(e) => handleUpdateEntry(originalIdx, 'title', e.target.value)}
                          placeholder="Boot Entry Display Title"
                          className="text-input w-full text-sm font-extrabold !py-3 !px-4 bg-[#050813] text-white border-white/[0.12] focus:border-indigo-500 focus:shadow-[0_0_20px_rgba(99,102,241,0.3)] rounded-xl font-sans"
                        />
                      </div>
                      {(entry.options !== undefined || entry.type === 'linux' || entry.type === 'custom') && (
                        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-black/50 border border-white/[0.06] text-[11px] font-mono text-slate-400 truncate shadow-inner">
                          <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate text-slate-300 font-semibold">{entry.options || 'root default kernel launch arguments'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center justify-end gap-2.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                    {entry.isCurrent && !isRecovery && activeKernelsCount <= 1 ? (
                      <>
                        <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 font-sans text-xs font-black shadow-[0_0_20px_rgba(16,185,129,0.25)] tracking-wide">
                          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>Protected (Active Kernel)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setInfoEntry(entry)}
                          className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-all cursor-pointer shrink-0"
                          title="View internal boot details"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        {entry.isCurrent && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans text-[11px] font-bold tracking-wide">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden xl:inline">Active Kernel</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setInfoEntry(entry)}
                          className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-all cursor-pointer shrink-0"
                          title="View internal boot details"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(originalIdx)}
                          className="p-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-200 hover:shadow-[0_0_18px_rgba(244,63,94,0.35)] transition-all font-sans text-xs flex items-center gap-2 font-bold cursor-pointer shrink-0"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sm:hidden">Delete Option</span>
                        </button>
                      </div>
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
        <section className="space-y-5 pt-8 border-t border-white/[0.1]">
          <div className="flex items-center justify-between border-b border-white/[0.1] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-wide text-amber-400">Recycle Bin (Rollback Vault)</h3>
                <p className="text-[12px] text-slate-400">Suppressed system boot entries staged for exclusion from generated configuration</p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
              {removedEntries.length} {removedEntries.length === 1 ? 'Suppressed Option' : 'Suppressed Options'}
            </span>
          </div>

          <div className="flex flex-col gap-3.5 pt-1">
            <AnimatePresence mode="popLayout">
              {removedEntries.map(({ entry, originalIdx }) => (
                <motion.div
                  key={entry.id || originalIdx}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="selection-card !p-5 !flex-col sm:!flex-row !items-stretch sm:!items-center gap-4 bg-[#070b16]/80 !border-dashed !border-amber-500/40 opacity-85 hover:opacity-100 transition-all shadow-lg backdrop-blur-xl"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="icon-box default !w-11 !h-11 !bg-amber-500/15 !text-amber-400 !border-amber-500/35 shrink-0 shadow-sm">
                      {getIcon(entry, false)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-bold text-base text-slate-300 truncate line-through decoration-rose-500 decoration-2">
                        {entry.title}
                      </div>
                      <div className="text-xs font-mono text-amber-400/80">
                        Status: Suppressed from GRUB regeneration pipeline
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setInfoEntry(entry)}
                      className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-all cursor-pointer shrink-0"
                      title="View internal boot details"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestoreEntry(originalIdx)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 hover:text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all font-sans text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Restore Option</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Entry Details Dialog */}
      <Dialog.Root open={!!infoEntry} onOpenChange={(open) => !open && setInfoEntry(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity animate-pro" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-white/[0.15] bg-[#0a1024]/95 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl focus:outline-none animate-pro text-slate-100 font-sans">
            <Dialog.Title className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
              <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-white tracking-tight">Boot Entry Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">Internal system identifiers and boot arguments</p>
              </div>
            </Dialog.Title>
            
            <div className="py-5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {infoEntry && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-black/20 p-3.5 rounded-xl border border-white/[0.04]">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Display Title</div>
                    <div className="text-sm text-slate-300 font-bold">{infoEntry.title}</div>
                  </div>
                  
                  {(infoEntry.version || infoEntry.options || infoEntry.args) && (
                    <div className="bg-black/20 p-3.5 rounded-xl border border-white/[0.04]">
                      {infoEntry.version && (
                        <div className="mb-3">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detected Kernel Version</div>
                          <div className="text-sm text-indigo-300 font-mono">{infoEntry.version}</div>
                        </div>
                      )}
                      {(infoEntry.options || infoEntry.args) && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detected Kernel Arguments</div>
                          <div className="text-sm text-emerald-400 font-mono break-words">{infoEntry.options || infoEntry.args}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {infoEntry.raw_boot_commands && (
                    <div className="bg-black/20 p-3.5 rounded-xl border border-white/[0.04]">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Raw Boot Configuration</div>
                      <div className="text-[13px] text-slate-300 font-mono break-words whitespace-pre-wrap leading-relaxed">
                        {infoEntry.raw_boot_commands}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-5 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setInfoEntry(null)}
                className="btn-glass !py-2.5 !px-8 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
};
