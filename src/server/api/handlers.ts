import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { log, logError, readProtectedFile, writeProtectedFile, fileCache } from '../utils/fileOps';
import { createServerSnapshot, getSnapshotsDir } from '../utils/snapshots';
import { sendJsonResponse, sendErrorResponse } from '../utils/apiUtils';
import { detectDistro, scanGrubThemes, parseDefaultGrubConfig } from '../services/systemService';
import { executeDeployPipeline } from '../services/deployService';
import { 
  BootEntry, 
  parseGrubCfg, 
  getOverridesPath, 
  getSavedOverrides, 
  mergeEntriesWithOverrides, 
  applyOverridesToGrubCfg 
} from '../parsers/grubParser';

export async function handleBootEntriesGet(res: ServerResponse) {
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
        log('GET /api/boot-entries', `Returning ${merged.length} entries`);
        sendJsonResponse(res, merged);
        return true;
      }
    } catch (e) {
      logError('GET /api/boot-entries', 'BLS directory read error, falling back to grub.cfg:', e);
    }
  }

  log('GET /api/boot-entries', `Reading grub.cfg...`);
  let content = "";
  let needsPkexec = false;
  try {
    content = fs.readFileSync('/boot/grub2/grub.cfg', 'utf8');
  } catch (e1: any) {
    if (e1.code === 'EACCES' || e1.code === 'EPERM') needsPkexec = true;
    try {
      content = fs.readFileSync('/boot/grub/grub.cfg', 'utf8');
    } catch (e2: any) {
      if (e2.code === 'EACCES' || e2.code === 'EPERM') needsPkexec = true;
      if (needsPkexec) {
        const tmpPath = `/tmp/grub-editor-read-${Date.now()}`;
        try {
          execSync(`pkexec /usr/bin/grub-editor-helper sh -c "if [ -f /boot/grub2/grub.cfg ]; then cat /boot/grub2/grub.cfg > ${tmpPath}; elif [ -f /boot/grub/grub.cfg ]; then cat /boot/grub/grub.cfg > ${tmpPath}; fi; chmod 666 ${tmpPath}"`);
          if (fs.existsSync(tmpPath)) {
            content = fs.readFileSync(tmpPath, 'utf8');
          }
        } catch (e: any) {
          logError('GET /api/boot-entries', 'Failed to read grub.cfg via pkexec:', e.message);
        } finally {
          if (fs.existsSync(tmpPath)) try { fs.unlinkSync(tmpPath); } catch {}
        }
      }
    }
  }
  const entries = parseGrubCfg(content);
  log('GET /api/boot-entries', `Parsed ${entries.length} menuentry blocks from grub.cfg`);
  const overrides = getSavedOverrides();
  log('GET /api/boot-entries', `Loaded ${overrides.length} saved overrides from ${getOverridesPath()}`);
  const merged = mergeEntriesWithOverrides(entries, overrides);
  log('GET /api/boot-entries', `Returning ${merged.length} entries`);
  sendJsonResponse(res, merged);
  return true;
}

export function handleGrubConfigGet(res: ServerResponse) {
  const map = parseDefaultGrubConfig();
  sendJsonResponse(res, map);
  return true;
}

export function handleDistroGet(res: ServerResponse) {
  const distroInfo = detectDistro();
  sendJsonResponse(res, distroInfo);
  return true;
}

export function handleScanThemesGet(res: ServerResponse) {
  const themes = scanGrubThemes();
  sendJsonResponse(res, themes);
  return true;
}

export function handleSnapshotsGet(res: ServerResponse) {
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
  sendJsonResponse(res, snapshots);
  return true;
}

