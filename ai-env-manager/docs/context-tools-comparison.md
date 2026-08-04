# Context-window tools — quick comparison

Six tools spotted as potential additions to a Claude Code AI workspace setup.
They each attack a different slice of the "context problem", but their scopes overlap
enough that running all of them simultaneously would likely produce redundancy and
configuration friction. Notes below to inform the choice.

---

## 1. Headroom — `chopratejas/headroom`

**What it does**: Compresses content *before* it reaches the LLM — tool outputs,
RAG chunks, logs, conversation history, code files. Claims 60-95 % token reduction
while preserving answer quality.

**Key mechanics**
- Six specialised compressors: SmartCrusher (JSON), CodeCompressor (AST-aware),
  Kompress-base (ML), plus image/text handlers.
- Reversible Compression (CCR): compressed tokens are cached locally; the model
  can ask to expand any of them on demand.
- CacheAligner stabilises prompt prefixes for KV-cache reuse.
- Multiple deployment surfaces: Python/TS library, local HTTP proxy (zero code
  change), MCP server, or `headroom wrap <agent>` CLI wrapper.

**Detection signals in `ai-env-manager`**
- `headroom` binary in PATH
- `python -m headroom` available
- MCP server entry matching `headroom`
- `.headroom.toml` / `headroom.toml` at project root or home
- Env vars: `HEADROOM_OUTPUT_SHAPER`, `HEADROOM_EMBEDDER_RUNTIME`
- Plugin entry matching `headroom`

---

## 2. ECC — `affaan-m/ECC`

**What it does**: An "agent harness OS" — a large, opinionated configuration
bundle for multiple AI coding tools (Claude Code, Cursor, Codex, OpenCode…).
Provides 67 specialised sub-agents, 271 skills, a hooks system, language-specific
rules, and MCP wiring, all evolved from 10+ months of production use.

**Key mechanics**
- Installed as a Claude Code plugin: `"/plugin install ecc@ecc"`.
- Runtime behaviour controlled via env vars (`ECC_HOOK_PROFILE`, `ECC_SESSION_START_MAX_CHARS`,
  `ECC_DISABLED_HOOKS`).
- Cross-platform Node.js scripts; supports npm / pnpm / yarn / bun.
- Components can be installed selectively to reduce overhead.

**Detection signals in `ai-env-manager`**
- Plugin entry matching `ecc` in `~/.claude/settings.json`
- Env vars: `ECC_HOOK_PROFILE`, `ECC_SESSION_START_MAX_CHARS`, `ECC_DISABLED_HOOKS`
- MCP server entry matching `ecc`
- `ecc` reference in project `CLAUDE.md` or `.claude/settings.json`

---

## 3. SocratiCode — `giancarloerra/SocratiCode`

**What it does**: Gives AI assistants deep semantic understanding of large
codebases via an MCP server. Combines dense vector embeddings (Qdrant) with
BM25 keyword search. Particularly strong on dependency graphs and symbol-level
impact analysis.

**Key mechanics**
- Runs locally via Docker (manages Qdrant + Ollama automatically on first use).
- AST-based file splitting across 18+ languages; respects `.gitignore` +
  `.socraticodeignore`.
- File watcher for incremental re-indexing; cross-process safety via file locks.
- Supports external embeddings (OpenAI, Gemini, LM Studio, LiteLLM).
- Plugin or manual MCP config; zero-config on first use.
- Benchmarked at 61 % less context, 84 % fewer tool calls on large OSS codebases.

**Detection signals in `ai-env-manager`**
- MCP server entry matching `socraticode` / `socrati`
- Plugin entry matching `socraticode`
- `socraticode` binary in PATH
- `.socraticodeignore` file at project root
- Docker container named `socraticode`

---

## 4. Graphify — `Graphify-Labs/graphify`

**What it does**: Turns a codebase (plus docs/PDFs) into a queryable knowledge
graph — "query instead of grepping through files". Parses code with tree-sitter
AST for deterministic structure, and adds semantic extraction for prose/media,
producing traceable inference edges rather than opaque vector similarity.

**Key mechanics**
- No vector embeddings for code — the graph is built from AST parsing, so
  edges are deterministic and traceable rather than nearest-neighbour guesses.
