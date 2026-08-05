use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::distro::BootloaderConfig;
use crate::bls::BlsManager;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BootEntry {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<String>,
    pub enabled: bool,
    pub deleted: bool,
    pub is_current: bool,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub is_custom: bool,
}

impl BootEntry {
    pub fn classify_type(title: &str, options: Option<&str>) -> String {
        let t_lower = title.to_lowercase();
        let o_lower = options.unwrap_or("").to_lowercase();
        if t_lower.contains("windows") {
            "windows".to_string()
        } else if t_lower.contains("recovery") || t_lower.contains("advanced") || o_lower.contains("single") || o_lower.contains("init=/bin/sh") {
            "recovery".to_string()
        } else if t_lower.contains("uefi") || t_lower.contains("firmware") {
            "efi".to_string()
        } else if t_lower.contains("custom") {
            "custom".to_string()
        } else {
            "linux".to_string()
        }
    }
}

pub struct MenuEntryParser;

impl MenuEntryParser {
    pub fn parse_grub_cfg_str(content: &str, current_kernel: Option<&str>) -> Vec<BootEntry> {
        let mut entries = Vec::new();
        let mut in_menuentry = false;
        let mut current_title = String::new();
        let mut current_id: Option<String> = None;
        let mut current_options: Option<String> = None;
        let mut current_version: Option<String> = None;
        let mut idx = 0;

        for line in content.lines() {
            let trimmed = line.trim();
            
            // Check for start of menuentry
            if trimmed.starts_with("menuentry ") || trimmed.starts_with("menuentry\t") {
                in_menuentry = true;
                current_title.clear();
                current_id = None;
                current_options = None;
                current_version = None;

                // Extract title enclosed in single or double quotes
                if let Some(start) = trimmed.find('\'').or_else(|| trimmed.find('"')) {
                    let quote_char = &trimmed[start..=start];
                    let remainder = &trimmed[start + 1..];
                    if let Some(end) = remainder.find(quote_char) {
                        current_title = remainder[..end].to_string();
                    }
                }
                if current_title.is_empty() {
                    current_title = format!("Boot Option #{}", idx + 1);
                }

                // Try extracting menuentry ID
                if let Some(id_idx) = trimmed.find("$menuentry_id_option ") {
                    let part = &trimmed[id_idx + "$menuentry_id_option ".len()..].trim();
                    if let Some(start) = part.find('\'').or_else(|| part.find('"')) {
                        let q = &part[start..=start];
                        let rem = &part[start + 1..];
                        if let Some(end) = rem.find(q) {
                            current_id = Some(rem[..end].to_string());
                        }
                    } else if !part.is_empty() {
                        current_id = Some(part.trim_end_matches('{').trim().to_string());
                    }
                }
                if current_id.is_none() {
                    current_id = Some(format!("entry-{}", idx));
                }
            } else if in_menuentry && (trimmed.starts_with("linux ") || trimmed.starts_with("linuxefi ") || trimmed.starts_with("linux16 ") || trimmed.starts_with("kernel ")) {
                // Parse kernel line for version and options
                let mut parts = trimmed.split_whitespace();
                let _cmd = parts.next();
                if let Some(kernel_path) = parts.next() {
                    // Try to extract version string from filename e.g. vmlinuz-6.8.0-45-generic
                    if let Some(idx) = kernel_path.find("vmlinuz-").or_else(|| kernel_path.find("vmlinux-")).or_else(|| kernel_path.find("kernel-")) {
                        let ver = &kernel_path[idx..];
                        if let Some(hyphen) = ver.find('-') {
                            current_version = Some(ver[hyphen + 1..].to_string());
                        }
                    }
                }
                let options: Vec<&str> = parts.collect();
                if !options.is_empty() {
                    current_options = Some(options.join(" "));
                }
            } else if in_menuentry && trimmed == "}" {
                in_menuentry = false;
                let entry_type = BootEntry::classify_type(&current_title, current_options.as_deref());
                
                let is_current = if let (Some(ref cur_ker), Some(ref ver)) = (current_kernel, &current_version) {
                    entry_type == "linux" && (ver.contains(cur_ker) || cur_ker.contains(ver))
                } else if let Some(ref cur_ker) = current_kernel {
                    entry_type == "linux" && current_title.contains(cur_ker)
                } else {
                    false
                };

                entries.push(BootEntry {
                    title: current_title.clone(),
                    id: current_id.take(),
                    version: current_version.take(),
                    options: current_options.take(),
                    enabled: true,
                    deleted: false,
                    is_current,
                    entry_type,
                    is_custom: false,
                });
                idx += 1;
            }
        }

        // If no Linux entry was marked as current, but there is at least one "linux" type entry and we are running on Linux, set the first linux entry as current if we couldn't match versions
        if !entries.iter().any(|e| e.is_current) && cfg!(target_os = "linux") {
            if let Some(first_linux) = entries.iter_mut().find(|e| e.entry_type == "linux" && !e.title.to_lowercase().contains("recovery")) {
                first_linux.is_current = true;
            }
        }

        entries
    }

