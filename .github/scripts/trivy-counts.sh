#!/usr/bin/env bash
# Counts of what `trivy image --format json` found, for the log and the step summary.
#
#   trivy-counts.sh <app> <trivy-json> <trivy-exit-code>
#
# COUNTS ONLY. The scanned images are built from private repositories and the Actions page
# of this repository is public, so the package / CVE / fixed-version list is never written
# here. To read it, run trivy yourself against a local build with `--format table`.
#
# Exit codes:  0 counts written (or the scanner itself failed: sca-gate.sh reports that)
#              3 the scanner said it finished (0 or 5) but left no usable report
set -Eeuo pipefail

if [ "$#" -ne 3 ]; then
	echo "usage: trivy-counts.sh <app> <trivy-json> <trivy-exit-code>" >&2
	exit 2
fi
app="$1"
report="$2"
trivy_rc="$3"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

# Only a trivy that finished (0 clean, 5 findings) owes a report. Any other exit is a
# scanner error that sca-gate.sh fails on every day; there is nothing to count.
case "$trivy_rc" in
0 | 5) ;;
*)
	{
		echo "### trivy: \`$app\` production image"
		echo
		echo "The scanner failed (exit $trivy_rc); no counts."
		echo
	} >>"$summary"
	echo "trivy ($app): scanner exit $trivy_rc, no counts"
	exit 0
	;;
esac

if ! jq -e 'type == "object"' "$report" >/dev/null 2>&1; then
	echo "::error::trivy-counts: trivy exited $trivy_rc but left no usable report at $report" >&2
	exit 3
fi

by_severity=""
total=0
for sev in CRITICAL HIGH; do
	n="$(jq --arg s "$sev" '[ .Results[]?.Vulnerabilities[]? | select(.Severity == $s) ] | length' "$report")"
	total=$((total + n))
	[ "$n" -eq 0 ] || by_severity+="${by_severity:+, }$(printf '%s' "$sev" | tr '[:upper:]' '[:lower:]') $n"
done
[ -n "$by_severity" ] || by_severity="none"

{
	echo "### trivy: \`$app\` production image"
	echo
	echo "**$total** HIGH or CRITICAL vulnerabilities with a fix available ($by_severity)."
	echo
} >>"$summary"
echo "trivy ($app): $total HIGH or CRITICAL with a fix available ($by_severity)"
