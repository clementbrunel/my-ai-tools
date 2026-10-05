---
name: weekly-deps
description: Weekly dependency maintenance for the my-ai-tools monorepo — inventories outdated libraries for every sub-project enabled in scope.json, opens/updates one tested PR per sub-project with the patch/minor bumps, lists major updates for manual handling in a single dashboard issue, and reviews ai-env-manager's catalogue (install steps, removals, additions). Use when the weekly-deps routine fires, or when asked to "faire la passe de mises à jour", "mettre à jour les dépendances", "état des lieux des libs", "run weekly-deps".
---

# Weekly dependency maintenance

Run from the repo root. The routine fires Friday at midnight (Paris) so the PRs are ready to
review over the weekend. Everything below is meant to be done in one session, unattended: never
stop to ask a question — when something is ambiguous, take the conservative option and say so in
the dashboard issue.

## Inputs

- **`scope.json`** (next to this file) — the only place the perimeter is decided. Skip any
  project with `enabled: false`. Each project lists its `npm` / `maven` / `pip` directories, the
  `checks` that must pass, an optional `adoptPr`, and `catalogue: true` for ai-env-manager.
- **`outdated.mjs`** (next to this file) — the inventory:
  `node .claude/skills/weekly-deps/outdated.mjs --json`. For every dependency it gives `safe`
  (best patch/minor target, applied automatically) and `major` (latest major, never applied
  automatically). Don't re-derive this by hand; if the script errors for a directory, report the
  error in the dashboard and carry on with the others.
- **`.claude/skills/github-issue-pr/SKILL.md`** — read it: every PR gets its sub-project label,
  applied in the same turn as the PR is created, and confirmed.

## Limits — keep the number of PRs low

- **At most one open deps PR per sub-project**, plus **at most one catalogue PR** for
  ai-env-manager. Each week updates the existing PR rather than opening another one.
- **Majors never get a PR.** They go in the dashboard issue only (see below).
- **One dashboard issue for the whole repo**, edited in place every week — never one issue per
  week.

## Step 1 — Inventory

1. `git fetch origin main && git checkout main && git pull`.
2. Run `outdated.mjs --json` and keep the result: it feeds every later step.

## Step 2 — One PR per enabled sub-project (patch/minor only)

For each enabled project that has at least one `safe` target:

1. **Pick the branch.**
   - `adoptPr` is set and that PR is still open → work on its head branch (fetch it). If it was
     merged or closed, ignore `adoptPr` and say in the recap that it can be removed from
     `scope.json`.
   - Otherwise use `deps/<project>`. If an open PR already uses it, continue on it. If the branch
     exists but its PR was merged/closed, restart it from `origin/main`.
   - Bring the branch up to date with a **merge** of `origin/main` (no rebase, no force-push on
     a branch that has an open PR).
2. **Apply the bumps.**
   - npm: edit the version ranges in `package.json` to the `safe` targets (keep the existing
     prefix `^`/`~`), then refresh the lockfile with `npm install` in that directory. Never edit
     `package-lock.json` by hand.
   - Maven: edit the `<version>` (or the `<properties>` entry it points to) in `pom.xml`.
   - pip: edit `requirements.txt`.
   - Skim the changelog/release notes of each minor bump (GitHub releases or the package's
     CHANGELOG) — a "minor" that announces a breaking change or a deprecation that this code
     hits is treated like a major: revert it and list it in the dashboard.
