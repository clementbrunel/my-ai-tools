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

// GitHub's generated notes ("--generate-notes" in the CI) list one line per merged PR:
// "* <title> by @<user> in <url>". Only the titles describing a change of the tool are shown.
const GENERATED_ITEM = /^[*-]\s+(.+?)\s+by\s+@\S+\s+in\s+\S+\s*$/;
/** "feat(cbl-log): ", "fix: " (group 1: scope) or "cbl-log: " (group 2). */
const TITLE_PREFIX = /^(?:(?:feat|fix|chore|docs|refactor|perf|style|test|build|ci)(?:\(([^)]*)\))?!?|([\w.-]+)):\s+/i;
/** Release plumbing PRs (version bump, release tag, .gitattributes of the source archive). */
const HOUSEKEEPING = /^(?:release|version|bump(?: the)? version)\b|\.gitattributes/i;
const TOOL = "cbl-log";

/** Feature title of a generated note line, or undefined for plumbing / other tools of the monorepo. */
function featureTitle(title: string): string | undefined {
  let text = title;
  const m = TITLE_PREFIX.exec(title);
  // "feat(x):", "fix:" or a tool name ("cbl-log:", "prono-core:"); not a plain word like "Note:".
  if (m && (m[2] === undefined || m[2].includes("-"))) {
    const scope = (m[1] ?? m[2] ?? "").toLowerCase();
    if (scope && scope !== TOOL) return undefined;
    text = title.slice(m[0].length).trim();
  }
  if (!text || HOUSEKEEPING.test(text)) return undefined;
  return text[0]!.toUpperCase() + text.slice(1);
}

/**
 * Release body -> user-facing list of changes ("• ..." per line). Generated notes are reduced to the
 * PR titles of features/fixes; a hand-written body is kept as is, minus the "Full Changelog" link.
 */
export function formatReleaseNotes(body: string | null | undefined): string {
  const lines = (body ?? "").split(/\r?\n/);
  const items = lines.map((l) => GENERATED_ITEM.exec(l.trim())).filter((m): m is RegExpExecArray => m !== null);
  if (items.length === 0) {
    return lines
      .filter((l) => !/^\s*\*\*Full Changelog\*\*/i.test(l))
      .join("\n")
      .trim();
  }
  const features = items.map((m) => featureTitle(m[1]!)).filter((t): t is string => t !== undefined);
  return [...new Set(features)].map((t) => `• ${t}`).join("\n");
}

/**
 * Newest published cbl-log release strictly newer than `current` that carries the asset for `kind`;
 * undefined when up to date. Its notes gather every version skipped since `current`, newest first.
 */
export function findUpdate(releases: readonly GitHubRelease[], current: string, kind: InstallKind): AvailableUpdate | undefined {
  let best: AvailableUpdate | undefined;
  const newer: { version: string; notes: string }[] = [];
  for (const r of releases) {
    if (r.draft || r.prerelease || !r.tag_name.startsWith(TAG_PREFIX)) continue;
    const version = r.tag_name.slice(TAG_PREFIX.length);
    if (!parseVersion(version) || compareVersions(version, current) <= 0) continue;
    newer.push({ version, notes: formatReleaseNotes(r.body) });
    if (best && compareVersions(version, best.version) <= 0) continue;
    const asset = r.assets.find((a) => a.name === assetName(kind, version));
    if (asset) best = { version, notes: "", pageUrl: r.html_url, asset };
  }
  if (!best) return undefined;
  const target = best.version;
  const shown = newer.filter((n) => n.notes && compareVersions(n.version, target) <= 0).sort((a, b) => compareVersions(b.version, a.version));
  best.notes = shown.length === 1 && shown[0]!.version === target ? shown[0]!.notes : shown.map((n) => `Version ${n.version}\n${n.notes}`).join("\n\n");
  return best;
}

/** Expected SHA-256 (hex) of an asset, when GitHub provides it. */
export function expectedSha256(asset: GitHubAsset): string | undefined {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? "");
  return m ? m[1]!.toLowerCase() : undefined;
}
