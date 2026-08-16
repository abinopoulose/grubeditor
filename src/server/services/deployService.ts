import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { log, logError, fileCache } from '../utils/fileOps';
import { getSnapshotsDir } from '../utils/snapshots';
import { getOverridesPath, applyOverridesToGrubCfg } from '../parsers/grubParser';

export async function executeDeployPipeline(config: Record<string, string>, bootEntries: any[], snapTitle: string): Promise<string> {
  const isRoot = process.getuid ? process.getuid() === 0 : false;
  
  const tmpConfig = `/tmp/grub-editor-deploy-config-${Date.now()}`;
  const tmpEntries = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
  
  let grubContent = "";
  for (const [k, v] of Object.entries(config)) {
    grubContent += `${k}="${v}"\n`;
  }
  fs.writeFileSync(tmpConfig, grubContent);
  
  const toSaveEntries = (bootEntries || []).map((e: any) => ({ ...e, originalTitle: e.originalTitle || e.title }));
  fs.writeFileSync(tmpEntries, JSON.stringify(toSaveEntries, null, 2));

  const timestamp = Date.now();
  const snapDir = path.join(getSnapshotsDir(), `snap_${timestamp}`);
  const defTarget = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
  const cfgTarget = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
  const overridesPath = getOverridesPath();
  
  const scriptPath = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`;
  const rawCfgOut = `/tmp/grub-editor-raw-cfg-${Date.now()}`;
  
  const snapMeta = {
    timestamp,
    date_string: `${timestamp} (UTC Timestamp)`,
    description: snapTitle,
    default_grub_backup: path.join(snapDir, 'default_grub.bak'),
    grub_cfg_backup: path.join(snapDir, 'grub.cfg.bak'),
    bls_entries_backup: path.join(snapDir, 'grub-editor-entries.json.bak')
  };
  const tmpMeta = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
  fs.writeFileSync(tmpMeta, JSON.stringify(snapMeta, null, 2));

  const tmpPatched = `/tmp/grub-editor-patched-cfg-${Date.now()}`;

  const bashScript = `#!/bin/bash
set -e
set -x

if [ -f /boot/grub2/grub.cfg ]; then
  cfgTarget="/boot/grub2/grub.cfg"
else
  cfgTarget="/boot/grub/grub.cfg"
fi

if [ -f /etc/default/grub ]; then
  defTarget="/etc/default/grub"
else
  defTarget="/boot/grub/default"
fi

echo "[Bash Runtime] Stage 1: Initializing snapshot in ${snapDir}..."
mkdir -p "${snapDir}"
chmod 755 "${snapDir}"
cp "${tmpMeta}" "${snapDir}/snapshot_metadata.json"
chmod 644 "${snapDir}/snapshot_metadata.json"

if [ -n "${snapMeta.default_grub_backup}" ] && [ "${snapMeta.default_grub_backup}" != "null" ] && [ -f "\${defTarget}" ]; then cp "\${defTarget}" "${snapMeta.default_grub_backup}"; chmod 644 "${snapMeta.default_grub_backup}"; fi
if [ -n "${snapMeta.grub_cfg_backup}" ] && [ "${snapMeta.grub_cfg_backup}" != "null" ] && [ -f "\${cfgTarget}" ]; then cp "\${cfgTarget}" "${snapMeta.grub_cfg_backup}"; chmod 644 "${snapMeta.grub_cfg_backup}"; fi
if [ -n "${snapMeta.bls_entries_backup}" ] && [ "${snapMeta.bls_entries_backup}" != "null" ] && [ -f "${overridesPath}" ]; then cp "${overridesPath}" "${snapMeta.bls_entries_backup}"; chmod 644 "${snapMeta.bls_entries_backup}"; fi

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${tmpConfig}" "\${defTarget}"
chmod 644 "\${defTarget}"
cp "${tmpEntries}" "${overridesPath}"
chmod 644 "${overridesPath}"

echo "[Bash Runtime] Stage 3: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching..."
cat "\${cfgTarget}" > "${rawCfgOut}"
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
cp "${tmpPatched}" "\${cfgTarget}"
chmod 644 "\${cfgTarget}"

echo "[Bash Runtime] Execution completed successfully!"
`;
  fs.writeFileSync(scriptPath, bashScript);
  
  return new Promise<string>((resolve, reject) => {
    let out = "";
    
    const cmdArgs = isRoot ? ['bash', scriptPath] : ['/usr/bin/grub-editor-helper', 'bash', scriptPath];
    const cmdExec = isRoot ? 'bash' : 'pkexec';
    
    const child = spawn(cmdExec, cmdArgs);
    
    child.stdout.on('data', (data: any) => { out += data.toString(); });
    child.stderr.on('data', (data: any) => { out += data.toString(); });
    
    child.on('close', (code: number) => {
      [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      });

      if (code === 0) {
        delete fileCache['/boot/grub/grub.cfg'];
        delete fileCache['/boot/grub2/grub.cfg'];
        delete fileCache['/etc/default/grub'];
        resolve(out);
      } else {
        reject(new Error(`Exit code ${code}:\n${out}`));
      }
    });
    
    child.on('error', (err: any) => {
      [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      });
      reject(new Error(`Spawn error: ${err.message}\n${out}`));
    });

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
}
