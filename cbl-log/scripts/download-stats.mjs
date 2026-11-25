// Download counts of the last stable cbl-log releases, read from the public GitHub API (download_count of
// each asset). No telemetry involved: GitHub counts every download of a release asset, including the ones made
// by the in-app updater. Pre-releases (betas) and drafts are left out.
//
//   node scripts/download-stats.mjs           -> prints the markdown table
//   node scripts/download-stats.mjs --write   -> rewrites the block between the markers in README.md
//
// GITHUB_TOKEN, when set, is sent to avoid the 60 requests/hour anonymous limit. Run by the release-tool
// skill in the version-bump PR of each cbl-log release.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "clementbrunel/my-ai-tools";
const TAG_PREFIX = "cbl-log-v";
const COUNT = 5;
const START = "<!-- download-stats:start -->";
const END = "<!-- download-stats:end -->";
const README = join(dirname(fileURLToPath(import.meta.url)), "..", "README.md");

const headers = { Accept: "application/vnd.github+json", "User-Agent": "cbl-log-download-stats" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers });
if (!res.ok) {
  console.error(`GitHub API: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const releases = await res.json();

const core = (v) => v.split(".").map(Number);
const byVersionDesc = (a, b) => {
  const [x, y] = [core(a.version), core(b.version)];
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
};

const rows = releases
  .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(TAG_PREFIX))
  .map((r) => ({ version: r.tag_name.slice(TAG_PREFIX.length), date: (r.published_at ?? "").slice(0, 10), assets: r.assets }))
  .filter((r) => /^\d+\.\d+\.\d+$/.test(r.version)) // a beta published without the pre-release flag
  .sort(byVersionDesc)
  .slice(0, COUNT)
  .map((r) => {
    const count = (name) => r.assets.find((a) => a.name === name)?.download_count ?? 0;
    const setup = count(`cbl-log-Setup-${r.version}.exe`);
    const portable = count(`cbl-log-${r.version}-portable.exe`);
    return `| ${r.version} | ${r.date} | ${setup} | ${portable} | ${setup + portable} |`;
  });

const table = [
  "| Version | Publiée le | Installeur | Portable | Total |",
  "|---|---|---:|---:|---:|",
  ...rows,
].join("\n");

if (!process.argv.includes("--write")) {
  console.log(table);
  process.exit(0);
}

const readme = readFileSync(README, "utf8");
const from = readme.indexOf(START);
const to = readme.indexOf(END);
if (from < 0 || to < from) {
  console.error(`Markers ${START} / ${END} not found in README.md`);
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const block = `${START}\n_Relevé du ${today}._\n\n${table}\n`;
writeFileSync(README, readme.slice(0, from) + block + readme.slice(to));
console.log(table);
