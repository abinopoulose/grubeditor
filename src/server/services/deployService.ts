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
    grub_dir_backup: path.join(snapDir, 'grub'),
    default_grub_backup: path.join(snapDir, 'default_grub'),
    loader_dir_backup: path.join(snapDir, 'loader')
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
grubDir=$(dirname "\${cfgTarget}")

TEMP_BACKUP_DIR="/tmp/grub-editor-rollback-${Date.now()}"

rollback() {
  set +e
  echo "[Bash Runtime] ERROR CAUGHT! Executing atomic rollback from \${TEMP_BACKUP_DIR}..."
  if [ -f "\${TEMP_BACKUP_DIR}/default_grub" ]; then
    cp -a "\${TEMP_BACKUP_DIR}/default_grub" "\${defTarget}"
  else
    rm -f "\${defTarget}" 2>/dev/null || true
  fi
  if [ -d "\${TEMP_BACKUP_DIR}/grub" ]; then
    rm -f "${overridesPath}" 2>/dev/null || true
    cp -a "\${TEMP_BACKUP_DIR}/grub/." "\${grubDir}/"
  fi
  if [ -d "\${TEMP_BACKUP_DIR}/loader" ]; then
    cp -a "\${TEMP_BACKUP_DIR}/loader/." "/boot/loader/"
  fi
  echo "[Bash Runtime] Rollback completed. System restored to original state."
  rm -rf "\${TEMP_BACKUP_DIR}"
  rm -rf "${snapDir}" 2>/dev/null || true
  exit 1
}

echo "[Bash Runtime] Stage 0: Creating temporary atomic backup at \${TEMP_BACKUP_DIR}..."
mkdir -p "\${TEMP_BACKUP_DIR}"
if [ -f "\${defTarget}" ]; then
  cp -a "\${defTarget}" "\${TEMP_BACKUP_DIR}/default_grub"
fi
if [ -d "\${grubDir}" ]; then
  cp -a "\${grubDir}" "\${TEMP_BACKUP_DIR}/grub"
fi
if [ -d "/boot/loader" ]; then
  cp -a "/boot/loader" "\${TEMP_BACKUP_DIR}/loader"
fi

trap 'rollback' ERR

echo "[Bash Runtime] Stage 1: Initializing vault snapshot in ${snapDir}..."
mkdir -p "${snapDir}"
chmod 755 "${snapDir}"
cp "${tmpMeta}" "${snapDir}/snapshot_metadata.json"
chmod 644 "${snapDir}/snapshot_metadata.json"

if [ -f "\${defTarget}" ]; then
  cp -a "\${defTarget}" "${snapMeta.default_grub_backup}"
fi

if [ -d "\${grubDir}" ]; then
  cp -a "\${grubDir}" "${snapMeta.grub_dir_backup}"
  if [ ! -f "${snapMeta.grub_dir_backup}/grub-editor-entries.json" ]; then
    echo '[]' > "${snapMeta.grub_dir_backup}/grub-editor-entries.json"
  fi
fi

if [ -d "/boot/loader" ]; then
  cp -a "/boot/loader" "${snapMeta.loader_dir_backup}"
fi

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
echo "[Bash Runtime] Copying \${tmpConfig} to \${defTarget}"
cp "${tmpConfig}" "\${defTarget}"
chmod 644 "\${defTarget}"

echo "[Bash Runtime] Copying \${tmpEntries} to \${overridesPath}"
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
    rollback
  fi
done

echo "[Bash Runtime] Stage 6: Finalizing deployment..."
cp "${tmpPatched}" "\${cfgTarget}"
chmod 644 "\${cfgTarget}"

echo "[Bash Runtime] Stage 7: Deployment successful! Cleaning up temporary backup..."
trap - ERR
rm -rf "\${TEMP_BACKUP_DIR}"

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

    child.on('close', (code: number) => {
      clearInterval(pollInterval);
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
      clearInterval(pollInterval);
      [tmpConfig, tmpEntries, tmpMeta, scriptPath, rawCfgOut, tmpPatched].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      });
      reject(new Error(`Spawn error: ${err.message}\n${out}`));
    });
  });
}