- `graphify install` wires it into 15+ platforms (Claude Code skill + PreToolUse
  hook, Cursor `.mdc` rule, Codex/Gemini via AGENTS.md, etc.) in one step.
- MCP server (`python -m graphify.serve`) can run stdio or HTTP, including a
  team-shared HTTP deployment with an API key.
- Output lives in `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`);
  `.graphifyignore` merges with `.gitignore` for exclusions.

**Detection signals in `ai-env-manager`**
- `graphify` binary in PATH
- MCP server entry matching `graphify`
- `.claude/skills/graphify/SKILL.md` at project root
- `.graphifyignore` file at project root
- `graphify-out/graph.json` (built graph) at project root
- `~/.graphify/global-graph.json` (global cross-project graph)

---

## 5. OpenWiki — `langchain-ai/openwiki`

**What it does**: A CLI that writes and maintains an agent-readable Markdown wiki
of the codebase. Same "don't make the agent grep" goal as SocratiCode/Graphify,
but the artefact is prose documentation committed to the repo rather than an
index — humans read it too, and `git diff` shows how the understanding changed.

**Key mechanics**
- `openwiki --init` generates the wiki, `openwiki --update` refreshes it after
  code changes; generation is agent-driven, so it costs LLM calls each run.
- Output lives in `openwiki/`, with `openwiki/INSTRUCTIONS.md` as the
  user-authored scope/priorities file; `.openwikiignore` excludes paths.
- Rewrites a pointer section into `CLAUDE.md` / `AGENTS.md` so agents pick the
  wiki up as memory without extra wiring — no MCP server, no hooks, no skill.
- Ships CI templates (`openwiki-update.yml` for GitHub Actions, plus GitLab and
  Bitbucket variants) that open a documentation PR when the code changes.
- Needs a provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
  or `OPENROUTER_API_KEY`); credentials persist in `~/.openwiki/.env`.
- A `personal` mode keeps a separate wiki under `~/.openwiki/wiki/`, and
  `openwiki visualize` opens the wiki as an explorable node graph.

**Detection signals in `ai-env-manager`**
- `openwiki` binary in PATH
- `openwiki/INSTRUCTIONS.md` or `openwiki/.langsmith.json` at project root
- `.openwikiignore` file at project root
- `.github/workflows/openwiki-update.yml` (CI auto-update)
- `openwiki` mentioned in `CLAUDE.md` or `AGENTS.md`
- `~/.openwiki/.env` (credentials) and `~/.openwiki/wiki/` (personal mode)

---

## 6. CodeAlmanac — `AlmanacCode/codealmanac`

**What it does**: A codebase wiki for AI agents, aimed at what the code itself
cannot state — why a design was chosen, what broke before, which invariants
matter, how a workflow crosses files and services. Same committed-Markdown
artefact as OpenWiki, but the writing is sourced from your *agent sessions*
rather than from a pass over the source tree.

**Key mechanics**
- `codealmanac setup` picks a runner (Codex by default, `--runner claude` for
  Claude Code), installs agent instructions, and registers three local
  `launchd` jobs: sync (5 h), garden (24 h), update (24 h).
- The sync job reads existing Codex/Claude conversations and ingests what is
  worth keeping — the wiki grows as a by-product of normal work rather than
  from an explicit regeneration command.
- `codealmanac init` scaffolds `almanac/` (`topics.yaml`, `architecture/`,
  `decisions/`, `guides/`); `.almanac.yaml` holds repo-level settings.
- Reuses the existing agent's authentication, so there is no separate provider
  key; indexing and agent execution stay on the machine (`~/.codealmanac/`).
- `codealmanac serve` opens a local wiki viewer; `search`/`show` query it. No
  MCP server and no Claude Code plugin — the integration is the agent
  instructions plus the committed Markdown.
- Constraints: macOS only for now, Python 3.12+, installed from PyPI via
  `uv tool install` (the old npm CLI is retired). `DO_NOT_TRACK=1` opts out of
  telemetry.

**Detection signals in `ai-env-manager`**
- `codealmanac` binary in PATH
- `almanac/topics.yaml` (or `almanac/README.md`) at project root
- `.almanac.yaml` file at project root
- `codealmanac` mentioned in `CLAUDE.md` or `AGENTS.md`
- `~/.codealmanac/config.toml` and `~/.codealmanac/codealmanac.db`

