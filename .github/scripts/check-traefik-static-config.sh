#!/usr/bin/env bash
# The gateway's static configuration, as Traefik itself loads it (ADR-0019 amendment).
#
#   check-traefik-static-config.sh <compose-file>
#
# Traefik reads exactly ONE static-configuration source, and a mounted file beats flags and
# environment variables, so the production compose carries the whole configuration as the
# `traefik` service's `command:` flags (the ACME contact comes from ${ACME_EMAIL}). A
# misspelled flag stops Traefik, which takes every route offline, and a flag that is accepted
# but means something else (`RequestPath=redact` is silently ignored; only `drop` removes the
# field, ADR-0053) is invisible in review. So this resolves the compose file as `docker
# compose` would, starts the real image on exactly that command with debug logging and no
# network, reads the "Static configuration loaded" line, and asserts the configuration
# Traefik ended up with.
#
# Every `${VAR:?...}` is given a dummy value, and ACME_EMAIL a recognisable probe, so the
# check needs no secrets. The values never leave this process.
#
# Exit codes: 0 the configuration is as expected   1 it is not   2 could not run the check
set -euo pipefail

if [ "$#" -ne 1 ]; then
	echo "usage: $0 <compose-file>" >&2
	exit 2
fi
file="$1"
[ -f "$file" ] || { echo "no such file: $file" >&2; exit 2; }

probe="probe@example.invalid"

vars="$({ grep -o '\${[A-Za-z_][A-Za-z_0-9]*:?' "$file" || true; } | sed 's/^\${//; s/:?$//' | sort -u)"
env_args=()
for v in $vars; do env_args+=("$v=dummy"); done
env_args+=("ACME_EMAIL=$probe")

# The file names `env_file: .env.production`, which exists only on the VPS and must never be
# in a checkout. Resolve a copy beside an empty one, in a scratch directory.
tmp="$(mktemp -d)"
name="kaleem-traefik-check-$$"
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	rm -rf "$tmp"
}
trap cleanup EXIT
cp "$file" "$tmp/docker-compose.yml"
: >"$tmp/.env.production"

json="$(env "${env_args[@]}" docker compose -f "$tmp/docker-compose.yml" config --format json 2>"$tmp/err")" || {
	echo "docker compose could not resolve $file:" >&2
	cat "$tmp/err" >&2
	exit 2
}
image="$(jq -r '.services.traefik.image // empty' <<<"$json")"
[ -n "$image" ] || { echo "no traefik service (with an image) in $file" >&2; exit 2; }
mapfile -t flags < <(jq -r '.services.traefik.command // [] | .[]' <<<"$json")
[ "${#flags[@]}" -gt 0 ] || { echo "the traefik service in $file has no command: flags" >&2; exit 1; }

# A later --log.level wins (verified against v3.7), so DEBUG is appended rather than the INFO
# flag being rewritten. Debug level is what prints the loaded static configuration.
docker run -d --network none --name "$name" "$image" "${flags[@]}" --log.level=DEBUG >/dev/null

# Wait for the configuration line, or for Traefik to give up (a bad flag exits at once).
logs=""
for _ in $(seq 1 40); do
	logs="$(docker logs "$name" 2>&1 || true)"
	grep -q 'Static configuration loaded' <<<"$logs" && break
	[ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)" = true ] || break
	sleep 0.5
done
logs="$(docker logs "$name" 2>&1 || true)"

static="$(grep 'Static configuration loaded' <<<"$logs" | head -n 1 | jq -c '.staticConfiguration' 2>/dev/null || true)"
if [ -z "$static" ] || [ "$static" = null ]; then
	echo "FAIL: Traefik printed no static configuration; it refused the flags or never started:"
	grep -v '^$' <<<"$logs" | tail -n 8 | sed 's/^/    /'
	exit 1
fi

rc=0
expect() { # <label> <jq expression that must be true>
	if [ "$(jq -r "$2" <<<"$static")" != true ]; then
		echo "FAIL: $1"
		rc=1
	fi
}
expect "acme.email is not the value from \${ACME_EMAIL}" \
	".certificatesResolvers.letsencrypt.acme.email == \"$probe\""
expect "acme.storage is not /letsencrypt/acme.json" \
	'.certificatesResolvers.letsencrypt.acme.storage == "/letsencrypt/acme.json"'
expect "acme http challenge is not on the web entrypoint" \
	'.certificatesResolvers.letsencrypt.acme.httpChallenge.entryPoint == "web"'
expect "accessLog.fields.names.RequestPath is not \"drop\" (ADR-0053: the path carries a query string)" \
	'.accessLog.fields.names.RequestPath == "drop"'
expect "accessLog is not json" '.accessLog.format == "json"'
expect "log is not json" '.log.format == "json"'
expect "the web entrypoint no longer redirects to websecure over https (redirect lost)" \
	'.entryPoints.web.http.redirections.entryPoint | (.to == "websecure" and .scheme == "https")'
expect "the web entrypoint is not :80" '.entryPoints.web.address == ":80"'
expect "the websecure entrypoint is not :443" '.entryPoints.websecure.address == ":443"'
expect "web graceTimeOut is not 30s" '.entryPoints.web.transport.lifeCycle.graceTimeOut == "30s"'
expect "websecure graceTimeOut is not 30s" '.entryPoints.websecure.transport.lifeCycle.graceTimeOut == "30s"'
# exposedByDefault is omitted from the printed configuration when false, and printed true
# when left at Traefik's default.
expect "providers.docker.exposedByDefault is not false" \
	'(.providers.docker.exposedByDefault // false) == false'
expect "the dashboard API is exposed insecurely" '(.api.insecure // false) == false'

if [ "$rc" -eq 0 ]; then
	echo "OK: Traefik loaded the expected static configuration from $(basename "$file")'s command: flags"
fi
exit "$rc"
