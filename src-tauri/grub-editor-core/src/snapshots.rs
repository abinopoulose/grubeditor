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
}

pub struct SnapshotManager {
    storage_dir: PathBuf,
}

impl SnapshotManager {
    pub fn new() -> Self {
        // Use system directory if elevated/root, otherwise fallback to local dev user config
        let storage_dir = if rust_running_as_root() || Path::new("/var/lib/grub-editor/backups").exists() {
            PathBuf::from("/var/lib/grub-editor/backups")
        } else {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            PathBuf::from(home).join(".local/share/grub-editor/backups")
        };
        let _ = fs::create_dir_all(&storage_dir);
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
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
        let folder_name = format!("snap_{}", now);
        let target_dir = self.storage_dir.join(folder_name);
        fs::create_dir_all(&target_dir)?;

        let default_grub_backup = target_dir.join("default_grub.bak");
        if distro.default_grub_path.exists() {
            fs::copy(&distro.default_grub_path, &default_grub_backup)?;
        }

        let grub_cfg_backup = if distro.grub_cfg_path.exists() {
            let p = target_dir.join("grub.cfg.bak");
            let _ = fs::copy(&distro.grub_cfg_path, &p);
            Some(p)
        } else {
            None
        };

        let date_string = format!("{} (UTC Timestamp)", now);
        let snap = Snapshot {
            timestamp: now,
            date_string,
            description: description.to_string(),
            default_grub_backup,
            grub_cfg_backup,
            bls_entries_backup: None,
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

        if snap.default_grub_backup.exists() {
            fs::copy(&snap.default_grub_backup, &distro.default_grub_path)?;
        }

        if let Some(cfg_bak) = snap.grub_cfg_backup {
            if cfg_bak.exists() {
                fs::copy(&cfg_bak, &distro.grub_cfg_path)?;
            }
        }

        Ok(())
    }
}

fn rust_running_as_root() -> bool {
    #[cfg(unix)]
    {
        std::env::var("USER").map_or(false, |u| u == "root") || std::env::var("SUDO_USER").is_ok()
    }
    #[cfg(not(unix))]
    {
        false
    }
}
