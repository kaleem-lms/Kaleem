#!/usr/bin/env bash
# semgrep over the code that ships, with a completeness guard and counts-only output.
#
#   semgrep-scan.sh --rules <rules-dir> <root>
#       scan <root>/{backend/kaleem,backend/signaling,backend/config,dashboard/src}
#   semgrep-scan.sh --from-json <report> --expected <file-list> <root>
#       classify a saved report only (the self-test uses this; no docker, no network)
#   SEMGREP_TARGETS="a/b c/d" overrides the target list (the CI canary uses it)
#   SEMGREP_DETAILS=1  also print `rule path:line` to stdout (local use only)
#
# <rules-dir> is a checkout of semgrep/semgrep-rules at the commit pinned in ci.yml
# (SEMGREP_RULES_SHA). It is fetched at run time and never committed: the rules are
# published under their own licence.
#
# Exit codes:
#   0  clean
#   3  a bad report, or a malformed suppression, or an unexpected failure of this script
#   4  INCOMPLETE: the scan read less than it should have (see the completeness guard)
#   5  findings
#   6  semgrep (or docker) itself failed. Semgrep's own exit codes include 3, 4 and 5,
#      which would be read as the codes above, so every semgrep failure becomes 6.
#
# Pair it with sca-gate.sh, which turns a 5 into a warning before SCA_BLOCKING_FROM and a
# failure from it, and fails on every other non-zero code on every day:
#
#   rc=0; .github/scripts/semgrep-scan.sh --rules "$RULES" . || rc=$?
#   .github/scripts/sca-gate.sh semgrep "$rc" 5
#
# Choices that are deliberate:
#   * semgrep runs WITHOUT --error, so any non-zero exit from it is a failure and never a
#     finding. Findings are counted from the report, not read from an exit code.
#   * --network none: the rules are local, and a scanner that needs the network at scan
#     time is a scanner that can be down. --metrics=off and --disable-version-check as well.
#   * Completeness: an entry in the report's `errors` (a partial parse included) or a
#     tracked source file missing from `paths.scanned` is exit 4. It is a set comparison,
#     not a count, so semgrep's own default ignores cannot widen the exclusions below.
#   * A suppression must name its rule: `nosemgrep: <rule-id>`. A bare `nosemgrep` silences
#     every rule on its line, including ones written later, so it is exit 3. Named ones are
#     counted in the summary, so a rise is visible in review.
#   * COUNTS ONLY by default, in the log and in the step summary. The scanned repositories
#     are private and the Actions page of this repository is public.
set -Eeuo pipefail

# semgrep/semgrep 1.180.0. Bumping the image is an ordinary PR, and any finding it
# surfaces follows the date guard.
IMAGE='semgrep/semgrep:1.180.0@sha256:529ee8a277ec8adc5b534d7c74eea0a47e9de21d62852b6ba7ac6ba9566845c3'

# Rule directories inside the pinned semgrep-rules checkout: the `security` rules for this
# stack. Chosen over the registry's `p/owasp-top-ten`, which changes without a commit.
RULE_DIRS=(
	python/lang/security
	python/django/security
	python/jwt/security
	python/cryptography/security
	python/requests/security
	javascript/lang/security
	javascript/browser/security
	javascript/jsonwebtoken/security
	typescript/react/security
)

# What is scanned: the code that ships. Paths are relative to <root>.
DEFAULT_TARGETS=(backend/kaleem backend/signaling backend/config dashboard/src)

# Tracked files with these extensions are expected to be scanned.
EXT_REGEX='\.(py|ts|tsx|js|jsx)$'

# Exclusions, in ONE place. They feed both the --exclude flags and the expected set, so the
# two cannot drift apart.
#   directories named like this, anywhere: test code, which is not the shipped surface
EXCLUDE_DIRS=(tests test)
#   file names: unit tests sit beside the code in the dashboard
EXCLUDE_NAMES=('*.test.ts' '*.test.tsx')
#   paths (matched as a suffix, as semgrep matches them): the development and CI settings
#   modules, which only spread the base settings and are never deployed
EXCLUDE_PATHS=(config/settings/local.py config/settings/test.py)

fail() {
	echo "::error::semgrep-scan: $*" >&2
	exit 3
}
usage() {
	echo "usage: semgrep-scan.sh --rules <rules-dir> <root> | --from-json <report> --expected <file-list> <root>" >&2
	exit 2
}

# Exit 5 means "findings" to sca-gate.sh, and jq itself exits 5 on a runtime error. Any
# command failing under `set -e` would therefore be read as a finding. Every unexpected
# failure is exit 3 instead.
trap 'fail "unexpected failure at line $LINENO (exit $?)"' ERR

