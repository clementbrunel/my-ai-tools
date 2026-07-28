# Context-window tools — quick comparison

Three tools spotted as potential additions to a Claude Code AI workspace setup.
They each attack a different slice of the "context problem", but their scopes overlap
enough that running all three simultaneously would likely produce redundancy and
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

**Detection signals in `ai-env-diagram`**
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

**Detection signals in `ai-env-diagram`**
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

**Detection signals in `ai-env-diagram`**
- MCP server entry matching `socraticode` / `socrati`
- Plugin entry matching `socraticode`
- `socraticode` binary in PATH
- `.socraticodeignore` file at project root
- Docker container named `socraticode`

---

## Comparison at a glance

| Dimension            | Headroom              | ECC                       | SocratiCode             |
|----------------------|-----------------------|---------------------------|-------------------------|
| Primary lever        | Compress inputs       | Orchestrate agent behaviour | Index codebase          |
| Deployment           | Binary / proxy / MCP  | Plugin (all-in-one)       | MCP via Docker          |
| Scope                | Any content type      | AI harness configuration  | Code understanding only |
| Requires setup       | Minimal               | Opinionated / large       | Docker required         |
| Cross-tool           | Yes (any LLM)         | Yes (multi-harness)       | Yes (via MCP)           |
| Overlaps with others | RTK (token reduction) | Caveman (token reduction) | Nothing in current set  |

## When to pick one

- **Headroom**: best fit when the bottleneck is *verbose tool outputs or large
  RAG/log payloads* hitting the context limit; the proxy mode requires zero
  code changes.
- **ECC**: best fit when you want a *pre-baked, opinionated workflow* covering
  agents + skills + hooks across multiple AI tools at once; heavier install.
- **SocratiCode**: best fit when working on *large or unfamiliar codebases*
  where grep/file-read exploration is too slow or too costly; needs Docker.

If forced to pick one for a "quick AI workspace setup": **SocratiCode** adds
a capability not covered by anything else already in this repo (RTK and Caveman
already cover token reduction; ECC would replace/conflict with existing skill
and hook setup).
