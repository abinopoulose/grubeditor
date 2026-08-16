export declare function log(stage: string, ...args: any[]): void;
export declare function logError(stage: string, ...args: any[]): void;
export declare const fileCache: Record<string, {
    timestamp: number;
    data: string;
}>;
export declare function readProtectedFile(filepath: string, cacheTime?: number): string;
export declare function writeProtectedFile(filepath: string, content: string): void;
