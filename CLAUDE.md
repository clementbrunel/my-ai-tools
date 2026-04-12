# CLAUDE.md

CLI toolbox for Claude Code / AI env inspection. Tool: `ai-env-diagram` — scans project, generates Mermaid diagram of AI setup.

## Commands
```bash
npm run build   # TS → dist/
npm run dev     # build + run
npm start       # run dist/index.js
```
No tests, no linter.

## Architecture
```
src/
  index.ts          — CLI entrypoint, orchestrates scanners
  types.ts          — McpServer, Hook, ContextFile, ModelInfo, Integration, ScanResult
  scanner/
    model.ts        — reads model from settings.json or ANTHROPIC_MODEL
    mcp.ts          — detects MCP servers, validates commands & env vars
    context.ts      — finds CLAUDE.md files, estimates token count
    hooks.ts        — reads Pre/PostToolUse/Stop hooks, verifies scripts
    integrations.ts — detects MemPalace, Caveman, RTK
    env.ts          — aggregates env var status across MCP servers
  diagram/
    mermaid.ts      — ScanResult → Mermaid graph + optional summary table
```
Data flow: scanners → `ScanResult` in `index.ts` → `generateMermaid()`.

## Key Patterns
- Every component: `status: "ok"|"warning"|"error"` + `diagnostics: string[]`
- No external runtime deps beyond chalk + commander
- ESM only (`"type": "module"`) — use `.js` extensions in imports

## Adding a Scanner
1. `src/scanner/<name>.ts` → `scan<Name>(projectPath): <ResultType>`
2. Add type to `types.ts` + `ScanResult`
3. Wire in `index.ts`
4. Add rendering block in `diagram/mermaid.ts`

## CLI
```bash
npx ai-env-diagram                    # scan current dir
npx ai-env-diagram --path /some/proj  # scan other project
npx ai-env-diagram --output out.md    # write to file
npx ai-env-diagram --summary          # include error/warning table
```
