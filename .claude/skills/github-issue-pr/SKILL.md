---
name: github-issue-pr
description: Create or update GitHub issues and pull requests (MRs) in the my-ai-tools monorepo, always attaching the right sub-project label (one per directory listed in the root CLAUDE.md table — currently ai-env-manager, mistral-chat, mottaret-watch, prono-core, my-house, my-money-hub, spec-merger) so work is traceable to the correct tool. Use whenever asked to open/file a GitHub issue, create a PR/MR, report a bug or feature request for one of this repo's tools, or to label/relabel existing issues and PRs — including French phrasing like "crée une issue", "ouvre une PR/MR", "ajoute un label", "rattache ce ticket à <tool>".
---

# GitHub issues & PRs in this monorepo

`my-ai-tools` hosts several unrelated tools in one repo (see the table in the root
`CLAUDE.md`). Without labels, issues/PRs from every tool pile up in one flat list with no way
to filter by sub-project. This skill keeps that filterable: every issue and PR gets a label
naming the sub-project(s) it belongs to.

**A PR or issue is not done until its label call has been made and its response checked.**
Creating the PR/issue is not the deliverable here — the labeled PR/issue is. Don't treat
labeling as cleanup to get to "eventually"; it's step 2 of a 2-step sequence, done in the same
turn as step 1, every time, with no exceptions for small or "obviously fine" changes.

## Label convention

One label per sub-project, named **exactly** like its directory (lowercase, hyphenated, no
prefix such as `project:` or `area/`). **Read the table in root `CLAUDE.md` at the start of
every run of this skill** and derive the label set from its directory column — don't rely on
a hardcoded list here, since it goes stale the moment a directory is added or renamed (this
happened before: `spec-merger` and `my-money-hub` existed in `CLAUDE.md` but were missing from
this file, and PRs for `spec-merger` — the busiest tool in the repo — kept shipping unlabeled
as a result). As of the last time this skill was edited, the table has:

- `ai-env-manager`
- `mistral-chat`
- `mottaret-watch`
- `prono-core`
- `my-house`
- `my-money-hub`
- `spec-merger`

Treat that list as an example, not the source of truth — always re-check `CLAUDE.md` itself.

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
  (multiple entries if it spans tools). One call, labels included — nothing further needed.
- **Existing issue**: `mcp__github__issue_write` with `method: "update"`, `issue_number`, and
  `labels: [...]`. This **replaces** the label set — if the issue may carry other labels worth
  keeping, read it first with `mcp__github__issue_read` and include them in the array too.

- **New PR — mandatory two-call sequence, both calls in the same turn:**
  `mcp__github__create_pull_request` has no `labels` field, so a PR is created *unlabeled* by
  construction. This is the exact gap that has caused unlabeled PRs before (#331, #329, #328,
  #322, #321, #318 all shipped with no label). To close it:
  1. Call `mcp__github__create_pull_request`. Note the returned `number`.
  2. **Immediately**, before doing anything else (no reporting success to the user, no moving
     to the next task), call `mcp__github__issue_write` with `method: "update"`,
     `issue_number: <that number>`, and `labels: [...]` — PRs are issues under the GitHub
     REST/GraphQL model, so the same call works.
  3. Confirm the label actually landed: check the `labels` field in the `issue_write` response
     (or re-fetch with `mcp__github__pull_request_read` if unsure). If it's missing, retry —
     do not treat the PR as finished until you have positive confirmation of the label.
  A PR creation is only complete once both calls have succeeded. If you find yourself about to
  say a PR is ready without having made the second call, stop and make it first.

- **Existing PR**: same `issue_write` update call, addressed by PR number — this is a single
  step, no sequencing risk, but still verify the response shows the label.

## Before finishing

1. Every issue/PR you touched this turn: does its current state (not just the call you made,
   but the tool's response) actually show the right label(s)? Spot-check with
   `mcp__github__pull_request_read` / `mcp__github__issue_read` if there's any doubt.
2. Title/body still make sense standalone — don't lean on the label to explain scope.
3. Every sub-project actually touched has its label; nothing untouched has one it shouldn't.
4. If a brand-new label got created (new tool, first issue/PR), say so — a grey, no-description
   label is easy to miss on the GitHub labels page and may be worth a color/description tweak
   by hand later (not available through these tools).
