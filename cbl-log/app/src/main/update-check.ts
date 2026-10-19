// Picks the update to offer from the GitHub releases of the monorepo (tags `cbl-log-vX.Y.Z`; the other
// tools of the repository publish their own tags there and are ignored). Pure: no network, no Electron.

export const RELEASES_URL = "https://api.github.com/repos/clementbrunel/my-ai-tools/releases?per_page=50";
const TAG_PREFIX = "cbl-log-v";

/** Subset of the GitHub REST "release" object used here. */
export interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
  /** "sha256:<hex>" (absent on old releases). */
  digest?: string | null;
}
export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

/** Installed build (NSIS installer) or portable `.exe`: they update from different assets. */
export type InstallKind = "setup" | "portable";

export interface AvailableUpdate {
  version: string;
  notes: string;
  pageUrl: string;
  asset: GitHubAsset;
}

/** "1.2.3" -> [1, 2, 3]; undefined for anything else (pre-release suffixes included). */
export function parseVersion(text: string): [number, number, number] | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

/** Negative if a < b, 0 if equal, positive if a > b. Unparsable versions sort lowest. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return (va ? 1 : 0) - (vb ? 1 : 0);
  return va[0] - vb[0] || va[1] - vb[1] || va[2] - vb[2];
}

/** Asset names produced by electron-builder.yml (`artifactName`). */
export const assetName = (kind: InstallKind, version: string): string =>
  kind === "setup" ? `cbl-log-Setup-${version}.exe` : `cbl-log-${version}-portable.exe`;

/**
 * Newest published cbl-log release strictly newer than `current` that carries the asset for `kind`;
 * undefined when up to date.
 */
export function findUpdate(releases: readonly GitHubRelease[], current: string, kind: InstallKind): AvailableUpdate | undefined {
  let best: AvailableUpdate | undefined;
  for (const r of releases) {
    if (r.draft || r.prerelease || !r.tag_name.startsWith(TAG_PREFIX)) continue;
    const version = r.tag_name.slice(TAG_PREFIX.length);
    if (!parseVersion(version) || compareVersions(version, current) <= 0) continue;
    if (best && compareVersions(version, best.version) <= 0) continue;
    const asset = r.assets.find((a) => a.name === assetName(kind, version));
    if (asset) best = { version, notes: (r.body ?? "").trim(), pageUrl: r.html_url, asset };
  }
  return best;
}

/** Expected SHA-256 (hex) of an asset, when GitHub provides it. */
export function expectedSha256(asset: GitHubAsset): string | undefined {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? "");
  return m ? m[1]!.toLowerCase() : undefined;
}
