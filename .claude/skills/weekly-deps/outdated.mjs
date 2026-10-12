#!/usr/bin/env node
// Lists outdated dependencies for every enabled project in scope.json.
// For each dependency it reports the best non-major target (applied automatically by the
// weekly-deps routine) and, separately, the latest major (reported only, handled by hand).
//
// Usage (from the repo root):
//   node .claude/skills/weekly-deps/outdated.mjs                 # markdown report
//   node .claude/skills/weekly-deps/outdated.mjs --json          # machine-readable
//   node .claude/skills/weekly-deps/outdated.mjs --project prono-core
//   node .claude/skills/weekly-deps/outdated.mjs --all           # ignore enabled:false

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const scope = JSON.parse(readFileSync(join(here, "scope.json"), "utf8"));

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const includeDisabled = args.includes("--all");
const onlyProject = args.includes("--project") ? args[args.indexOf("--project") + 1] : null;

const NCU = "npx -y npm-check-updates@23";
const VERSIONS_PLUGIN = "org.codehaus.mojo:versions-maven-plugin:2.18.0";
const MAVEN_IGNORE = "(?i).*[-.](alpha|beta|m|rc|cr|ea|preview|snapshot)[-.]?\\d*.*";

function sh(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024, timeout: 600_000 }).toString();
}

function parseVersion(v) {
  const m = String(v).replace(/^[\^~>=<v\s]+/, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

// patch | minor | major — a 0.x minor bump is breaking under semver, so it counts as major.
function bumpKind(from, to) {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (!a || !b) return "unknown";
  if (a[0] !== b[0]) return "major";
  if (a[1] !== b[1]) return a[0] === 0 ? "major" : "minor";
  return "patch";
}

function clean(v) {
  return String(v).replace(/^[\^~>=<\s]+/, "");
}

function merge(deps, current, safe, latest) {
  for (const name of new Set([...Object.keys(safe), ...Object.keys(latest)])) {
    if (!current[name]) continue;
    const safeTarget = safe[name] && clean(safe[name]) !== clean(current[name]) ? clean(safe[name]) : null;
    const latestTarget = latest[name] && bumpKind(current[name], latest[name]) === "major" ? clean(latest[name]) : null;
    if (!safeTarget && !latestTarget) continue;
    deps.push({
      name,
      current: clean(current[name]),
      safe: safeTarget,
      safeKind: safeTarget ? bumpKind(current[name], safeTarget) : null,
      major: latestTarget,
    });
  }
}

function npmOutdated(dir) {
  const cwd = join(root, dir);
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const current = { ...pkg.dependencies, ...pkg.devDependencies };
  const ncu = (target) => JSON.parse(sh(`${NCU} --jsonUpgraded --target ${target} 2>/dev/null`, cwd) || "{}");
  const deps = [];
  merge(deps, current, ncu("minor"), ncu("latest"));
  return deps;
}

// Only artifacts with an explicit <version> (or ${property}) in the pom are ours to bump;
// the rest are managed by the Spring Boot parent and move with it.
function explicitlyVersioned(pomXml) {
  const keys = new Set();
  for (const block of pomXml.match(/<(dependency|plugin|parent)>[\s\S]*?<\/\1>/g) ?? []) {
    if (!/<version>/.test(block)) continue;
    const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1] ?? "org.apache.maven.plugins";
    const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
    if (a) keys.add(`${g.trim()}:${a.trim()}`);
  }
  return keys;
}

function mavenUpdates(cwd, extra) {
  const out = sh(
    `mvn -B ${VERSIONS_PLUGIN}:display-dependency-updates ${VERSIONS_PLUGIN}:display-parent-updates ` +
      `-DprocessDependencyManagement=false "-Dmaven.version.ignore=${MAVEN_IGNORE}" ${extra} 2>&1`,
    cwd,
  );
  const text = out
    .split("\n")
    .map((l) => l.replace(/^\[INFO\]\s?/, ""))
    .join("\n")
    .replace(/\.\.\.\s*\n\s+/g, "... ");
  const updates = {};
  const current = {};
  for (const m of text.matchAll(/([\w.\-]+:[\w.\-]+)\s*\.*\s+(\S+)\s+->\s+(\S+)/g)) {
    current[m[1]] = m[2];
    updates[m[1]] = m[3];
  }
  return { current, updates };
}

function mavenOutdated(dir) {
  const cwd = join(root, dir);
  const keep = explicitlyVersioned(readFileSync(join(cwd, "pom.xml"), "utf8"));
  const safe = mavenUpdates(cwd, "-DallowMajorUpdates=false");
  const latest = mavenUpdates(cwd, "");
  const current = { ...latest.current, ...safe.current };
  const filter = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k)));
  const deps = [];
  merge(deps, filter(current), filter(safe.updates), filter(latest.updates));
  return deps;
}

function pipOutdated(dir) {
  const file = join(root, dir, "requirements.txt");
  if (!existsSync(file)) return [];
  const deps = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.trim().match(/^([A-Za-z0-9_.\-]+)\s*(==|>=|~=)\s*([\w.]+)/);
    if (!m) continue;
    const [, name, , cur] = m;
    let releases;
    try {
      releases = Object.keys(JSON.parse(sh(`curl -sSf https://pypi.org/pypi/${name}/json`)).releases);
    } catch {
      continue;
    }
    const stable = releases.filter((v) => /^\d+(\.\d+)*$/.test(v)).sort((x, y) => {
      const a = parseVersion(x), b = parseVersion(y);
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    });
    const sameMajor = stable.filter((v) => bumpKind(cur, v) !== "major");
    merge(deps, { [name]: cur }, { [name]: sameMajor.at(-1) ?? cur }, { [name]: stable.at(-1) ?? cur });
  }
  return deps;
}

const report = [];
for (const project of scope.projects) {
  if (onlyProject && project.name !== onlyProject) continue;
  if (!project.enabled && !includeDisabled) continue;
  const entry = { project: project.name, ecosystems: [], errors: [] };
  const run = (kind, dirs, fn) => {
    for (const dir of dirs ?? []) {
      try {
        entry.ecosystems.push({ kind, dir, deps: fn(dir) });
      } catch (e) {
        entry.errors.push(`${kind} ${dir}: ${String(e.message ?? e).split("\n")[0]}`);
      }
    }
  };
  run("npm", project.npm, npmOutdated);
  run("maven", project.maven, mavenOutdated);
  run("pip", project.pip, pipOutdated);
  report.push(entry);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const p of report) {
    console.log(`\n## ${p.project}\n`);
    for (const err of p.errors) console.log(`> ⚠️ ${err}`);
    const rows = p.ecosystems.flatMap((e) => e.deps.map((d) => ({ ...d, kind: e.kind, dir: e.dir })));
    if (rows.length === 0) {
      console.log("À jour.");
      continue;
    }
    console.log("| Dossier | Paquet | Actuel | Patch/minor (auto) | Majeure (manuel) |");
    console.log("|---|---|---|---|---|");
    for (const r of rows) {
      const safe = r.safe ? `${r.safe} (${r.safeKind})` : "—";
      console.log(`| ${r.dir} | \`${r.name}\` | ${r.current} | ${safe} | ${r.major ?? "—"} |`);
    }
  }
}