    pub fn read_system_kernel_version() -> Option<String> {
        if let Ok(ver) = fs::read_to_string("/proc/sys/kernel/osrelease") {
            Some(ver.trim().to_string())
        } else {
            None
        }
    }

    pub fn get_system_boot_entries(config: &BootloaderConfig) -> anyhow::Result<Vec<BootEntry>> {
        let current_kernel = Self::read_system_kernel_version();
        
        if config.uses_bls {
            let entries_dir = Path::new("/boot/loader/entries");
            let bls_entries = BlsManager::load_entries(entries_dir)?;
            if !bls_entries.is_empty() {
                let mut out = Vec::new();
                for (idx, bls) in bls_entries.into_iter().enumerate() {
                    let entry_type = BootEntry::classify_type(&bls.title, Some(&bls.options));
                    let is_current = if let Some(ref cur_ker) = current_kernel {
                        entry_type == "linux" && (bls.version.contains(cur_ker) || cur_ker.contains(&bls.version))
                    } else {
                        idx == 0 && entry_type == "linux"
                    };
                    out.push(BootEntry {
                        title: bls.title,
                        id: bls.id.or_else(|| Some(format!("bls-{}", idx))),
                        version: if bls.version.is_empty() { None } else { Some(bls.version) },
                        options: if bls.options.is_empty() { None } else { Some(bls.options) },
                        enabled: true,
                        deleted: false,
                        is_current,
                        entry_type,
                        is_custom: false,
                    });
                }
                // Check if we need a fallback for is_current
                if !out.iter().any(|e| e.is_current) && cfg!(target_os = "linux") {
                    if let Some(first_linux) = out.iter_mut().find(|e| e.entry_type == "linux") {
                        first_linux.is_current = true;
                    }
                }
                return Ok(out);
            }
        }

        let content = fs::read_to_string(&config.grub_cfg_path)?;
        Ok(Self::parse_grub_cfg_str(&content, current_kernel.as_deref()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_grub_cfg() {
        let cfg = r#"
menuentry 'Ubuntu, with Linux 6.8.0-45-generic' --class ubuntu --class gnu-linux --class gnu --class os $menuentry_id_option 'gnulinux-6.8.0-45-generic' {
    recordfail
    load_video
    gfxmode $linux_gfx_mode
    insmod gzio
    linux /boot/vmlinuz-6.8.0-45-generic root=UUID=1234 ro quiet splash
    initrd /boot/initrd.img-6.8.0-45-generic
}
menuentry 'Ubuntu, with Linux 6.8.0-45-generic (recovery mode)' --class ubuntu --class gnu-linux {
    linux /boot/vmlinuz-6.8.0-45-generic root=UUID=1234 ro single nomodeset
}
menuentry 'Windows Boot Manager (on /dev/nvme0n1p1)' --class windows --class os {
    chainloader /EFI/Microsoft/Boot/bootmgfw.efi
}
"#;
        let entries = MenuEntryParser::parse_grub_cfg_str(cfg, Some("6.8.0-45-generic"));
        assert_eq!(entries.len(), 3);
        
        assert_eq!(entries[0].title, "Ubuntu, with Linux 6.8.0-45-generic");
        assert_eq!(entries[0].id, Some("gnulinux-6.8.0-45-generic".to_string()));
        assert_eq!(entries[0].version, Some("6.8.0-45-generic".to_string()));
        assert_eq!(entries[0].options, Some("root=UUID=1234 ro quiet splash".to_string()));
        assert_eq!(entries[0].entry_type, "linux");
        assert_eq!(entries[0].is_current, true);

        assert_eq!(entries[1].title, "Ubuntu, with Linux 6.8.0-45-generic (recovery mode)");
        assert_eq!(entries[1].entry_type, "recovery");
        assert_eq!(entries[1].is_current, false);

        assert_eq!(entries[2].title, "Windows Boot Manager (on /dev/nvme0n1p1)");
        assert_eq!(entries[2].entry_type, "windows");
        assert_eq!(entries[2].is_current, false);
    }
}
