#!/usr/bin/env bash
# Tests for check-traefik-static-config.sh. Compose files are generated into a temp dir and
# the checker starts a real Traefik on each (no network, nothing published), so this needs a
# Docker daemon. Each failing fixture is the good one with exactly one thing taken away, so a
# checker that stopped looking at that one thing would pass it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-traefik-static-config.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail=0

# The flag list is the one in infra/docker-compose.production.yml (the real file is checked
# separately in CI); `@FLAGS@` is replaced per fixture.
base_flags=(
	'--api.dashboard=true'
	'--api.insecure=false'
	'--entrypoints.web.address=:80'
	'--entrypoints.web.http.redirections.entrypoint.to=websecure'
	'--entrypoints.web.http.redirections.entrypoint.scheme=https'
	'--entrypoints.web.transport.lifecycle.graceTimeOut=30s'
	'--entrypoints.websecure.address=:443'
	'--entrypoints.websecure.transport.lifecycle.graceTimeOut=30s'
	'--providers.docker.endpoint=unix:///var/run/docker.sock'
	'--providers.docker.exposedByDefault=false'
	'--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL:?ACME_EMAIL is required}'
	'--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
	'--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
	'--log.level=INFO'
	'--log.format=json'
	'--accesslog=true'
	'--accesslog.format=json'
	'--accesslog.fields.names.RequestPath=drop'
)

fixture() { # <path> <flag to remove, or -> <flag to add, or ->
	local path="$1" remove="$2" add="$3" f
	{
		echo "services:"
		echo "  traefik:"
		echo "    image: traefik:v3"
		echo "    command:"
		for f in "${base_flags[@]}"; do
			if [ "$remove" != "-" ] && [[ "$f" == "$remove"* ]]; then continue; fi
			printf '      - %s\n' "$f"
		done
		if [ "$add" != "-" ]; then printf '      - %s\n' "$add"; fi
	} >"$path"
}

expect() { # <name> <want rc> <needle|-> cmd...
	local name="$1" want="$2" needle="$3"
	shift 3
	local out rc=0
	out="$("$@" 2>&1)" || rc=$?
	if [ "$rc" -ne "$want" ]; then
		echo "FAIL: $name -- want rc=$want, got rc=$rc"
		echo "$out" | sed 's/^/    /'
		fail=1
	elif [ "$needle" != "-" ] && ! grep -qF -- "$needle" <<<"$out"; then
		echo "FAIL: $name -- output lacks: $needle"
		echo "$out" | sed 's/^/    /'
		fail=1
	else
		echo "ok:   $name"
	fi
}

fixture "$work/good.yml" - -
expect "the full flag set passes" 0 "OK:" "$check" "$work/good.yml"

fixture "$work/no-drop.yml" '--accesslog.fields.names.RequestPath' -
expect "a missing RequestPath drop fails and is named" 1 "RequestPath" "$check" "$work/no-drop.yml"

fixture "$work/redact.yml" '--accesslog.fields.names.RequestPath' '--accesslog.fields.names.RequestPath=redact'
expect "RequestPath=redact (silently ignored by Traefik) fails" 1 "RequestPath" "$check" "$work/redact.yml"

fixture "$work/no-email.yml" '--certificatesresolvers.letsencrypt.acme.email' -
expect "a missing ACME email fails and is named" 1 "acme.email" "$check" "$work/no-email.yml"

fixture "$work/typo.yml" '--certificatesresolvers.letsencrypt.acme.storage' '--certificatesresolvers.letsencrypt.acme.storag=/letsencrypt/acme.json'
expect "a misspelled flag fails" 1 "static configuration" "$check" "$work/typo.yml"

fixture "$work/no-redirect.yml" '--entrypoints.web.http.redirections.entrypoint.to' -
expect "a lost http-to-https redirect fails" 1 "redirect" "$check" "$work/no-redirect.yml"

fixture "$work/expose.yml" '--providers.docker.exposedByDefault' -
expect "exposedByDefault left at Traefik's default (true) fails" 1 "exposedByDefault" "$check" "$work/expose.yml"

fixture "$work/grace.yml" '--entrypoints.websecure.transport.lifecycle.graceTimeOut' -
expect "a lost 30s grace period fails" 1 "graceTimeOut" "$check" "$work/grace.yml"

expect "no compose file is a usage error" 2 "usage" "$check"
printf 'services:\n  web:\n    image: nginx:alpine\n' >"$work/none.yml"
expect "a compose file with no traefik service is an error" 2 "no traefik service" "$check" "$work/none.yml"

exit "$fail"
