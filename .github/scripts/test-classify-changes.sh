#!/usr/bin/env bash
# Table-driven tests for classify-changes.sh.
#
# This runs as a step of the `triage` job, so the thing that decides what CI
# skips is itself checked on every run. That is deliberate: the recurring
# failure of the last phase was a verifier that was itself unverified.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
classify="$here/classify-changes.sh"
fail=0

# Assert the classification of a literal list of paths.
expect_paths() {
	local want="$1" name="$2"
	shift 2
	local got
	got="$(printf '%s\n' "$@" | "$classify" --paths-from-stdin)"
	if [ "$got" != "$want" ]; then
		echo "FAIL: $name -- want code=$want, got code=$got"
		fail=1
	else
		echo "ok: $name"
	fi
}

expect_paths false "docs and root markdown only" \
	"docs/superpowers/specs/2026-09-08-ci-cost-optimization-design.md" "STATE.md"
expect_paths false "every root markdown file we keep" \
	"README.md" "CLAUDE.md" "ISSUES.md" "AGENTS.md"
expect_paths true "docs plus a submodule pointer" "STATE.md" "backend"
expect_paths true "a submodule pointer alone" "dashboard"
expect_paths true "a workflow change alone" ".github/workflows/ci.yml"
expect_paths true "the gitleaks allowlist alone" ".gitleaksignore"
expect_paths true "an unrecognised top-level file" "justfile"
expect_paths true "a nested non-docs path" "infra/docker-compose.production.yml"
expect_paths true "a docs-named file outside docs/" "src/docs/thing.md"

# An empty diff is not evidence that nothing changed -- it is evidence that we
# could not see what changed. Run everything.
got="$(printf '' | "$classify" --paths-from-stdin)"
if [ "$got" != "true" ]; then
	echo "FAIL: empty diff -- want code=true, got code=$got"
	fail=1
else
	echo "ok: empty diff"
fi

# A force-push or a brand-new branch gives an all-zero `before` SHA.
zero="0000000000000000000000000000000000000000"
got="$("$classify" "$zero" HEAD)"
if [ "$got" != "true" ]; then
	echo "FAIL: all-zero base -- want code=true, got code=$got"
	fail=1
else
	echo "ok: all-zero base"
fi

# An unreachable base ref (history rewritten under us) must not crash the job.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp"
: > "$tmp/STATE.md"
git -C "$tmp" add STATE.md
git -C "$tmp" -c user.email=t@example.com -c user.name=t commit -qm "seed"
got="$(cd "$tmp" && "$classify" deadbeefdeadbeefdeadbeefdeadbeefdeadbeef HEAD)"
if [ "$got" != "true" ]; then
	echo "FAIL: unreachable base -- want code=true, got code=$got"
	fail=1
else
	echo "ok: unreachable base"
fi

if [ "$fail" -ne 0 ]; then
	echo "classify-changes.sh: FAILURES"
	exit 1
fi
echo "classify-changes.sh: all cases pass"