export function handleSnapshotDetailsGet(req: any, res: ServerResponse) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const timestamp = url.searchParams.get('timestamp');
  if (!timestamp) {
    sendErrorResponse(res, 'Missing timestamp', 400);
    return true;
  }
  
  try {
    const snapDir = getSnapshotsDir();
    const targetDir = path.join(snapDir, `snap_${timestamp}`);
    const metaPath = path.join(targetDir, 'snapshot_metadata.json');
    
    if (!fs.existsSync(metaPath)) {
      throw new Error('Snapshot not found');
    }
    
    const snapData = JSON.parse(readProtectedFile(metaPath));
    const config: Record<string, string> = {};
    if (snapData.default_grub_backup) {
      try {
        const content = readProtectedFile(snapData.default_grub_backup);
        content.split('\n').forEach((line: string) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.substring(0, idx).trim();
            let val = trimmed.substring(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            config[key] = val;
          }
        });
      } catch (e) {
        logError('GET /api/snapshot-details', 'Failed to read default_grub_backup', e);
      }
    }

    let bootEntries: any[] = [];
    if (snapData.bls_entries_backup) {
      try {
        bootEntries = JSON.parse(readProtectedFile(snapData.bls_entries_backup));
      } catch (e) {
        logError('GET /api/snapshot-details', 'Failed to read bls_entries_backup', e);
      }
    }
    
    sendJsonResponse(res, { config, bootEntries });
  } catch (e: any) {
    sendErrorResponse(res, e.message);
  }
  return true;
}

export async function handleSaveGrubConfigPost(data: any, res: ServerResponse) {
  const { newConfig, reason, createSnapshot } = data;
  log('POST /api/save-grub-config', `Saving config (createSnapshot=${createSnapshot}, reason="${reason}")`);
  
  let snapScript = "";
  let tmpMeta = "";
  if (createSnapshot) {
    const snapResult = createServerSnapshot(reason || "Modified GRUB general configuration", getOverridesPath, false);
    if (snapResult) {
      snapScript = snapResult.script;
      tmpMeta = snapResult.tmpMeta;
    }
  }

  if (newConfig) {
    const lines: string[] = ["# Updated via GrubEditor GUI"];
    for (const [k, v] of Object.entries(newConfig)) {
      lines.push(`${k}="${v}"`);
    }
    const tmpPath = path.join(os.tmpdir(), `grub-config-${Date.now()}`);
    fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');

    const bashScript = `#!/bin/bash
set -e

if [ -f /boot/grub2/grub.cfg ]; then
  grubCfgPath="/boot/grub2/grub.cfg"
else
  grubCfgPath="/boot/grub/grub.cfg"
fi

if [ -f /etc/default/grub ]; then
  grubDefaultPath="/etc/default/grub"
else
  grubDefaultPath="/boot/grub/default"
fi

${snapScript}

if [ -f /etc/default/grub ]; then
  defTarget="/etc/default/grub"
elif [ -f /boot/grub/default ]; then
  defTarget="/boot/grub/default"
else
  defTarget="/etc/default/grub"
fi
cp "${tmpPath}" "\${defTarget}"
chmod 644 "\${defTarget}"
rm -f "${tmpPath}"
`;
    const scriptPath = path.join(os.tmpdir(), `grub-editor-save-config-${Date.now()}.sh`);
    fs.writeFileSync(scriptPath, bashScript);

    try {
      const isRoot = process.getuid ? process.getuid() === 0 : false;
      const cmd = isRoot ? `bash ${scriptPath}` : `pkexec /usr/bin/grub-editor-helper bash ${scriptPath}`;
      execSync(cmd, { stdio: 'ignore' });
    } catch (e: any) {
      console.warn("Failed to copy config via pkexec:", e.message);
      throw new Error("Failed to copy config via pkexec: " + e.message);
    } finally {
      if (fs.existsSync(scriptPath)) try { fs.unlinkSync(scriptPath); } catch {}
      if (fs.existsSync(tmpPath)) try { fs.unlinkSync(tmpPath); } catch {}
      if (tmpMeta && fs.existsSync(tmpMeta)) try { fs.unlinkSync(tmpMeta); } catch {}
    }
    delete fileCache['/etc/default/grub'];
    delete fileCache['/boot/grub/default'];
  }
  sendJsonResponse(res, { success: true });
  return true;
}

