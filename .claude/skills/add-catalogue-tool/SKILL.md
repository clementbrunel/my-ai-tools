---
name: add-catalogue-tool
description: Add a new AI tool/library (plugin, MCP server, pip/npm package, CLAUDE.md drop-in, etc.) to ai-env-diagram's managed catalogue and scanner. Use this whenever the user wants to add, register, or wire up a new "managed library", "candidate", or "integration" for ai-env-diagram — phrases like "ajoute X à la bibliothèque/au catalogue", "add X to ai-env-diagram", "add a new candidate tool", or when given a GitHub link to a Claude Code plugin/skill/MCP server and asked to make ai-env-diagram detect and offer it for installation. Covers both the interactive `--prepare` installer (catalogue.ts) and the passive scanner (scanner/integrations/) that reports whether a tool is already in use.
---

# Add a tool to ai-env-diagram's catalogue

`ai-env-diagram` (in this monorepo) has two coupled systems for "managed" AI tools:

1. **Catalogue** (`ai-env-diagram/src/prepare/catalogue.ts`) — what the interactive `--prepare`
   installer offers: name, pitch, install steps, conflict rules.
2. **Scanner integration** (`ai-env-diagram/src/scanner/integrations/<id>.ts`) — how the passive
   scan detects whether the tool is *already* configured in a project, so the report doesn't
   suggest installing something that's already there.

