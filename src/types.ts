export type DistroFamily = 'DebianUbuntu' | 'FedoraRHEL' | 'ArchLinux' | 'OpenSuse' | 'GenericLinux';

export interface BootloaderConfig {
  distro_name: string;
  family: DistroFamily;
  default_grub_path: string;
  grub_dir: string;
  grub_cfg_path: string;
  themes_dir: string;
  regen_command: string[];
  uses_bls: boolean;
}

export type ConfigLine =
  | { Comment: string }
  | 'Empty'
  | { KeyValue: { key: string; value: string; quote: string } };

export interface GrubDefaultConfig {
  lines: ConfigLine[];
}

export interface ThemeMetadata {
  name: string;
  path: string;
  is_valid: boolean;
  validation_errors: string[];
  has_pf2_fonts: boolean;
  background_image?: string;
  title_text?: string;
  item_color: string;
  selected_item_color: string;
  terminal_box?: string;
  menu_box_top?: string;
  menu_box_left?: string;
  menu_box_width?: string;
  menu_box_height?: string;
}

export interface Snapshot {
  timestamp: number;
  date_string: string;
  description: string;
  default_grub_backup: string;
  grub_cfg_backup?: string;
  bls_entries_backup?: string;
  config_snapshot?: Record<string, string>;
  entries_snapshot?: BootEntry[];
}

export interface BootEntry {
  title: string;
  id?: string;
  version?: string;
  options?: string;
  enabled?: boolean;
  deleted?: boolean;
  isCurrent?: boolean;
  type?: 'linux' | 'windows' | 'recovery' | 'efi' | 'custom';
  isCustom?: boolean;
}
