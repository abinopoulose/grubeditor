use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub timestamp: i64,
    pub date_string: String,
    pub description: String,
    pub default_grub_backup: PathBuf,
    pub grub_cfg_backup: Option<PathBuf>,
    pub bls_entries_backup: Option<PathBuf>,
    /// Tracks non-fatal warnings that occurred during snapshot creation
    #[serde(default)]
    pub warnings: Vec<String>,
}

pub struct SnapshotManager {
    storage_dir: PathBuf,
}

impl SnapshotManager {
    pub fn new() -> Self {
        let storage_dir = PathBuf::from("/var/lib/grub-editor/backups");
        if rust_running_as_root() {
            let _ = fs::create_dir_all(&storage_dir);
        }
        Self { storage_dir }
    }

    pub fn list_snapshots(&self) -> anyhow::Result<Vec<Snapshot>> {
        let mut list = Vec::new();
        if !self.storage_dir.exists() {
            return Ok(list);
        }
        for entry in fs::read_dir(&self.storage_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let meta_file = path.join("snapshot_metadata.json");
                if meta_file.exists() {
                    if let Ok(content) = fs::read_to_string(&meta_file) {
                        if let Ok(snap) = serde_json::from_str::<Snapshot>(&content) {
                            list.push(snap);
                        }
                    }
                }
            }
        }
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn create_snapshot(&self, description: &str, distro: &crate::distro::BootloaderConfig) -> anyhow::Result<Snapshot> {
        // FIX Flaw 4: Refuse to create a snapshot if the source config file doesn't exist,
        // since the resulting snapshot would be empty/corrupt and mislead the user on restore.
        if !distro.default_grub_path.exists() {
            return Err(anyhow::anyhow!(
                "Cannot create snapshot: source config file {:?} does not exist. \
                 An empty snapshot would be useless for recovery.",
                distro.default_grub_path
            ));
        }

        // FIX Flaw 1: Use millisecond-precision timestamps and a collision-retry loop
        // to prevent two snapshots created in rapid succession from silently overwriting each other.
        let mut now_ms = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64;
        let mut folder_name = format!("snap_{}", now_ms);
        let mut target_dir = self.storage_dir.join(&folder_name);

        // Collision retry: if the directory already exists, increment until unique
        let mut retries = 0;
        while target_dir.exists() && retries < 100 {
            now_ms += 1;
            folder_name = format!("snap_{}", now_ms);
            target_dir = self.storage_dir.join(&folder_name);
            retries += 1;
        }
        if target_dir.exists() {
            return Err(anyhow::anyhow!(
                "Failed to create unique snapshot directory after {} retries", retries
            ));
        }

        fs::create_dir_all(&target_dir)?;

        let default_grub_backup = target_dir.join("default_grub.bak");
        fs::copy(&distro.default_grub_path, &default_grub_backup)?;

        let mut warnings = Vec::new();

        // FIX Flaw 8: Don't silently discard grub.cfg copy errors — record them as warnings
        let grub_cfg_backup = if distro.grub_cfg_path.exists() {
            let p = target_dir.join("grub.cfg.bak");
            match fs::copy(&distro.grub_cfg_path, &p) {
                Ok(_) => Some(p),
                Err(e) => {
                    let msg = format!(
                        "Warning: Failed to back up grub.cfg from {:?}: {}. \
                         Only /etc/default/grub was archived.",
                        distro.grub_cfg_path, e
                    );
                    eprintln!("{}", msg);
                    warnings.push(msg);
                    None
                }
            }
        } else {
            None
        };

        let bls_entries_backup = {
            let overrides_path = crate::menu_entries::MenuEntryParser::get_overrides_path(distro);
            if overrides_path.exists() {
                let p = target_dir.join("boot_entries.json.bak");
                match fs::copy(&overrides_path, &p) {
                    Ok(_) => Some(p),
                    Err(e) => {
                        let msg = format!(
                            "Warning: Failed to back up boot entries from {:?}: {}",
                            overrides_path, e
                        );
                        eprintln!("{}", msg);
                        warnings.push(msg);
                        None
                    }
                }
            } else {
                None
            }
        };

        let date_string = format!("{} (UTC Timestamp)", now_ms);
        let snap = Snapshot {
            timestamp: now_ms,
            date_string,
            description: description.to_string(),
            default_grub_backup,
            grub_cfg_backup,
            bls_entries_backup,
            warnings,
        };

        let meta_file = target_dir.join("snapshot_metadata.json");
        fs::write(&meta_file, serde_json::to_string_pretty(&snap)?)?;

        Ok(snap)
    }

