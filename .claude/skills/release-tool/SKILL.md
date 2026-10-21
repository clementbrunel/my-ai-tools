---
name: release-tool
description: Release a sub-project of the my-ai-tools monorepo (tag + GitHub release) so that GitHub's auto-generated "Source code" archive contains only that tool's directory. Use when asked to "faire une release", "release X", "publier la version X.Y.Z", "tagger cbl-log", or to cut a tagged release of any sub-project.
---

# Releasing a sub-project

GitHub's "Source code (zip / tar.gz)" is a `git archive` of the tagged commit and honours
`export-ignore` from the `.gitattributes` **of that commit**. To ship only one tool's sources, the
tagged commit must carry a `.gitattributes` ignoring everything else. `main` must not keep it
(it would break the next release of another tool), so it is added then reverted on the same branch.

Tag convention: `<tool>-vX.Y.Z` (e.g. `cbl-log-v1.0.0`). The tool's own workflow
(`.github/workflows/<tool>.yml`, e.g. `cbl-log.yml`) builds and publishes on that tag; if the tool has
none, the tag alone is the deliverable — say so.

## Steps

1. **Version bump + changelog first, merged.** The tool's version (package.json files, lockfile, any
   hardcoded version, README/status) is bumped through a normal PR, which also adds the
   `## [X.Y.Z] — YYYY-MM-DD` section to `<tool>/CHANGELOG.md` (see **Changelog** below); merged into
   `main`, CI green. Check this before anything else; stop and say so if not. Check the notes with
   `node .claude/skills/release-tool/release-notes.mjs <tool> X.Y.Z`.
2. `git fetch origin main`, then create `release/<tool>-vX.Y.Z` from `origin/main`.
3. `node .claude/skills/release-tool/gen-gitattributes.mjs <tool>` then commit **A**:
   `<tool>: archive restricted to <tool>/ for vX.Y.Z`.
4. Check: `git archive HEAD | tar -t | cut -d/ -f1 | sort -u` must list only `<tool>`.
5. Tag **A**: `git tag <tool>-vX.Y.Z` and `git push origin <tool>-vX.Y.Z`. This triggers the release.
6. `git revert --no-edit HEAD` (commit **B**), push the branch, open a PR labelled `<tool>`
   (see the `github-issue-pr` skill).
7. **Merge the PR with a merge commit — never squash or rebase**, otherwise commit A (the tag target)
   would not be in `main`'s history. Say it explicitly when handing the PR over.
8. Follow the workflow run and report the release URL once published.

## Changelog

The release notes are **written, not generated**: `--generate-notes` lists every merged PR of the
monorepo by title, branch-style prefixes and author, which is noise for a user (cbl-log shows the
notes in its in-app update dialog). The tool's workflow publishes the release with
`release-notes.mjs <tool> <version>` (the `## [X.Y.Z]` section of `<tool>/CHANGELOG.md`, up to the
next `## `) and fails when the section is missing or empty.

Writing the section:
- Source: `git log --no-merges --format='%h %s' <tool>-v<previous>..origin/main -- <tool>/` — only
  commits touching the tool, so work on other sub-projects (even in the same PR) never leaks in.
- One bullet per change **the user can see**, in French, in their words (what they can now do / what
  is fixed), not the commit title. Group related commits into one bullet.
- Leave out: version bumps, release / `.gitattributes` commits, reverts of unpublished work, CI,
  dependency bumps, tests, recette runs, refactors without visible effect, docs.
- No branch names, PR numbers, commit hashes, authors or links. Plain `- ` bullets; `**bold**` and
  `` `code` `` are fine (stripped in the app dialog), no tables or images.
- A breaking change (major bump) says what the user has to do.
- Newest version on top. Keep the header paragraph of the file.

The section then reads the same in the GitHub release, the in-app dialog and the repository.

## Redoing a release

If the tag already exists (e.g. first made without this filter): delete the GitHub release
(`gh release delete <tag> --yes`), the remote tag and the local tag, only after the new branch is
ready, then run the steps above. Confirm with the user before deleting a published release.