export async function handleSaveBootEntriesPost(data: any, res: ServerResponse) {
  const { newEntries, reason, createSnapshot } = data;
  log('POST /api/save-boot-entries', `Received ${newEntries?.length ?? 0} entries to save (createSnapshot=${createSnapshot}, reason="${reason}")`);
  
  let snapScript = "";
  let tmpMeta = "";
  if (createSnapshot) {
    const snapResult = createServerSnapshot(reason || "Modified boot menu entries & ordering", getOverridesPath, false);
    if (snapResult) {
      snapScript = snapResult.script;
      tmpMeta = snapResult.tmpMeta;
    }
  }

  if (newEntries && Array.isArray(newEntries)) {
    const toSave = newEntries.map((e: any) => ({ ...e, originalTitle: e.originalTitle || e.title }));
    const deletedCount = toSave.filter((e: any) => e.deleted).length;
    const activeCount = toSave.filter((e: any) => !e.deleted).length;
    log('POST /api/save-boot-entries', `Saving ${toSave.length} entries (${activeCount} active, ${deletedCount} deleted) to ${getOverridesPath()}`);
    
    const targetPath = getOverridesPath();
    const contentToSave = JSON.stringify(toSave, null, 2);

    if (snapScript) {
      const tmpEntries = `/tmp/grub-editor-entries-${Date.now()}`;
      fs.writeFileSync(tmpEntries, contentToSave);
      
      const bashScript = `#!/bin/bash
set -e

if [ -f /boot/grub2/grub.cfg ]; then
  grubCfgPath="/boot/grub2/grub.cfg"
else
  grubCfgPath="/boot/grub/grub.cfg"
fi

if [ -f /etc/default/grub ]; then
  grubDefaultPath="/etc/default/grub"
else
  grubDefaultPath="/boot/grub/default"
fi

${snapScript}
cp "${tmpEntries}" "${targetPath}"
chmod 644 "${targetPath}"
`;
      const scriptPath = `/tmp/grub-editor-save-entries-${Date.now()}.sh`;
      fs.writeFileSync(scriptPath, bashScript);
      try {
        const isRoot = process.getuid ? process.getuid() === 0 : false;
        const cmd = isRoot ? `bash ${scriptPath}` : `pkexec /usr/bin/grub-editor-helper bash ${scriptPath}`;
        execSync(cmd, { stdio: 'ignore' });
        log('POST /api/save-boot-entries', 'Write successful via atomic pkexec');
      } catch (e: any) {
        throw new Error("Failed to save entries via pkexec: " + e.message);
      } finally {
        if (fs.existsSync(scriptPath)) try { fs.unlinkSync(scriptPath); } catch {}
        if (fs.existsSync(tmpEntries)) try { fs.unlinkSync(tmpEntries); } catch {}
        if (tmpMeta && fs.existsSync(tmpMeta)) try { fs.unlinkSync(tmpMeta); } catch {}
      }
    } else {
      writeProtectedFile(targetPath, contentToSave);
      log('POST /api/save-boot-entries', 'Write successful via writeProtectedFile');
    }
  }
  delete fileCache['/boot/grub/grub.cfg'];
  delete fileCache['/boot/grub2/grub.cfg'];
  sendJsonResponse(res, { success: true });
  return true;
}