rules="" report="" expected="" root=""
while [ "$#" -gt 0 ]; do
	case "$1" in
	--rules)
		[ "$#" -ge 2 ] || usage
		rules="$2"
		shift 2
		;;
	--from-json)
		[ "$#" -ge 2 ] || usage
		report="$2"
		shift 2
		;;
	--expected)
		[ "$#" -ge 2 ] || usage
		expected="$2"
		shift 2
		;;
	-*) usage ;;
	*)
		[ -z "$root" ] || usage
		root="$1"
		shift
		;;
	esac
done
[ -n "$root" ] || usage
if [ -n "$report" ]; then
	[ -n "$expected" ] && [ -z "$rules" ] || usage
else
	[ -n "$rules" ] && [ -z "$expected" ] || usage
fi
[ -d "$root" ] || fail "root not found: $root"
root="$(cd "$root" && pwd)"

command -v jq >/dev/null 2>&1 || fail "jq is not installed"

if [ -n "${SEMGREP_TARGETS:-}" ]; then
	read -r -a targets <<<"$SEMGREP_TARGETS"
else
	targets=("${DEFAULT_TARGETS[@]}")
fi

# True when a path (relative to <root>) is one of the exclusions above.
is_excluded() {
	local p="$1" part name rest
	name="${p##*/}"
	rest="${p%/*}"
	if [ "$rest" != "$p" ]; then
		local IFS=/
		for part in $rest; do
			for d in "${EXCLUDE_DIRS[@]}"; do
				[ "$part" != "$d" ] || return 0
			done
		done
	fi
	for g in "${EXCLUDE_NAMES[@]}"; do
		# shellcheck disable=SC2254
		case "$name" in $g) return 0 ;; esac
	done
	for e in "${EXCLUDE_PATHS[@]}"; do
		[ "$p" != "$e" ] && [ "${p%/"$e"}" = "$p" ] || return 0
	done
	return 1
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# --- the expected set --------------------------------------------------------------
# Every git-tracked source file under the targets, minus the exclusions. `git -C <target>`
# resolves the repository the target lives in, whether that is a submodule checkout or
# this repository, and fails when the directory is missing (a submodule that did not
# check out is an error, never an empty clean scan).
if [ -z "$report" ]; then
	: >"$work/expected.txt"
	for t in "${targets[@]}"; do
		[ -d "$root/$t" ] || fail "target not found: $t (is the submodule checked out?)"
		git -C "$root/$t" ls-files -z | while IFS= read -r -d '' f; do
			p="$t/$f"
			[[ "$p" =~ $EXT_REGEX ]] || continue
			is_excluded "$p" || printf '%s\n' "$p"
		done >>"$work/expected.txt"
	done
	expected="$work/expected.txt"
fi
[ -f "$expected" ] || fail "expected-file list not found: $expected"
LC_ALL=C sort -u "$expected" >"$work/expected.sorted"

# --- the scan ----------------------------------------------------------------------
if [ -z "$report" ]; then
	[ -d "$rules" ] || fail "rules directory not found: $rules"
	rules="$(cd "$rules" && pwd)"
	cfg=()
	for d in "${RULE_DIRS[@]}"; do cfg+=(--config "/rules/$d"); done
	exc=()
	for d in "${EXCLUDE_DIRS[@]}"; do exc+=(--exclude "$d"); done
	for n in "${EXCLUDE_NAMES[@]}"; do exc+=(--exclude "$n"); done
	for e in "${EXCLUDE_PATHS[@]}"; do exc+=(--exclude "$e"); done
	mkdir -p "$work/out"
	chmod 777 "$work/out"
	semgrep_rc=0
	docker run --rm --network none \
		--user "$(id -u):$(id -g)" -e HOME=/tmp \
		-v "$root:/src:ro" -v "$rules:/rules:ro" -v "$work/out:/out" -w /src \
		"$IMAGE" semgrep scan --metrics=off --disable-version-check \
		--json --output /out/report.json \
		"${cfg[@]}" "${exc[@]}" "${targets[@]}" >"$work/semgrep.log" 2>&1 || semgrep_rc=$?
	if [ "$semgrep_rc" -ne 0 ]; then
		# The log can name files of a private repository, and this output is public.
		echo "::error::semgrep-scan: semgrep exited $semgrep_rc, which is not a result. A scan that did not run is not a clean scan." >&2
		[ "${SEMGREP_DETAILS:-}" != "1" ] || sed 's/^/  | /' "$work/semgrep.log" >&2
		exit 6
	fi
	report="$work/out/report.json"
fi

# --- the report --------------------------------------------------------------------
[ -f "$report" ] || fail "report file not found: $report"
jq -e '(.results | type == "array") and (.errors | type == "array") and (.paths.scanned | type == "array")' \
	"$report" >/dev/null 2>&1 ||
	fail "the report is not a semgrep report (no results, errors and paths.scanned): $report"

