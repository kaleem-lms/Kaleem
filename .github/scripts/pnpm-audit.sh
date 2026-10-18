#!/usr/bin/env bash
# `pnpm audit --prod` over one frontend's COMMITTED lockfile, with an expiring allowlist.
#
#   pnpm-audit.sh <dir>                       audit <dir>/pnpm-lock.yaml, no install
#   pnpm-audit.sh <dir> --from-json <file>    read a saved report (the self-test uses this)
#
# Exit codes:  0 no findings   5 findings   3 the audit itself failed (not a result)
#
# Pair it with sca-gate.sh, which turns a 5 into a warning before the blocking date and
# a failure from it, and passes every other code through as an error:
#
#   rc=0; .github/scripts/pnpm-audit.sh dashboard || rc=$?
#   .github/scripts/sca-gate.sh "pnpm audit (dashboard)" "$rc" 5
#
# Choices that are deliberate:
#   * `--prod`: dev-only packages cannot reach a user (ADR-0030 point 3). Both frontends
#     list their build tools under `dependencies`, so those are still audited, and an
#     allowlist entry is how a build-time-only finding is recorded as triaged.
#   * No `--ignore-registry-errors`. If the advisory service cannot be reached, pnpm
#     prints an error body with no `metadata`; that is exit 3 here, never "clean".
#   * pnpm exits 1 when it HAS findings. That alone is not an error; the JSON decides.
#   * The allowlist is `.github/security/pnpm-audit-allowlist.txt` (override with
#     $PNPM_AUDIT_ALLOWLIST): `<GHSA-id> <review-by YYYY-MM-DD> <reason...>`, one per line.
#     An entry past its review-by date is exit 3 even when its advisory is gone or fixed,
#     so a suppression cannot outlive the reason it was written for.
set -Eeuo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
allowlist="${PNPM_AUDIT_ALLOWLIST:-$here/../security/pnpm-audit-allowlist.txt}"

fail() {
	echo "::error::pnpm-audit: $*" >&2
	exit 3
}

if [ "$#" -ne 1 ] && [ "$#" -ne 3 ]; then
	echo "usage: pnpm-audit.sh <dir> [--from-json <file>]" >&2
	exit 2
fi
dir="$1"
from_json=""
if [ "$#" -eq 3 ]; then
	[ "$2" = "--from-json" ] || {
		echo "usage: pnpm-audit.sh <dir> [--from-json <file>]" >&2
		exit 2
	}
	from_json="$3"
fi

# Exit 5 is what means "findings" to sca-gate.sh, and jq itself exits 5 on a runtime error.
# Any command failing under `set -e` would therefore be read as a finding. Every
# unexpected failure is exit 3 instead.
trap 'fail "unexpected failure at line $LINENO (exit $?)"' ERR

command -v jq >/dev/null 2>&1 || fail "jq is not installed"

# --- the allowlist ---------------------------------------------------------------
[ -f "$allowlist" ] || fail "allowlist file not found: $allowlist"
today="$(date -u +%F)"
allowed=" "
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
	lineno=$((lineno + 1))
	case "$line" in '' | '#'*) continue ;; esac
	read -r id review rest <<<"$line"
	[[ "$review" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && date -u -d "$review" +%F >/dev/null 2>&1 ||
		fail "allowlist line $lineno: '$id' needs a review-by date (YYYY-MM-DD) as its second field"
	[ -n "${rest// /}" ] || fail "allowlist line $lineno: '$id' needs a reason after the date"
	if [[ "$review" < "$today" ]]; then
		fail "allowlist entry '$id' expired on $review (line $lineno): re-triage it, fix the dependency, or delete the line"
	fi
	allowed+="$id "
done <"$allowlist"

# --- the report ------------------------------------------------------------------
report="$(mktemp)"
trap 'rm -f "$report"' EXIT
if [ -n "$from_json" ]; then
	[ -f "$from_json" ] || fail "report file not found: $from_json"
	cp "$from_json" "$report"
else
	[ -f "$dir/pnpm-lock.yaml" ] || fail "$dir/pnpm-lock.yaml not found"
	(cd "$dir" && pnpm audit --prod --json) >"$report" || true
fi

# A report is only a report if it says how many dependencies it covered. The advisory
# service being down yields an error body without `metadata`, and that must not pass.
jq -e '(.metadata | type == "object") and (.advisories | type == "object")' "$report" >/dev/null 2>&1 ||
	fail "the audit returned no usable report (no 'metadata'): the advisory service may be unreachable"

total="$(jq '.advisories | length' "$report")"

# Severity-ordered rows: severity <TAB> package <TAB> advisory <TAB> patched range.
rows="$(jq -r --arg allowed "$allowed" '
	def sev: {"critical":0,"high":1,"moderate":2,"low":3,"info":4}[.] // 5;
	[ .advisories[]
	  | { s: (.severity // "unknown"), p: (.module_name // "?"),
	      a: (.github_advisory_id // ("id:" + (.id | tostring))),
	      f: (.patched_versions // "none") }
	  | . as $adv
	  | select(($allowed | contains(" " + $adv.a + " ")) | not) ]
	| sort_by([(.s | sev), .p, .a])[]
	| [.s, .p, .a, .f] | @tsv' "$report")"

remaining=0
[ -z "$rows" ] || remaining="$(printf '%s\n' "$rows" | wc -l | tr -d ' ')"
filtered=$((total - remaining))

{
	echo "### pnpm audit --prod: \`$dir\`"
	echo
	echo "$total advisories reported, $filtered allowlisted, **$remaining to act on**."
	if [ "$remaining" -gt 0 ]; then
		echo
		echo "| Severity | Package | Advisory | Patched in |"
		echo "| --- | --- | --- | --- |"
		printf '%s\n' "$rows" | awk -F'\t' '{ printf "| %s | %s | %s | `%s` |\n", $1, $2, $3, $4 }'
	fi
	echo
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "pnpm audit --prod $dir: $total advisories, $filtered allowlisted, $remaining to act on"
if [ "$remaining" -gt 0 ]; then
	printf '%s\n' "$rows" | awk -F'\t' '{ printf "  %-9s %-28s %-24s patched: %s\n", $1, $2, $3, $4 }'
	exit 5
fi
