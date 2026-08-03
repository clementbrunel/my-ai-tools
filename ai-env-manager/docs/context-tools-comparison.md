# Context-window tools — quick comparison

Four tools spotted as potential additions to a Claude Code AI workspace setup.
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

## Comparison at a glance

| Dimension            | Headroom              | ECC                       | SocratiCode             | Graphify                |
|----------------------|-----------------------|---------------------------|-------------------------|--------------------------|
| Primary lever        | Compress inputs       | Orchestrate agent behaviour | Index codebase          | Index codebase + docs   |
| Deployment           | Binary / proxy / MCP  | Plugin (all-in-one)       | MCP via Docker          | CLI + skill + MCP       |
| Scope                | Any content type      | AI harness configuration  | Code understanding only | Code + docs/PDF         |
| Requires setup       | Minimal               | Opinionated / large       | Docker required         | Minimal (no Docker)     |
| Cross-tool           | Yes (any LLM)         | Yes (multi-harness)       | Yes (via MCP)           | Yes (15+ platforms)     |
| Overlaps with others | RTK (token reduction) | Caveman (token reduction) | Graphify (codebase indexing) | SocratiCode (codebase indexing) |

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

If forced to pick one for a "quick AI workspace setup": **SocratiCode or
Graphify** add a capability not covered by anything else already in this repo
(RTK and Caveman already cover token reduction; ECC would replace/conflict
with existing skill and hook setup) — pick whichever of the two matches your
Docker tolerance and whether docs/PDFs matter, not both.