export async function handleRestoreSnapshotPost(data: any, res: ServerResponse) {
  const { timestamp } = data;
  log('POST /api/restore-snapshot', `Restoring snapshot timestamp ${timestamp}...`);
  const snapDir = getSnapshotsDir();
  const targetDir = path.join(snapDir, `snap_${timestamp}`);
  const metaPath = path.join(targetDir, 'snapshot_metadata.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error('Snapshot metadata not found for timestamp ' + timestamp);
  }
  const snapData = JSON.parse(readProtectedFile(metaPath));

  let snapScript = "";
  let tmpMeta = "";
  const snapResult = createServerSnapshot(`Auto-backup before restoring snapshot from ${new Date(timestamp).toLocaleString()}`, getOverridesPath, false);
  if (snapResult) {
    snapScript = snapResult.script;
    tmpMeta = snapResult.tmpMeta;
  }

  const overridesPath = getOverridesPath();

  const scriptPath = `/tmp/grub-editor-restore-script-${Date.now()}.sh`;
  const bashScript = `#!/bin/bash
set -e

if [ -f /boot/grub2/grub.cfg ]; then
  grubCfgPath="/boot/grub2/grub.cfg"
  cfgTarget="/boot/grub2/grub.cfg"
else
  grubCfgPath="/boot/grub/grub.cfg"
  cfgTarget="/boot/grub/grub.cfg"
fi

if [ -f /etc/default/grub ]; then
  grubDefaultPath="/etc/default/grub"
  defTarget="/etc/default/grub"
else
  grubDefaultPath="/boot/grub/default"
  defTarget="/boot/grub/default"
fi

${snapScript}

if [ -n "${snapData.default_grub_backup}" ] && [ "${snapData.default_grub_backup}" != "null" ] && [ -f "${snapData.default_grub_backup}" ]; then
  cp "${snapData.default_grub_backup}" "\${defTarget}"
  chmod 644 "\${defTarget}"
fi

if [ -n "${snapData.grub_cfg_backup}" ] && [ "${snapData.grub_cfg_backup}" != "null" ] && [ -f "${snapData.grub_cfg_backup}" ]; then
  cp "${snapData.grub_cfg_backup}" "\${cfgTarget}"
  chmod 644 "\${cfgTarget}"
fi

if [ -n "${snapData.bls_entries_backup}" ] && [ "${snapData.bls_entries_backup}" != "null" ] && [ -f "${snapData.bls_entries_backup}" ]; then
  cp "${snapData.bls_entries_backup}" "${overridesPath}"
  chmod 644 "${overridesPath}"
else
  echo '[]' > "${overridesPath}"
  chmod 644 "${overridesPath}"
fi
`;
  
  fs.writeFileSync(scriptPath, bashScript);

  try {
    const isRoot = process.getuid ? process.getuid() === 0 : false;
    const cmd = isRoot ? `bash ${scriptPath}` : `pkexec /usr/bin/grub-editor-helper bash ${scriptPath}`;
    execSync(cmd, { stdio: 'ignore' });
    
    delete fileCache['/etc/default/grub'];
    delete fileCache['/boot/grub/default'];
    delete fileCache['/boot/grub/grub.cfg'];
    delete fileCache['/boot/grub2/grub.cfg'];
    delete fileCache[overridesPath];
    
    log('POST /api/restore-snapshot', 'Restore completed successfully');
    sendJsonResponse(res, { success: true });
  } catch (e: any) {
    logError('POST /api/restore-snapshot', 'Restore aborted due to error:', e.message);
    sendErrorResponse(res, e.message);
  } finally {
    if (fs.existsSync(scriptPath)) try { fs.unlinkSync(scriptPath); } catch {}
    if (tmpMeta && fs.existsSync(tmpMeta)) try { fs.unlinkSync(tmpMeta); } catch {}
  }
  return true;
}

