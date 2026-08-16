import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { log, readProtectedFile } from '../utils/fileOps';

export interface BootEntry {
  id: string;
  title: string;
  type: 'linux' | 'windows' | 'recovery' | 'efi' | 'custom';
  enabled: boolean;
  order: number;
  args?: string;
  version?: string;
  isCurrent?: boolean;
  is_current?: boolean;
  is_default?: boolean;
  parent_id?: string;
  raw_boot_commands?: string;
  originalTitle?: string;
  deleted?: boolean;
}

export function parseGrubCfg(content: string): BootEntry[] {
  const entries: BootEntry[] = [];
  const activeKernel = os.release().trim();

  const lines = content.split('\n');
  let currentParentId: string | undefined = undefined;
  let inSubmenu = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('submenu ') || line.startsWith('submenu\t')) {
      inSubmenu = true;
      const match = line.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/);
      if (match) {
        currentParentId = `submenu-${i}`;
      }
      continue;
    }
    if (inSubmenu && line === '}') {
      inSubmenu = false;
      currentParentId = undefined;
      continue;
    }

    if (line.startsWith('menuentry ') || line.startsWith('menuentry\t')) {
      let title = "Unknown Entry";
      const titleMatch = line.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      if (titleMatch) {
        title = titleMatch[1] || titleMatch[2] || "Unknown Entry";
      }

      let id = `sys-entry-${entries.length}`;
      const idMatch = line.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      if (idMatch) {
        id = idMatch[1] || idMatch[2] || id;
      }

      let blockContent = "";
      let braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      let j = i + 1;
      while (j < lines.length && (braceDepth > 0 || (braceDepth === 0 && !lines[j].includes('{')))) {
        const bline = lines[j];
        blockContent += bline + "\n";
        braceDepth += (bline.match(/\{/g) || []).length - (bline.match(/\}/g) || []).length;
        if (braceDepth <= 0 && bline.includes('}')) break;
        j++;
      }
      i = j;

      let type: 'linux' | 'windows' | 'recovery' | 'efi' | 'custom' = 'custom';
      let args: string | undefined = undefined;
      let version: string | undefined = undefined;
      let isCurrent = false;

      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('recovery') || lowerTitle.includes('advanced') || lowerTitle.includes('rescue') || blockContent.toLowerCase().includes('recovery') || blockContent.toLowerCase().includes('single')) {
        type = 'recovery';
      } else if (lowerTitle.includes('windows') || blockContent.toLowerCase().includes('chainloader')) {
        type = 'windows';
      } else if (lowerTitle.includes('uefi') || lowerTitle.includes('firmware') || blockContent.toLowerCase().includes('fwsetup')) {
        type = 'efi';
      } else if (lowerTitle.includes('linux') || lowerTitle.includes('ubuntu') || lowerTitle.includes('debian') || lowerTitle.includes('fedora') || blockContent.includes('linux ') || blockContent.includes('linuxefi ') || blockContent.includes('linux16 ')) {
        type = 'linux';
      }

      const linuxMatch = blockContent.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (linuxMatch) {
        const kernelPath = linuxMatch[1];
        args = linuxMatch[2].trim();
        if (type !== 'recovery' && type !== 'windows' && type !== 'efi') {
          type = 'linux';
        }
        const verMatch = kernelPath.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || kernelPath.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        if (verMatch) {
          version = verMatch[1];
        }
      }

      if (!version) {
        const titleVerMatch = title.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        if (titleVerMatch) {
          version = titleVerMatch[1];
        }
      }

      if ((version && version.includes(activeKernel)) || title.includes(activeKernel) || (activeKernel.length > 3 && (version === activeKernel || title.includes(activeKernel)))) {
        isCurrent = true;
      }

      entries.push({
        id,
        title,
        type,
        enabled: true,
        order: entries.length,
        args: args || undefined,
        version: version || undefined,
        isCurrent,
        is_current: isCurrent,
        is_default: entries.length === 0,
        parent_id: currentParentId,
        raw_boot_commands: blockContent.trim(),
      });
    }
  }
  return entries;
}