# --- suppressions ------------------------------------------------------------------
# Semgrep's own parser reads `nosem` as well as `nosemgrep`, and takes ids after a colon.
# Every text file under the targets is read, not only the source files in the expected set:
# the template annotations live in `.txt` files. The same exclusions apply.
bare=0
named=0
grep_ex=()
for d in "${EXCLUDE_DIRS[@]}"; do grep_ex+=(--exclude-dir="$d"); done
for n in "${EXCLUDE_NAMES[@]}"; do grep_ex+=(--exclude="$n"); done
for t in "${targets[@]}"; do
	[ -d "$root/$t" ] || fail "target not found: $t"
	while IFS= read -r hit; do
		rel="${hit%%:*}"
		rel="${rel#"$root"/}"
		is_excluded "$rel" && continue
		if [[ "${hit#*:}" =~ nosem(grep)?:[[:space:]]*[A-Za-z0-9_] ]]; then
			named=$((named + 1))
		else
			bare=$((bare + 1))
		fi
	done < <(grep -rIaE "${grep_ex[@]}" 'nosem(grep)?([^A-Za-z0-9_]|$)' "$root/$t" || true)
done
if [ "$bare" -gt 0 ]; then
	fail "$bare suppression(s) name no rule. Write 'nosemgrep: <rule-id>' (the last segment of the rule id) and give the reason in an adjacent comment; a bare 'nosemgrep' silences every rule on its line."
fi

# --- completeness ------------------------------------------------------------------
n_expected="$(wc -l <"$work/expected.sorted" | tr -d ' ')"
n_errors="$(jq '.errors | length' "$report")"
jq -r '.paths.scanned[]' "$report" | LC_ALL=C sort -u >"$work/scanned.sorted"
LC_ALL=C comm -23 "$work/expected.sorted" "$work/scanned.sorted" >"$work/missing.txt"
n_missing="$(wc -l <"$work/missing.txt" | tr -d ' ')"
incomplete=""
[ "$n_expected" -gt 0 ] || incomplete+="the expected set is empty (nothing to scan is not a clean scan); "
[ "$n_errors" -eq 0 ] || incomplete+="$n_errors error(s) in the report, a partial parse included; "
[ "$n_missing" -eq 0 ] || incomplete+="$n_missing of $n_expected expected file(s) missing from paths.scanned; "

# Per-target counts of expected files that were scanned.
scanned_lines=""
for t in "${targets[@]}"; do
	te="$(grep -c "^${t//./\\.}/" "$work/expected.sorted" || true)"
	tm="$(grep -c "^${t//./\\.}/" "$work/missing.txt" || true)"
	scanned_lines+="$t: $((te - tm)) of $te"$'\n'
done

# --- counts ------------------------------------------------------------------------
total="$(jq '.results | length' "$report")"
by_severity=""
counted=0
for sev in ERROR WARNING INFO; do
	n="$(jq --arg s "$sev" '[ .results[] | select(.extra.severity == $s) ] | length' "$report")"
	counted=$((counted + n))
	[ "$n" -eq 0 ] || by_severity+="${by_severity:+, }$(printf '%s' "$sev" | tr '[:upper:]' '[:lower:]') $n"
done
# A severity this script does not know is still counted, so the parts always add up.
[ "$counted" -eq "$total" ] || by_severity+="${by_severity:+, }other $((total - counted))"
[ -n "$by_severity" ] || by_severity="none"

{
	echo "### semgrep: shipped code"
	echo
	if [ -n "$incomplete" ]; then
		echo "**INCOMPLETE SCAN.** ${incomplete%; }."
		echo
	fi
	echo "**$total** finding(s) ($by_severity), $named named suppression(s)."
	echo
	echo "Files scanned, per target:"
	echo
	# shellcheck disable=SC2016  # backticks are Markdown, not a command substitution
	printf '%s' "$scanned_lines" | sed 's/^/- `/; s/: /`: /'
	echo
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "semgrep: $total finding(s) ($by_severity), $named named suppression(s)"
printf '%s' "$scanned_lines" | sed 's/^/  scanned /'

if [ "${SEMGREP_DETAILS:-}" = "1" ]; then
	jq -r '.results[] | "  \(.check_id | split(".") | last)  \(.path):\(.start.line)"' "$report"
	[ ! -s "$work/missing.txt" ] || sed 's/^/  missing: /' "$work/missing.txt"
elif [ "$total" -gt 0 ]; then
	echo "  (itemised list withheld: run SEMGREP_DETAILS=1 .github/scripts/semgrep-scan.sh locally)"
fi

if [ -n "$incomplete" ]; then
	echo "::error::semgrep-scan: INCOMPLETE SCAN: ${incomplete%; }. It did not look at everything, so it did not pass." >&2
	exit 4
fi
[ "$total" -eq 0 ] || exit 5
