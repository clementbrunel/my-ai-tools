// Small helpers shared by the bench modules: sizes, statistics, formatting.

const UNITS: Record<string, number> = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };

/** Parses "200M", "10G", "1.5g", "4096" (binary units: 1G = 1024^3 bytes). */
export function parseSize(text: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMGT]?)B?\s*$/i.exec(text);
  if (!match) throw new Error(`Invalid size: "${text}" (expected e.g. 200M, 10G)`);
  return Math.floor(Number(match[1]) * UNITS[match[2]!.toUpperCase()]!);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

export const mib = (bytes: number): number => bytes / 1024 ** 2;

/** Percentile (0..100) of an unsorted list, nearest-rank. NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = Float64Array.from(values).sort();
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank]!;
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wall-clock time in fractional milliseconds, comparable across processes on the same machine. */
export function wallMs(): number {
  return performance.timeOrigin + performance.now();
}

export function gc(): void {
  (globalThis as { gc?: () => void }).gc?.();
}

/** Matches the probe lines written by writer.ts: sequence number and write time (wall ms). */
export const PROBE_LINE = /O #(\d+)#(\d+)#/;
