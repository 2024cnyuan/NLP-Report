#!/usr/bin/env bash
set -euo pipefail

# Use a separate repository so the source working tree and branch are preserved.
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote_url="${1:-$(git -C "$source_root" remote get-url origin)}"
publish_dir="$(mktemp -d "${TMPDIR:-/tmp}/nlp-pages-publish.XXXXXX")"
git init --quiet --initial-branch=pages "$publish_dir"
git -C "$publish_dir" config user.name "$(git -C "$source_root" config user.name || echo 'github-actions[bot]')"
git -C "$publish_dir" config user.email "$(git -C "$source_root" config user.email || echo '41898282+github-actions[bot]@users.noreply.github.com')"
git -C "$publish_dir" remote add origin "$remote_url"

# Reuse checkout's token without printing it or embedding it in the remote URL.
if git -C "$source_root" config --local --get http.https://github.com/.extraheader >/dev/null; then
  git -C "$publish_dir" config http.https://github.com/.extraheader "$(git -C "$source_root" config --local --get http.https://github.com/.extraheader)"
fi

remote_branch="$(git -C "$publish_dir" ls-remote --heads origin refs/heads/pages)"
if [[ -n "$remote_branch" ]]; then
  git -C "$publish_dir" fetch --quiet --depth=1 origin pages
  # The fetched commit is the parent; the index contains only current files.
  git -C "$publish_dir" update-ref refs/heads/pages FETCH_HEAD
fi
cp -R "$source_root/pages/." "$publish_dir/"
git -C "$publish_dir" add --all
if git -C "$publish_dir" rev-parse --verify HEAD >/dev/null 2>&1 && git -C "$publish_dir" diff --cached --quiet; then
  echo "The pages branch already contains the current site."
  exit 0
fi
git -C "$publish_dir" commit --quiet -m "Publish project hub and offline sites"
git -C "$publish_dir" push origin HEAD:refs/heads/pages
echo "Published pages branch from $publish_dir"
