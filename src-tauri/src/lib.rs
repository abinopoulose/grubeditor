use grub_editor_core::distro::BootloaderConfig;
use grub_editor_core::default_grub::{GrubDefaultConfig, ConfigLine};
use grub_editor_core::menu_entries::{BootEntry, MenuEntryParser};
use grub_editor_core::snapshots::{Snapshot, SnapshotManager};
use grub_editor_core::theme::{ThemeMetadata, ThemeValidator};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

// Helper to locate grub-editor-helper binary
fn get_helper_path() -> PathBuf {
    let dev_paths = [
        Path::new("target/debug/grub-editor-helper"),
        Path::new("target/release/grub-editor-helper"),
        Path::new("../target/debug/grub-editor-helper"),
        Path::new("../target/release/grub-editor-helper"),
    ];
    for p in &dev_paths {
        if p.exists() {
            if let Ok(abs) = p.canonicalize() {
                return abs;
            }
        }
    }
    if Path::new("/usr/bin/grub-editor-helper").exists() {
        PathBuf::from("/usr/bin/grub-editor-helper")
    } else {
        PathBuf::from("grub-editor-helper")
    }
}

fn run_helper(args: &[&str], requires_root: bool) -> Result<String, String> {
    let helper = get_helper_path();
    let mut cmd = if requires_root && !BootloaderConfig::is_root() {
        let mut c = Command::new("pkexec");
        c.arg(&helper);
        c
    } else {
        Command::new(&helper)
    };

    for arg in args {
        cmd.arg(arg);
    }

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Helper failed ({}): {}", output.status, stderr))
            }
        }
        Err(e) => Err(format!("Failed to launch helper {:?}: {}", helper, e)),
    }
}

#[tauri::command]
async fn detect_distro() -> Result<BootloaderConfig, String> {
    Ok(BootloaderConfig::detect())
}

#[tauri::command]
async fn get_grub_config() -> Result<HashMap<String, String>, String> {
    let distro = BootloaderConfig::detect();
    let content = fs::read_to_string(&distro.default_grub_path).or_else(|_| {
        run_helper(&["read-config"], true)
    }).map_err(|e| format!("Failed to read GRUB config: {}", e))?;
    
    // Check if content is JSON produced by helper read-config or plain raw string from direct read
    let config = if let Ok(parsed_json) = serde_json::from_str::<GrubDefaultConfig>(&content) {
        parsed_json
    } else {
        GrubDefaultConfig::parse_str(&content)
    };

    let mut map = HashMap::new();
    for line in &config.lines {
        if let ConfigLine::KeyValue { key, value, .. } = line {
            map.insert(key.clone(), value.clone());
        }
    }
    Ok(map)
}

#[tauri::command]
async fn save_grub_config(new_config: HashMap<String, String>, _reason: Option<String>, _create_snapshot: Option<bool>) -> Result<bool, String> {
    let distro = BootloaderConfig::detect();
    let content = fs::read_to_string(&distro.default_grub_path).unwrap_or_default();
    let mut config = GrubDefaultConfig::parse_str(&content);
    
    for (k, v) in new_config {
        config.set_value(&k, &v);
    }
    
    let payload = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    run_helper(&["write-config", &payload], true)?;
    Ok(true)
}

#[tauri::command]
async fn get_boot_entries() -> Result<Vec<BootEntry>, String> {
    let distro = BootloaderConfig::detect();
    match MenuEntryParser::get_system_boot_entries(&distro) {
        Ok(entries) => Ok(entries),
        Err(_) => {
            // Permission denied or failure on /boot/grub/grub.cfg, invoke helper via polkit/pkexec
            let out = run_helper(&["read-boot-entries"], true)?;
            let entries: Vec<BootEntry> = serde_json::from_str(&out)
                .map_err(|e| format!("Failed to parse helper JSON output: {} (output: {})", e, out))?;
            Ok(entries)
        }
    }
}

#[tauri::command]
async fn save_boot_entries(new_entries: Vec<BootEntry>, _reason: Option<String>, _create_snapshot: Option<bool>) -> Result<bool, String> {
    let payload = serde_json::to_string(&new_entries).map_err(|e| e.to_string())?;
    run_helper(&["write-boot-entries", &payload], true)?;
    Ok(true)
}

#[tauri::command]
async fn scan_themes() -> Result<Vec<ThemeMetadata>, String> {
    let distro = BootloaderConfig::detect();
    match ThemeValidator::scan_themes_directory(&distro.themes_dir) {
        Ok(themes) => Ok(themes),
        Err(_) => {
            let out = run_helper(&["scan-themes"], false)?;
            serde_json::from_str(&out).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
async fn apply_theme(theme_name: String) -> Result<bool, String> {
    run_helper(&["apply-theme", &theme_name], true)?;
    Ok(true)
}

#[tauri::command]
async fn get_snapshots() -> Result<Vec<Snapshot>, String> {
    let mgr = SnapshotManager::new();
    mgr.list_snapshots().or_else(|_| {
        let out = run_helper(&["list-snapshots"], false)?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }).map_err(|e| e.to_string())
}

#[tauri::command]
async fn restore_snapshot(timestamp: i64) -> Result<bool, String> {
    let ts_str = timestamp.to_string();
    run_helper(&["restore-snapshot", &ts_str], true)?;
    Ok(true)
}

#[tauri::command]
async fn trigger_regen() -> Result<serde_json::Value, String> {
    let out = run_helper(&["regenerate"], true)?;
    let val: serde_json::Value = serde_json::from_str(&out)
        .unwrap_or_else(|_| serde_json::json!({ "success": true, "output": out }));
    Ok(val)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            detect_distro,
            get_grub_config,
            save_grub_config,
            get_boot_entries,
            save_boot_entries,
            scan_themes,
            apply_theme,
            get_snapshots,
            restore_snapshot,
            trigger_regen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
