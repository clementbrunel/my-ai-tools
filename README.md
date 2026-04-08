# my-ai-tools

A personal collection of AI development tools for inspecting, diagnosing, and optimizing AI-assisted coding environments.

## Tools

### `ai-env-diagram` — AI Environment Diagram

Scans your project's Claude Code / AI environment and generates a **Mermaid diagram** that visualizes all connected components and their health status.

#### What it detects

| Component | Sources scanned |
|-----------|----------------|
| **MCP Servers** | `.mcp.json`, `.claude/settings.json`, `~/.claude/settings.json` |
| **Context Files** | `CLAUDE.md` (project, parent dirs, home), `.claude/` directory |
| **Hooks** | `PreToolUse`, `PostToolUse`, `Stop`, etc. from settings |
| **Environment Variables** | All env vars referenced by MCP server configs |

#### What it reports

- **Status per component**: OK (green), Warning (orange), Error (red)
- **Missing API keys**: detects unset `*_API_KEY`, `*_TOKEN`, `*_SECRET` env vars
- **Unavailable commands**: checks if MCP server commands exist in `PATH`
- **Missing hook scripts**: verifies hook scripts exist and are executable

#### Usage

```bash
# Scan the current directory
npx ai-env-diagram

# Scan a specific project
npx ai-env-diagram --path /path/to/project

# Write diagram to a file
npx ai-env-diagram --output diagram.md

# Include a summary table with errors/warnings
npx ai-env-diagram --summary
```

#### Example output

Running `ai-env-diagram` on a project with GitHub, Filesystem, and Slack MCP servers (where Slack is missing its API tokens):

```mermaid
graph LR

  Claude["🤖 Claude Code"]

  subgraph MCP_Servers[MCP Servers]
    mcp_github["github ❌<br/><i>Missing API key: GITHUB_TOKEN</i><br/><small>stdio: npx</small>"]:::error
    mcp_filesystem["filesystem ✅<br/><small>stdio: npx</small>"]:::ok
    mcp_slack["slack ❌<br/><i>Missing API key: SLACK_BOT_TOKEN<br/>Missing API key: SLACK_API_KEY</i><br/><small>stdio: npx</small>"]:::error
  end

  subgraph Context[Context Files]
    ctx_claude_md["CLAUDE.md ✅<br/><small>project · 1.2KB</small>"]:::ok
  end

  subgraph Hooks[Hooks]
    hook_stop["Stop ✅"]:::ok
  end

  env_summary["Env Vars ❌<br/><small>0/3 set</small><br/><i>Missing: GITHUB_TOKEN, SLACK_BOT_TOKEN, SLACK_API_KEY</i>"]:::error

  Claude --> mcp_github
  Claude --> mcp_filesystem
  Claude --> mcp_slack
  Claude --> ctx_claude_md
  Claude --> hook_stop
  Claude --> env_summary

  classDef ok fill:#2ea043,stroke:#2ea043,color:#fff
  classDef warning fill:#d29922,stroke:#d29922,color:#fff
  classDef error fill:#cf222e,stroke:#cf222e,color:#fff
```

## Getting Started

```bash
# Clone the repo
git clone https://github.com/clementbrunel/my-ai-tools.git
cd my-ai-tools

# Install dependencies
npm install

# Build
npm run build

# Run
node dist/index.js --path /your/project
```

## Project Structure

```
src/
  index.ts              — CLI entrypoint
  types.ts              — Shared type definitions
  scanner/
    mcp.ts              — MCP server detection & validation
    context.ts          — Context file detection (CLAUDE.md, etc.)
    hooks.ts            — Hooks configuration scanning
    env.ts              — Environment variable checking
  diagram/
    mermaid.ts          — Mermaid diagram generation
```

## Roadmap

Future tools to be added to this collection:

- **ai-env-diff** — Compare AI environment configurations between branches or projects
- **ai-context-lint** — Validate and lint CLAUDE.md files for best practices
- **ai-mcp-test** — Run health checks against live MCP server connections

## License

MIT
