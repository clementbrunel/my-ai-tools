# ai-env-manager

Scans, diagnoses, and manages your Claude Code / AI environment: prints a status report in the terminal (optionally writes a Markdown report to a file), checks for tool updates, and offers a catalogue of recommended tools with guided or automated installation.

## What it detects

| Component | Sources scanned |
|---|---|
| **Model** | `.claude/settings.json`, `~/.claude/settings.json`, `ANTHROPIC_MODEL` env var |
| **MCP Servers** | `.mcp.json`, `.claude/settings.json`, `~/.claude/settings.json`, `claude_desktop_config.json` |
| **Context Files** | `CLAUDE.md` (project, parent dirs, user), `.claude/` directory |
| **Hooks** | `PreToolUse`, `PostToolUse`, `Stop`, etc. from settings |
| **Integrations** | [MemPalace](https://www.mempalace.tech/), Caveman skill, [RTK](https://www.rtk-ai.app/), [Headroom](https://github.com/chopratejas/headroom), [ECC](https://github.com/affaan-m/ECC), [SocratiCode](https://github.com/giancarloerra/SocratiCode), [Andrej Karpathy Skills](https://github.com/forrestchang/andrej-karpathy-skills), [Graphify](https://github.com/Graphify-Labs/graphify), [Ponytail](https://github.com/DietrichGebert/ponytail), [CodeBurn](https://github.com/getagentseal/codeburn), [OpenWiki](https://github.com/langchain-ai/openwiki) |
| **Env Vars** | All env vars referenced by MCP server configs |

## What it reports

- **Model**: warns if unset, errors if not Sonnet
- **Context files**: token estimate per file (~4 chars/token), warns above 500t, errors above 1000t
- **MCP servers**: command availability in PATH, missing API keys
- **Hooks**: script existence and executability
- **Integrations**: detection status, active config detail
- **Status levels**: `ok` (green) · `warning` (yellow) · `error` (red) · `outdated` (blue)

## Usage

```bash
# Scan current directory
npx ai-env-manager

# Scan a specific project
npx ai-env-manager --path /path/to/project

# Write a Markdown report to a file
npx ai-env-manager --output report.md

# Check for updates on detected AI tools and apply them
npx ai-env-manager update --path /path/to/project

# Show the recommended tools catalogue and an install plan for missing ones
npx ai-env-manager prepare --path /path/to/project

# Install specific tools from the catalogue
npx ai-env-manager prepare --with rtk,mempalace --install
```

## Example output

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
+-------------------------+---------+--------+--------+---------+
| ~/.claude/CLAUDE.md     | user    | 8.1 KB | 2.0kt  | error   |
+-------------------------+---------+--------+--------+---------+

  ── INTEGRATIONS
+-------------------------+----------+--------+--------+
| Name                    | Detected | Detail | Status |
+-------------------------+----------+--------+--------+
| MemPalace               | yes      | ...    | ok     |
| Caveman                 | yes      | full   | ok     |
| RTK (Rust Token Killer) | yes      | —      | ok     |
+-------------------------+----------+--------+--------+

  1 warning(s):
     • CLAUDE.md: estimated token count is high (507t ≥ 500t)
```

## Getting started

```bash
git clone https://github.com/clementbrunel/my-ai-tools.git
cd my-ai-tools/ai-env-manager
npm install
npm run build
node dist/index.js --path /your/project
```

## Project structure

```
src/
  index.ts                    — CLI entry point
  types.ts                    — Shared type definitions
  scanner/
    model.ts                  — Model check
    mcp.ts                    — MCP server detection & validation
    context.ts                — Context file detection + token estimation
    hooks.ts                  — Hooks configuration scanning
    hook-providers.ts         — Known hook provider metadata
    env.ts                    — Environment variable aggregation
    integrations/
      index.ts                — Integration orchestrator
      mempalace.ts            — MemPalace detection
      caveman.ts              — Caveman skill detection
      rtk.ts                  — RTK detection
      headroom.ts             — Headroom detection
      ecc.ts                  — ECC detection
      socraticode.ts          — SocratiCode detection
      karpathy-skills.ts      — Andrej Karpathy Skills detection
      graphify.ts             — Graphify detection
      ponytail.ts             — Ponytail detection
      codeburn.ts             — CodeBurn detection
      openwiki.ts             — OpenWiki detection
  diagram/
    table.ts                  — Console table + Markdown report rendering
  updater/
    index.ts                  — Update checking & applying
  prepare/
    catalogue.ts               — Recommended tools catalogue & conflict rules
    installer.ts               — Automated install execution
    render.ts                  — Catalogue, install plan & suggestion rendering
```

## License

MIT
