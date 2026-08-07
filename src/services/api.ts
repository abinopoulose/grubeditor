import { BootloaderConfig, ThemeMetadata, Snapshot, BootEntry } from '../types';

// Detect if running inside Tauri native webview
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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

export const ApiService = {
  async getDistro(): Promise<BootloaderConfig> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<BootloaderConfig>('detect_distro');
      } catch (err) {
        console.error("Failed to detect native distro:", err);
        throw err;
      }
    }
    const res = await fetch('/api/distro');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch distro information");
    }
    return await res.json();
  },

  async getGrubConfig(): Promise<Record<string, string>> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<Record<string, string>>('get_grub_config');
      } catch (err) {
        console.error("Failed to load native GRUB config:", err);
        throw err;
      }
    }
    const res = await fetch('/api/grub-config');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch GRUB config. PolicyKit authorization may have been denied.");
    }
    return await res.json();
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
      const res = await fetch('/api/save-grub-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newConfig, reason, createSnapshot })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not save to live system via Vite API");
      }
    }
    return true;
  },

  async scanThemes(): Promise<ThemeMetadata[]> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<ThemeMetadata[]>('scan_themes');
      } catch (err) {
        console.error("Failed to scan native themes:", err);
        throw err;
      }
    }
    const res = await fetch('/api/scan-themes');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not fetch system themes via Vite API");
    }
    return await res.json();
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
        console.error('[GrubEditor UI] getBootEntries: Tauri invoke failed:', err);
        throw err;
      }
    }
    const res = await fetch('/api/boot-entries');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch boot entries. PolicyKit authorization may have been denied.");
    }
    const entries: BootEntry[] = await res.json();
    return entries.map((e, index) => ({ ...e, id: e.id || `sys-target-${index}` }));
  },

  async saveBootEntries(newEntries: BootEntry[], reason = "Modified boot menu entries & ordering in Boot Menu Options", createSnapshot = true): Promise<boolean> {
    console.log(`[GrubEditor UI] saveBootEntries: saving ${newEntries.length} entries`);
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
      const res = await fetch('/api/save-boot-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEntries, reason, createSnapshot })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Vite API save failed");
      }
    }
    return true;
  },

  async getSnapshots(): Promise<Snapshot[]> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<Snapshot[]>('get_snapshots');
      } catch (err) {
        console.error("Failed to fetch native snapshots:", err);
        throw err;
      }
    }
    const res = await fetch('/api/snapshots');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load server snapshots");
    }
    return await res.json();
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
    const res = await fetch('/api/restore-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to restore via server API");
    }
    return true;
  },

  async triggerRegen(): Promise<{ success: boolean; output: string }> {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<{ success: boolean; output: string }>('trigger_regen');
      } catch (err) {
        console.error("Failed to trigger native regeneration:", err);
        throw err;
      }
    }
    const res = await fetch('/api/trigger-regen', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to trigger regeneration");
    }
    const data = await res.json();
    return data;
  },

  async deployPipeline(config: Record<string, string>, bootEntries: BootEntry[], snapTitle: string): Promise<{ success: boolean; output: string }> {
    if (isTauri) {
      // For Tauri, we'll still call the individual methods since they run securely natively
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_grub_config', { newConfig: config, reason: snapTitle, createSnapshot: true });
        await invoke('save_boot_entries', { newEntries: bootEntries, reason: "User deployed boot menu option modifications via GrubEditor GUI", createSnapshot: false });
        return await invoke<{ success: boolean; output: string }>('trigger_regen');
      } catch (err) {
        throw err;
      }
    } else {
      const res = await fetch('/api/deploy-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, bootEntries, snapTitle })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to deploy configuration pipeline");
      }
      return await res.json();
    }
  }
};
