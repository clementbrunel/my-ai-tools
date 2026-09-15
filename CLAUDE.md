# CLAUDE.md

Monorepo of small CLI tools for Claude Code / AI environment inspection.

## Structure

Each tool lives in its own subdirectory with its own `package.json`, `src/`, and `README.md`.

| Directory         | Tool             | Description                                                     |
|-------------------|------------------|-----------------------------------------------------------------|
| `ai-env-manager/` | `ai-env-manager` | Scans, diagnoses, and manages a Claude Code project's AI setup (MCP servers, context, hooks, tool updates, install catalogue, post-install verification, Claude → Mistral migration) |
| `mistral-chat/`   | `mistral-chat`   | Interactive CLI REPL for enterprise Mistral via browser cookies |
| `mottaret-watch/`  | `mottaret-watch`  | Python cron (GitHub Actions) — scrapes rental availability, emails alerts |
| `prono-core/`      | `prono-core`      | Full-stack World Cup 2026 betting app (Java/Spring + React)              |
| `my-house/`        | `my-house`        | Home Assistant setup (NAS Docker or Pi 3B+ HAOS) + Somfy RTS/Zigbee      |
| `spec-doc-jxml-merger/` | `spec-doc-jxml-merger` | Merges a project's Word spec with its JWAY JXML source into a single editable, version-tracked markdown (Java/Spring Boot + React + Postgres) |

## Adding a new tool

1. Create a new directory: `mkdir my-new-tool && cd my-new-tool`
2. Add `package.json`, `tsconfig.json`, `src/`, `README.md`
3. Add a row to the table above and in the root `README.md`

## GitHub issues & PRs

Every issue/PR gets a label matching the sub-project directory it belongs to (`ai-env-manager`,
`mistral-chat`, `mottaret-watch`, `prono-core`, `my-house`) so work stays filterable by tool in
this monorepo. See `.claude/skills/github-issue-pr/` for the convention and how to apply it.

## Common commands (per tool)

```bash
cd ai-env-manager
npm install       # install deps
npm run build     # TS → dist/
npm run dev       # build + run
npm start         # run dist/index.js
```

No tests, no linter.
