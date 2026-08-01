use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConfigLine {
    Comment(String),
    Empty,
    KeyValue { key: String, value: String, quote: char },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrubDefaultConfig {
    pub lines: Vec<ConfigLine>,
}

impl GrubDefaultConfig {
    pub fn parse_str(content: &str) -> Self {
        let mut lines = Vec::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                lines.push(ConfigLine::Empty);
            } else if trimmed.starts_with('#') {
                lines.push(ConfigLine::Comment(line.to_string()));
            } else if let Some((k, v)) = trimmed.split_once('=') {
                let key = k.trim().to_string();
                let val_str = v.trim();
                let quote = if val_str.starts_with('"') && val_str.ends_with('"') && val_str.len() >= 2 {
                    '"'
                } else if val_str.starts_with('\'') && val_str.ends_with('\'') && val_str.len() >= 2 {
                    '\''
                } else {
                    ' '
                };

                let value = if quote != ' ' {
                    val_str[1..val_str.len() - 1].to_string()
                } else {
                    val_str.to_string()
                };

                lines.push(ConfigLine::KeyValue { key, value, quote });
            } else {
                // Keep unrecognized lines as comments/raw preserves to avoid destroying custom syntax
                lines.push(ConfigLine::Comment(line.to_string()));
            }
        }
        Self { lines }
    }

    pub fn to_config_string(&self) -> String {
        let mut out = String::new();
        for line in &self.lines {
            match line {
                ConfigLine::Empty => out.push('\n'),
                ConfigLine::Comment(c) => {
                    out.push_str(c);
                    out.push('\n');
                }
                ConfigLine::KeyValue { key, value, quote } => {
                    if *quote == '"' || *quote == '\'' {
                        out.push_str(&format!("{}={}{}{}\n", key, quote, value, quote));
                    } else if value.contains(' ') || value.is_empty() {
                        out.push_str(&format!("{}=\"{}\"\n", key, value));
                    } else {
                        out.push_str(&format!("{}={}\n", key, value));
                    }
                }
            }
        }
        out
    }

    pub fn get_value(&self, search_key: &str) -> Option<&String> {
        for line in &self.lines {
            if let ConfigLine::KeyValue { key, value, .. } = line {
                if key == search_key {
                    return Some(value);
                }
            }
        }
        None
    }

    pub fn set_value(&mut self, target_key: &str, new_value: &str) {
        for line in &mut self.lines {
            if let ConfigLine::KeyValue { key, value, quote } = line {
                if key == target_key {
                    *value = new_value.to_string();
                    if new_value.contains(' ') && *quote == ' ' {
                        *quote = '"';
                    }
                    return;
                }
            }
        }
        // If key was not found, append to end
        let quote = if new_value.contains(' ') || new_value.is_empty() { '"' } else { ' ' };
        self.lines.push(ConfigLine::KeyValue {
            key: target_key.to_string(),
            value: new_value.to_string(),
            quote,
        });
    }

    pub fn remove_key(&mut self, target_key: &str) {
        self.lines.retain(|l| match l {
            ConfigLine::KeyValue { key, .. } => key != target_key,
            _ => true,
        });
    }

    // Helper for managing kernel parameters safely (GRUB_CMDLINE_LINUX_DEFAULT)
    pub fn get_cmdline_default(&self) -> Vec<String> {
        if let Some(val) = self.get_value("GRUB_CMDLINE_LINUX_DEFAULT") {
            val.split_whitespace().map(|s| s.to_string()).collect()
        } else {
            Vec::new()
        }
    }

    pub fn set_cmdline_default(&mut self, params: &[String]) {
        let joined = params.join(" ");
        self.set_value("GRUB_CMDLINE_LINUX_DEFAULT", &joined);
    }

    pub fn toggle_param(&mut self, param_prefix: &str, enabled: bool, value: Option<&str>) {
        let mut params = self.get_cmdline_default();
        params.retain(|p| !p.starts_with(param_prefix));
        
        if enabled {
            if let Some(val) = value {
                params.push(format!("{}={}", param_prefix, val));
            } else {
                params.push(param_prefix.to_string());
            }
        }
        self.set_cmdline_default(&params);
    }
}

impl fmt::Display for GrubDefaultConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_config_string())
    }
}
