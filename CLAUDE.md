# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

`my-ai-tools` is a personal CLI toolbox for inspecting and diagnosing Claude Code / AI environments. The only tool so far is `ai-env-diagram`, which scans a project and generates a Mermaid diagram of its AI setup (model, MCP servers, context files, hooks, integrations, env vars).

## Commands

```bash
npm run build   # Compile TypeScript → dist/
npm run dev     # Build + run immediately
npm start       # Run compiled dist/index.js
```

No tests yet. No linter configured.

## Architecture

```
src/
  index.ts              — CLI entrypoint (commander), orchestrates scanners
  types.ts              — Shared types: McpServer, Hook, ContextFile, ModelInfo, Integration, ScanResult
  scanner/
    model.ts            — Reads model from settings.json or ANTHROPIC_MODEL env var
    mcp.ts              — Detects MCP servers from .mcp.json / settings.json, validates commands & env vars
    context.ts          — Finds CLAUDE.md files (project, parent dirs, ~/.claude), estimates token count
    hooks.ts            — Reads PreToolUse / PostToolUse / Stop hooks, verifies script existence
    integrations.ts     — Detects MemPalace, Caveman, RTK by checking paths, binaries, and hooks
    env.ts              — Aggregates env var status across all MCP servers
  diagram/
    mermaid.ts          — Renders ScanResult → Mermaid graph + optional summary table
```

**Data flow**: each scanner returns a typed result → `ScanResult` is assembled in `index.ts` → passed to `generateMermaid()`.

## Key Patterns

- **Status model**: every component carries `status: "ok" | "warning" | "error"` + a `diagnostics: string[]` array for human-readable messages.
- **No external runtime deps beyond chalk + commander** — keep it that way unless there is a strong reason.
- **ESM only** (`"type": "module"` in package.json) — use `.js` extensions in all imports, even for `.ts` source files.
- When adding a new scanner, add its return type to `types.ts`, wire it in `index.ts`, and add a node group in `diagram/mermaid.ts`.

## Adding a New Scanner

1. Create `src/scanner/<name>.ts` with a `scan<Name>(projectPath: string): <ResultType>` function.
2. Add the result type to [src/types.ts](src/types.ts) and to the `ScanResult` interface.
3. Call it in [src/index.ts](src/index.ts) and include its output in the `result` object.
4. Add a rendering block in [src/diagram/mermaid.ts](src/diagram/mermaid.ts).

## CLI Usage

```bash
npx ai-env-diagram                    # Scan current directory
npx ai-env-diagram --path /some/proj  # Scan another project
npx ai-env-diagram --output out.md    # Write to file
npx ai-env-diagram --summary          # Include error/warning table
```