export async function handleTriggerRegenPost(res: ServerResponse) {
  log('POST /api/trigger-regen', 'Starting GRUB regeneration...');
  const isRoot = process.getuid ? process.getuid() === 0 : false;
  const overrides = getSavedOverrides();
  const hasOverrides = overrides.length > 0;
  
  const scriptPath = `/tmp/grub-editor-regen-${Date.now()}.sh`;
  const rawCfgOut = `/tmp/grub-editor-raw-cfg-${Date.now()}`;
  const tmpPatched = `/tmp/grub-editor-patched-cfg-${Date.now()}`;
  
  const bashScript = `#!/bin/bash
set -e
echo "[Bash Runtime] Stage 1: Running update-grub..."
update-grub 2>&1

if [ "${hasOverrides}" = "true" ]; then
  if [ -f /boot/grub2/grub.cfg ]; then
    cfgTarget="/boot/grub2/grub.cfg"
  else
    cfgTarget="/boot/grub/grub.cfg"
  fi
  echo "[Bash Runtime] Stage 2: Exposing raw configuration for Node.js patching..."
  cat "\${cfgTarget}" > "${rawCfgOut}"
  chmod 666 "${rawCfgOut}"

  echo "[Bash Runtime] Stage 3: Waiting for Node.js to apply dynamic overrides..."
  COUNT=0
  while [ ! -f "${tmpPatched}" ]; do
    sleep 0.5
    COUNT=$((COUNT+1))
    if [ $COUNT -gt 60 ]; then
      echo "[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration." >&2
      exit 1
    fi
  done

  echo "[Bash Runtime] Stage 4: Finalizing deployment..."
  cp "${tmpPatched}" "\${cfgTarget}"
  chmod 644 "\${cfgTarget}"
fi
echo "[Bash Runtime] Regeneration completed successfully!"
`;
  fs.writeFileSync(scriptPath, bashScript);

  try {
    const cmdArgs = isRoot ? ['bash', scriptPath] : ['/usr/bin/grub-editor-helper', 'bash', scriptPath];
    const cmdExec = isRoot ? 'bash' : 'pkexec';
    
    const child = require('node:child_process').spawn(cmdExec, cmdArgs);
    let output = "";
    
    child.stdout.on('data', (data: any) => { output += data.toString(); });
    child.stderr.on('data', (data: any) => { output += data.toString(); });

    const pollInterval = setInterval(() => {
      if (hasOverrides && fs.existsSync(rawCfgOut)) {
        clearInterval(pollInterval);
        log('POST /api/trigger-regen', 'Detected raw config. Applying overrides...');
        try {
          const rawContent = fs.readFileSync(rawCfgOut, 'utf8');
          const updatedContent = applyOverridesToGrubCfg(rawContent, overrides);
          fs.writeFileSync(tmpPatched, updatedContent);
        } catch (err: any) {
          logError('POST /api/trigger-regen', 'Failed to patch config:', err.message);
        }
      }
    }, 500);

    child.on('close', (code: number) => {
      clearInterval(pollInterval);
      [scriptPath, rawCfgOut, tmpPatched].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      });
      delete fileCache['/boot/grub/grub.cfg'];
      delete fileCache['/boot/grub2/grub.cfg'];

      if (code === 0) {
        log('POST /api/trigger-regen', 'Regeneration pipeline complete');
        if (hasOverrides) output += "\n[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.";
        sendJsonResponse(res, { success: true, output });
      } else {
        logError('POST /api/trigger-regen', 'Regeneration failed:', output);
        sendErrorResponse(res, `Failed to regenerate GRUB configuration:\n${output}`);
      }
    });

    child.on('error', (err: any) => {
      clearInterval(pollInterval);
      [scriptPath, rawCfgOut, tmpPatched].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      });
      sendErrorResponse(res, `Failed to regenerate GRUB configuration: ${err.message}`);
    });
  } catch (e: any) {
    sendErrorResponse(res, e.message);
  }
  return true;
}

export async function handleDeployPipelinePost(data: any, res: ServerResponse) {
  const { config, bootEntries, snapTitle } = data;
  log('POST /api/deploy-pipeline', `Starting batched deploy pipeline. snapTitle: ${snapTitle}`);
  try {
    const output = await executeDeployPipeline(config, bootEntries, snapTitle);
    log('POST /api/deploy-pipeline', 'Deployment pipeline complete');
    sendJsonResponse(res, { success: true, output });
  } catch (e: any) {
    logError('POST /api/deploy-pipeline', 'Deploy pipeline failed:', e.message);
    sendErrorResponse(res, e.message);
  }
  return true;
}
