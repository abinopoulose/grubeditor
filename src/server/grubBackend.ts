import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';

const LOG_PREFIX = '[GrubEditor API]';
export function log(stage: string, ...args: any[]) {
  console.log(`${LOG_PREFIX} [${stage}]`, ...args);
}
export function logError(stage: string, ...args: any[]) {
  console.error(`${LOG_PREFIX} [${stage}] ERROR:`, ...args);
}

const fileCache: Record<string, { time: number; content: string }> = {};

export function readProtectedFile(filepath: string, maxAgeMs = 15000): string {
  const now = Date.now();
  if (fileCache[filepath] && (now - fileCache[filepath].time) < maxAgeMs) {
    return fileCache[filepath].content;
  }
  let content = "";
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch {
    try {
      content = execSync(`sudo -n cat "${filepath}" 2>/dev/null`, { encoding: 'utf8' });
    } catch {
      try {
        content = execSync(`pkexec /usr/bin/grub-editor-helper cat "${filepath}"`, { encoding: 'utf8' });
      } catch (err: any) {
        console.error(`Failed to read ${filepath} via pkexec:`, err.message);
        throw new Error(`Cannot read ${filepath}: permission denied or authentication dismissed.`);
      }
    }
  }
  fileCache[filepath] = { time: now, content };
  return content;
}

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

