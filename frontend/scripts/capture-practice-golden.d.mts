export const TEMPORARY_PREFIX: string;
export const GOLDEN_SEEDS: readonly string[];

export interface GoldenRuntimeRecord {
  readonly record: string;
  readonly profile: { readonly [field: string]: unknown };
}
export interface GoldenMathPreset {
  readonly presentationBand: string | null;
  readonly mathSkills: {
    readonly representations: readonly string[];
    readonly operations: readonly string[];
  } | null;
}
export function buildGoldenRuntimeRecords(
  mathPresets: { readonly [id: string]: GoldenMathPreset },
  writingModes: readonly string[],
  presentationBands: readonly string[],
): GoldenRuntimeRecord[];

export interface CaptureByteComparison {
  readonly equal: boolean;
  readonly actualSha256: string;
  readonly expectedSha256: string;
}
export function compareCaptureBytes(
  actual: string | Uint8Array,
  expected: string | Uint8Array,
): CaptureByteComparison;

export interface DependencyManifestTexts {
  readonly packageJson: string;
  readonly packageLock: string;
}
export interface DependencyManifestComparison {
  readonly compatible: boolean;
  readonly differences: readonly string[];
}
export function compareDependencyManifests(
  reference: DependencyManifestTexts,
  working: DependencyManifestTexts,
): DependencyManifestComparison;

export interface BoundedRunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}
export interface BoundedRunResult {
  readonly output: string;
}
/** The rejection of runBounded: the combined output so far and the child's pid. */
export interface BoundedRunError extends Error {
  readonly output: string;
  readonly pid: number | undefined;
}
export function runBounded(
  command: string,
  args: readonly string[],
  options: BoundedRunOptions,
): Promise<BoundedRunResult>;
