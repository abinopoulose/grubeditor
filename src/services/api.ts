import { BootloaderConfig, ThemeMetadata, Snapshot, BootEntry } from '../types';

// Detect if running inside Tauri native webview
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Simulated store for dev mode / unprivileged web testing
let mockDistro: BootloaderConfig = {
  distro_name: "Ubuntu 24.04.4 LTS (Noble Numbat)",
  family: "DebianUbuntu",
  default_grub_path: "/etc/default/grub",
  grub_dir: "/boot/grub",
  grub_cfg_path: "/boot/grub/grub.cfg",
  themes_dir: "/boot/grub/themes",
  regen_command: ["update-grub"],
  uses_bls: false
};

let mockConfig: Record<string, string> = {
  "GRUB_DEFAULT": "0",
  "GRUB_TIMEOUT_STYLE": "menu",
  "GRUB_TIMEOUT": "5",
  "GRUB_DISTRIBUTOR": "`lsb_release -i -s 2> /dev/null || echo Debian`",
  "GRUB_CMDLINE_LINUX_DEFAULT": "quiet splash nvidia-drm.modeset=1",
  "GRUB_CMDLINE_LINUX": "",
  "GRUB_TERMINAL_OUTPUT": "gfxterm",
  "GRUB_GFXMODE": "1920x1080x32,auto",
  "GRUB_THEME": "/boot/grub/themes/Vince-Cyberpunk/theme.txt",
  "GRUB_DISABLE_OS_PROBER": "false",
  "GRUB_SAVEDEFAULT": "false"
};

let mockThemes: ThemeMetadata[] = [
  {
    name: "Vince-Cyberpunk",
    path: "/boot/grub/themes/Vince-Cyberpunk",
    is_valid: true,
    validation_errors: [],
    has_pf2_fonts: true,
    background_image: "background.png",
    title_text: "GrubDeck Boot System",
    item_color: "#a3b8cc",
    selected_item_color: "#00ffcc",
    menu_box_left: "30%",
    menu_box_top: "35%",
    menu_box_width: "40%",
    menu_box_height: "35%"
  },
  {
    name: "GrubDeck-Monochrome-Pro",
    path: "/boot/grub/themes/GrubDeck-Monochrome-Pro",
    is_valid: true,
    validation_errors: [],
    has_pf2_fonts: true,
    background_image: "dark-grid.jpg",
    title_text: "Select Boot Option",
    item_color: "#888888",
    selected_item_color: "#ffffff",
    menu_box_left: "25%",
    menu_box_top: "30%",
    menu_box_width: "50%",
    menu_box_height: "40%"
  },
  {
    name: "Legacy-Broken-Theme",
    path: "/boot/grub/themes/Legacy-Broken-Theme",
    is_valid: false,
    validation_errors: [
      "Missing primary configuration file: theme.txt",
      "Warning: No compiled GRUB fonts (.pf2) found in theme folder. May fall back to ugly unstyled text during boot!",
      "Error: Cannot read theme directory contents due to strict filesystem permissions. GRUB requires 0755 for directories and 0644 for files!"
    ],
    has_pf2_fonts: false,
    item_color: "#cccccc",
    selected_item_color: "#ffffff"
  }
];

let mockBootEntries: BootEntry[] = [
  { title: "Ubuntu 24.04 LTS (Kernel 6.8.0-45-generic)", id: "ubuntu", options: "quiet splash nvidia-drm.modeset=1", enabled: true, isCurrent: true, type: "linux" },
  { title: "Ubuntu 24.04 LTS (Recovery Mode / Advanced options)", id: "ubuntu-recovery", options: "single nomodeset", enabled: true, type: "recovery" },
  { title: "Windows 11 Pro (on /dev/nvme0n1p1 via OS-Prober)", id: "windows-efi", enabled: true, type: "windows" },
  { title: "Fedora 40 Workstation (on /dev/sdb2)", id: "fedora-bls", enabled: true, type: "linux" }
];

export function formatSnapshotDate(timestampOrDate: number | Date = Date.now()): string {
  const d = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : timestampOrDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day}/${month}/${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
}

let mockSnapshots: Snapshot[] = [
  {
    timestamp: Date.now() - 3600000 * 24,
    date_string: formatSnapshotDate(Date.now() - 3600000 * 24),
    description: "Initial pristine post-install configuration",
    default_grub_backup: "/var/lib/grub-editor/backups/snap_1/default_grub.bak",
    grub_cfg_backup: "/var/lib/grub-editor/backups/snap_1/grub.cfg.bak",
    config_snapshot: { ...mockConfig },
    entries_snapshot: mockBootEntries.map(e => ({ ...e }))
  },
  {
    timestamp: Date.now() - 3600000 * 4,
    date_string: formatSnapshotDate(Date.now() - 3600000 * 4),
    description: "Manual configuration checkpoint",
    default_grub_backup: "/var/lib/grub-editor/backups/snap_2/default_grub.bak",
    grub_cfg_backup: "/var/lib/grub-editor/backups/snap_2/grub.cfg.bak",
    config_snapshot: { ...mockConfig },
    entries_snapshot: mockBootEntries.map(e => ({ ...e }))
  }
];

