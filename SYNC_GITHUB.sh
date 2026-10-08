#!/usr/bin/env bash
set -euo pipefail
# Run from the extracted project's root, with GitHub credentials configured.
REMOTE="https://github.com/slitherproduction-ai/flixplay.git"
BRANCH="evanoq/2.17.0-sync-pending"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git clone "$REMOTE" "$WORK/repo"
cd "$WORK/repo"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
# Replace tracked application files by checkpoint 45, preserving branch documentation.
git ls-files -z | xargs -0 -r git rm --quiet --ignore-unmatch
cp -a "$OLDPWD"/. .
git add -A
# Explicitly protect secrets even if the repository ignore settings change.
if git diff --cached --name-only | grep -Ei '(^|/)(\.env|.*\.(jks|p12|p8|key|pem|keystore)$|local\.properties$)'; then
  echo 'ERROR: sensitive file detected; aborting' >&2
  exit 1
fi
git diff --cached --check
git commit -m 'feat: synchronize EVANOQ 2.17.0 checkpoint 45 source'
git push origin "$BRANCH"
echo 'Complete: inspect PR https://github.com/slitherproduction-ai/flixplay/pull/9'