export function writeProtectedFile(filepath: string, content: string): void {
  try {
    fs.writeFileSync(filepath, content, 'utf8');
  } catch {
    const tmpPath = path.join(os.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      execSync(`sudo -n cp "${tmpPath}" "${filepath}" 2>/dev/null && rm -f "${tmpPath}"`, { stdio: 'ignore' });
    } catch {
      try {
        execSync(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${tmpPath}' '${filepath}' && chmod 0644 '${filepath}'"`, { stdio: 'ignore' });
      } catch (err: any) {
        console.error(`Failed to write ${filepath} via pkexec:`, err.message);
        throw new Error(`Cannot write to ${filepath}: permission denied or authentication dismissed.`);
      } finally {
        if (fs.existsSync(tmpPath)) try { fs.unlinkSync(tmpPath); } catch {}
      }
    }
  }
  delete fileCache[filepath];
}

export function getSavedOverrides(): any[] {
  try {
    const p = getOverridesPath();
    const content = readProtectedFile(p, 1000);
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

export function getSnapshotsDir(): string {
  if (process.getuid && process.getuid() === 0) {
    const p = '/var/lib/grub-editor/backups';
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
  }
  if (fs.existsSync('/var/lib/grub-editor/backups')) {
    return '/var/lib/grub-editor/backups';
  }
  const localDir = path.join(os.homedir(), '.local', 'share', 'grub-editor', 'backups');
  if (!fs.existsSync(localDir)) {
    try { fs.mkdirSync(localDir, { recursive: true }); } catch {}
  }
  return localDir;
}

export function createServerSnapshot(description: string): any {
  const baseDir = getSnapshotsDir();
  const timestamp = Date.now();
  const folderName = `snap_${timestamp}`;
  const targetDir = path.join(baseDir, folderName);
  
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  } catch {
    try {
      execSync(`pkexec /usr/bin/grub-editor-helper mkdir -p "${targetDir}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${targetDir}"`);
    } catch (e) {
      logError('SNAPSHOT', "Could not create snapshot dir:", e.message);
      return null;
    }
  }

  const grubDefaultPath = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
  const defaultGrubBackup = path.join(targetDir, 'default_grub.bak');
  try {
    const defaultContent = readProtectedFile(grubDefaultPath);
    writeProtectedFile(defaultGrubBackup, defaultContent);
  } catch (e) {
    logError('SNAPSHOT', "Failed to backup default grub:", e);
  }

  const grubCfgPath = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
  let grubCfgBackup: string | null = null;
  if (fs.existsSync(grubCfgPath)) {
    const cfgBackupPath = path.join(targetDir, 'grub.cfg.bak');
    try {
      const cfgContent = readProtectedFile(grubCfgPath);
      writeProtectedFile(cfgBackupPath, cfgContent);
      grubCfgBackup = cfgBackupPath;
    } catch (e) {
      logError('SNAPSHOT', "Failed to backup grub.cfg:", e);
    }
  }

  let blsEntriesBackup: string | null = null;
  const overridesPath = getOverridesPath();
  if (fs.existsSync(overridesPath)) {
    const ovBackupPath = path.join(targetDir, 'grub-editor-entries.json.bak');
    try {
      const ovContent = readProtectedFile(overridesPath);
      writeProtectedFile(ovBackupPath, ovContent);
      blsEntriesBackup = ovBackupPath;
    } catch (e) {}
  }

  const date_string = `${timestamp} (UTC Timestamp)`;
  const snapshotData = {
    timestamp,
    date_string,
    description: description || "Auto-backup",
    default_grub_backup: defaultGrubBackup,
    grub_cfg_backup: grubCfgBackup,
    bls_entries_backup: blsEntriesBackup,
    warnings: []
  };

  const metaFile = path.join(targetDir, 'snapshot_metadata.json');
  writeProtectedFile(metaFile, JSON.stringify(snapshotData, null, 2));
  log('SNAPSHOT', `Created recovery snapshot in ${targetDir}: "${description}"`);
  return snapshotData;
}

export async function handleApiRequest(req: IncomingMessage | any, res: ServerResponse | any): Promise<boolean> {
  if (!req.url || !req.url.startsWith('/api/')) {
    return false;
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/boot-entries') {
      log('GET /api/boot-entries', 'Fetching boot entries...');
      if (fs.existsSync('/boot/loader/entries')) {
        try {
          const files = fs.readdirSync('/boot/loader/entries').filter(f => f.endsWith('.conf') || f.endsWith('.mgnix'));
          if (files.length > 0) {
            log('GET /api/boot-entries', `Found ${files.length} BLS entry files`);
            const blsEntries: BootEntry[] = [];
            const activeKernel = os.release().trim();
            files.sort().forEach((file, idx) => {
              const content = fs.readFileSync(path.join('/boot/loader/entries', file), 'utf8');
              let title = file;
              let version = "";
              let args = "";
              content.split('\n').forEach(line => {
                const l = line.trim();
                if (l.startsWith('title ')) title = l.substring(6).trim();
                else if (l.startsWith('version ')) version = l.substring(8).trim();
                else if (l.startsWith('options ')) args = l.substring(8).trim();
              });
              const isCurrent = version.includes(activeKernel) || title.includes(activeKernel);
              blsEntries.push({
                id: file.replace(/\.[^/.]+$/, ""),
                title,
                type: title.toLowerCase().includes('recovery') || title.toLowerCase().includes('rescue') ? 'recovery' : 'linux',
                enabled: true,
                order: idx,
                args: args || undefined,
                version: version || undefined,
                isCurrent,
                is_current: isCurrent,
                is_default: idx === 0,
              });
            });
            const overrides = getSavedOverrides();
            log('GET /api/boot-entries', `Loaded ${overrides.length} saved overrides from ${getOverridesPath()}`);
            const merged = mergeEntriesWithOverrides(blsEntries, overrides);
            log('GET /api/boot-entries', `Returning ${merged.length} entries (active: ${merged.filter((e: any) => !e.deleted).length}, deleted: ${merged.filter((e: any) => e.deleted).length})`);
            res.end(JSON.stringify(merged));
            return true;
          }
        } catch (e) {
          logError('GET /api/boot-entries', 'BLS directory read error, falling back to grub.cfg:', e);
        }
      }

      const grubCfgPath = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
      log('GET /api/boot-entries', `Reading grub.cfg from ${grubCfgPath}`);
      const content = readProtectedFile(grubCfgPath);
      const entries = parseGrubCfg(content);
      log('GET /api/boot-entries', `Parsed ${entries.length} menuentry blocks from grub.cfg`);
      const overrides = getSavedOverrides();
      log('GET /api/boot-entries', `Loaded ${overrides.length} saved overrides from ${getOverridesPath()}`);
      const merged = mergeEntriesWithOverrides(entries, overrides);
      log('GET /api/boot-entries', `Returning ${merged.length} entries (active: ${merged.filter((e: any) => !e.deleted).length}, deleted: ${merged.filter((e: any) => e.deleted).length})`);
      res.end(JSON.stringify(merged));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/grub-config') {
      const grubPath = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
      const content = readProtectedFile(grubPath);
      const map: Record<string, string> = {};
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          map[key] = val;
        }
      });
      res.end(JSON.stringify(map));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/distro') {
      let distroName = "Ubuntu 24.04.4 LTS";
      let family = "DebianUbuntu";
      let regenCommand = ["update-grub"];
      try {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        osRelease.split('\n').forEach(line => {
          if (line.startsWith('PRETTY_NAME=')) {
            distroName = line.split('=')[1].replace(/["']/g, '').trim();
          } else if (line.startsWith('ID=')) {
            const id = line.split('=')[1].replace(/["']/g, '').trim().toLowerCase();
            if (id === 'fedora' || id === 'rhel' || id === 'centos' || id === 'rocky') {
              family = "RHEL";
              regenCommand = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"];
            } else if (id === 'arch' || id === 'manjaro') {
              family = "Arch";
              regenCommand = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"];
            }
          }
        });
      } catch {}

      res.end(JSON.stringify({
        distro_name: distroName,
        family,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: regenCommand,
        uses_bls: fs.existsSync('/boot/loader/entries')
      }));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/scan-themes') {
      const themesDir = fs.existsSync('/boot/grub2/themes') ? '/boot/grub2/themes' : '/boot/grub/themes';
      const themes: any[] = [];
      try {
        let dirs: string[] = [];
        try {
          dirs = fs.readdirSync(themesDir);
        } catch {
          const out = execSync(`pkexec /usr/bin/grub-editor-helper find "${themesDir}" -maxdepth 1 -mindepth 1 -type d`, { encoding: 'utf8' });
          dirs = out.split('\n').filter(Boolean).map(d => path.basename(d.trim()));
        }

        for (const dir of dirs) {
          const themePath = path.join(themesDir, dir);
          const txtPath = path.join(themePath, 'theme.txt');
          let isValid = false;
          try {
            if (fs.existsSync(txtPath)) isValid = true;
          } catch {
            try {
              execSync(`test -f "${txtPath}"`, { stdio: 'ignore' });
              isValid = true;
            } catch {}
          }
          if (isValid) {
            themes.push({
              name: dir,
              path: themePath,
              is_valid: true,
              validation_errors: [],
              has_pf2_fonts: true,
              background_image: "background.png",
              title_text: `${dir} Theme`
            });
          }
        }
      } catch (e) {
        console.warn("Could not scan system themes, fallback empty or default:", e);
      }
      if (themes.length === 0) {
        themes.push({
          name: "ubuntu-theme",
          path: "/boot/grub/themes/ubuntu-theme",
          is_valid: true,
          validation_errors: [],
          has_pf2_fonts: true,
          background_image: "background.png",
          title_text: "Ubuntu Default Theme"
        });
      }
      res.end(JSON.stringify(themes));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/snapshots') {
      log('GET /api/snapshots', 'Fetching recovery snapshots...');
      const snapDir = getSnapshotsDir();
      const snapshots: any[] = [];
      if (fs.existsSync(snapDir)) {
        try {
          const subdirs = fs.readdirSync(snapDir);
          for (const folder of subdirs) {
            const metaPath = path.join(snapDir, folder, 'snapshot_metadata.json');
            if (fs.existsSync(metaPath)) {
              try {
                const content = readProtectedFile(metaPath);
                const data = JSON.parse(content);
                snapshots.push(data);
              } catch (err) {}
            }
          }
          snapshots.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch (e) {
          logError('GET /api/snapshots', 'Failed reading snapshot directories:', e);
        }
      }
      log('GET /api/snapshots', `Returning ${snapshots.length} snapshots`);
      res.end(JSON.stringify(snapshots));
      return true;
    }

    if (req.method === 'POST') {
      let body = "";
      req.on('data', (chunk: any) => { body += chunk; });
      await new Promise<void>((resolve) => {
        req.on('end', async () => {
          try {
            const data = body ? JSON.parse(body) : {};
            if (pathname === '/api/save-grub-config') {
              const { newConfig, reason, createSnapshot } = data;
              log('POST /api/save-grub-config', `Saving config (createSnapshot=${createSnapshot}, reason="${reason}")`);
              if (createSnapshot) {
                createServerSnapshot(reason || "Modified GRUB general configuration");
              }
              if (newConfig) {
                const lines: string[] = ["# Updated via GrubEditor GUI"];
                for (const [k, v] of Object.entries(newConfig)) {
                  lines.push(`${k}="${v}"`);
                }
                const tmpPath = path.join(os.tmpdir(), `grub-config-${Date.now()}`);
                fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');
                try {
                  fs.copyFileSync(tmpPath, '/etc/default/grub');
                  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                } catch {
                  try {
                    execSync(`pkexec /usr/bin/grub-editor-helper cp "${tmpPath}" /etc/default/grub && rm -f "${tmpPath}"`);
                  } catch (e: any) {
                    console.warn("Failed to copy config via pkexec:", e.message);
                    throw new Error("Failed to copy config via pkexec: " + e.message);
                  }
                }
                delete fileCache['/etc/default/grub'];
                delete fileCache['/boot/grub/default'];
              }
              res.end(JSON.stringify({ success: true }));
              resolve();
              return;
            }

            if (pathname === '/api/save-boot-entries') {
              const { newEntries, reason, createSnapshot } = data;
              log('POST /api/save-boot-entries', `Received ${newEntries?.length ?? 0} entries to save (createSnapshot=${createSnapshot}, reason="${reason}")`);
              if (createSnapshot) {
                createServerSnapshot(reason || "Modified boot menu entries & ordering");
              }
              if (newEntries && Array.isArray(newEntries)) {
                const toSave = newEntries.map((e: any) => ({ ...e, originalTitle: e.originalTitle || e.title }));
                const deletedCount = toSave.filter((e: any) => e.deleted).length;
                const activeCount = toSave.filter((e: any) => !e.deleted).length;
                log('POST /api/save-boot-entries', `Saving ${toSave.length} entries (${activeCount} active, ${deletedCount} deleted) to ${getOverridesPath()}`);
                toSave.forEach((e: any, i: number) => {
                  log('POST /api/save-boot-entries', `  [${i}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted} enabled=${e.enabled}`);
                });
                writeProtectedFile(getOverridesPath(), JSON.stringify(toSave, null, 2));
                log('POST /api/save-boot-entries', 'Write successful');
              }
              delete fileCache['/boot/grub/grub.cfg'];
              delete fileCache['/boot/grub2/grub.cfg'];
              res.end(JSON.stringify({ success: true }));
              resolve();
              return;
            }

            if (pathname === '/api/restore-snapshot') {
              const { timestamp } = data;
              log('POST /api/restore-snapshot', `Restoring snapshot timestamp ${timestamp}...`);
              const snapDir = getSnapshotsDir();
              const targetDir = path.join(snapDir, `snap_${timestamp}`);
              const metaPath = path.join(targetDir, 'snapshot_metadata.json');
              if (!fs.existsSync(metaPath)) {
                throw new Error('Snapshot metadata not found for timestamp ' + timestamp);
              }
              const snapData = JSON.parse(readProtectedFile(metaPath));

              createServerSnapshot(`Auto-backup before restoring snapshot from ${new Date(timestamp).toLocaleString()}`);

              if (snapData.default_grub_backup && fs.existsSync(snapData.default_grub_backup)) {
                const defTarget = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
                writeProtectedFile(defTarget, readProtectedFile(snapData.default_grub_backup));
                delete fileCache['/etc/default/grub'];
                delete fileCache['/boot/grub/default'];
              }
              if (snapData.grub_cfg_backup && fs.existsSync(snapData.grub_cfg_backup)) {
                const cfgTarget = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
                writeProtectedFile(cfgTarget, readProtectedFile(snapData.grub_cfg_backup));
                delete fileCache['/boot/grub/grub.cfg'];
                delete fileCache['/boot/grub2/grub.cfg'];
              }
              if (snapData.bls_entries_backup && fs.existsSync(snapData.bls_entries_backup)) {
                writeProtectedFile(getOverridesPath(), readProtectedFile(snapData.bls_entries_backup));
              }
              log('POST /api/restore-snapshot', 'Restore completed successfully');
              res.end(JSON.stringify({ success: true }));
              resolve();
              return;
            }

            if (pathname === '/api/trigger-regen') {
              log('POST /api/trigger-regen', 'Starting GRUB regeneration...');
              let output = "";
              try {
                const isRoot = process.getuid ? process.getuid() === 0 : false;
                const cmd = isRoot ? 'update-grub 2>&1' : 'pkexec /usr/bin/grub-editor-helper update-grub 2>&1';
                log('POST /api/trigger-regen', `Running: ${cmd} (isRoot=${isRoot})`);
                output = execSync(cmd, { encoding: 'utf8' });
                log('POST /api/trigger-regen', 'update-grub completed successfully');
                delete fileCache['/boot/grub/grub.cfg'];
                delete fileCache['/boot/grub2/grub.cfg'];

                try {
                  const grubCfgPath = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
                  if (fs.existsSync(grubCfgPath)) {
                    const content = readProtectedFile(grubCfgPath);
                    const overrides = getSavedOverrides();
                    log('POST /api/trigger-regen', `Post-regen: ${overrides.length} overrides to apply to ${grubCfgPath}`);
                    if (overrides.length > 0) {
                      const deletedOverrides = overrides.filter((o: any) => o.deleted);
                      log('POST /api/trigger-regen', `Overrides breakdown: ${overrides.length - deletedOverrides.length} active, ${deletedOverrides.length} deleted`);
                      const updated = applyOverridesToGrubCfg(content, overrides);
                      writeProtectedFile(grubCfgPath, updated);
                      log('POST /api/trigger-regen', 'Successfully wrote modified grub.cfg');
                      output += "\n[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.";
                    }
                  }
                } catch (errPost: any) {
                  logError('POST /api/trigger-regen', 'Failed to apply post-regeneration overrides:', errPost);
                  output += `\n[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${errPost.message}`;
                }
              } catch (e: any) {
                logError('POST /api/trigger-regen', 'update-grub failed:', e.message);
                throw new Error(`Failed to regenerate GRUB configuration: ${e.stdout || e.stderr || e.message}`);
              }
              log('POST /api/trigger-regen', 'Regeneration pipeline complete');
              res.end(JSON.stringify({ success: true, output }));
              resolve();
              return;
            }


            if (pathname === '/api/deploy-pipeline') {
              const { config, bootEntries, snapTitle } = data;
              log('POST /api/deploy-pipeline', `Starting batched deploy pipeline. snapTitle: ${snapTitle}`);
              
              const isRoot = process.getuid ? process.getuid() === 0 : false;
              const pkexecCmd = isRoot ? '' : 'pkexec /usr/bin/grub-editor-helper ';

              // 1. Prepare temp files with new data
              const tmpConfig = `/tmp/grub-editor-deploy-config-${Date.now()}`;
              const tmpEntries = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              
              let grubContent = "";
              for (const [k, v] of Object.entries(config)) {
                grubContent += `${k}="${v}"
`;
              }
              fs.writeFileSync(tmpConfig, grubContent);
              
              const toSaveEntries = (bootEntries || []).map((e) => ({ ...e, originalTitle: e.originalTitle || e.title }));
              fs.writeFileSync(tmpEntries, JSON.stringify(toSaveEntries, null, 2));

              // 2. Generate deployment bash script
              const timestamp = Date.now();
              const snapDir = path.join(getSnapshotsDir(), `snap_${timestamp}`);
              const defTarget = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
              const cfgTarget = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
              const overridesPath = getOverridesPath();
              
              const scriptPath = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`;
              const rawCfgOut = `/tmp/grub-editor-raw-cfg-${Date.now()}`;
              
              // Snapshot metadata
              const snapMeta = {
                timestamp,
                description: snapTitle,
                default_grub_backup: path.join(snapDir, 'default_grub.bak'),
                grub_cfg_backup: fs.existsSync(cfgTarget) ? path.join(snapDir, 'grub.cfg.bak') : null,
                bls_entries_backup: path.join(snapDir, 'grub-editor-entries.json.bak')
              };
              const tmpMeta = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              fs.writeFileSync(tmpMeta, JSON.stringify(snapMeta, null, 2));

              const tmpPatched = `/tmp/grub-editor-patched-cfg-${Date.now()}`;

              const bashScript = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Initializing snapshot in ${snapDir}..."
mkdir -p "${snapDir}"
chmod 755 "${snapDir}"
if [ -f "${defTarget}" ]; then cp "${defTarget}" "${snapMeta.default_grub_backup}"; fi
if [ -f "${cfgTarget}" ]; then cp "${cfgTarget}" "${snapMeta.grub_cfg_backup}"; fi
if [ -f "${overridesPath}" ]; then cp "${overridesPath}" "${snapMeta.bls_entries_backup}"; fi
cp "${tmpMeta}" "${snapDir}/snapshot_metadata.json"
chmod 644 "${snapDir}/snapshot_metadata.json"

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${tmpConfig}" "${defTarget}"
chmod 644 "${defTarget}"
cp "${tmpEntries}" "${overridesPath}"
chmod 644 "${overridesPath}"

echo "[Bash Runtime] Stage 3: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching..."
cat "${cfgTarget}" > "${rawCfgOut}"
chmod 666 "${rawCfgOut}"

echo "[Bash Runtime] Stage 5: Waiting for Node.js to apply dynamic overrides..."
COUNT=0
while [ ! -f "${tmpPatched}" ]; do
  sleep 0.5
  COUNT=$((COUNT+1))
  if [ $COUNT -gt 60 ]; then
    echo "[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration." >&2
    exit 1
  fi
done

echo "[Bash Runtime] Stage 6: Finalizing deployment..."
cp "${tmpPatched}" "${cfgTarget}"
chmod 644 "${cfgTarget}"
echo "[Bash Runtime] Execution completed successfully!"
`;
              fs.writeFileSync(scriptPath, bashScript);
              
              log('POST /api/deploy-pipeline', 'Executing Batched Deploy Script Asynchronously...');
              
              try {
                const output = await new Promise<string>((resolve, reject) => {
                  let out = "";
                  
                  // Spawn the process
                  // We need to parse pkexecCmd correctly. If it's empty, use bash. Otherwise use pkexec.
                  const cmdArgs = isRoot ? ['bash', scriptPath] : ['/usr/bin/grub-editor-helper', 'bash', scriptPath];
                  const cmdExec = isRoot ? 'bash' : 'pkexec';
                  
                  const child = spawn(cmdExec, cmdArgs);
                  
                  child.stdout.on('data', (data: any) => { out += data.toString(); });
                  child.stderr.on('data', (data: any) => { out += data.toString(); });
                  
                  child.on('close', (code: number) => {
                    if (code === 0) resolve(out);
                    else reject(new Error(`Exit code ${code}:\n${out}`));
                  });
                  child.on('error', (err: any) => {
                    reject(new Error(`Spawn error: ${err.message}\n${out}`));
                  });

                  // Poll for the raw file
                  const pollInterval = setInterval(() => {
                    if (fs.existsSync(rawCfgOut)) {
                      clearInterval(pollInterval);
                      log('POST /api/deploy-pipeline', 'Detected raw config. Applying overrides...');
                      try {
                        const rawContent = fs.readFileSync(rawCfgOut, 'utf8');
                        const updatedContent = applyOverridesToGrubCfg(rawContent, toSaveEntries);
                        fs.writeFileSync(tmpPatched, updatedContent);
                      } catch (err: any) {
                        logError('POST /api/deploy-pipeline', 'Failed to patch config:', err.message);
                      }
                    }
                  }, 500);
                });

                // Cleanup temps
                [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(p => {
                  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
                });
                
                delete fileCache['/boot/grub/grub.cfg'];
                delete fileCache['/boot/grub2/grub.cfg'];
                delete fileCache['/etc/default/grub'];
                
                log('POST /api/deploy-pipeline', 'Deployment pipeline complete');
                res.end(JSON.stringify({ success: true, output }));
                resolve();
                return;
                
              } catch (e: any) {
                // Cleanup temps on error
                [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(p => {
                  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
                });
                logError('POST /api/deploy-pipeline', 'Deploy pipeline failed:', e.message);
                throw new Error(`Failed during deployment:\n${e.message}`);
              }

              res.end(JSON.stringify({ success: true, output }));
              resolve();
              return;
            }

            res.end(JSON.stringify({ success: true }));
            resolve();
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            resolve();
          }
        });
      });
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("GrubBackend error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    return true;
  }
}
