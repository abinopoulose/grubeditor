use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BlsEntry {
    pub filepath: PathBuf,
    pub title: String,
    pub version: String,
    pub linux: String,
    pub initrd: Vec<String>,
    pub options: String,
    pub id: Option<String>,
}

impl BlsEntry {
    pub fn parse_file(path: &Path) -> anyhow::Result<Self> {
        let content = fs::read_to_string(path)?;
        let mut title = String::new();
        let mut version = String::new();
        let mut linux = String::new();
        let mut initrd = Vec::new();
        let mut options = String::new();
        let mut id = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('#') || trimmed.is_empty() {
                continue;
            }
            if let Some((key, val)) = trimmed.split_once(' ') {
                let k = key.trim();
                let v = val.trim().to_string();
                match k {
                    "title" => title = v,
                    "version" => version = v,
                    "linux" => linux = v,
                    "initrd" => initrd.push(v),
                    "options" => options = v,
                    "id" => id = Some(v),
                    _ => {}
                }
            }
        }

        Ok(Self {
            filepath: path.to_path_buf(),
            title: if title.is_empty() { path.file_stem().map_or("Untitled Entry".to_string(), |s| s.to_string_lossy().to_string()) } else { title },
            version,
            linux,
            initrd,
            options,
            id,
        })
    }

    pub fn to_config_string(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!("title {}\n", self.title));
        if !self.version.is_empty() {
            out.push_str(&format!("version {}\n", self.version));
        }
        if let Some(ref id_str) = self.id {
            out.push_str(&format!("id {}\n", id_str));
        }
        if !self.linux.is_empty() {
            out.push_str(&format!("linux {}\n", self.linux));
        }
        for i in &self.initrd {
            out.push_str(&format!("initrd {}\n", i));
        }
        if !self.options.is_empty() {
            out.push_str(&format!("options {}\n", self.options));
        }
        out
    }

    pub fn save(&self) -> anyhow::Result<()> {
        fs::write(&self.filepath, self.to_config_string())?;
        Ok(())
    }
}

pub struct BlsManager;

impl BlsManager {
    /// Loads all BLSCFG entries from /boot/loader/entries/ sorted by modification or version
    pub fn load_entries(entries_dir: &Path) -> anyhow::Result<Vec<BlsEntry>> {
        let mut entries = Vec::new();
        if !entries_dir.exists() {
            return Ok(entries);
        }

        for entry in fs::read_dir(entries_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "conf") {
                if let Ok(bls) = BlsEntry::parse_file(&path) {
                    entries.push(bls);
                }
            }
        }
        // Sort entries by title / version descending
        entries.sort_by(|a, b| b.version.cmp(&a.version));
        Ok(entries)
    }
}
