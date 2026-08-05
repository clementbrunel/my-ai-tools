# ai-env-manager

Scans, diagnoses, and manages the AI environment of a Claude Code project — MCP servers, context
files, hooks, and third-party AI tooling.

Everything the tool does falls into **four feature groups**, one per CLI command:

| # | Group | Command | What it answers |
|---|---|---|---|
| 1 | **Scan / diagnose** | `ai-env-manager` (default) | *What is currently wired into this project, and is any of it broken?* |
| 2 | **Update** | `ai-env-manager update` | *Are the detected tools running an outdated version — and can they be upgraded now?* |
| 3 | **Prepare / catalogue** | `ai-env-manager prepare` | *What should I install, what conflicts with what, and what are the exact steps?* |
| 4 | **Verify** | `ai-env-manager verify` | *Are the tools I asked for actually installed and working in this folder?* |

Groups 1, 3 and 4 share the same scan engine: `prepare` runs a scan first so it can mark catalogue
tools as “already installed” and only suggest what is genuinely missing, and `verify` re-uses the
same detectors to confirm, after the fact, that each requested tool is really operational.

---

## 1. Scan — diagnose the environment

`ai-env-manager [--path <dir>] [--output <file>]`

Reads config from disk (nothing is executed against the network except version lookups in
`update`), builds a `ScanResult`, and renders it as an ANSI console report and/or a Markdown file.

### What it inspects

