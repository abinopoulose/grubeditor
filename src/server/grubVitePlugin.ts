import type { Plugin } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const fileCache: Record<string, { time: number; content: string }> = {};

function readProtectedFile(filepath: string, maxAgeMs = 15000): string {
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
        content = execSync(`pkexec cat "${filepath}"`, { encoding: 'utf8' });
      } catch (err: any) {
        console.error(`Failed to read ${filepath} via pkexec:`, err);
        throw new Error(`Cannot read ${filepath}: permission denied or authentication dismissed.`);
      }
    }
  }
  fileCache[filepath] = { time: now, content };
  return content;
}

interface BootEntry {
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

function parseGrubCfg(content: string): BootEntry[] {
  const entries: BootEntry[] = [];
  const activeKernel = os.release().trim(); // e.g. 7.0.0-28-generic

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

export function grubApiPlugin(): Plugin {
  return {
    name: 'grub-editor-live-system-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const pathname = url.pathname;

          if (req.method === 'GET' && pathname === '/api/boot-entries') {
            if (fs.existsSync('/boot/loader/entries')) {
              try {
                const files = fs.readdirSync('/boot/loader/entries').filter(f => f.endsWith('.conf') || f.endsWith('.mgnix'));
                if (files.length > 0) {
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
                  res.end(JSON.stringify(blsEntries));
                  return;
                }
              } catch (e) {
                console.warn("BLS directory read error, falling back to grub.cfg:", e);
              }
            }

            const grubCfgPath = fs.existsSync('/boot/grub2/grub.cfg') ? '/boot/grub2/grub.cfg' : '/boot/grub/grub.cfg';
            const content = readProtectedFile(grubCfgPath);
            const entries = parseGrubCfg(content);
            res.end(JSON.stringify(entries));
            return;
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
            return;
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
            return;
          }

          if (req.method === 'GET' && pathname === '/api/scan-themes') {
            const themesDir = fs.existsSync('/boot/grub2/themes') ? '/boot/grub2/themes' : '/boot/grub/themes';
            const themes: any[] = [];
            try {
              let dirs: string[] = [];
              try {
                dirs = fs.readdirSync(themesDir);
              } catch {
                const out = execSync(`pkexec find "${themesDir}" -maxdepth 1 -mindepth 1 -type d`, { encoding: 'utf8' });
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
            return;
          }

          if (req.method === 'GET' && pathname === '/api/snapshots') {
            const home = os.homedir();
            const snapDir = path.join(home, '.grubdeck', 'snapshots');
            const snapshots: any[] = [];
            if (fs.existsSync(snapDir)) {
              try {
                const files = fs.readdirSync(snapDir).filter(f => f.endsWith('.json'));
                for (const file of files) {
                  const data = JSON.parse(fs.readFileSync(path.join(snapDir, file), 'utf8'));
                  snapshots.push(data);
                }
              } catch {}
            }
            res.end(JSON.stringify(snapshots));
            return;
          }

          if (req.method === 'POST') {
            let body = "";
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const data = body ? JSON.parse(body) : {};
                if (pathname === '/api/save-grub-config') {
                  const { newConfig } = data;
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
                        execSync(`pkexec cp "${tmpPath}" /etc/default/grub && rm -f "${tmpPath}"`);
                      } catch (e) {
                        console.warn("Failed to copy config via pkexec:", e);
                      }
                    }
                    delete fileCache['/etc/default/grub'];
                    delete fileCache['/boot/grub/default'];
                  }
                  res.end(JSON.stringify({ success: true }));
                  return;
                }

                if (pathname === '/api/save-boot-entries') {
                  delete fileCache['/boot/grub/grub.cfg'];
                  delete fileCache['/boot/grub2/grub.cfg'];
                  res.end(JSON.stringify({ success: true }));
                  return;
                }

                if (pathname === '/api/trigger-regen') {
                  let output = "";
                  try {
                    const isRoot = process.getuid ? process.getuid() === 0 : false;
                    const cmd = isRoot ? 'update-grub 2>&1' : 'pkexec update-grub 2>&1';
                    output = execSync(cmd, { encoding: 'utf8' });
                    delete fileCache['/boot/grub/grub.cfg'];
                    delete fileCache['/boot/grub2/grub.cfg'];
                  } catch (e: any) {
                    output = e.stdout || e.stderr || `Failed: ${e.message}`;
                  }
                  res.end(JSON.stringify({ success: true, output }));
                  return;
                }

                res.end(JSON.stringify({ success: true }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          next();
        } catch (err: any) {
          console.error("Vite API Middleware error:", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
      });
    }
  };
}