export function getOverridesPath(): string {
  if (fs.existsSync('/boot/grub2')) return '/boot/grub2/grub-editor-entries.json';
  if (fs.existsSync('/boot/grub')) return '/boot/grub/grub-editor-entries.json';
  const dir = path.join(os.homedir(), '.grubdeck');
  if (!fs.existsSync(dir)) try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, 'grub-editor-entries.json');
}

export function getSavedOverrides(): any[] {
  try {
    const p = getOverridesPath();
    const content = readProtectedFile(p, 0);
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function mergeEntriesWithOverrides(systemEntries: any[], overrides: any[]): any[] {
  log('MERGE', `Starting merge: ${systemEntries.length} system entries, ${overrides.length} overrides`);
  if (!overrides || !Array.isArray(overrides) || overrides.length === 0) {
    log('MERGE', 'No overrides found, returning raw system entries');
    return systemEntries;
  }
  const sysMatched = new Set<number>();
  systemEntries.forEach((entry) => {
    if (!entry.originalTitle) entry.originalTitle = entry.title;
  });

  log('MERGE', 'System entries:', systemEntries.map((e, i) => `[${i}] id="${e.id}" title="${e.title}"`).join(' | '));
  log('MERGE', 'Overrides:', overrides.map((o, i) => `[${i}] id="${o.id}" title="${o.title}" origTitle="${o.originalTitle}" deleted=${o.deleted}`).join(' | '));

  const result: any[] = [];
  overrides.forEach((ov, ovIdx) => {
    let matchIdx = systemEntries.findIndex((sys, idx) => !sysMatched.has(idx) && ov.id && sys.id === ov.id && !sys.id.startsWith('sys-entry-'));
    let matchMethod = 'id';

    if (matchIdx === -1) {
      matchIdx = systemEntries.findIndex((sys, idx) => {
        if (sysMatched.has(idx)) return false;
        const sysOrig = sys.originalTitle || sys.title;
        const ovOrig = ov.originalTitle || ov.title;
        return ovOrig === sys.title || ovOrig === sysOrig || ov.title === sys.title;
      });
      matchMethod = 'title';
    }

    if (matchIdx === -1 && ov.id && ov.id.startsWith('sys-entry-')) {
      const pos = parseInt(ov.id.replace('sys-entry-', ''), 10);
      if (!isNaN(pos) && pos < systemEntries.length && !sysMatched.has(pos)) {
        matchIdx = pos;
        matchMethod = 'positional';
      }
    }

    if (matchIdx !== -1) {
      sysMatched.add(matchIdx);
      log('MERGE', `Override[${ovIdx}] "${ov.title}" matched system[${matchIdx}] "${systemEntries[matchIdx].title}" via ${matchMethod}`);
    } else {
      log('MERGE', `Override[${ovIdx}] "${ov.title}" (origTitle="${ov.originalTitle}", id="${ov.id}") had NO match in system entries`);
    }

    if (ov.deleted) {
      const alreadyInResult = result.some(e => 
        (ov.id && e.id === ov.id && !e.id.startsWith('sys-') && !ov.id.startsWith('sys-')) ||
        ((ov.originalTitle || ov.title) === (e.originalTitle || e.title))
      );
      if (alreadyInResult) {
        log('MERGE', `Override[${ovIdx}] "${ov.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      log('MERGE', `Override[${ovIdx}] "${ov.title}" is DELETED (${matchIdx !== -1 ? 'matched & suppressed system entry' : 'preserved deleted override from previous deploy'})`);
      result.push({ ...ov, deleted: true, enabled: false });
    } else if (matchIdx !== -1) {
      const sys = systemEntries[matchIdx];
      result.push({
        ...sys,
        title: ov.title !== undefined ? ov.title : sys.title,
        originalTitle: ov.originalTitle || sys.originalTitle || sys.title,
        enabled: ov.enabled !== undefined ? ov.enabled : sys.enabled,
        deleted: false,
        order: result.length,
      });
    } else {
      result.push({ ...ov, deleted: false, order: result.length });
    }
  });

  let unmatchedCount = 0;
  systemEntries.forEach((sys, index) => {
    if (!sysMatched.has(index)) {
      unmatchedCount++;
      log('MERGE', `System entry[${index}] "${sys.title}" was UNMATCHED — adding to result`);
      result.push({
        ...sys,
        originalTitle: sys.originalTitle || sys.title,
        order: result.length,
      });
    }
  });
  log('MERGE', `Merge complete: ${result.length} total entries (${unmatchedCount} unmatched system entries added)`);
  return result;
}

export function applyOverridesToGrubCfg(content: string, overrides: any[]): string {
  if (!overrides || !Array.isArray(overrides) || overrides.length === 0) return content;

  const lines = content.split('\n');
  const outputLines: string[] = [];
  const extractedBlocks: { id: string; title: string; lines: string[]; origIdx: number }[] = [];
  let firstMenuIdx = -1;
  
  let i = 0;
  let entryCount = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('submenu ') || trimmed.startsWith('submenu\t')) {
      if (firstMenuIdx === -1) firstMenuIdx = outputLines.length;
      i++;
      continue;
    }
    if (trimmed === '}' && firstMenuIdx !== -1 && outputLines.length >= firstMenuIdx) {
      i++;
      continue;
    }

    if (trimmed.startsWith('menuentry ') || trimmed.startsWith('menuentry\t')) {
      if (firstMenuIdx === -1) firstMenuIdx = outputLines.length;
      let title = "Unknown Entry";
      const titleMatch = trimmed.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      if (titleMatch) title = titleMatch[1] || titleMatch[2] || title;

      let id = `sys-entry-${entryCount}`;
      const idMatch = trimmed.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      if (idMatch) id = idMatch[1] || idMatch[2] || id;

      const blockLines: string[] = [line];
      let braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      let j = i + 1;
      while (j < lines.length && (braceDepth > 0 || (braceDepth === 0 && !lines[j].includes('{')))) {
        const bline = lines[j];
        blockLines.push(bline);
        braceDepth += (bline.match(/\{/g) || []).length - (bline.match(/\}/g) || []).length;
        if (braceDepth <= 0 && bline.includes('}')) {
          j++;
          break;
        }
        j++;
      }
      extractedBlocks.push({ id, title, lines: blockLines, origIdx: entryCount });
      entryCount++;
      i = j;
      continue;
    }

    outputLines.push(line);
    i++;
  }

  if (firstMenuIdx === -1 || extractedBlocks.length === 0) return content;

  const processedBlocks: { idx: number; text: string }[] = [];
  const matchedOrigIndices = new Set<number>();

  overrides.forEach((ov, ovIndex) => {
    let matchIdx = extractedBlocks.findIndex((b, idx) => !matchedOrigIndices.has(idx) && ov.id && b.id === ov.id && !b.id.startsWith('sys-entry-'));
    if (matchIdx === -1) {
      matchIdx = extractedBlocks.findIndex((b, idx) => !matchedOrigIndices.has(idx) && (ov.originalTitle === b.title || ov.title === b.title));
    }
    if (matchIdx === -1 && ov.id && ov.id.startsWith('sys-entry-')) {
      const pos = parseInt(ov.id.replace('sys-entry-', ''), 10);
      if (!isNaN(pos) && !matchedOrigIndices.has(pos)) matchIdx = pos;
    }

    if (matchIdx !== -1) {
      matchedOrigIndices.add(matchIdx);
    }

    if (ov.deleted || ov.enabled === false) return;

    if (matchIdx !== -1) {
      const block = extractedBlocks[matchIdx];
      let firstLine = block.lines[0];
      if (ov.title && ov.title !== block.title) {
        firstLine = firstLine.replace(block.title, ov.title);
        block.lines[0] = firstLine;
      }
      processedBlocks.push({ idx: ovIndex, text: block.lines.join('\n') });
    }
  });

  extractedBlocks.forEach((block, idx) => {
    if (!matchedOrigIndices.has(idx)) {
      processedBlocks.push({ idx: processedBlocks.length + 1000, text: block.lines.join('\n') });
    }
  });

  processedBlocks.sort((a, b) => a.idx - b.idx);
  const finalMenuSection = processedBlocks.map(b => b.text).join('\n\n');
  outputLines.splice(firstMenuIdx, 0, finalMenuSection);

  return outputLines.join('\n');
}
