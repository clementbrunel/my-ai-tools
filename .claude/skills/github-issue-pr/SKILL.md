---
name: github-issue-pr
description: Create or update GitHub issues and pull requests (MRs) in the my-ai-tools monorepo, always attaching the right sub-project label (ai-env-manager, mistral-chat, mottaret-watch, prono-core, my-house) so work is traceable to the correct tool. Use whenever asked to open/file a GitHub issue, create a PR/MR, report a bug or feature request for one of this repo's tools, or to label/relabel existing issues and PRs — including French phrasing like "crée une issue", "ouvre une PR/MR", "ajoute un label", "rattache ce ticket à <tool>".
---

# GitHub issues & PRs in this monorepo

`my-ai-tools` hosts several unrelated tools in one repo (see the table in the root
`CLAUDE.md`). Without labels, issues/PRs from every tool pile up in one flat list with no way
to filter by sub-project. This skill keeps that filterable: every issue and PR gets a label
naming the sub-project(s) it belongs to.

## Label convention

One label per sub-project, named **exactly** like its directory (lowercase, hyphenated, no
prefix such as `project:` or `area/`):

- `ai-env-manager`
- `mistral-chat`
- `mottaret-watch`
- `prono-core`
- `my-house`

Root-level or cross-cutting changes (root `README.md`, `CLAUDE.md`, CI config, repo-wide
tooling) get **no** sub-project label — don't force one just to have one.

If a brand-new tool directory is being added, add it to the table in root `CLAUDE.md` and
`README.md` first (per CLAUDE.md's "Adding a new tool" section), then use that directory name
as the label.

## Determining which label(s) apply

- Title/body names a tool explicitly (existing convention here: `prono-core: ...`,
  `mottaret-watch fails to ...`) → that tool's label.
- For a PR, map the changed files' top-level directories to labels (`git diff --name-only
  <base>...HEAD`, or the PR's file list) — a PR touching more than one subdirectory gets every
  matching label.
- When genuinely ambiguous, ask rather than guessing.

## Applying labels (GitHub MCP tools)

There is no dedicated label-creation tool in this environment — and none is needed: applying
an unknown label name to an issue/PR creates it automatically on first use (default grey
color, empty description). Don't try to work around that or hand-craft colors/descriptions.

- **New issue**: `mcp__github__issue_write` with `method: "create"` and `labels: ["<tool>"]`
  (multiple entries if it spans tools).
- **Existing issue**: `mcp__github__issue_write` with `method: "update"`, `issue_number`, and
  `labels: [...]`. This **replaces** the label set — if the issue may carry other labels worth
  keeping, read it first with `mcp__github__issue_read` and include them in the array too.
- **New PR**: `mcp__github__create_pull_request` has no `labels` field. Create the PR first,
  then label it via `mcp__github__issue_write` (`method: "update"`, `issue_number: <PR
  number>`) — PRs are issues under the GitHub REST/GraphQL model, so the same call works.
- **Existing PR**: same `issue_write` update call, addressed by PR number.

## Before finishing

1. Title/body still make sense standalone — don't lean on the label to explain scope.
2. Every sub-project actually touched has its label; nothing untouched has one it shouldn't.
3. If a brand-new label got created (new tool, first issue/PR), say so — a grey, no-description
   label is easy to miss on the GitHub labels page and may be worth a color/description tweak
   by hand later (not available through these tools).