| Component | Sources scanned | Checks performed |
|---|---|---|
| **Model** | `.claude/settings.json` → `~/.claude/settings.json` → `ANTHROPIC_MODEL` (first hit wins) | `error` if a model is configured and it is not a Sonnet variant; unset is `ok` with an informational note |
| **MCP servers** | `.mcp.json`, `.claude/settings.json`, `~/.claude/settings.json`, `claude_desktop_config.json` (macOS / Windows / XDG paths) | stdio command resolvable in `PATH`, referenced env vars set, API-key-shaped vars flagged separately; Docker MCP gateways are expanded into their sub-server list via `docker mcp server list` |
| **Context files** | `CLAUDE.md` (project, every parent up to `$HOME`, `~/CLAUDE.md`, `~/.claude/CLAUDE.md`), every file in `.claude/`, `.clauderc` | size + token estimate (~4 chars/token): `warning` ≥ 500t, `error` ≥ 1000t, plus a TOTAL row |
| **Hooks** | `.claude/settings.json`, `~/.claude/settings.json` | script exists and is executable (or first token resolves in `PATH`); `mcp__<server>__<tool>` matchers are parsed into server/tool; hooks are grouped by provider executable |
| **Integrations** | 12 detectors, see [Integration detection](#integration-detection) | detected or not, plus whether the install looks complete (binary missing, plugin without `SKILL.md`, missing provider key…) |
| **Env vars** | every var referenced by an MCP server config | deduplicated set/missing summary |

### Status levels

`ok` (green) · `outdated` (blue) · `warning` (yellow) · `error` (red).

Statuses roll up worst-wins per section, and the console report ends with a grouped list of every
error, warning and outdated component — or `All N components OK`.

### Output

- **Console** — ASCII tables with colour, wrapped at 48 chars per cell.
- **Markdown** — `--output report.md` writes the same report with shields.io status badges,
  suitable for committing or pasting into an issue.

```
  ── MODEL
  unset (default)

  ── MCP SERVERS
+------------+-------+---------------+----------------------------+--------+------------+
| Name       | Type  | Command / URL | Source                     | Status | Diagnostic |
+------------+-------+---------------+----------------------------+--------+------------+
| MCP_DOCKER | stdio | docker        | claude_desktop_config.json | ok     |            |
+------------+-------+---------------+----------------------------+--------+------------+

  ── CONTEXT FILES
+-------------------------+---------+--------+--------+---------+
| Path                    | Scope   | Size   | Tokens | Status  |
+-------------------------+---------+--------+--------+---------+
| ./CLAUDE.md             | project | 2.0 KB | 507t   | warning |
| ~/.claude/CLAUDE.md     | user    | 8.1 KB | 2.0kt  | error   |
| TOTAL                   |         | 10.1KB | 2.5kt  | error   |
+-------------------------+---------+--------+--------+---------+

  ── HOOKS
+---------------+-------+--------------------------+--------+
| Provider      | Count | Events                   | Status |
+---------------+-------+--------------------------+--------+
| GitKraken CLI | 22    | SessionStart, PreToolUse | ok     |
| MemPalace     | 2     | PreCompact, Stop         | ok     |
+---------------+-------+--------------------------+--------+

  ── INTEGRATIONS
+-------------------------+----------+---------------------+--------+
| Name                    | Detected | Detail              | Status |
+-------------------------+----------+---------------------+--------+
| MemPalace               | yes      | 12 drawers (arch:5) | ok     |
| Caveman                 | yes      | full                | ok     |
| RTK (Rust Token Killer) | yes      | —                   | ok     |
+-------------------------+----------+---------------------+--------+

  1 warning(s):
     • CLAUDE.md: estimated token count is high (507t ≥ 500t)
```

---

## 2. Update — keep detected tools current

`ai-env-manager update [--path <dir>]`

Runs a scan, then for every component that maps to a package manager:

| Kind | Source of the package name | Version check | Upgrade command |
|---|---|---|---|
| MCP servers launched via `npx` | first non-flag arg of `args`, version pin stripped (`@scope/name@1.2.3` → `@scope/name`) | `npm list -g` vs `npm view <pkg> version` | `npm install -g <pkg>@latest` |
| Detected integrations with a pip package | `pipPackage` on the detector — currently **MemPalace** (`mempalace`) and **Graphify** (`graphifyy`) | `pip show` vs `pip index versions` | `pip install --upgrade <pkg>` |

Outdated components are re-marked `outdated` in the report (with `Update available: X → Y` as the
first diagnostic) before the upgrades are applied, so the table shows what changed and why.

---

## 3. Prepare — the recommended-tools catalogue

`ai-env-manager prepare [--path <dir>] [--with <ids>] [--install] [--verbose] [--no-record]`

Two modes:

- **Without `--with`** — scans the project, prints the whole catalogue with `✓ déjà installé`
  badges, then prints a generated `--with …` command covering the groups that are not yet
  covered.
- **With `--with rtk,mempalace`** — validates the ids, checks conflict rules, and prints an
  install plan. `--install` executes the runnable steps (`▶`); steps that require an interactive
  Claude Code session (`ℹ`) are always printed rather than run.

When the selection has no conflict, the requested ids are recorded in `.ai-env-manager.json` at the
project root so `verify` can check them later without repeating the list. `--no-record` skips the
write. Re-running `prepare` merges the new ids in and drops the previous pick of any conflict group
it touches, so switching from `rtk` to `caveman` does not leave `rtk` behind as a failing check.
The file is plain JSON (`{ "requested": [...], "updatedAt": "..." }`) and worth committing — it is
the declared expectation `verify` checks against.

### Catalogue groupings

The catalogue is organised by **conflict group** — tools inside a group solve the same problem and
are mutually exclusive, so the CLI prints `(choisir 1)` next to the group heading and refuses an
install plan that picks more than one.

#### Group `token` — token reduction *(pick 1)*

> These tools reduce what enters the context window. They overlap — one is enough.

| id | Tool | What it does | Install surface |
|---|---|---|---|
| `rtk` | [RTK (Rust Token Killer)](https://www.rtk-ai.app/) | CLI proxy that compresses shell output before it reaches the model | `cargo install rtk` + a `PostToolUse` hook |
| `headroom` | [Headroom](https://github.com/chopratejas/headroom) | Compresses tool outputs, RAG chunks and JSON (60–95 % claimed) | `pip install headroom`; library, HTTP proxy, or MCP server |
| `caveman` | [Caveman](https://github.com/JuliusBrussee/caveman) | Skill that steers the model toward terse answers — zero infra | `/plugin install caveman@caveman` |

#### Group `memory` — project memory & codebase knowledge *(pick 1)*

> MemPalace = notes you write. SocratiCode = automatic embedding-based code indexing (Docker).
> Graphify = deterministic AST graph, no Docker, ingests docs/PDF. OpenWiki = agent-generated
> Markdown docs committed to the repo. CodeAlmanac = committed Markdown too, but fed continuously
> by what your agent sessions learn (macOS only).

| id | Tool | What it does | Install surface |
|---|---|---|---|
| `mempalace` | [MemPalace](https://www.mempalace.tech/) | Long-term memory MCP server — you decide what is remembered | `pip install mempalace` + `claude mcp add` |
| `socraticode` | [SocratiCode](https://github.com/giancarloerra/SocratiCode) | Codebase index: hybrid vector + BM25 search, call tracing, blast-radius | Docker + `/plugin install socraticode@socraticode` |
| `graphify` | [Graphify](https://github.com/Graphify-Labs/graphify) | Codebase → queryable knowledge graph (tree-sitter AST, no embeddings) | `uv tool install graphifyy` + `graphify install` |
| `openwiki` | [OpenWiki](https://github.com/langchain-ai/openwiki) | Generates and maintains a Markdown wiki of the codebase, committed to the repo | `npm i -g openwiki` + provider key + optional CI workflow |
| `codealmanac` | [CodeAlmanac](https://github.com/AlmanacCode/codealmanac) | Wiki fed by your agent sessions — decisions, invariants, gotchas | `uv tool install codealmanac` + `codealmanac setup` (macOS, Python 3.12+) |

#### Ungrouped tools — `AUTRES OUTILS` *(cumulables)*

No exclusivity rule applies to these — they are additive, except for the two pairwise conflicts
listed below.

| id | Tool | What it does | Install surface |
|---|---|---|---|
| `ecc` | [ECC (Agent Harness OS)](https://github.com/affaan-m/ECC) | All-in-one harness: 67 agents, 271 skills, hooks and rules across Claude Code / Cursor / Codex | `/plugin install ecc@ecc` |
| `karpathy-skills` | [Andrej Karpathy Skills](https://github.com/forrestchang/andrej-karpathy-skills) | Coding-discipline guidelines: no unverified assumptions, no over-engineering, no out-of-scope edits | plugin, or drop-in `CLAUDE.md` |
| `ponytail` | [Ponytail](https://github.com/DietrichGebert/ponytail) | Anti-over-engineering skill — forces a YAGNI decision ladder before writing code | plugin, or rule files per editor |
| `codeburn` | [CodeBurn](https://github.com/getagentseal/codeburn) | Cost & token accounting across 36 AI coding tools — measures, does not compress | `npm i -g codeburn` + optional MCP server |

### Conflict rules

Two kinds, both enforced by `getConflicts()` before an install plan is printed:

| Kind | Rule | Reason |
|---|---|---|
| Group cardinality | at most **1** tool from `token`, at most **1** from `memory` | same problem, overlapping mechanisms |
| Pairwise special case | `ecc` + `caveman` | ECC already bundles an equivalent verbosity-reduction mechanism |
| Pairwise special case | `ponytail` + `karpathy-skills` | both target over-engineering / edit discipline — redundant or contradictory rules |

When a conflict is hit, the plan is replaced by a `CONFLITS DÉTECTÉS` block and nothing is
installed, even with `--install`.

### Suggestion engine

With no `--with`, `suggestMissing()` maps detected integration names → catalogue ids
(`INTEGRATION_TO_TOOL`), then for every conflict group with no detected member proposes the
lowest-friction default:

| Group | Default suggestion | Why |
|---|---|---|
| `token` | `caveman` | no infrastructure, plugin only |
| `memory` | `mempalace` | no Docker, no automatic indexing |

If every group is already covered, it prints `✓ Tous les groupes d'outils sont déjà couverts`.

---

## 4. Verify — are the requested tools actually working here?

`ai-env-manager verify [--path <dir>] [--with <ids>] [--json]`

`prepare` says what to install; `verify` answers the follow-up question — *is it really installed
and functional in that folder?* Half of the catalogue is installed by hand (`/plugin install …`,
`claude mcp add …`), so an install plan being printed is no proof the tool ended up wired in.

It scans the target folder and, for each requested tool, resolves the matching integration detector
(`TOOL_TO_INTEGRATION`) into one of three verdicts:

| Verdict | Meaning | Reported |
|---|---|---|
| `ok` — *fonctionnel* | detected and the detector reports no problem | the signals that proved it (`source :`) |
| `incomplete` — *incomplet* | detected but `warning`/`error`: partially wired, e.g. plugin enabled but binary missing, or no graph built yet | the detector's diagnostics |
| `missing` — *absent* | no signal at all in this folder | the install steps left to run |

The list of tools to check comes from `--with rtk,mempalace`, or — with no `--with` — from the
`.ai-env-manager.json` written by `prepare`. With neither, the command exits `1` and points at
`prepare`.

**Exit code is `0` only when every requested tool is `ok`**, so the command doubles as a CI gate:

```bash
ai-env-manager verify --path . --json    # machine-readable report, non-zero exit on any gap
```

```
VÉRIFICATION — outils demandés
Dossier : /home/user/demo
────────────────────────────────────────────────────────────────────────

  ✓ rtk         RTK (Rust Token Killer)  fonctionnel
                source : binary in PATH, hook: PostToolUse

  ⚠ graphify    Graphify                 incomplet
                source : binary in PATH
                • No graph built yet — run 'graphify build' to generate graphify-out/graph.json

  ✗ mempalace   MemPalace                absent
                Étapes restantes :
                  $ pip install mempalace  (Installer le package Python)
                  ℹ claude mcp add mempalace -- python -m mempalace  (Ajouter comme serveur MCP)

────────────────────────────────────────────────────────────────────────

  1/3 outil(s) opérationnel(s) — 1 incomplet(s), 1 absent(s).
  Relancer les étapes avec ai-env-manager prepare --with graphify,mempalace
```

---

## Integration detection

The scanner ships 12 detectors (`src/scanner/integrations/`). Each returns *detected / not
detected* plus the evidence that led to the verdict, so `prepare` never suggests something that is
already there. Detection is signal-based: any single signal is enough to report the tool as
present, and a partial install (e.g. plugin enabled but binary missing) is reported as
`warning`/`error` with a diagnostic.

| Integration | Signals checked |
|---|---|
| **MemPalace** | MCP server matching `mem?palace`, enabled plugin, `mempalace` binary or `python -m mempalace`; detail column shows the project's wing/drawer counts |
| **Caveman** | enabled plugin, `.claude/skills/caveman/` (project or `~`) with a `SKILL.md`; detail shows the active level from `~/.claude/.caveman-active` |
| **RTK** | `rtk` in `PATH`, `RTK.md`, a hook whose command mentions `rtk`, a reference in `CLAUDE.md` or `.claude/settings.json` |
| **Headroom** | binary or `python -m headroom`, MCP server match, `.headroom.toml` (project or `~`), `HEADROOM_*` env vars, enabled plugin |
| **ECC** | enabled plugin, MCP server match, `ECC_HOOK_PROFILE` / `ECC_SESSION_START_MAX_CHARS` / `ECC_DISABLED_HOOKS`, reference in `CLAUDE.md` or `.claude/settings.json`; detail shows the hook profile |
| **SocratiCode** | enabled plugin, MCP server matching `socrati`, `socraticode` binary, `.socraticodeignore`, running Docker container |
| **Andrej Karpathy Skills** | enabled plugin, `.cursor/rules/karpathy-guidelines.mdc`, reference in `CLAUDE.md` |
| **Graphify** | `graphify` binary, MCP server match, `.claude/skills/graphify/SKILL.md`, `.graphifyignore`, `graphify-out/graph.json`, `~/.graphify/global-graph.json` |
| **Ponytail** | enabled plugin, `~/.config/ponytail/config.json`, `PONYTAIL_DEFAULT_MODE`, rule files (`.cursor` / `.windsurf` / `.clinerules`), reference in `CLAUDE.md` / `AGENTS.md` / copilot instructions |
| **CodeBurn** | `codeburn` binary, MCP server match, `~/.config/codeburn/{config,guard}.json` |
| **OpenWiki** | `openwiki` binary, `openwiki/INSTRUCTIONS.md` or `openwiki/.langsmith.json`, `.openwikiignore`, `.github/workflows/openwiki-update.yml`, reference in `CLAUDE.md` / `AGENTS.md`, `~/.openwiki/` credentials & personal wiki |
| **CodeAlmanac** | `codealmanac` binary, `almanac/topics.yaml` or `almanac/README.md`, `.almanac.yaml`, reference in `CLAUDE.md` / `AGENTS.md`, `~/.codealmanac/{config.toml,codealmanac.db}` |

See [`docs/context-tools-comparison.md`](./docs/context-tools-comparison.md) for a side-by-side
analysis of the context-window tools (Headroom, ECC, SocratiCode, Graphify, OpenWiki, CodeAlmanac)
and guidance on picking one.

### Hook provider catalogue

Hooks are reported per *provider* rather than per entry: the executable name is extracted from each
hook command and looked up in `HOOK_PROVIDER_CATALOGUE` (`src/scanner/hook-providers.ts`), which
carries a display name, a description and per-event explanations. Known providers: **GitKraken
CLI** (22 lifecycle events), **MemPalace** (`PreCompact`, `Stop`), **Caveman** (`SessionStart`,
`UserPromptSubmit`), **Graphify** (`PreToolUse`), **RTK** (no hooks — CLI wrapper). Unknown
providers still show up, keyed by their executable name.

---

## CLI reference

```bash
# Scan the current directory
npx ai-env-manager

# Scan another project
npx ai-env-manager --path /path/to/project

# Write a Markdown report
npx ai-env-manager --output report.md

# Check and apply updates on detected tools
npx ai-env-manager update --path /path/to/project

# Show the catalogue + a suggestion based on what is missing
npx ai-env-manager prepare --path /path/to/project

# Full descriptions instead of just taglines
npx ai-env-manager prepare --verbose

# Show the install plan for specific tools (dry-run)
npx ai-env-manager prepare --with rtk,mempalace

# Actually run the shell steps
npx ai-env-manager prepare --with rtk,mempalace --install

# Check the requested tools are functional in that folder (ids from .ai-env-manager.json)
npx ai-env-manager verify --path /path/to/project

# Check an explicit list, machine-readable, non-zero exit if anything is missing
npx ai-env-manager verify --with rtk,mempalace --json
```

| Command | Option | Description |
|---|---|---|
| *(default)* | `-p, --path <dir>` | project directory to scan (default `.`) |
| *(default)* | `-o, --output <file>` | write the Markdown report to a file |
| `update` | `-p, --path <dir>` | project directory to scan |
| `prepare` | `-p, --path <dir>` | project directory to scan |
| `prepare` | `--with <ids>` | comma-separated catalogue ids |
| `prepare` | `--install` | execute the runnable steps |
| `prepare` | `--verbose` | print full `why` descriptions in the catalogue |
| `prepare` | `--no-record` | do not write the requested ids to `.ai-env-manager.json` |
| `verify` | `-p, --path <dir>` | project directory to check |
| `verify` | `--with <ids>` | ids to check (default: those recorded by `prepare`) |
| `verify` | `--json` | JSON report instead of the console rendering |

---

## Getting started

```bash
git clone https://github.com/clementbrunel/my-ai-tools.git
cd my-ai-tools/ai-env-manager
npm install
npm run build
node dist/index.js --path /your/project
```

Development commands:

```bash
npm run build     # TS → dist/
npm run dev       # build + run
npm start         # run dist/index.js
npm test          # vitest run
npm run test:watch
```

## Project structure

```
src/
  index.ts                    — CLI entry point (4 commands: scan / update / prepare / verify)
  types.ts                    — Shared type definitions (ScanResult and its parts)
  utils.ts                    — JSON parsing, PATH lookup, API-key heuristic, plugin detection
  scanner/
    run.ts                    — Orchestrates a full scan into a ScanResult
    model.ts                  — Model resolution & check
    mcp.ts                    — MCP server detection, env-var checks, Docker gateway expansion
    context.ts                — Context file discovery + token estimation
    hooks.ts                  — Hook parsing, script validation, mcp__ matcher parsing
    hook-providers.ts         — Known hook provider metadata (per-event descriptions)
    env.ts                    — Environment variable aggregation
    integrations/
      index.ts                — Runs all 12 detectors
      mempalace.ts  caveman.ts  rtk.ts  headroom.ts  ecc.ts  socraticode.ts
      karpathy-skills.ts  graphify.ts  ponytail.ts  codeburn.ts
      openwiki.ts  codealmanac.ts
  diagram/
    shared.ts                 — Status ranking, token formatting, path shortening
    console.ts                — ANSI console report (ASCII tables, wrapping, summary)
    markdown.ts               — Markdown report with shields.io badges
  updater/
    index.ts                  — Update detection & orchestration
    npm.ts                    — npm version lookup / upgrade
    pip.ts                    — pip version lookup / upgrade
  prepare/
    catalogue.ts              — Catalogue, conflict groups & rules, suggestion engine
    render.ts                 — Catalogue, install plan & suggestion rendering
    installer.ts              — Executes the runnable install steps
    state.ts                  — Reads/writes the requested tools in .ai-env-manager.json
  verify/
    index.ts                  — Verdict per requested tool (ok / incomplete / missing)
    render.ts                 — Verification report rendering
  __tests__/                  — vitest suites (detectors, catalogue rules, rendering, hooks, verify)
docs/
  context-tools-comparison.md — Comparison of the context-window tools
.claude/skills/
  add-catalogue-tool/         — Skill describing how to add a new tool to the catalogue + scanner
```

## Adding a tool to the catalogue

Adding a tool means touching both the catalogue (`prepare/catalogue.ts`) and the scanner
(`scanner/integrations/`), plus tests and docs. The
[`add-catalogue-tool`](./.claude/skills/add-catalogue-tool/SKILL.md) skill walks through the nine
steps in order — research, catalogue entry, conflict decision, detector, wiring,
`HOOK_PROVIDER_CATALOGUE` entry if relevant, tests, docs, and verification.

Convention: ids, code, comments and tests are in English; catalogue `tagline`, `why` and conflict
notes are in French, matching the CLI output.

## License

MIT
