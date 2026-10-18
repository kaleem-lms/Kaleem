#!/usr/bin/env bash
# Self-test for check-nginx-access-log.sh: the checker must FAIL on configs that
# leak and on configs that log nothing, or a pass from it means nothing.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-nginx-access-log.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
echo "<!doctype html><title>x</title>" >"$work/index.html"
mkdir "$work/static" && echo "x" >"$work/static/a.txt" # a directory with no index file
chmod 755 "$work" "$work/static"; chmod 644 "$work/index.html" "$work/static/a.txt" # the nginx worker is not our uid

fail=0
expect_fail() {
	local name="$1" conf="$2" needle="$3" out rc=0
	out="$("$check" "$conf" "$work" 2>&1)" || rc=$?
	if [ "$rc" -ne 1 ]; then
		echo "FAIL: $name -- want rc=1, got rc=$rc"
		echo "$out"
		fail=1
	elif ! grep -q "$needle" <<<"$out"; then
		echo "FAIL: $name -- rc=1 but not for the expected reason ($needle)"
		echo "$out"
		fail=1
	else
		echo "ok: $name"
	fi
}

expect_fail "default log format leaks the probe" \
	"$here/fixtures/nginx-default-log.conf" "reached the container log"
expect_fail "a config that logs nothing is rejected" \
	"$here/fixtures/nginx-no-log.conf" "was not logged"
expect_fail "the error log is read too: a directory without an index file" \
	"$here/fixtures/nginx-dir-index.conf" "directory index"
exit "$fail"
