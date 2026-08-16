import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { log, logError, readProtectedFile, writeProtectedFile } from './fileOps';

export function getSnapshotsDir(): string {
  const p = '/var/lib/grub-editor/backups';
  if (process.getuid && process.getuid() === 0) {
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
  }
  return p;
}

export function createServerSnapshot(description: string, getOverridesPath: () => string, execute = true): any {
  const baseDir = getSnapshotsDir();
  const timestamp = Date.now();
  const folderName = `snap_${timestamp}`;
  const targetDir = path.join(baseDir, folderName);
  
  const overridesPath = getOverridesPath();

  const defaultGrubBackup = path.join(targetDir, 'default_grub.bak');
  const cfgBackupPath = path.join(targetDir, 'grub.cfg.bak');
  const ovBackupPath = path.join(targetDir, 'grub-editor-entries.json.bak');
  
  const date_string = `${timestamp} (UTC Timestamp)`;
  const snapshotData = {
    timestamp,
    date_string,
    description: description || "Auto-backup",
    default_grub_backup: defaultGrubBackup,
    grub_cfg_backup: cfgBackupPath,
    bls_entries_backup: ovBackupPath,
    warnings: []
  };

  const tmpMeta = `/tmp/grub-editor-snap-meta-${Date.now()}`;
  fs.writeFileSync(tmpMeta, JSON.stringify(snapshotData, null, 2));

  const bashScript = `
# --- START SNAPSHOT: ${description} ---
mkdir -p "${targetDir}"
chmod 755 "${targetDir}"
cp "${tmpMeta}" "${targetDir}/snapshot_metadata.json"
chmod 644 "${targetDir}/snapshot_metadata.json"

if [ -f "\${grubDefaultPath}" ]; then
  cp "\${grubDefaultPath}" "${defaultGrubBackup}"
  chmod 644 "${defaultGrubBackup}"
fi

if [ -f "\${grubCfgPath}" ]; then
  cp "\${grubCfgPath}" "${cfgBackupPath}"
  chmod 644 "${cfgBackupPath}"
fi

if [ -f "${overridesPath}" ]; then
  cp "${overridesPath}" "${ovBackupPath}"
  chmod 644 "${ovBackupPath}"
fi
# --- END SNAPSHOT ---
`;

  if (execute) {
    const scriptPath = `/tmp/grub-editor-snap-script-${Date.now()}.sh`;
    const fullScript = `#!/bin/bash\nset -e\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  grubCfgPath="/boot/grub2/grub.cfg"\nelse\n  grubCfgPath="/boot/grub/grub.cfg"\nfi\n\nif [ -f /etc/default/grub ]; then\n  grubDefaultPath="/etc/default/grub"\nelse\n  grubDefaultPath="/boot/grub/default"\nfi\n` + bashScript;
    fs.writeFileSync(scriptPath, fullScript);

    try {
      const isRoot = process.getuid ? process.getuid() === 0 : false;
      const cmd = isRoot ? `bash ${scriptPath}` : `pkexec /usr/bin/grub-editor-helper bash ${scriptPath}`;
      execSync(cmd, { stdio: 'ignore' });
      log('SNAPSHOT', `Created recovery snapshot in ${targetDir}: "${description}"`);
    } catch (e: any) {
      logError('SNAPSHOT', "Could not create snapshot:", e.message);
      return null;
    } finally {
      if (fs.existsSync(tmpMeta)) try { fs.unlinkSync(tmpMeta); } catch {}
      if (fs.existsSync(scriptPath)) try { fs.unlinkSync(scriptPath); } catch {}
    }
    return snapshotData;
  }

  return { snapshotData, script: bashScript, tmpMeta };
}
