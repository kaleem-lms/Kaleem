#!/usr/bin/env bash
# Tests for check-staging-host-key.sh. Keys are generated into a temp dir: nothing here is a
# real host's key.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="${here}/check-staging-host-key.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
fail=0

ssh-keygen -q -t ed25519 -N '' -C '' -f "${work}/ed"
ssh-keygen -q -t ed25519 -N '' -C '' -f "${work}/ed2"
ssh-keygen -q -t rsa -b 2048 -N '' -C '' -f "${work}/rsa"
ed="$(cut -d' ' -f1,2 "${work}/ed.pub")"
ed2="$(cut -d' ' -f1,2 "${work}/ed2.pub")"
rsa="$(cut -d' ' -f1,2 "${work}/rsa.pub")"

expect() { # <name> <want rc> <needle|-> cmd...
	local name="$1" want="$2" needle="$3"
	shift 3
	local out rc=0
	out="$("$@" 2>&1)" || rc=$?
	if [ "${rc}" -ne "${want}" ]; then
		echo "FAIL: ${name} -- want rc=${want}, got rc=${rc}"
		echo "${out}" | sed 's/^/    /'
		fail=1
	elif [ "${needle}" != "-" ] && ! grep -qF -- "${needle}" <<<"${out}"; then
		echo "FAIL: ${name} -- output lacks: ${needle}"
		echo "${out}" | sed 's/^/    /'
		fail=1
	else
		echo "ok:   ${name}"
	fi
}

printf 'kaleem-staging %s\n' "${ed}" >"${work}/good"
expect "one aliased ed25519 key passes" 0 "OK" "${check}" "${work}/good"

printf '# the staging host\n\nkaleem-staging %s\n' "${ed}" >"${work}/commented"
expect "comments and blank lines are ignored" 0 "OK" "${check}" "${work}/commented"

expect "a missing file fails" 1 "missing" "${check}" "${work}/absent"

: >"${work}/empty"
expect "an empty file fails" 1 "found 0" "${check}" "${work}/empty"

printf 'kaleem-staging %s\nkaleem-staging %s\n' "${ed}" "${ed2}" >"${work}/two"
expect "a second key fails" 1 "found 2" "${check}" "${work}/two"

printf '203.0.113.7 %s\n' "${ed}" >"${work}/address"
expect "an address instead of the alias fails" 1 "alias" "${check}" "${work}/address"

printf 'kaleem-staging %s\n' "${rsa}" >"${work}/rsa"
expect "an rsa key fails" 1 "ed25519" "${check}" "${work}/rsa"

printf 'kaleem-staging ssh-ed25519 AAAAnotakey\n' >"${work}/garbage"
expect "a key OpenSSH cannot parse fails" 1 "cannot parse" "${check}" "${work}/garbage"

exit "${fail}"