function createSnapshotRecord(description: string, defaultBackupPath?: string) {
  const newTs = Math.max(Date.now(), (mockSnapshots[0]?.timestamp || 0) + 1);
  const backupPath = defaultBackupPath || `/var/lib/grub-editor/backups/snap_${newTs}/default_grub.bak`;
  mockSnapshots.unshift({
    timestamp: newTs,
    date_string: formatSnapshotDate(newTs),
    description,
    default_grub_backup: backupPath,
    grub_cfg_backup: `/var/lib/grub-editor/backups/snap_${newTs}/grub.cfg.bak`,
    config_snapshot: { ...mockConfig },
    entries_snapshot: mockBootEntries.map(e => ({ ...e }))
  });
}

export const ApiService = {
  async getDistro(): Promise<BootloaderConfig> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<BootloaderConfig>('detect_distro');
      } catch (err) {
        console.error("Failed to detect native distro, falling back to mock:", err);
        return mockDistro;
      }
    }
    try {
      const res = await fetch('/api/distro');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Vite backend API not reachable, falling back to simulation mock data:", err);
    }
    return mockDistro;
  },

  async getGrubConfig(): Promise<Record<string, string>> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<Record<string, string>>('get_grub_config');
      } catch (err) {
        console.error("Failed to load native GRUB config, falling back to mock:", err);
      }
    }
    try {
      const res = await fetch('/api/grub-config');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Vite backend API not reachable, falling back to simulation mock config:", err);
    }
    return { ...mockConfig };
  },

  async saveGrubConfig(newConfig: Record<string, string>, reason = "Manual modification in General Settings", createSnapshot = true): Promise<boolean> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke<boolean>('save_grub_config', { newConfig, reason, createSnapshot });
      } catch (err) {
        console.error("Failed to save native GRUB config:", err);
        throw err;
      }
    } else {
      try {
        await fetch('/api/save-grub-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newConfig, reason, createSnapshot })
        });
      } catch (e) {
        console.warn("Could not save to live system via Vite API:", e);
      }
    }
    mockConfig = { ...newConfig };
    if (createSnapshot) {
      createSnapshotRecord(reason);
    }
    return true;
  },

  async scanThemes(): Promise<ThemeMetadata[]> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<ThemeMetadata[]>('scan_themes');
      } catch (err) {
        console.error("Failed to scan native themes, falling back to mock:", err);
      }
    }
    try {
      const res = await fetch('/api/scan-themes');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Could not fetch system themes via Vite API:", e);
    }
    return [...mockThemes];
  },

  async getBootEntries(): Promise<BootEntry[]> {
    console.log('[GrubEditor UI] getBootEntries: fetching...');
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const entries = await invoke<BootEntry[]>('get_boot_entries');
        console.log(`[GrubEditor UI] getBootEntries: got ${entries.length} entries from Tauri`);
        return entries.map((e, index) => ({ ...e, id: e.id || `sys-target-${index}` }));
      } catch (err) {
        console.error('[GrubEditor UI] getBootEntries: Tauri invoke failed, falling back:', err);
      }
    }
    try {
      const res = await fetch('/api/boot-entries');
      if (res.ok) {
        const entries: BootEntry[] = await res.json();
        const active = entries.filter(e => !e.deleted);
        const deleted = entries.filter(e => e.deleted);
        console.log(`[GrubEditor UI] getBootEntries: got ${entries.length} entries from Vite API (${active.length} active, ${deleted.length} deleted)`);
        entries.forEach((e, i) => {
          console.log(`[GrubEditor UI]   [${i}] id="${e.id}" title="${e.title}" origTitle="${(e as any).originalTitle}" deleted=${e.deleted} enabled=${e.enabled}`);
        });
        return entries.map((e, index) => ({ ...e, id: e.id || `sys-target-${index}` }));
      }
    } catch (e) {
      console.warn('[GrubEditor UI] getBootEntries: Vite API not reachable, using mock:', e);
    }
    return mockBootEntries.map((e, index) => ({ ...e, id: e.id || `sys-target-${index}` }));
  },

  async saveBootEntries(newEntries: BootEntry[], reason = "Modified boot menu entries & ordering in Boot Menu Options", createSnapshot = true): Promise<boolean> {
    console.log(`[GrubEditor UI] saveBootEntries: saving ${newEntries.length} entries`);
    newEntries.forEach((e, i) => {
      console.log(`[GrubEditor UI]   [${i}] id="${e.id}" title="${e.title}" origTitle="${(e as any).originalTitle}" deleted=${e.deleted} enabled=${e.enabled}`);
    });
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_boot_entries', { newEntries, reason, createSnapshot });
        console.log('[GrubEditor UI] saveBootEntries: Tauri save successful');
      } catch (err) {
        console.error('[GrubEditor UI] saveBootEntries: Tauri save failed:', err);
        throw err;
      }
    } else {
      try {
        const res = await fetch('/api/save-boot-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEntries, reason, createSnapshot })
        });
        console.log(`[GrubEditor UI] saveBootEntries: Vite API response status=${res.status}`);
      } catch (e) {
        console.error('[GrubEditor UI] saveBootEntries: Vite API save failed:', e);
      }
    }
    mockBootEntries = [...newEntries];
    if (createSnapshot) {
      createSnapshotRecord(`Auto-backup: ${reason}`);
    }
    return true;
  },

  async applyTheme(themeName: string): Promise<boolean> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('apply_theme', { themeName });
      } catch (err) {
        console.error("Failed to apply native theme:", err);
        throw err;
      }
    }
    try {
      await fetch('/api/apply-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName })
      });
    } catch (e) {}
    const target = mockThemes.find(t => t.name === themeName);
    if (target && !target.is_valid) {
      throw new Error("Cannot install invalid theme with broken permissions or missing font assets!");
    }
    if (target) {
      mockConfig["GRUB_THEME"] = `${target.path}/theme.txt`;
      mockConfig["GRUB_TERMINAL_OUTPUT"] = "gfxterm";
      createSnapshotRecord(`Applied theme ${themeName}`);
    }
    return true;
  },

  async getSnapshots(): Promise<Snapshot[]> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<Snapshot[]>('get_snapshots');
      } catch (err) {
        console.error("Failed to fetch native snapshots, falling back to mock:", err);
      }
    }
    try {
      const res = await fetch('/api/snapshots');
      if (res.ok) {
        const data = await res.json();
        console.log(`[GrubEditor UI] Loaded ${data.length} snapshots from server`);
        return data;
      }
    } catch (e) {
      console.warn('[GrubEditor UI] Failed to load server snapshots:', e);
    }
    return [...mockSnapshots];
  },

  async restoreSnapshot(timestamp: number): Promise<boolean> {
    console.log(`[GrubEditor UI] Restoring snapshot: timestamp=${timestamp}`);
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('restore_snapshot', { timestamp });
      } catch (err) {
        console.error("Failed to restore native snapshot:", err);
        throw err;
      }
    }
    try {
      const res = await fetch('/api/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp })
      });
      if (res.ok) {
        console.log('[GrubEditor UI] Snapshot restore successful via Vite server');
        return true;
      }
    } catch (e) {
      console.warn('[GrubEditor UI] Failed to restore via server API:', e);
    }
    const found = mockSnapshots.find(s => s.timestamp === timestamp);
    if (!found) throw new Error("Snapshot timestamp ID not found");
    if (found.config_snapshot) mockConfig = { ...found.config_snapshot };
    if (found.entries_snapshot) mockBootEntries = found.entries_snapshot.map(e => ({ ...e }));
    createSnapshotRecord(`Rollback restore to state from ${found.date_string}`, found.default_grub_backup);
    return true;
  },

  async triggerRegen(): Promise<{ success: boolean; output: string }> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<{ success: boolean; output: string }>('trigger_regen');
      } catch (err) {
        console.error("Failed to trigger native regeneration:", err);
        return { success: false, output: `Regeneration failed: ${err}` };
      }
    }
    try {
      const res = await fetch('/api/trigger-regen', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.output) return data;
      }
    } catch (e) {}
    await new Promise(res => setTimeout(res, 1200)); // Emulate generator runtime
    const bin = mockDistro.regen_command.join(" ");
    const entryLogs = mockBootEntries.filter(e => e.enabled !== false).map(e => `Configuring boot menu entry: '${e.title}'`).join("\n");
    return {
      success: true,
      output: `[Polkit Authorization Granted]\nRunning ${bin}...\nSourcing file \`/etc/default/grub'\nSourcing file \`/etc/default/grub.d/init-select.cfg'\nGenerating grub configuration file ...\nFound theme: ${mockConfig["GRUB_THEME"] || "none"}\n${entryLogs}\nAdding boot menu entry for UEFI Firmware Settings ...\nCompilation complete. Synchronized boot loader configuration to partition.\ndone`
    };
  }
};

