#!/usr/bin/env bash
# Prove an nginx config writes no credential to the container's log.
#
#   check-nginx-access-log.sh <nginx.conf> <docroot>
#
# Runs the config in a real nginx container, sends requests whose query string,
# Referer, User-Agent and Cookie all carry a probe value (the shape of a credential
# link followed from an email), then reads the container's ENTIRE output -- access log
# and error log, stdout and stderr. Fails if the probe appears anywhere, and fails if
# the request PATH does not appear: a config that logs nothing would otherwise pass.
# (Access-log policy: paths only, never a query string or a header.)
#
# Exit: 0 clean, 1 a leak or no path logged, 2 the check itself could not run.
set -euo pipefail

conf="${1:?usage: check-nginx-access-log.sh <nginx.conf> <docroot>}"
docroot="${2:?usage: check-nginx-access-log.sh <nginx.conf> <docroot>}"
image="${NGINX_IMAGE:-nginx:1.27-alpine}"
probe="zz-probe-credential-9f3a"

[ -f "$conf" ] || { echo "ERROR: no such config: $conf" >&2; exit 2; }
[ -d "$docroot" ] || { echo "ERROR: no such docroot: $docroot" >&2; exit 2; }
conf="$(realpath "$conf")"
docroot="$(realpath "$docroot")"

name="nginx-log-check-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -p 127.0.0.1::80 \
	-v "$conf:/etc/nginx/conf.d/default.conf:ro" \
	-v "$docroot:/usr/share/nginx/html:ro" "$image" >/dev/null
port="$(docker port "$name" 80/tcp | head -n1 | sed 's/.*://')"
[ -n "$port" ] || { echo "ERROR: no published port" >&2; exit 2; }

ready=""
for _ in $(seq 1 50); do
	if curl -s -o /dev/null "http://127.0.0.1:$port/"; then ready=1; break; fi
	sleep 0.2
done
[ -n "$ready" ] || { echo "ERROR: nginx did not answer; its output:" >&2; docker logs "$name" >&2 || true; exit 2; }

paths=(/verify-email /reset-password /verify-pending /assets/missing.js)

probe_get() {
	curl -s -o /dev/null \
		-A "agent-$probe" \
		-H "Referer: https://app.example/reset-password?token=$probe" \
		-H "Cookie: session=$probe" \
		"http://127.0.0.1:$port$1" || true
}
probe_get "/verify-email?key=$probe"
probe_get "/reset-password?uid=$probe&token=$probe"
probe_get "/verify-pending?email=$probe%40example.com"
probe_get "/assets/missing.js?x=$probe"
# A request for a directory that has no index file is answered with 403 and nginx's
# ERROR log (not the access log) names the whole request line and the Referer, so
# the probe has to reach that path too. Use a real directory from the build.
dir="$(find "$docroot" -mindepth 1 -maxdepth 1 -type d ! -exec test -e '{}/index.html' ';' -print | head -n1)"
if [ -n "$dir" ]; then
	dirname="$(basename "$dir")"
	probe_get "/$dirname/?d=$probe"
	paths+=("/$dirname/")
fi

out="$(docker logs "$name" 2>&1)"

rc=0
if grep -q "$probe" <<<"$out"; then
	echo "FAIL: the probe value reached the container log:" >&2
	grep "$probe" <<<"$out" >&2
	rc=1
fi
for path in "${paths[@]}"; do
	if ! grep -q "$path" <<<"$out"; then
		echo "FAIL: the path $path was not logged (a config that logs nothing proves nothing)" >&2
		rc=1
	fi
done
[ "$rc" -eq 0 ] && echo "CLEAN: $conf logs paths only; the probe is absent from the container output"
exit "$rc"
