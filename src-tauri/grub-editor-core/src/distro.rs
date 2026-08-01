use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DistroFamily {
    DebianUbuntu,
    FedoraRHEL,
    ArchLinux,
    OpenSuse,
    GenericLinux,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootloaderConfig {
    pub distro_name: String,
    pub family: DistroFamily,
    pub default_grub_path: PathBuf,
    pub grub_dir: PathBuf,
    pub grub_cfg_path: PathBuf,
    pub themes_dir: PathBuf,
    pub regen_command: Vec<String>,
    pub uses_bls: bool,
}

impl BootloaderConfig {
    /// Automatically detects the host Linux distribution and resolves accurate GRUB asset paths and generator commands.
    pub fn detect() -> Self {
        let (distro_name, family) = Self::parse_os_release();
        let default_grub_path = PathBuf::from("/etc/default/grub");

        // Determine grub directory (/boot/grub2 vs /boot/grub)
        let grub_dir = if Path::new("/boot/grub2").exists() || family == DistroFamily::FedoraRHEL {
            PathBuf::from("/boot/grub2")
        } else {
            PathBuf::from("/boot/grub")
        };

        let grub_cfg_path = grub_dir.join("grub.cfg");

        // Resolve themes directory: prefer grub_dir/themes, fallback to /usr/share/grub/themes
        let themes_dir = if grub_dir.join("themes").exists() {
            grub_dir.join("themes")
        } else if Path::new("/usr/share/grub/themes").exists() {
            PathBuf::from("/usr/share/grub/themes")
        } else {
            grub_dir.join("themes")
        };

        // Determine regeneration command based on distro family and installed utilities
        let regen_command = match family {
            DistroFamily::DebianUbuntu => {
                if Path::new("/usr/sbin/update-grub").exists() || Path::new("/sbin/update-grub").exists() {
                    vec!["update-grub".to_string()]
                } else {
                    vec!["grub-mkconfig".to_string(), "-o".to_string(), grub_cfg_path.to_string_lossy().to_string()]
                }
            }
            DistroFamily::FedoraRHEL | DistroFamily::OpenSuse => {
                vec!["grub2-mkconfig".to_string(), "-o".to_string(), grub_cfg_path.to_string_lossy().to_string()]
            }
            _ => {
                vec!["grub-mkconfig".to_string(), "-o".to_string(), grub_cfg_path.to_string_lossy().to_string()]
            }
        };

        // Check if Boot Loader Specification (BLS) is active (Fedora/RHEL style)
        let uses_bls = Path::new("/boot/loader/entries").exists() && (
            family == DistroFamily::FedoraRHEL || {
                if let Ok(content) = fs::read_to_string(&default_grub_path) {
                    content.lines().any(|l| l.trim() == "GRUB_ENABLE_BLSCFG=true" || l.trim() == "GRUB_ENABLE_BLSCFG=1")
                } else {
                    false
                }
            }
        );

        Self {
            distro_name,
            family,
            default_grub_path,
            grub_dir,
            grub_cfg_path,
            themes_dir,
            regen_command,
            uses_bls,
        }
    }

    fn parse_os_release() -> (String, DistroFamily) {
        let os_release = match fs::read_to_string("/etc/os-release") {
            Ok(s) => s,
            Err(_) => return ("Unknown Linux".to_string(), DistroFamily::GenericLinux),
        };

        let mut name = "Generic Linux".to_string();
        let mut id = String::new();
        let mut id_like = String::new();

        for line in os_release.lines() {
            if let Some((k, v)) = line.split_once('=') {
                let clean_v = v.trim().trim_matches('"').trim_matches('\'').to_lowercase();
                match k.trim() {
                    "NAME" | "PRETTY_NAME" => name = v.trim().trim_matches('"').trim_matches('\'').to_string(),
                    "ID" => id = clean_v,
                    "ID_LIKE" => id_like = clean_v,
                    _ => {}
                }
            }
        }

        let combined_ids = format!("{} {}", id, id_like);

        let family = if combined_ids.contains("ubuntu") || combined_ids.contains("debian") || combined_ids.contains("pop") || combined_ids.contains("mint") || combined_ids.contains("elementary") {
            DistroFamily::DebianUbuntu
        } else if combined_ids.contains("fedora") || combined_ids.contains("rhel") || combined_ids.contains("centos") || combined_ids.contains("alma") || combined_ids.contains("rocky") {
            DistroFamily::FedoraRHEL
        } else if combined_ids.contains("arch") || combined_ids.contains("manjaro") || combined_ids.contains("endeavouros") || combined_ids.contains("cachyos") {
            DistroFamily::ArchLinux
        } else if combined_ids.contains("suse") || combined_ids.contains("sles") {
            DistroFamily::OpenSuse
        } else {
            DistroFamily::GenericLinux
        };

        (name, family)
    }
}
