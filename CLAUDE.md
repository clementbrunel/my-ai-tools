# CLAUDE.md

Monorepo of small CLI tools for Claude Code / AI environment inspection.

## Structure

Each tool lives in its own subdirectory with its own `package.json`, `src/`, and `README.md`.

| Directory         | Tool             | Description                                                     |
|-------------------|------------------|-----------------------------------------------------------------|
| `ai-env-diagram/` | `ai-env-diagram` | Scans project, generates Mermaid diagram of AI setup            |
| `mistral-chat/`   | `mistral-chat`   | Interactive CLI REPL for enterprise Mistral via browser cookies |

## Adding a new tool

1. Create a new directory: `mkdir my-new-tool && cd my-new-tool`
2. Add `package.json`, `tsconfig.json`, `src/`, `README.md`
3. Add a row to the table above and in the root `README.md`

## Common commands (per tool)

```bash
cd ai-env-diagram
npm install       # install deps
npm run build     # TS → dist/
npm run dev       # build + run
npm start         # run dist/index.js
```

No tests, no linter.