    pub fn restore_snapshot(&self, timestamp: i64, distro: &crate::distro::BootloaderConfig) -> anyhow::Result<()> {
        let folder_name = format!("snap_{}", timestamp);
        let target_dir = self.storage_dir.join(folder_name);
        let meta_file = target_dir.join("snapshot_metadata.json");
        
        if !meta_file.exists() {
            return Err(anyhow::anyhow!("Snapshot not found"));
        }
        
        let content = fs::read_to_string(&meta_file)?;
        let snap: Snapshot = serde_json::from_str(&content)?;

        // FIX Flaw 3: Create a safety backup of the CURRENT configuration before restoring,
        // so the user can undo an accidental restore. This is critical for a recovery system.
        if let Err(e) = self.create_snapshot(
            &format!("Auto-backup before restoring snapshot from {}", snap.date_string),
            distro
        ) {
            eprintln!("Warning: Failed to create pre-restore backup: {}", e);
            // Continue with restore even if backup fails — the user explicitly requested it
        }

        if snap.default_grub_backup.exists() {
            fs::copy(&snap.default_grub_backup, &distro.default_grub_path)?;
        } else {
            return Err(anyhow::anyhow!(
                "Snapshot backup file {:?} is missing from disk. Cannot restore.",
                snap.default_grub_backup
            ));
        }

        if let Some(cfg_bak) = snap.grub_cfg_backup {
            if cfg_bak.exists() {
                fs::copy(&cfg_bak, &distro.grub_cfg_path)?;
            }
        }

        let overrides_path = crate::menu_entries::MenuEntryParser::get_overrides_path(distro);
        if let Some(ref bls_bak) = snap.bls_entries_backup {
            if bls_bak.exists() {
                fs::copy(bls_bak, &overrides_path)?;
            }
        } else {
            // If the snapshot has no overrides, we remove the current overrides to accurately restore state
            if overrides_path.exists() {
                let _ = fs::remove_file(&overrides_path);
            }
        }

        Ok(())
    }

    pub fn get_snapshot_details(&self, timestamp: i64) -> anyhow::Result<(crate::default_grub::GrubDefaultConfig, Vec<crate::menu_entries::BootEntry>)> {
        let folder_name = format!("snap_{}", timestamp);
        let target_dir = self.storage_dir.join(folder_name);
        let meta_file = target_dir.join("snapshot_metadata.json");
        
        if !meta_file.exists() {
            return Err(anyhow::anyhow!("Snapshot not found"));
        }
        
        let content = fs::read_to_string(&meta_file)?;
        let snap: Snapshot = serde_json::from_str(&content)?;

        let config_str = if snap.default_grub_backup.exists() {
            fs::read_to_string(&snap.default_grub_backup).unwrap_or_default()
        } else {
            String::new()
        };
        let config = crate::default_grub::GrubDefaultConfig::parse_str(&config_str);

        let overrides = if let Some(bls_bak) = snap.bls_entries_backup {
            if bls_bak.exists() {
                let j = fs::read_to_string(&bls_bak).unwrap_or_default();
                serde_json::from_str(&j).unwrap_or_default()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        Ok((config, overrides))
    }
}

fn rust_running_as_root() -> bool {
    // FIX Flaw 7: Use the actual effective UID from the kernel instead of the
    // easily spoofable $USER environment variable. geteuid() is the standard
    // POSIX way to check if a process has root privileges.
    #[cfg(unix)]
    {
        unsafe { libc::geteuid() == 0 }
    }
    #[cfg(not(unix))]
    {
        false
    }
}
