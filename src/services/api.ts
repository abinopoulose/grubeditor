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

let mockSnapshots: Snapshot[] = [
  {
    timestamp: Date.now() - 3600000 * 24,
    date_string: new Date(Date.now() - 3600000 * 24).toLocaleString(),
    description: "Initial pristine post-install configuration",
    default_grub_backup: "/var/lib/grub-editor/backups/snap_1/default_grub.bak",
    grub_cfg_backup: "/var/lib/grub-editor/backups/snap_1/grub.cfg.bak"
  },
  {
    timestamp: Date.now() - 3600000 * 4,
    date_string: new Date(Date.now() - 3600000 * 4).toLocaleString(),
    description: "Auto-backup before switching to theme Vince-Cyberpunk",
    default_grub_backup: "/var/lib/grub-editor/backups/snap_2/default_grub.bak",
    grub_cfg_backup: "/var/lib/grub-editor/backups/snap_2/grub.cfg.bak"
  }
];

let mockBootEntries: BootEntry[] = [
  { title: "Ubuntu 24.04 LTS (Kernel 6.8.0-45-generic)", id: "ubuntu", options: "quiet splash nvidia-drm.modeset=1" },
  { title: "Ubuntu 24.04 LTS (Recovery Mode / Advanced options)", id: "ubuntu-recovery", options: "single nomodeset" },
  { title: "Windows 11 Pro (on /dev/nvme0n1p1 via OS-Prober)", id: "windows-efi" },
  { title: "Fedora 40 Workstation (on /dev/sdb2)", id: "fedora-bls" }
];

export const ApiService = {
  async getDistro(): Promise<BootloaderConfig> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<BootloaderConfig>('detect_distro');
      } catch {
        return mockDistro;
      }
    }
    return mockDistro;
  },

  async getGrubConfig(): Promise<Record<string, string>> {
    return { ...mockConfig };
  },

  async saveGrubConfig(newConfig: Record<string, string>, reason = "Manual modification in General Settings"): Promise<boolean> {
    mockConfig = { ...newConfig };
    // Automatically create snapshot on save
    mockSnapshots.unshift({
      timestamp: Date.now(),
      date_string: new Date().toLocaleString(),
      description: `Auto-backup: ${reason}`,
      default_grub_backup: `/var/lib/grub-editor/backups/snap_${Date.now()}/default_grub.bak`
    });
    return true;
  },

  async scanThemes(): Promise<ThemeMetadata[]> {
    return [...mockThemes];
  },

  async getBootEntries(): Promise<BootEntry[]> {
    return [...mockBootEntries];
  },

  async applyTheme(themeName: string): Promise<boolean> {
    const target = mockThemes.find(t => t.name === themeName);
    if (target && !target.is_valid) {
      throw new Error("Cannot install invalid theme with broken permissions or missing font assets!");
    }
    if (target) {
      mockConfig["GRUB_THEME"] = `${target.path}/theme.txt`;
      mockConfig["GRUB_TERMINAL_OUTPUT"] = "gfxterm";
      mockSnapshots.unshift({
        timestamp: Date.now(),
        date_string: new Date().toLocaleString(),
        description: `Applied theme ${themeName}`,
        default_grub_backup: `/var/lib/grub-editor/backups/snap_${Date.now()}/default_grub.bak`
      });
    }
    return true;
  },

  async getSnapshots(): Promise<Snapshot[]> {
    return [...mockSnapshots];
  },

  async restoreSnapshot(timestamp: number): Promise<boolean> {
    const found = mockSnapshots.find(s => s.timestamp === timestamp);
    if (!found) throw new Error("Snapshot timestamp ID not found");
    // Emulate rollback
    mockSnapshots.unshift({
      timestamp: Date.now(),
      date_string: new Date().toLocaleString(),
      description: `Rollback restore to state from ${found.date_string}`,
      default_grub_backup: found.default_grub_backup
    });
    return true;
  },

  async triggerRegen(): Promise<{ success: boolean; output: string }> {
    await new Promise(res => setTimeout(res, 1200)); // Emulate generator runtime
    const bin = mockDistro.regen_command.join(" ");
    return {
      success: true,
      output: `[Polkit Authorization Granted]\nRunning ${bin}...\nSourcing file \`/etc/default/grub'\nSourcing file \`/etc/default/grub.d/init-select.cfg'\nGenerating grub configuration file ...\nFound theme: ${mockConfig["GRUB_THEME"] || "none"}\nFound linux image: /boot/vmlinuz-6.8.0-45-generic\nFound initrd image: /boot/initramfs-6.8.0-45-generic.img\nFound Windows Boot Manager on /dev/nvme0n1p1@/EFI/Microsoft/Boot/bootmgfw.efi\nAdding boot menu entry for UEFI Firmware Settings ...\ndone`
    };
  }
};
