#!/usr/bin/env bash
# The production gateway publishes only the ports the deploy runbook lists (ADR-0056).
#
#   check-published-ports.sh <compose-file> [port ...]     default ports: 80 443
#
# Resolves the compose file exactly as `docker compose` would on the VPS and fails unless
# the set of HOST ports it publishes equals the allowed set: an extra port fails, and so
# does a missing one (a gateway that stopped publishing 443 is as wrong as one that
# publishes too much). A service on `network_mode: host` (coturn) publishes nothing in this
# sense, since it binds on the host directly; its ports are the runbook's TURN table, not
# something compose can enumerate.
#
# Every `${VAR:?...}` the file requires is given a dummy value, so the check needs no
# secrets. The values never leave this process.
#
# Exit codes: 0 the set matches   1 it does not   2 could not resolve the file
set -euo pipefail

if [ "$#" -lt 1 ]; then
	echo "usage: $0 <compose-file> [port ...]" >&2
	exit 2
fi
file="$1"
shift
[ -f "$file" ] || { echo "no such file: $file" >&2; exit 2; }
if [ "$#" -gt 0 ]; then allowed="$(printf '%s\n' "$@" | sort -n | paste -sd' ')"; else allowed="80 443"; fi

# Dummy values for every required variable.
vars="$({ grep -o '\${[A-Za-z_][A-Za-z_0-9]*:?' "$file" || true; } | sed 's/^\${//; s/:?$//' | sort -u)"
env_args=()
for v in $vars; do env_args+=("$v=dummy"); done

# The file names `env_file: .env.production`, which exists only on the VPS and must never be
# in a checkout. Resolve a copy beside an empty one, in a scratch directory.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp "$file" "$tmp/docker-compose.yml"
: >"$tmp/.env.production"

json="$(env "${env_args[@]}" docker compose -f "$tmp/docker-compose.yml" config --format json 2>"$tmp/err")" || {
	echo "docker compose could not resolve $file:" >&2
	cat "$tmp/err" >&2
	exit 2
}

# `published` is a string in compose's JSON ("80"). Protocols are not distinguished: a
# udp publish of an allowed number is reported against the number, which is the safe side.
published="$(jq -r '[.services[]?.ports[]?.published // empty | tostring] | map(select(. != "")) | map(tonumber) | unique | .[]' <<<"$json" | sort -n | paste -sd' ')"

if [ "$published" = "$allowed" ]; then
	echo "OK: $file publishes exactly: $published"
	exit 0
fi
echo "FAIL: $file publishes: ${published:-nothing}; allowed: $allowed"
jq -r '.services | to_entries[] | select(.value.ports) | .key as $s | .value.ports[] | "  \($s): \(.published // "?"):\(.target)/\(.protocol)"' <<<"$json"
exit 1
