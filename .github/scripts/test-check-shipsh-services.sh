#!/usr/bin/env bash
# Tests for check-shipsh-services.sh. Compose files and ship scripts are generated into a temp
# dir; docker compose only resolves them, nothing is started.
#
# The last case runs the checker on the real compose file and the real ship.sh. Those live in
# the infra submodule, so the directory is overridable for a checkout that has none:
#   KALEEM_INFRA_DIR=/path/to/infra .github/scripts/test-check-shipsh-services.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="${here}/check-shipsh-services.sh"
infra="${KALEEM_INFRA_DIR:-${here}/../../infra}"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
fail=0

compose() { # <path> <extra service yaml, or empty>
	cat >"$1" <<EOC
services:
  web:
    image: nginx:alpine
    env_file: .env.production
    environment:
      NEEDED: \${NEEDED:?NEEDED is required}
  db:
    image: postgres:18-alpine
  worker-blue:
    profiles: [blue]
    image: nginx:alpine
  worker-green:
    profiles: [green]
    image: nginx:alpine
${2:-}
EOC
}

ship() { # <path> <service>...   a stand-in for ship.sh that honours --list-services
	local path="$1"
	shift
	{
		echo '#!/usr/bin/env bash'
		echo '[ "${1:-}" = "--list-services" ] || exit 9'
		printf 'echo %s\n' "$@"
	} >"${path}"
}

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

compose "${work}/good.yml" ""
ship "${work}/good.sh" web db
expect "profiled services are ignored" 0 "OK" "${check}" "${work}/good.yml" "${work}/good.sh"

compose "${work}/extra.yml" "  newsvc:
    image: nginx:alpine"
expect "an extra shared service fails and is named" 1 "unlisted: newsvc" "${check}" "${work}/extra.yml" "${work}/good.sh"

ship "${work}/missing.sh" web db gone
expect "a listed service compose lacks fails and is named" 1 "not in compose: gone" "${check}" "${work}/good.yml" "${work}/missing.sh"

expect "a required variable gets a dummy value" 0 "OK" "${check}" "${work}/good.yml" "${work}/good.sh"

printf 'services: [not, a, mapping\n' >"${work}/broken.yml"
expect "a compose file it cannot resolve is rc=2" 2 - "${check}" "${work}/broken.yml" "${work}/good.sh"
expect "no such compose file is rc=2" 2 "no such file" "${check}" "${work}/absent.yml" "${work}/good.sh"
expect "no such ship script is rc=2" 2 "no such file" "${check}" "${work}/good.yml" "${work}/absent.sh"

printf '#!/usr/bin/env bash\nexit 3\n' >"${work}/bad.sh"
expect "a ship script that cannot list services is rc=2" 2 - "${check}" "${work}/good.yml" "${work}/bad.sh"

ship "${work}/empty.sh"
expect "an empty list is not a match" 1 "unlisted: web" "${check}" "${work}/good.yml" "${work}/empty.sh"

if [ -f "${infra}/docker-compose.production.yml" ] && [ -f "${infra}/scripts/ship.sh" ]; then
	expect "the real compose file and the real ship.sh agree" 0 "OK" \
		"${check}" "${infra}/docker-compose.production.yml" "${infra}/scripts/ship.sh"
else
	echo "FAIL: the infra submodule is not checked out at ${infra}"
	fail=1
fi

exit "${fail}"
