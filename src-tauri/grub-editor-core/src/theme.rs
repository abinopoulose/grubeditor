use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeMetadata {
    pub name: String,
    pub path: PathBuf,
    pub is_valid: bool,
    pub validation_errors: Vec<String>,
    pub has_pf2_fonts: bool,
    pub background_image: Option<String>,
    pub title_text: Option<String>,
    pub item_color: String,
    pub selected_item_color: String,
    pub terminal_box: Option<String>,
    pub menu_box_top: Option<String>,
    pub menu_box_left: Option<String>,
    pub menu_box_width: Option<String>,
    pub menu_box_height: Option<String>,
}

pub struct ThemeValidator;

impl ThemeValidator {
    /// Conducts thorough independent post-installation verification on a GRUB theme directory
    pub fn inspect_theme(theme_dir: &Path) -> anyhow::Result<ThemeMetadata> {
        let name = theme_dir.file_name().map_or("Unnamed".to_string(), |s| s.to_string_lossy().to_string());
        let mut validation_errors = Vec::new();

        if !theme_dir.exists() || !theme_dir.is_dir() {
            return Err(anyhow::anyhow!("Theme directory does not exist or is not a directory: {:?}", theme_dir));
        }

        // Check for theme.txt
        let theme_txt_path = theme_dir.join("theme.txt");
        if !theme_txt_path.exists() {
            validation_errors.push("Missing primary configuration file: theme.txt".to_string());
        }

        // Check for compiled bitmap fonts (.pf2)
        let mut has_pf2_fonts = false;
        if let Ok(entries) = fs::read_dir(theme_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().map_or(false, |ext| ext == "pf2") {
                    has_pf2_fonts = true;
                    break;
                }
            }
        }
        if !has_pf2_fonts {
            validation_errors.push("Warning: No compiled GRUB fonts (.pf2) found in theme folder. May fall back to ugly unstyled text during boot!".to_string());
        }

        // Verify read filesystem permissions (check if readable without root)
        match fs::read_dir(theme_dir) {
            Err(_) => validation_errors.push("Error: Cannot read theme directory contents due to strict filesystem permissions. GRUB requires 0755 for directories and 0644 for files!".to_string()),
            Ok(entries) => {
                for entry in entries.flatten() {
                    if fs::metadata(entry.path()).is_err() {
                        validation_errors.push(format!("Permission error on file: {:?}", entry.file_name()));
                    }
                }
            }
        }

        // Parse theme.txt for preview styling
        let mut background_image = None;
        let mut title_text = None;
        let mut item_color = "#cccccc".to_string();
        let mut selected_item_color = "#ffffff".to_string();
        let mut terminal_box = None;
        let mut menu_box_top = None;
        let mut menu_box_left = None;
        let mut menu_box_width = None;
        let mut menu_box_height = None;

        if let Ok(content) = fs::read_to_string(&theme_txt_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some((k, v)) = trimmed.split_once(':') {
                    let key = k.trim().to_lowercase();
                    let val = v.trim().trim_matches('"').trim_matches('\'').trim().to_string();
                    match key.as_str() {
                        "desktop-image" => background_image = Some(val),
                        "title-text" => title_text = Some(val),
                        "item_color" | "item-color" => item_color = val,
                        "selected_item_color" | "selected-item-color" => selected_item_color = val,
                        "terminal-box" => terminal_box = Some(val),
                        "left" => menu_box_left = Some(val),
                        "top" => menu_box_top = Some(val),
                        "width" => menu_box_width = Some(val),
                        "height" => menu_box_height = Some(val),
                        _ => {}
                    }
                }
            }
        }

        if let Some(ref bg) = background_image {
            let bg_path = theme_dir.join(bg);
            if !bg_path.exists() {
                validation_errors.push(format!("Specified background image '{}' in theme.txt does not exist!", bg));
            }
        }

        // FIX Flaw 10: Explicitly separate hard validation errors from soft warnings.
        // The old logic `errors.len() == 1 && !has_pf2_fonts` was fragile and would break
        // if any new validation check was ever added. Missing .pf2 fonts is a warning,
        // not a hard error — GRUB can still render the theme with fallback fonts.
        let hard_error_count = validation_errors.iter().filter(|e| {
            !e.starts_with("Warning:")
        }).count();
        let is_valid = hard_error_count == 0;

        Ok(ThemeMetadata {
            name,
            path: theme_dir.to_path_buf(),
            is_valid,
            validation_errors,
            has_pf2_fonts,
            background_image,
            title_text,
            item_color,
            selected_item_color,
            terminal_box,
            menu_box_top,
            menu_box_left,
            menu_box_width,
            menu_box_height,
        })
    }

    /// Scans a directory (e.g. /boot/grub/themes) and inspects all installed themes
    pub fn scan_themes_directory(themes_root: &Path) -> anyhow::Result<Vec<ThemeMetadata>> {
        let mut themes = Vec::new();
        if !themes_root.exists() || !themes_root.is_dir() {
            return Ok(themes);
        }

        for entry in fs::read_dir(themes_root)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                if let Ok(meta) = Self::inspect_theme(&path) {
                    themes.push(meta);
                }
            }
        }
        Ok(themes)
    }
}

// automated unit test for parser and validation logic
#[cfg(test)]
mod tests {
    use super::*;
    use crate::default_grub::GrubDefaultConfig;

    #[test]
    fn test_grub_config_idempotency() {
        let original = "# Sample GRUB\nGRUB_DEFAULT=0\nGRUB_TIMEOUT=5\nGRUB_CMDLINE_LINUX_DEFAULT=\"quiet splash\"\n";
        let mut parsed = GrubDefaultConfig::parse_str(original);
        assert_eq!(parsed.get_value("GRUB_TIMEOUT"), Some(&"5".to_string()));
        parsed.set_value("GRUB_TIMEOUT", "10");
        assert_eq!(parsed.get_value("GRUB_TIMEOUT"), Some(&"10".to_string()));
        assert_eq!(parsed.to_config_string(), "# Sample GRUB\nGRUB_DEFAULT=0\nGRUB_TIMEOUT=10\nGRUB_CMDLINE_LINUX_DEFAULT=\"quiet splash\"\n");
    }
}
