#!/usr/bin/env node
// Writes a root .gitattributes that export-ignores every top-level entry except <tool>/,
// so GitHub's auto-generated "Source code" zip/tar.gz of a tag only contains that tool.
// Usage: node gen-gitattributes.mjs <tool>   (run from the repo root, on the release branch)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const tool = process.argv[2];
if (!tool) {
  console.error("usage: node gen-gitattributes.mjs <tool>");
  process.exit(1);
}

const entries = execFileSync("git", ["ls-tree", "--name-only", "HEAD"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
if (!entries.includes(tool)) {
  console.error(`"${tool}" is not a top-level entry of HEAD`);
  process.exit(1);
}

const lines = [...new Set([...entries, ".gitattributes"])]
  .filter((e) => e !== tool)
  .sort()
  .map((e) => `/${e} export-ignore`);
writeFileSync(".gitattributes", lines.join("\n") + "\n");
console.log(`.gitattributes: ${lines.length} entries ignored, only ${tool}/ kept`);
