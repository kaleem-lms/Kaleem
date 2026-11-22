#!/usr/bin/env bash
# Secret scan over the FULL git history of one repository, with a completeness guard.
#
#   gitleaks-history.sh <dir>        e.g. `.` (meta) or `backend`, `dashboard`, ...
#
# Same scanner and pin as the tree scan in ci.yml (zricethezav/gitleaks:v8.30.1).
#
# Exit codes:  0 clean   1 leaks found   4 the scan was INCOMPLETE (do not trust it)
#
# Why the guard is the point: when git cannot read the repository inside the container,
# gitleaks logs an `ERR` line, scans ZERO commits, prints "no leaks found" and exits 0
# (observed 2026-10-17). A history scan that read nothing looks exactly like a clean one.
# So the scan only counts when
#   1. the repository is not shallow (a shallow clone has one commit to look at);
#   2. there is no `ERR` line in the output;
#   3. gitleaks reports at least as many commits scanned as the lower bound below.
#
# The bound is the number of non-merge commits, across every ref, that add at least one
# text line. It is a LOWER BOUND and not an equality by measurement: gitleaks reads
# `git log -p`, so a pure rename, a pure deletion, a binary-only change or an empty commit
# produces no patch and is not counted (infra 29 of 32 commits, tokens 10 of 11). None of
# those can introduce a secret. Demanding equality would fail on every history that has one.
#
# Leaks are reported redacted. Where they are reported matters: this is a public
# repository, so a finding goes to the owner privately, never into ISSUES.md or a comment.
set -euo pipefail

readonly IMAGE="zricethezav/gitleaks:v8.30.1"

if [ "$#" -ne 1 ]; then
	echo "usage: gitleaks-history.sh <dir>" >&2
	exit 2
fi

incomplete() {
	echo "INCOMPLETE SCAN of $1: $2" >&2
	echo "::error::gitleaks history scan of $1 is incomplete: $2" >&2
	exit 4
}

dir="$1"
[ -d "$dir" ] || incomplete "$dir" "not a directory"
wt="$(cd "$dir" && pwd -P)"

git -C "$wt" rev-parse --git-dir >/dev/null 2>&1 || incomplete "$dir" "not a git repository"
[ "$(git -C "$wt" rev-parse --show-toplevel)" = "$wt" ] ||
	incomplete "$dir" "not the root of a git repository (it would scan its parent's history)"

if [ "$(git -C "$wt" rev-parse --is-shallow-repository)" != "false" ]; then
	incomplete "$dir" "shallow repository (check out with fetch-depth: 0)"
fi

# Lower bound: non-merge commits, every ref, with at least one added TEXT line. numstat
# prints `-` for a binary file, which is not a number and so does not count.
bound="$(git -C "$wt" log --all --no-merges --numstat --format='@%H' |
	awk '/^@/ { if (c) n++; c = 0; next } $1 ~ /^[0-9]+$/ && $1 > 0 { c = 1 } END { if (c) n++; print n + 0 }')"

# Mount the working tree and the git directories at their REAL paths, so that a
# submodule's `.git` file (`gitdir: ../.git/modules/<name>`) and a linked worktree's
# pointer resolve inside the container exactly as they do outside it.
mounts=(-v "${wt}:${wt}:ro")
for g in "$(git -C "$wt" rev-parse --absolute-git-dir)" "$(git -C "$wt" rev-parse --path-format=absolute --git-common-dir)"; do
	case "$g/" in
	"$wt"/*) ;; # already inside the mounted working tree
	*) mounts+=(-v "${g}:${g}:ro") ;;
	esac
done

rc=0
out="$(docker run --rm "${mounts[@]}" -w "$wt" "$IMAGE" \
	git "$wt" --log-opts="--all" --redact --no-banner --no-color --exit-code 1 2>&1)" || rc=$?
printf '%s\n' "$out"

scanned="$(printf '%s\n' "$out" | sed -n -E 's/.* ([0-9]+) commits scanned.*/\1/p' | tail -n 1)"

if printf '%s\n' "$out" | grep -q ' ERR '; then
	incomplete "$dir" "the scanner logged an error (scanned ${scanned:-none} of at least $bound commits)"
fi
# No "N commits scanned" line at all counts as zero commits.
if [ "${scanned:-0}" -lt "$bound" ]; then
	incomplete "$dir" "scanned ${scanned:-0} commits, fewer than the $bound that add text"
fi

if [ "$rc" -ne 0 ]; then
	echo "LEAKS FOUND in the history of $dir (gitleaks exit $rc). Report privately; never in ISSUES.md." >&2
	exit "$rc"
fi

echo "CLEAN: ${scanned:-0} commits (bound $bound) in $dir"
