export declare function detectDistro(): {
    distro_name: string;
    family: string;
    default_grub_path: string;
    grub_dir: string;
    grub_cfg_path: string;
    themes_dir: string;
    regen_command: string[];
    uses_bls: boolean;
};
export declare function scanGrubThemes(): any[];
export declare function parseDefaultGrubConfig(): Record<string, string>;
