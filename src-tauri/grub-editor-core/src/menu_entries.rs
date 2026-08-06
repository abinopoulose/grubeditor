use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::distro::BootloaderConfig;
use crate::bls::BlsManager;

fn default_enabled() -> bool { true }
fn default_entry_type() -> String { "custom".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BootEntry {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub deleted: bool,
    #[serde(default)]
    pub is_current: bool,
    #[serde(rename = "type", default = "default_entry_type")]
    pub entry_type: String,
    #[serde(default)]
    pub is_custom: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub order: Option<usize>,
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
                    original_title: Some(current_title.clone()),
                    version: current_version.take(),
                    options: current_options.take(),
                    enabled: true,
                    deleted: false,
                    is_current,
                    entry_type,
                    is_custom: false,
                    order: Some(idx),
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
                        title: bls.title.clone(),
                        id: bls.id.or_else(|| Some(format!("bls-{}", idx))),
                        original_title: Some(bls.title),
                        version: if bls.version.is_empty() { None } else { Some(bls.version) },
                        options: if bls.options.is_empty() { None } else { Some(bls.options) },
                        enabled: true,
                        deleted: false,
                        is_current,
                        entry_type,
                        is_custom: false,
                        order: Some(idx),
                    });
                }
                if !out.iter().any(|e| e.is_current) && cfg!(target_os = "linux") {
                    if let Some(first_linux) = out.iter_mut().find(|e| e.entry_type == "linux") {
                        first_linux.is_current = true;
                    }
                }
                let overrides = Self::load_overrides(config);
                return Ok(Self::merge_with_overrides(out, &overrides));
            }
        }

        let content = fs::read_to_string(&config.grub_cfg_path)?;
        let entries = Self::parse_grub_cfg_str(&content, current_kernel.as_deref());
        let overrides = Self::load_overrides(config);
        Ok(Self::merge_with_overrides(entries, &overrides))
    }

    pub fn get_overrides_path(config: &BootloaderConfig) -> std::path::PathBuf {
        config.grub_dir.join("grub-editor-entries.json")
    }

    pub fn load_overrides(config: &BootloaderConfig) -> Vec<BootEntry> {
        let path = Self::get_overrides_path(config);
        if let Ok(content) = fs::read_to_string(path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    pub fn merge_with_overrides(mut system_entries: Vec<BootEntry>, overrides: &[BootEntry]) -> Vec<BootEntry> {
        if overrides.is_empty() {
            for e in &mut system_entries {
                if e.original_title.is_none() {
                    e.original_title = Some(e.title.clone());
                }
            }
            return system_entries;
        }
        let mut matched = vec![false; system_entries.len()];
        let mut result = Vec::new();

        for ov in overrides {
            let mut match_idx = None;
            if let Some(ref ov_id) = ov.id {
                if !ov_id.starts_with("sys-entry-") && !ov_id.starts_with("entry-") && !ov_id.starts_with("bls-") {
                    match_idx = system_entries.iter().enumerate().position(|(idx, sys)| !matched[idx] && sys.id.as_deref() == Some(ov_id.as_str()));
                }
            }
            if match_idx.is_none() {
                match_idx = system_entries.iter().enumerate().position(|(idx, sys)| {
                    if matched[idx] { return false; }
                    let sys_orig = sys.original_title.as_ref().unwrap_or(&sys.title);
                    let ov_orig = ov.original_title.as_ref().unwrap_or(&ov.title);
                    ov_orig == sys_orig || &ov.title == &sys.title || ov_orig == &sys.title
                });
            }
            if match_idx.is_none() && ov.id.is_some() {
                let id_str = ov.id.as_ref().unwrap();
                if id_str.starts_with("entry-") || id_str.starts_with("sys-entry-") {
                    let num_part = id_str.split('-').last().unwrap_or("");
                    if let Ok(pos) = num_part.parse::<usize>() {
                        if pos < system_entries.len() && !matched[pos] {
                            match_idx = Some(pos);
                        }
                    }
                }
            }

            if let Some(idx) = match_idx {
                matched[idx] = true;
            }

            if ov.deleted {
                let mut item = ov.clone();
                item.deleted = true;
                item.enabled = false;
                result.push(item);
            } else if let Some(idx) = match_idx {
                let mut merged = system_entries[idx].clone();
                merged.title = ov.title.clone();
                merged.original_title = ov.original_title.clone().or_else(|| Some(system_entries[idx].title.clone()));
                merged.enabled = ov.enabled;
                merged.deleted = false;
                result.push(merged);
            } else {
                let mut item = ov.clone();
                item.deleted = false;
                result.push(item);
            }
        }

        for (idx, mut sys) in system_entries.into_iter().enumerate() {
            if !matched[idx] {
                if sys.original_title.is_none() {
                    sys.original_title = Some(sys.title.clone());
                }
                result.push(sys);
            }
        }

        result
    }

    pub fn apply_overrides_to_grub_cfg(cfg_path: &std::path::Path, overrides: &[BootEntry]) -> anyhow::Result<()> {
        if overrides.is_empty() || !cfg_path.exists() {
            return Ok(());
        }
        let content = fs::read_to_string(cfg_path)?;
        let updated = Self::apply_overrides_to_str(&content, overrides);
        fs::write(cfg_path, updated)?;
        Ok(())
    }

    pub fn apply_overrides_to_str(content: &str, overrides: &[BootEntry]) -> String {
        if overrides.is_empty() {
            return content.to_string();
        }

        struct ExtractedBlock {
            id: String,
            title: String,
            lines: Vec<String>,
        }

        let lines: Vec<&str> = content.lines().collect();
        let mut output_lines: Vec<String> = Vec::new();
        let mut extracted_blocks: Vec<ExtractedBlock> = Vec::new();
        let mut first_menu_idx: Option<usize> = None;
        
        let mut i = 0;
        let mut entry_count = 0;

        while i < lines.len() {
            let line = lines[i];
            let trimmed = line.trim();

            if trimmed.starts_with("submenu ") || trimmed.starts_with("submenu\t") {
                if first_menu_idx.is_none() {
                    first_menu_idx = Some(output_lines.len());
                }
                i += 1;
                continue;
            }
            if trimmed == "}" && first_menu_idx.is_some() && output_lines.len() >= first_menu_idx.unwrap() {
                i += 1;
                continue;
            }

            if trimmed.starts_with("menuentry ") || trimmed.starts_with("menuentry\t") {
                if first_menu_idx.is_none() {
                    first_menu_idx = Some(output_lines.len());
                }
                let mut title = "Unknown Entry".to_string();
                if let Some(start) = trimmed.find('\'').or_else(|| trimmed.find('"')) {
                    let quote_char = &trimmed[start..=start];
                    let remainder = &trimmed[start + 1..];
                    if let Some(end) = remainder.find(quote_char) {
                        title = remainder[..end].to_string();
                    }
                }

                let mut id = format!("entry-{}", entry_count);
                if let Some(id_idx) = trimmed.find("$menuentry_id_option ") {
                    let part = &trimmed[id_idx + "$menuentry_id_option ".len()..].trim();
                    if let Some(start) = part.find('\'').or_else(|| part.find('"')) {
                        let q = &part[start..=start];
                        let rem = &part[start + 1..];
                        if let Some(end) = rem.find(q) {
                            id = rem[..end].to_string();
                        }
                    }
                }

                let mut block_lines: Vec<String> = vec![line.to_string()];
                let mut brace_depth: i32 = line.chars().filter(|&c| c == '{').count() as i32 - line.chars().filter(|&c| c == '}').count() as i32;
                let mut j = i + 1;
                while j < lines.len() && (brace_depth > 0 || (brace_depth == 0 && !lines[j].contains('{'))) {
                    let bline = lines[j];
                    block_lines.push(bline.to_string());
                    brace_depth += bline.chars().filter(|&c| c == '{').count() as i32 - bline.chars().filter(|&c| c == '}').count() as i32;
                    if brace_depth <= 0 && bline.contains('}') {
                        j += 1;
                        break;
                    }
                    j += 1;
                }
                extracted_blocks.push(ExtractedBlock { id, title, lines: block_lines });
                entry_count += 1;
                i = j;
                continue;
            }

            output_lines.push(line.to_string());
            i += 1;
        }

        if first_menu_idx.is_none() || extracted_blocks.is_empty() {
            return content.to_string();
        }
        let insert_pos = first_menu_idx.unwrap();

        let mut processed_blocks: Vec<(usize, String)> = Vec::new();
        let mut matched_orig = vec![false; extracted_blocks.len()];

        for (ov_idx, ov) in overrides.iter().enumerate() {
            let mut match_idx = None;
            if let Some(ref ov_id) = ov.id {
                if !ov_id.starts_with("sys-entry-") && !ov_id.starts_with("entry-") && !ov_id.starts_with("bls-") {
                    match_idx = extracted_blocks.iter().enumerate().position(|(idx, b)| !matched_orig[idx] && &b.id == ov_id);
                }
            }
            if match_idx.is_none() {
                match_idx = extracted_blocks.iter().enumerate().position(|(idx, b)| {
                    if matched_orig[idx] { return false; }
                    let ov_orig = ov.original_title.as_ref().unwrap_or(&ov.title);
                    ov_orig == &b.title || &ov.title == &b.title
                });
            }
            if match_idx.is_none() && ov.id.is_some() {
                let id_str = ov.id.as_ref().unwrap();
                let num_part = id_str.split('-').last().unwrap_or("");
                if let Ok(pos) = num_part.parse::<usize>() {
                    if pos < extracted_blocks.len() && !matched_orig[pos] {
                        match_idx = Some(pos);
                    }
                }
            }

            if let Some(idx) = match_idx {
                matched_orig[idx] = true;
            }

            if ov.deleted || !ov.enabled {
                continue;
            }

            if let Some(idx) = match_idx {
                let mut block = extracted_blocks[idx].lines.clone();
                let first = &block[0];
                let orig_title = &extracted_blocks[idx].title;
                if &ov.title != orig_title && first.contains(orig_title) {
                    block[0] = first.replace(orig_title, &ov.title);
                }
                processed_blocks.push((ov_idx, block.join("\n")));
            }
        }

        for (idx, block) in extracted_blocks.into_iter().enumerate() {
            if !matched_orig[idx] {
                processed_blocks.push((processed_blocks.len() + 1000, block.lines.join("\n")));
            }
        }

        processed_blocks.sort_by_key(|k| k.0);
        let final_menu_section = processed_blocks.into_iter().map(|k| k.1).collect::<Vec<_>>().join("\n\n");
        
        output_lines.insert(insert_pos, final_menu_section);
        output_lines.join("\n")
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
        assert_eq!(entries[2].original_title, Some("Windows Boot Manager (on /dev/nvme0n1p1)".to_string()));
    }

    #[test]
    fn test_apply_overrides_to_str() {
        let cfg = r#"# GRUB cfg header
set default=0
menuentry 'Ubuntu 24.04' $menuentry_id_option 'ubuntu' {
    linux /vmlinuz root=UUID=123
}
menuentry 'Windows 11' $menuentry_id_option 'windows' {
    chainloader /EFI/Boot/bootmgfw.efi
}
# GRUB cfg footer"#;
        
        let overrides = vec![
            BootEntry {
                title: "Windows Gaming Edition".to_string(),
                original_title: Some("Windows 11".to_string()),
                id: Some("windows".to_string()),
                version: None,
                options: None,
                enabled: true,
                deleted: false,
                is_current: false,
                entry_type: "windows".to_string(),
                is_custom: false,
                order: Some(0),
            },
            BootEntry {
                title: "Ubuntu 24.04".to_string(),
                original_title: Some("Ubuntu 24.04".to_string()),
                id: Some("ubuntu".to_string()),
                version: None,
                options: None,
                enabled: true,
                deleted: true, // Mark Ubuntu deleted!
                is_current: false,
                entry_type: "linux".to_string(),
                is_custom: false,
                order: Some(1),
            }
        ];

        let out = MenuEntryParser::apply_overrides_to_str(cfg, &overrides);
        assert!(out.contains("menuentry 'Windows Gaming Edition'"));
        assert!(!out.contains("menuentry 'Ubuntu 24.04'"));
    }
}
