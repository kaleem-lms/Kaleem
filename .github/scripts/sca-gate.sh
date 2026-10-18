#!/usr/bin/env bash
# The date guard for the dependency scanners (ADR-0030, amended).
#
#   sca-gate.sh <scanner-name> <scanner-rc> <finding-rc>
#
# Run it right after a scanner, passing the scanner's exit code and the one code
# that scanner uses ONLY for "I looked, and I found something":
#
#   rc = 0           clean                       -> exit 0
#   rc = finding-rc  a finding                   -> before $SCA_BLOCKING_FROM: a
#                                                   ::warning:: and exit 0
#                                                   (report-only); on or after it:
#                                                   ::error:: and exit 1
#   anything else    the scanner itself failed   -> ALWAYS ::error:: and fail.
#                                                   A registry outage, a bad report or
#                                                   a missing tool is never "clean".
#
# `$SCA_BLOCKING_FROM` is one ISO date (YYYY-MM-DD) set once in ci.yml. Nobody has to
# remember to flip a switch: the day arrives and the finding path turns red. Moving the
# date LATER needs an ADR (the ADR-0026 ratchet rule applied to a date); moving it
# earlier is an ordinary PR.
#
# An unset or malformed date is itself an error and is checked FIRST, even for a clean
# scan: a guard whose configuration is broken must not look like a guard that passed.
set -euo pipefail

if [ "$#" -ne 3 ]; then
	echo "usage: sca-gate.sh <scanner-name> <scanner-rc> <finding-rc>" >&2
	exit 2
fi

name="$1" rc="$2" finding_rc="$3"

for n in "$rc" "$finding_rc"; do
	case "$n" in
	'' | *[!0-9]*)
		echo "::error::sca-gate: '$n' is not an exit code" >&2
		exit 2
		;;
	esac
done

from="${SCA_BLOCKING_FROM:-}"
# A calendar-valid ISO date only: `date -d` rejects 2026-13-45, the regex rejects
# the forms `date` would happily accept ("tomorrow", "next friday").
if ! [[ "$from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || ! date -u -d "$from" +%F >/dev/null 2>&1; then
	echo "::error::sca-gate: SCA_BLOCKING_FROM='${from}' is not a valid YYYY-MM-DD date" >&2
	exit 2
fi

today="$(date -u +%F)"

if [ "$rc" -eq 0 ]; then
	echo "$name: clean"
	exit 0
fi

if [ "$rc" -ne "$finding_rc" ]; then
	echo "::error::$name: the scanner failed (exit $rc), which is not a result. A scan that did not run is not a clean scan."
	exit "$rc"
fi

# ISO dates compare correctly as strings.
if [[ "$today" < "$from" ]]; then
	echo "::warning::$name: findings above. Report-only until $from; they block from that day."
	exit 0
fi

echo "::error::$name: findings above, and findings have blocked since $from."
exit 1
