export interface ExportEntry { path: string; sha256: string; bytes: number }
export function exportTree(source: string, destination: string): Promise<ExportEntry[]>;
export function hash(bytes: string | Uint8Array): string;
export function safePath(path: string): boolean;
export function excluded(path: string): boolean;
export function listTree(root: string, options?: { exporting?: boolean }): Promise<string[]>;
