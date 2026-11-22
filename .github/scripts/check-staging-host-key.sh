#!/usr/bin/env bash
# The staging deploy trusts exactly one host key, committed under an alias.
#
#   check-staging-host-key.sh [known-hosts-file]     default: .github/deploy/staging_known_hosts
#
# The deploy connects with StrictHostKeyChecking=yes and HostKeyAlias=kaleem-staging, so the
# file must hold exactly one entry: the alias `kaleem-staging` (never an address), an ed25519
# key, and a key OpenSSH can parse. A missing file, a second entry, a different key type or a
# line that is not a key fails here, on the pull request, instead of at the first deploy.
#
# Exit codes: 0 the file pins one well-formed ed25519 key   1 it does not
set -euo pipefail

file="${1:-.github/deploy/staging_known_hosts}"
alias_name="kaleem-staging"

fail() {
	echo "::error file=${file}::$1"
	exit 1
}

[ -f "${file}" ] || fail "missing: the deploy has no host key to trust (see docs/runbook/deploy.md)"

entries="$(grep -vE '^[[:space:]]*(#|$)' "${file}" || true)"
count="$(printf '%s' "${entries}" | grep -c . || true)"
[ "${count}" -eq 1 ] || fail "expected exactly one host key entry, found ${count}"

printf '%s\n' "${entries}" | grep -qE "^${alias_name} ssh-ed25519 [A-Za-z0-9+/]+=*\$" \
	|| fail "the entry must read '${alias_name} ssh-ed25519 <key>': an alias, never an address, and an ed25519 key"

# Parse it the way OpenSSH will.
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT
printf '%s\n' "${entries}" >"${tmp}"
fp="$(ssh-keygen -lf "${tmp}" 2>/dev/null)" || fail "OpenSSH cannot parse the key"

echo "OK: ${file} pins one ed25519 key under the alias ${alias_name}: ${fp}"