---

## Comparison at a glance

| Dimension            | Headroom              | ECC                       | SocratiCode             | Graphify                | OpenWiki                | CodeAlmanac             |
|----------------------|-----------------------|---------------------------|-------------------------|--------------------------|-------------------------|-------------------------|
| Primary lever        | Compress inputs       | Orchestrate agent behaviour | Index codebase          | Index codebase + docs   | Write codebase docs     | Write codebase docs     |
| Deployment           | Binary / proxy / MCP  | Plugin (all-in-one)       | MCP via Docker          | CLI + skill + MCP       | CLI + CI workflow       | CLI + launchd jobs      |
| Scope                | Any content type      | AI harness configuration  | Code understanding only | Code + docs/PDF         | Code understanding only | Decisions, flows, invariants, gotchas |
| Requires setup       | Minimal               | Opinionated / large       | Docker required         | Minimal (no Docker)     | Minimal + provider key  | macOS + Python 3.12+    |
| Cross-tool           | Yes (any LLM)         | Yes (multi-harness)       | Yes (via MCP)           | Yes (15+ platforms)     | Yes (CLAUDE.md/AGENTS.md) | Claude Code or Codex   |
| Artefact             | None (in-flight)      | Config files              | Vector index            | `graphify-out/graph.json` | `openwiki/` Markdown (committed) | `almanac/` Markdown (committed) |
| Recurring LLM cost   | No                    | No                        | No (local embeddings)   | No (AST parsing)        | Yes (each generation)   | Yes (reuses agent auth) |
| Fed by               | —                     | —                         | Source tree             | Source tree + docs      | Source tree             | Your agent sessions     |
| Overlaps with others | RTK (token reduction) | Caveman (token reduction) | Graphify, OpenWiki, CodeAlmanac (codebase understanding) | SocratiCode, OpenWiki, CodeAlmanac (codebase understanding) | SocratiCode, Graphify, CodeAlmanac (codebase understanding) | OpenWiki most directly (same wiki artefact) |

## When to pick one

- **Headroom**: best fit when the bottleneck is *verbose tool outputs or large
  RAG/log payloads* hitting the context limit; the proxy mode requires zero
  code changes.
- **ECC**: best fit when you want a *pre-baked, opinionated workflow* covering
  agents + skills + hooks across multiple AI tools at once; heavier install.
- **SocratiCode**: best fit when working on *large or unfamiliar codebases*
  where grep/file-read exploration is too slow or too costly, and vector-based
  semantic search (plus Docker) is acceptable overhead.
- **Graphify**: same "stop grepping" niche as SocratiCode, but favours a
  deterministic AST-derived graph over vector embeddings, needs no Docker, and
  also ingests docs/PDFs alongside code — pick it when traceability of *why*
  two things are linked matters more than fuzzy semantic recall, or when the
  codebase's docs are as important as its code.
- **OpenWiki**: same "stop grepping" niche again, but the output is prose the
  team reads too, reviewable in PRs and versioned with the code. Pick it when
  the codebase is under-documented for *humans* as much as for agents, and when
  paying LLM calls on every regeneration is acceptable; skip it if you only want
  a machine-side index, since SocratiCode and Graphify do that without recurring
  token cost.
- **CodeAlmanac**: closest to OpenWiki — both commit a Markdown wiki — but the
  two differ in where the content comes from. OpenWiki reads the source tree on
  demand; CodeAlmanac harvests the sessions you already run, so it captures the
  reasoning and the dead ends that never made it into the code. Pick it when the
  knowledge you keep losing is *why* rather than *what*, and when macOS-only plus
  a background daemon are acceptable; pick OpenWiki instead if you need CI-driven
  regeneration or run on Linux.

If forced to pick one for a "quick AI workspace setup": **SocratiCode,
Graphify, OpenWiki or CodeAlmanac** add a capability not covered by anything
else already in this repo (RTK and Caveman already cover token reduction; ECC
would replace/conflict with existing skill and hook setup) — pick whichever of
the four matches your Docker tolerance, whether docs/PDFs matter, whether the
output should be readable by the team, and whether you want it fed by the source
tree or by your own sessions, not several.
