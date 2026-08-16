export interface BootEntry {
    id: string;
    title: string;
    type: 'linux' | 'windows' | 'recovery' | 'efi' | 'custom';
    enabled: boolean;
    order: number;
    args?: string;
    version?: string;
    isCurrent?: boolean;
    is_current?: boolean;
    is_default?: boolean;
    parent_id?: string;
    raw_boot_commands?: string;
    originalTitle?: string;
    deleted?: boolean;
}
export declare function parseGrubCfg(content: string): BootEntry[];
export declare function getOverridesPath(): string;
export declare function getSavedOverrides(): any[];
export declare function mergeEntriesWithOverrides(systemEntries: any[], overrides: any[]): any[];
export declare function applyOverridesToGrubCfg(content: string, overrides: any[]): string;
