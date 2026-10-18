#!/usr/bin/env bash
# Tests for check-published-ports.sh. Compose files are generated into a temp dir; docker
# compose only resolves them, nothing is started.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-published-ports.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail=0

compose() { # <path> <ports yaml lines for web>
	cat >"$1" <<EOF
services:
  web:
    image: nginx:alpine
    env_file: .env.production
    environment:
      NEEDED: \${NEEDED:?NEEDED is required}
    ports:
$2
  turn:
    image: coturn/coturn:4.6
    network_mode: host
EOF
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

compose "$work/good.yml" '      - "80:80"
      - "443:443"'
expect "80 and 443 only" 0 "publishes exactly: 80 443" "$check" "$work/good.yml"

compose "$work/extra.yml" '      - "80:80"
      - "443:443"
      - "8080:8080"'
expect "an extra tcp port fails and is named" 1 "publishes: 80 443 8080" "$check" "$work/extra.yml"

compose "$work/udp.yml" '      - "80:80"
      - "443:443"
      - "9999:9999/udp"'
expect "an extra udp port fails" 1 "9999" "$check" "$work/udp.yml"

compose "$work/bound.yml" '      - "127.0.0.1:5432:5432"
      - "80:80"
      - "443:443"'
expect "a loopback-bound publish still counts" 1 "5432" "$check" "$work/bound.yml"

compose "$work/missing.yml" '      - "80:80"'
expect "a missing 443 fails" 1 "publishes: 80;" "$check" "$work/missing.yml"

compose "$work/range.yml" '      - "80:80"
      - "443:443"
      - "49152-49153:49152-49153/udp"'
expect "a published range fails" 1 "49152" "$check" "$work/range.yml"

expect "the allowed set can be given" 0 "publishes exactly: 80" "$check" "$work/missing.yml" 80

printf 'services: [not, a, mapping\n' >"$work/broken.yml"
expect "a file compose cannot resolve is rc=2" 2 - "$check" "$work/broken.yml"
expect "no such file is rc=2" 2 "no such file" "$check" "$work/absent.yml"

exit "$fail"