3. **Test.** Run every command in the project's `checks`, from the repo root. If something fails:
   bisect — revert bumps one by one (or by family: react + @types/react, mapstruct +
   mapstruct-processor, vitest + @vitest/*) until the checks pass. A bump that can be made to pass
   with a small, obvious code fix (e.g. a renamed import) may be kept with that fix; anything
   larger is reverted and listed in the dashboard as "minor bloquée", with the error message.
   Never skip, disable or delete a test to get green.
4. **Commit** — one commit per week, message `<project>: bump patch/minor dependencies (YYYY-MM-DD)`,
   listing the bumps in the body.
5. **Push** — `git push -u origin <branch>`. If the git proxy refuses that branch name, fall back
   to `mcp__github__create_branch` + `mcp__github__push_files` for the same branch.
6. **PR** — create it if none is open (title `<project>: dépendances patch/minor`), otherwise
   update its body. The body contains: the table of bumps applied (from → to, patch/minor), the
   bumps reverted and why, the exact `checks` commands run and their result (last lines of
   output), and a link to the dashboard issue for the majors. Then apply the label per the
   github-issue-pr skill.

Projects with nothing to bump get no branch and no PR.

## Step 3 — ai-env-manager catalogue (`catalogue: true`)

One PR, branch `deps/ai-env-manager-catalogue`, title `ai-env-manager: catalogue — revue
hebdo`, label `ai-env-manager`. Same branch rules as Step 2. Only open it if there is at least
one change; otherwise just report "catalogue OK" in the dashboard.

1. **Install process.** For every entry of `CATALOGUE` in
   `ai-env-manager/src/prepare/catalogue.ts`, check upstream (README via
   `raw.githubusercontent.com`, releases, `npm view <pkg>`, `pip index versions <pkg>`) that
   each step is still right: package name, install command, plugin/marketplace name, MCP command,
   prerequisites, known install pitfalls. Fix `steps` (and the scanner detector in
   `src/scanner/integrations/<id>.ts` if a binary/config name changed). One commit per tool.
2. **Removals.** Propose removing a tool whose repo is archived, deleted, explicitly
   unmaintained, or superseded by another catalogue entry. Do the removal in its own commit
   (catalogue entry, `ToolId`, `INTEGRATION_TO_TOOL`, detector, tests, README) so it can be
   dropped from the PR independently, and explain the evidence in the PR body.
3. **Additions.** Search the web for new Claude Code tools in the catalogue's problem spaces
   (token reduction, project memory / codebase indexing, agent discipline, cost tracking,
   documentation). Add **at most one** new tool per week — the strongest candidate — by
   following `ai-env-manager/.claude/skills/add-catalogue-tool/SKILL.md` step by step, in its
   own commit. List the other candidates (name, link, one line on why) in the dashboard instead
   of adding them.
4. Run `cd ai-env-manager && npm ci && npm run build && npm test` — must pass before pushing.

The tools' *own* runtime versions (`--update` in ai-env-manager) are not this skill's job: only
the catalogue's install instructions are.

## Step 4 — Dashboard issue

A single issue titled exactly `📦 Dépendances — tableau de bord hebdo` (find it with
`mcp__github__search_issues`; create it if missing, with label `dependencies`; no sub-project
label since it is repo-wide). Replace its body every week with:

```
_Dernière passe : YYYY-MM-DD — périmètre : <projets enabled>_

## PR de la semaine
| Projet | PR | Bumps appliqués | Bumps retirés |

## Majeures en attente (traitement manuel)
### <projet>
| Paquet | Actuel | Majeure dispo | Notes (breaking changes, lien changelog) |

## Minors bloquées
| Projet | Paquet | Cible | Erreur |

## Catalogue ai-env-manager
- Install mis à jour : …
- Retraits proposés : …
- Ajout de la semaine : …
- Autres candidats : …

## Hors périmètre
<projets enabled:false, et adoptPr à nettoyer le cas échéant>
```

For each major, add one short line on what it breaks (from its release notes / migration guide)
so the manual work can be sized at a glance. Group families (e.g. "Spring Boot 4 (parent +
springdoc 3)").

## Step 5 — Final message (sent by email)

The session's last message is the recap the user receives by email. Keep it short, in French:
links to each PR (with number of bumps), link to the dashboard issue, number of majors pending,
any failure (a project whose checks could not run, a push refused…). No narration of the steps.
