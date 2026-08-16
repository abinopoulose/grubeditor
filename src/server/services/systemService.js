import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { readProtectedFile } from '../utils/fileOps';
export function detectDistro() {
    var distroName = "Ubuntu 24.04.4 LTS";
    var family = "DebianUbuntu";
    var regenCommand = ["update-grub"];
    try {
        var osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        osRelease.split('\n').forEach(function (line) {
            if (line.startsWith('PRETTY_NAME=')) {
                distroName = line.split('=')[1].replace(/["']/g, '').trim();
            }
            else if (line.startsWith('ID=')) {
                var id = line.split('=')[1].replace(/["']/g, '').trim().toLowerCase();
                if (id === 'fedora' || id === 'rhel' || id === 'centos' || id === 'rocky') {
                    family = "RHEL";
                    regenCommand = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"];
                }
                else if (id === 'arch' || id === 'manjaro') {
                    family = "Arch";
                    regenCommand = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"];
                }
            }
        });
    }
    catch (_a) { }
    return {
        distro_name: distroName,
        family: family,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: regenCommand,
        uses_bls: fs.existsSync('/boot/loader/entries')
    };
}
export function scanGrubThemes() {
    var themesDir = '/boot/grub2/themes';
    var themes = [];
    try {
        var dirs = [];
        var needsPkexec = false;
        try {
            dirs = fs.readdirSync('/boot/grub2/themes');
        }
        catch (e1) {
            if (e1.code === 'EACCES' || e1.code === 'EPERM') {
                needsPkexec = true;
            }
            else {
                themesDir = '/boot/grub/themes';
                try {
                    dirs = fs.readdirSync('/boot/grub/themes');
                }
                catch (e2) {
                    if (e2.code === 'EACCES' || e2.code === 'EPERM')
                        needsPkexec = true;
                }
            }
        }
        if (dirs.length === 0 && needsPkexec) {
            try {
                var out = execSync("pkexec /usr/bin/grub-editor-helper sh -c \"if [ -d /boot/grub2/themes ]; then find /boot/grub2/themes -maxdepth 1 -mindepth 1 -type d; elif [ -d /boot/grub/themes ]; then find /boot/grub/themes -maxdepth 1 -mindepth 1 -type d; fi\"", { encoding: 'utf8' });
                dirs = out.split('\n').filter(Boolean).map(function (d) { return path.basename(d.trim()); });
                themesDir = out.includes('/boot/grub2/themes') ? '/boot/grub2/themes' : '/boot/grub/themes';
            }
            catch (_a) { }
        }
        for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
            var dir = dirs_1[_i];
            var themePath = path.join(themesDir, dir);
            var txtPath = path.join(themePath, 'theme.txt');
            var isValid = false;
            try {
                if (fs.existsSync(txtPath))
                    isValid = true;
            }
            catch (_b) {
                try {
                    execSync("test -f \"".concat(txtPath, "\""), { stdio: 'ignore' });
                    isValid = true;
                }
                catch (_c) { }
            }
            if (isValid) {
                themes.push({
                    name: dir,
                    path: themePath,
                    is_valid: true,
                    validation_errors: [],
                    has_pf2_fonts: true,
                    background_image: "background.png",
                    title_text: "".concat(dir, " Theme")
                });
            }
        }
    }
    catch (e) {
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
    return themes;
}
export function parseDefaultGrubConfig() {
    var grubPath = fs.existsSync('/etc/default/grub') ? '/etc/default/grub' : '/boot/grub/default';
    var content = readProtectedFile(grubPath);
    var map = {};
    content.split('\n').forEach(function (line) {
        var trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            var idx = trimmed.indexOf('=');
            var key = trimmed.substring(0, idx).trim();
            var val = trimmed.substring(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.substring(1, val.length - 1);
            }
            map[key] = val;
        }
    });
    return map;
}
