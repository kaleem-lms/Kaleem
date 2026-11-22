#!/usr/bin/env bash
# `pnpm audit --prod` over one frontend's COMMITTED lockfile, with an expiring allowlist.
#
#   pnpm-audit.sh <dir>                       audit <dir>/pnpm-lock.yaml, no install
#   pnpm-audit.sh <dir> --from-json <file>    read a saved report (the self-test uses this)
#   PNPM_AUDIT_DETAILS=1 pnpm-audit.sh <dir>  also print the itemised rows to stdout (local use)
#
# Output is COUNTS ONLY by default, in the log and in the step summary. The audited
# repositories are private and the Actions page of this repository is public, so the
# severity/package/advisory/patched list is never written to the step summary and reaches
# stdout only when PNPM_AUDIT_DETAILS=1 is set by whoever is running it.
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
#     so a suppression cannot outlive the reason it was written for. A review-by date more
#     than 90 days ahead ($PNPM_AUDIT_MAX_REVIEW_DAYS) is exit 3 too, so none is permanent.
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
# A review-by date may lie at most this many days ahead of the day the check runs, so an
# entry can never be parked for good: it has to be re-triaged at least this often.
max_days="${PNPM_AUDIT_MAX_REVIEW_DAYS:-90}"
[[ "$max_days" =~ ^[0-9]+$ ]] || fail "PNPM_AUDIT_MAX_REVIEW_DAYS must be a whole number of days, got '$max_days'"
horizon="$(date -u -d "$today + $max_days days" +%F)"
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
	if [[ "$review" > "$horizon" ]]; then
		fail "allowlist entry '$id' (line $lineno) is reviewed on $review, more than $max_days days ahead: pick a date on or before $horizon"
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

# Counts per severity of what is left to act on, e.g. "critical 1, high 2". The scanned
# code is private and this output lands on a public Actions page, so CI sees counts only;
# the itemised rows are printed to stdout on request, for a local run.
by_severity=""
counted=0
for sev in critical high moderate low info; do
	n=0
	[ -z "$rows" ] || n="$(printf '%s\n' "$rows" | awk -F'\t' -v s="$sev" '$1 == s { n++ } END { print n + 0 }')"
	counted=$((counted + n))
	[ "$n" -eq 0 ] || by_severity+="${by_severity:+, }$sev $n"
done
# A severity this script does not know is still counted, so the parts always add up.
[ "$counted" -eq "$remaining" ] || by_severity+="${by_severity:+, }other $((remaining - counted))"
[ -n "$by_severity" ] || by_severity="none"

{
	echo "### pnpm audit --prod: \`$dir\`"
	echo
	echo "$total advisories reported, $filtered allowlisted, **$remaining to act on** ($by_severity)."
	echo
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "pnpm audit --prod $dir: $total advisories, $filtered allowlisted, $remaining to act on ($by_severity)"
if [ "$remaining" -gt 0 ]; then
	if [ "${PNPM_AUDIT_DETAILS:-}" = "1" ]; then
		printf '%s\n' "$rows" | awk -F'\t' '{ printf "  %-9s %-28s %-24s patched: %s\n", $1, $2, $3, $4 }'
	else
		echo "  (itemised list withheld: run PNPM_AUDIT_DETAILS=1 .github/scripts/pnpm-audit.sh $dir locally)"
	fi
	exit 5
fi
