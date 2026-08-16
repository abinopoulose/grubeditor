import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { log, logError } from './fileOps';
export function getSnapshotsDir() {
    var p = '/var/lib/grub-editor/backups';
    if (process.getuid && process.getuid() === 0) {
        if (!fs.existsSync(p)) {
            try {
                fs.mkdirSync(p, { recursive: true });
            }
            catch (_a) { }
        }
    }
    return p;
}
export function createServerSnapshot(description, getOverridesPath, execute) {
    if (execute === void 0) { execute = true; }
    var baseDir = getSnapshotsDir();
    var timestamp = Date.now();
    var folderName = "snap_".concat(timestamp);
    var targetDir = path.join(baseDir, folderName);
    var overridesPath = getOverridesPath();
    var defaultGrubBackup = path.join(targetDir, 'default_grub.bak');
    var cfgBackupPath = path.join(targetDir, 'grub.cfg.bak');
    var ovBackupPath = path.join(targetDir, 'grub-editor-entries.json.bak');
    var date_string = "".concat(timestamp, " (UTC Timestamp)");
    var snapshotData = {
        timestamp: timestamp,
        date_string: date_string,
        description: description || "Auto-backup",
        default_grub_backup: defaultGrubBackup,
        grub_cfg_backup: cfgBackupPath,
        bls_entries_backup: ovBackupPath,
        warnings: []
    };
    var tmpMeta = "/tmp/grub-editor-snap-meta-".concat(Date.now());
    fs.writeFileSync(tmpMeta, JSON.stringify(snapshotData, null, 2));
    var bashScript = "\n# --- START SNAPSHOT: ".concat(description, " ---\nmkdir -p \"").concat(targetDir, "\"\nchmod 755 \"").concat(targetDir, "\"\ncp \"").concat(tmpMeta, "\" \"").concat(targetDir, "/snapshot_metadata.json\"\nchmod 644 \"").concat(targetDir, "/snapshot_metadata.json\"\n\nif [ -f \"${grubDefaultPath}\" ]; then\n  cp \"${grubDefaultPath}\" \"").concat(defaultGrubBackup, "\"\n  chmod 644 \"").concat(defaultGrubBackup, "\"\nfi\n\nif [ -f \"${grubCfgPath}\" ]; then\n  cp \"${grubCfgPath}\" \"").concat(cfgBackupPath, "\"\n  chmod 644 \"").concat(cfgBackupPath, "\"\nfi\n\nif [ -f \"").concat(overridesPath, "\" ]; then\n  cp \"").concat(overridesPath, "\" \"").concat(ovBackupPath, "\"\n  chmod 644 \"").concat(ovBackupPath, "\"\nfi\n# --- END SNAPSHOT ---\n");
    if (execute) {
        var scriptPath = "/tmp/grub-editor-snap-script-".concat(Date.now(), ".sh");
        var fullScript = "#!/bin/bash\nset -e\n\nif [ -f /boot/grub2/grub.cfg ]; then\n  grubCfgPath=\"/boot/grub2/grub.cfg\"\nelse\n  grubCfgPath=\"/boot/grub/grub.cfg\"\nfi\n\nif [ -f /etc/default/grub ]; then\n  grubDefaultPath=\"/etc/default/grub\"\nelse\n  grubDefaultPath=\"/boot/grub/default\"\nfi\n" + bashScript;
        fs.writeFileSync(scriptPath, fullScript);
        try {
            var isRoot = process.getuid ? process.getuid() === 0 : false;
            var cmd = isRoot ? "bash ".concat(scriptPath) : "pkexec /usr/bin/grub-editor-helper bash ".concat(scriptPath);
            execSync(cmd, { stdio: 'ignore' });
            log('SNAPSHOT', "Created recovery snapshot in ".concat(targetDir, ": \"").concat(description, "\""));
        }
        catch (e) {
            logError('SNAPSHOT', "Could not create snapshot:", e.message);
            return null;
        }
        finally {
            if (fs.existsSync(tmpMeta))
                try {
                    fs.unlinkSync(tmpMeta);
                }
                catch (_a) { }
            if (fs.existsSync(scriptPath))
                try {
                    fs.unlinkSync(scriptPath);
                }
                catch (_b) { }
        }
        return snapshotData;
    }
    return { snapshotData: snapshotData, script: bashScript, tmpMeta: tmpMeta };
}
