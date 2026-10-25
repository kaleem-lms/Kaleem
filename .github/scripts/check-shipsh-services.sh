#!/usr/bin/env bash
# Every compose service outside a colour profile is started by ship.sh.
#
#   check-shipsh-services.sh <compose-file> <ship.sh>
#
# ship.sh starts its shared services (step 4) and static frontends (step 10) from explicit
# lists, so a compose service in neither is never started, and nothing reports it: that is how
# coturn once went unstarted with every health check green. This resolves the compose file
# exactly as `docker compose` would on the VPS (no --profile, so the colour-profiled services
# drop out) and fails unless the set of services equals what `ship.sh --list-services` prints:
# a service ship.sh does not name fails, and so does a listed service compose no longer has.
# ship.sh runs the same comparison on the host before it pulls anything.
#
# Every `${VAR:?...}` the file requires is given a dummy value, so the check needs no
# secrets. The values never leave this process.
#
# Exit codes: 0 the sets match   1 they differ   2 could not resolve the file or run ship.sh
set -euo pipefail

if [ "$#" -ne 2 ]; then
	echo "usage: $0 <compose-file> <ship.sh>" >&2
	exit 2
fi
file="$1"
ship="$2"
[ -f "${file}" ] || { echo "no such file: ${file}" >&2; exit 2; }
[ -f "${ship}" ] || { echo "no such file: ${ship}" >&2; exit 2; }

vars="$({ grep -o '\${[A-Za-z_][A-Za-z_0-9]*:?' "${file}" || true; } | sed 's/^\${//; s/:?$//' | sort -u)"
env_args=()
for v in ${vars}; do env_args+=("${v}=dummy"); done

# The file names `env_file: .env.production`, which exists only on the VPS and must never be
# in a checkout. Resolve a copy beside an empty one, in a scratch directory.
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
cp "${file}" "${tmp}/docker-compose.yml"
: >"${tmp}/.env.production"

compose_services="$(env "${env_args[@]}" docker compose -f "${tmp}/docker-compose.yml" config --services 2>"${tmp}/err")" || {
	echo "docker compose could not resolve ${file}:" >&2
	cat "${tmp}/err" >&2
	exit 2
}

listed="$(bash "${ship}" --list-services 2>"${tmp}/err")" || {
	echo "${ship} --list-services failed:" >&2
	cat "${tmp}/err" >&2
	exit 2
}

compose_sorted="$(printf '%s\n' "${compose_services}" | grep -v '^$' | sort -u || true)"
listed_sorted="$(printf '%s\n' "${listed}" | grep -v '^$' | sort -u || true)"

rc=0
while IFS= read -r s; do
	[ -n "${s}" ] || continue
	echo "unlisted: ${s} (a compose service outside a profile that ${ship##*/} never starts)"
	rc=1
done < <(comm -23 <(printf '%s\n' "${compose_sorted}") <(printf '%s\n' "${listed_sorted}"))
while IFS= read -r s; do
	[ -n "${s}" ] || continue
	echo "not in compose: ${s} (listed by ${ship##*/} but absent from ${file##*/})"
	rc=1
done < <(comm -13 <(printf '%s\n' "${compose_sorted}") <(printf '%s\n' "${listed_sorted}"))

if [ "${rc}" -eq 0 ]; then
	echo "OK: ${file##*/} and ${ship##*/} agree on: $(paste -sd' ' <<<"${compose_sorted}")"
else
	echo "FAIL: add the service to SHARED_SERVICES or STATIC_SERVICES in ${ship##*/}, or give it a colour profile."
fi
exit "${rc}"
