use grub_editor_core::distro::BootloaderConfig;
use grub_editor_core::default_grub::GrubDefaultConfig;
use grub_editor_core::snapshots::SnapshotManager;
use grub_editor_core::theme::ThemeValidator;
use grub_editor_core::menu_entries::MenuEntryParser;
use std::env;
use std::fs;
use std::process::Command;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: grub-editor-helper <command> [args...]");
        eprintln!("Commands: detect-distro, read-config, write-config, read-boot-entries, scan-themes, apply-theme, regenerate, create-snapshot, list-snapshots, restore-snapshot");
        std::process::exit(1);
    }

    let distro = BootloaderConfig::detect();
    let snapshot_mgr = SnapshotManager::new();

    match args[1].as_str() {
        "detect-distro" => {
            println!("{}", serde_json::to_string_pretty(&distro).unwrap());
        }
        "read-boot-entries" => {
            match MenuEntryParser::get_system_boot_entries(&distro) {
                Ok(entries) => println!("{}", serde_json::to_string_pretty(&entries).unwrap()),
                Err(e) => {
                    eprintln!("Failed to read boot entries: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "read-config" => {
            let path = &distro.default_grub_path;
            let content = fs::read_to_string(path).unwrap_or_else(|_| "# Default GRUB not readable\nGRUB_DEFAULT=0\nGRUB_TIMEOUT=5\nGRUB_CMDLINE_LINUX_DEFAULT=\"quiet splash\"\n".to_string());
            let config = GrubDefaultConfig::parse_str(&content);
            println!("{}", serde_json::to_string_pretty(&config).unwrap());
        }
        "write-config" => {
            if args.len() < 3 {
                eprintln!("Error: write-config requires a JSON payload");
                std::process::exit(1);
            }
            let config: GrubDefaultConfig = match serde_json::from_str(&args[2]) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to parse JSON payload: {}", e);
                    std::process::exit(1);
                }
            };

            // Automatic backup before applying modifications
            if let Err(e) = snapshot_mgr.create_snapshot("Auto-backup before configuration update", &distro) {
                eprintln!("Warning: Failed to create snapshot: {}", e);
            }

            let rendered = config.to_config_string();
            match fs::write(&distro.default_grub_path, rendered) {
                Ok(_) => {
                    // FIX Flaw 6: Use serde_json for safe JSON serialization instead of
                    // hand-crafted format strings that are vulnerable to injection.
                    let res = serde_json::json!({
                        "status": "success",
                        "message": "Successfully updated /etc/default/grub"
                    });
                    println!("{}", serde_json::to_string_pretty(&res).unwrap());
                }
                Err(e) => {
                    eprintln!("Failed to write to {:?}: {}", distro.default_grub_path, e);
                    std::process::exit(1);
                }
            }
        }
        "scan-themes" => {
            let themes = ThemeValidator::scan_themes_directory(&distro.themes_dir).unwrap_or_default();
            println!("{}", serde_json::to_string_pretty(&themes).unwrap());
        }
        "apply-theme" => {
            if args.len() < 3 {
                eprintln!("Error: apply-theme requires a theme directory path or name");
                std::process::exit(1);
            }
            let theme_param = &args[2];
            let theme_path = if theme_param.starts_with('/') {
                std::path::PathBuf::from(theme_param)
            } else {
                distro.themes_dir.join(theme_param)
            };

            let theme_txt = theme_path.join("theme.txt");
            if !theme_txt.exists() {
                eprintln!("Error: Selected theme does not have a valid theme.txt at {:?}", theme_txt);
                std::process::exit(1);
            }

            // Perform verification checklist
            let audit = match ThemeValidator::inspect_theme(&theme_path) {
                Ok(res) => res,
                Err(e) => {
                    eprintln!("Theme inspection failed: {}", e);
                    std::process::exit(1);
                }
            };

            if !audit.is_valid {
                eprintln!("Refusing to install invalid theme: {:?}", audit.validation_errors);
                std::process::exit(1);
            }

            // Create backup before applying
            if let Err(e) = snapshot_mgr.create_snapshot(&format!("Auto-backup before switching to theme {}", audit.name), &distro) {
                eprintln!("Warning: Failed to create pre-theme-switch backup: {}", e);
            }

            let content = fs::read_to_string(&distro.default_grub_path).unwrap_or_default();
            let mut config = GrubDefaultConfig::parse_str(&content);
            config.set_value("GRUB_THEME", &theme_txt.to_string_lossy());
            config.set_value("GRUB_TERMINAL_OUTPUT", "gfxterm");

            let rendered = config.to_config_string();
            if let Err(e) = fs::write(&distro.default_grub_path, rendered) {
                eprintln!("Failed to update /etc/default/grub: {}", e);
                std::process::exit(1);
            }

            // FIX Flaw 5: Use serde_json for safe JSON serialization instead of
            // hand-crafted format strings that break on special characters in theme names.
            let res = serde_json::json!({
                "status": "success",
                "theme": audit.name,
                "has_pf2_fonts": audit.has_pf2_fonts
            });
            println!("{}", serde_json::to_string_pretty(&res).unwrap());
        }
        "regenerate" => {
            let cmd_parts = &distro.regen_command;
            if cmd_parts.is_empty() {
                eprintln!("No regeneration command available for this distro.");
                std::process::exit(1);
            }
            let bin = &cmd_parts[0];
            let mut cmd = Command::new(bin);
            for arg in &cmd_parts[1..] {
                cmd.arg(arg);
            }
            match cmd.output() {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let success = output.status.success();
                    let res = serde_json::json!({
                        "success": success,
                        "command": cmd_parts.join(" "),
                        "stdout": stdout,
                        "stderr": stderr
                    });
                    println!("{}", serde_json::to_string_pretty(&res).unwrap());
                }
                Err(e) => {
                    eprintln!("Failed to execute {}: {}", bin, e);
                    std::process::exit(1);
                }
            }
        }
        "list-snapshots" => {
            let snaps = snapshot_mgr.list_snapshots().unwrap_or_default();
            println!("{}", serde_json::to_string_pretty(&snaps).unwrap());
        }
        "create-snapshot" => {
            let desc = if args.len() >= 3 { &args[2] } else { "Manual user snapshot" };
            match snapshot_mgr.create_snapshot(desc, &distro) {
                Ok(s) => println!("{}", serde_json::to_string_pretty(&s).unwrap()),
                Err(e) => { eprintln!("Failed to create snapshot: {}", e); std::process::exit(1); }
            }
        }
        "restore-snapshot" => {
            if args.len() < 3 {
                eprintln!("Error: restore-snapshot requires a timestamp ID");
                std::process::exit(1);
            }
            // FIX Flaw 2: Return an explicit parse error instead of silently defaulting to 0,
            // which would produce a misleading "Snapshot not found" error.
            let ts: i64 = match args[2].parse() {
                Ok(v) => v,
                Err(_) => {
                    eprintln!("Error: '{}' is not a valid snapshot timestamp ID. Expected a numeric value.", args[2]);
                    std::process::exit(1);
                }
            };
            match snapshot_mgr.restore_snapshot(ts, &distro) {
                Ok(_) => {
                    let res = serde_json::json!({
                        "status": "success",
                        "message": "Restored snapshot successfully"
                    });
                    println!("{}", serde_json::to_string_pretty(&res).unwrap());
                }
                Err(e) => { eprintln!("Failed to restore snapshot: {}", e); std::process::exit(1); }
            }
        }
        _ => {
            eprintln!("Unknown command: {}", args[1]);
            std::process::exit(1);
        }
    }
}