Adding a tool means touching both, plus tests and docs. Do the steps in order — later steps
depend on decisions made earlier (e.g. you can't write `INTEGRATION_TO_TOOL` until the catalogue
`id` and the detector's `Integration.name` both exist).

All work happens inside `ai-env-diagram/`; run `npm run build` and `npx vitest run` from that
directory before considering the job done.

## Step 1 — Research the tool

Before writing anything, pin down:

- **What it is and what problem it solves** (one sentence, for the `why`/`tagline` fields).
- **How it's installed.** Read the repo's README (fetch it directly — `raw.githubusercontent.com/<owner>/<repo>/<branch>/README.md` is more reliable than a rendered page, and don't trust a single fetch's numbers like star counts without a second source; those get hallucinated by page summarizers). Concretely: is it a
  - **Claude Code plugin** (`/plugin marketplace add <owner>/<repo>` + `/plugin install <name>@<marketplace>`),
  - **MCP server** (`claude mcp add ...`),
  - **pip/npm package**,
  - **CLAUDE.md / rule file drop-in** (curl a file into the repo, no runtime component), or
  - some combination?
- **Concrete detection signals** — the *evidence* the scanner can check for after install: a
  binary in PATH, an MCP server name/command substring, a config file path (project root and/or
  `~`), specific env vars, a plugin entry in `~/.claude/settings.json` (via `detectPlugin()`), or
  a text reference inside `CLAUDE.md` / `.claude/settings.json`. If the tool is *only* a
  CLAUDE.md drop-in with no other footprint, the detector will mostly rely on grepping CLAUDE.md
  for a distinctive phrase or heading — say so explicitly rather than inventing a config file
  that doesn't exist.

Check first whether the tool is already in `CATALOGUE` (`ai-env-diagram/src/prepare/catalogue.ts`)
under a different name/link — several plugins get re-hosted or forked, and duplicating an entry
just adds confusion.

## Step 2 — Add the `CatalogueTool` entry

In `src/prepare/catalogue.ts`:

1. Extend the `ToolId` union with the new id (short, lowercase, hyphenated if needed).
2. Add an entry to `CATALOGUE: CatalogueTool[]` with `id`, `name`, `tagline`, `why`, and `steps`
   (`InstallStep[]`, each with a `label` and either a runnable `command` or a `manual` instruction
   — use `manual` for anything that requires an interactive Claude Code session, like
   `/plugin install ...`).
3. **Write `tagline`, `why`, and any `CONFLICT_GROUPS[].note` in French** — that matches the rest
   of this file and the project's `CLAUDE.md`. Everything else (ids, code, comments, test names)
   stays in English.

## Step 3 — Decide on conflicts

Only set `conflictGroup` if the tool genuinely overlaps in *purpose* with an existing group
(currently `token` = token/output reduction, `memory` = project memory / codebase indexing —
see `CONFLICT_GROUPS`). Most tools (like `ecc`) don't belong to a group at all — leave
`conflictGroup` unset rather than forcing a fit.

If there's a narrower, one-off conflict that isn't a full group (like the ECC-bundles-Caveman
case), add a special-case check at the bottom of `getConflicts()` instead of inventing a group
for just one pair.

## Step 4 — Write the detector

Create `src/scanner/integrations/<id>.ts` exporting `detect<Tool>(...)`. Look at the existing
detectors first and copy the shape closest to your tool's install method:

- **Plugin-based** (installed via `/plugin install`) → `caveman.ts` or `ecc.ts`: use
  `detectPlugin(namePattern, marketplaceDirName)` from `../../utils.js` first; fall back to
  signal-collection (MCP server match, env vars, file references) if no plugin is found.
- **MCP server + config file** → `headroom.ts` or `mempalace.ts`: check `mcpServers` for a
  name/command/arg match, plus a project or home-dir config file.
- **CLI proxy / hook-only** → `rtk.ts`: check `isCommandAvailable()`, a doc file (e.g. `RTK.md`),
  a matching hook, and/or a CLAUDE.md reference — treat CLAUDE.md-only configuration as a valid,
  complete signal (not a warning) when that's the tool's documented standard usage.

Return an `Integration` (`../../types.js`): `detected: false` with a `warning` status and a
diagnostic explaining exactly what was checked, when nothing matches; otherwise `detected: true`
with `source` describing where it was found and `status` reflecting whether the install looks
complete (`ok`) or partial (`warning`/`error`, with a diagnostic saying what's missing — e.g. a
plugin installed but its binary isn't on PATH).

## Step 5 — Wire it in

- Import and call the new `detect<Tool>` in `src/scanner/integrations/index.ts` (`scanIntegrations`).
- Add `"<Integration.name>": "<ToolId>"` to `INTEGRATION_TO_TOOL` in `catalogue.ts` — this is what
  lets `suggestMissing()` recognize "this tool is already handled, don't suggest an alternative
  from its conflict group."

## Step 6 — Hook provider entry (only if relevant)

If the tool registers Claude Code hooks (PreToolUse/PostToolUse/SessionStart/etc.), add an entry
to `HOOK_PROVIDER_CATALOGUE` in `src/scanner/hook-providers.ts`, keyed by the hook command's
executable name, with per-event descriptions of what each hook does. Skip this step entirely if
the tool has no hook footprint — most don't.

## Step 7 — Tests

Add detector tests to `src/__tests__/integrations.new.test.ts` (or a new file if that one gets
unwieldy), mirroring the existing `describe("detect<Tool>", ...)` blocks: not-detected on an
empty temp dir, detected via a mocked MCP server if applicable, detected via a config/marker file
if applicable. Add or extend cases in `src/__tests__/prepare.catalogue.test.ts` if the new tool
changes `suggestMissing()` or `getConflicts()` behavior (e.g. it joins an existing conflict group,
or you added a special-case conflict rule).

## Step 8 — Docs

Update `ai-env-diagram/README.md`: append the tool to the **Integrations** row's link list and to
the **Project structure** file tree (list the new `integrations/<id>.ts` line). Only touch
`docs/context-tools-comparison.md` if the new tool is genuinely comparable to what's already
discussed there (same problem space) — it's a comparison note, not a full catalogue index, so
don't force an entry that doesn't add a useful contrast.

## Step 9 — Verify

From `ai-env-diagram/`, run:

```bash
npm run build
npx vitest run
```

Both must pass before the tool is considered added. A build error usually means the `ToolId`
union, `INTEGRATION_TO_TOOL` key, or an import path is out of sync — check those first.
