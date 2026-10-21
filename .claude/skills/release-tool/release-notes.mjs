#!/usr/bin/env node
// Prints the `## [X.Y.Z]` section of <tool>/CHANGELOG.md, used as the GitHub release notes.
// Usage: node .claude/skills/release-tool/release-notes.mjs <tool> <X.Y.Z>
// Exits 1 when the changelog or the section is missing or empty, so a release cannot go out without notes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [tool, version] = process.argv.slice(2);
if (!tool || !version) {
  console.error("usage: release-notes.mjs <tool> <X.Y.Z>");
  process.exit(2);
}
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", tool, "CHANGELOG.md");
let text;
try {
  text = readFileSync(file, "utf8");
} catch {
  console.error(`${tool}/CHANGELOG.md not found`);
  process.exit(1);
}
const lines = text.split(/\r?\n/);
const escaped = version.replace(/\./g, "\\.");
const start = lines.findIndex((l) => new RegExp(`^## \\[${escaped}\\]`).test(l));
const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && /^## /.test(l));
const body = start < 0 ? "" : lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
if (!body) {
  console.error(`no "## [${version}]" section (or an empty one) in ${tool}/CHANGELOG.md`);
  process.exit(1);
}
console.log(body);
