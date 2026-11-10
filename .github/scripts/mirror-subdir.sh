#!/usr/bin/env bash
# Keep a read-only repository equal to one sub-directory of this monorepo, with its history.
#
# Usage: mirror-subdir.sh <prefix> <mirror-url> [extra-branch]
#   prefix        directory of the monorepo that becomes the root of the mirror (e.g. spec-merger/backend)
#   mirror-url    https URL of the mirror repository
#   extra-branch  optional second branch of the mirror kept equal to main (e.g. the only branch a GitLab pull mirror follows).
#                 It is a pure copy of main, so it is force-pushed and recreated if missing or edited.
# Environment: MIRROR_TOKEN, a token that can push to the mirror (sent as a header, never written to the URL or to .git/config).
#
# Instead of cutting the whole history again (git subtree split reads every commit of the monorepo, around ten
# minutes), only the commits added since the last run are replayed on top of the mirror:
#   1. find, on the first-parent history of HEAD, the commit whose directory is exactly the tree of the mirror's tip;
#   2. for each newer commit that touches the directory, create a commit with the same author, dates and message, whose
#      tree is that directory, and whose parent is the previous one. This is what git subtree split produces for a linear history;
#   3. push, fast-forward only. A mirror that no longer matches the monorepo makes the script fail, it is never overwritten.
# An empty mirror is filled with a full git subtree split (the first run only).
set -euo pipefail

PREFIX="${1:?usage: mirror-subdir.sh <prefix> <mirror-url> [extra-branch]}"
URL="${2:?usage: mirror-subdir.sh <prefix> <mirror-url> [extra-branch]}"
EXTRA_BRANCH="${3:-}"
: "${MIRROR_TOKEN:?MIRROR_TOKEN is not set}"

PREFIX="${PREFIX%/}"
BRANCH=main
AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$MIRROR_TOKEN" | base64 -w0)"
mirror() { git -c "http.extraheader=$AUTH" "$@"; }

# Make the extra branch point at the given commit (no-op when it is already there or not requested)
sync_extra() {
  [[ -n "$EXTRA_BRANCH" ]] || return 0
  mirror push --force "$URL" "$1:refs/heads/$EXTRA_BRANCH"
}

echo "==> $PREFIX -> $URL"

# Is there a branch on the mirror yet?
if ! mirror ls-remote --exit-code --heads "$URL" "$BRANCH" >/dev/null 2>&1; then
  echo "    empty mirror: full split (first run)"
  commit="$(git subtree split --prefix="$PREFIX" HEAD)"
  mirror push "$URL" "$commit:refs/heads/$BRANCH"
  sync_extra "$commit"
  exit 0
fi

mirror fetch --quiet --no-tags "$URL" "refs/heads/$BRANCH:refs/mirror/tip"
tip="$(git rev-parse refs/mirror/tip)"
tip_tree="$(git rev-parse "$tip^{tree}")"

# Commits of the first-parent history that change the directory, newest first
mapfile -t commits < <(git rev-list --first-parent HEAD -- "$PREFIX")

pending=()
found=false
for c in "${commits[@]}"; do
  tree="$(git rev-parse --verify --quiet "$c:$PREFIX" || true)"
  if [[ "$tree" == "$tip_tree" ]]; then
    found=true
    break
  fi
  pending+=("$c")
done

if ! $found; then
  echo "::error::The tip of the mirror ($tip) matches no commit of $PREFIX: the mirror was edited or the history was rewritten." >&2
  exit 1
fi

if ((${#pending[@]} == 0)); then
  echo "    already up to date ($tip)"
  sync_extra "$tip"
  exit 0
fi

parent="$tip"
parent_tree="$tip_tree"
# pending is newest first: replay from the oldest
for ((i = ${#pending[@]} - 1; i >= 0; i--)); do
  c="${pending[$i]}"
  tree="$(git rev-parse --verify --quiet "$c:$PREFIX" || true)"
  # Directory deleted by this commit, or same content as before (e.g. only a merge): nothing to mirror
  if [[ -z "$tree" || "$tree" == "$parent_tree" ]]; then
    continue
  fi
  parent="$(
    git log -1 --format=%B "$c" | env \
      GIT_AUTHOR_NAME="$(git log -1 --format=%an "$c")" \
      GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$c")" \
      GIT_AUTHOR_DATE="$(git log -1 --format=%aI "$c")" \
      GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$c")" \
      GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$c")" \
      GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$c")" \
      git commit-tree "$tree" -p "$parent"
  )"
  parent_tree="$tree"
  echo "    + $(git log -1 --format='%h %s' "$c")"
done

if [[ "$parent" == "$tip" ]]; then
  echo "    nothing new for this directory"
  sync_extra "$tip"
  exit 0
fi

mirror push "$URL" "$parent:refs/heads/$BRANCH"
sync_extra "$parent"
