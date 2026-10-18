#!/usr/bin/env bash
# Serve a built static site with a real nginx and the REAL nginx.conf, then check the
# security headers on the responses a browser would get (ADR-0056).
#
#   check-security-headers.sh <nginx.conf> <docroot> <expected-file> [nginx-image]
#
#   <expected-file>  one `Name: value` per line (blank lines and # comments ignored).
#                    Every header must appear EXACTLY once with EXACTLY that value, on every
#                    response checked.
#   [nginx-image]    default: the `FROM nginx... AS production` image of the Dockerfile that
#                    sits next to the conf, so the check runs the image that ships.
#
# Responses checked: `/`, one extensionless route (the first built page other than the
# index, when there is one), one hashed asset under /_astro/, and a path that does not
# exist (a 404 must carry the headers too). nginx drops every inherited add_header in a
# location that sets its own, so each location block must repeat them; which location a
# request lands in is the only thing that tells a missing copy.
#
# Also fails when any built *.html contains an inline <script>, an inline <style>, a
# style="" attribute or an on...="" handler. A Content-Security-Policy without
# 'unsafe-inline' blocks all four, and this reads the BUILT output because the build can
# inline small CSS that a container render of the source would not show. A page that
# needs one of them is a decision to take in the policy, not a surprise in production.
#
# Exit codes: 0 all good   1 a header or inline-code check failed   2 usage / could not run
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
	echo "usage: $0 <nginx.conf> <docroot> <expected-file> [nginx-image]" >&2
	exit 2
fi
conf="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
docroot="$(cd "$2" && pwd)"
expected="$3"
[ -f "$conf" ] || { echo "no such conf: $conf" >&2; exit 2; }
[ -f "$expected" ] || { echo "no such expected file: $expected" >&2; exit 2; }

image="${4:-}"
if [ -z "$image" ]; then
	dockerfile="$(dirname "$conf")/Dockerfile"
	image="$(sed -n 's/^FROM \(nginx[^ ]*\) AS production$/\1/p' "$dockerfile" 2>/dev/null | head -n 1)"
fi
[ -n "$image" ] || { echo "no nginx image given and none found in the Dockerfile" >&2; exit 2; }

fail=0
problem() {
	echo "FAIL: $*"
	fail=1
}

# ---- 1. no inline code in the built pages --------------------------------------------
pages="$(find "$docroot" -name '*.html' -type f | sort)"
[ -n "$pages" ] || { echo "no built *.html under $docroot: build first" >&2; exit 2; }
while IFS= read -r page; do
	rel="${page#"$docroot"/}"
	grep -Pzoq '<style[\s>]' "$page" && problem "$rel has an inline <style>"
	grep -Pzoq '<script(?![^>]*\ssrc\s*=)[^>]*>' "$page" && problem "$rel has an inline <script>"
	grep -Pzoq '<[a-zA-Z][^>]*\sstyle\s*=' "$page" && problem "$rel has a style=\"\" attribute"
	grep -Pzoq '<[a-zA-Z][^>]*\son[a-z]+\s*=' "$page" && problem "$rel has an inline event handler"
done <<<"$pages"

# ---- 2. headers over a real nginx -------------------------------------------------------
name="sechdr-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -p 127.0.0.1::80 \
	-v "$docroot:/usr/share/nginx/html:ro" \
	-v "$conf:/etc/nginx/conf.d/default.conf:ro" "$image" >/dev/null
port="$(docker port "$name" 80/tcp 2>/dev/null | head -n 1 | sed 's/.*://' || true)"
ready=0
for _ in $(seq 1 40); do
	[ -n "$port" ] || break
	if curl -s -o /dev/null "http://127.0.0.1:$port/"; then
		ready=1
		break
	fi
	sleep 0.25
done
if [ -z "$port" ] || [ "$ready" -ne 1 ]; then
	echo "nginx never answered; its log:" >&2
	docker logs "$name" >&2 || true
	exit 2
fi

# Paths to check.
paths=("/")
route="$(find "$docroot" -name '*.html' -type f ! -path "$docroot/index.html" | sort | head -n 1)"
if [ -n "$route" ]; then
	route="${route#"$docroot"}"
	case "$route" in
	*/index.html) route="${route%/index.html}" ;;
	*) route="${route%.html}" ;;
	esac
	paths+=("$route")
fi
asset="$(find "$docroot/_astro" -type f 2>/dev/null | sort | head -n 1)"
if [ -n "$asset" ]; then
	paths+=("/_astro/$(basename "$asset")")
else
	problem "no file under _astro/ to check: the asset location went unchecked"
fi
paths+=("/no-such-page-$$")

while IFS= read -r line; do
	line="${line%$'\r'}"
	case "$line" in "" | \#*) continue ;; esac
	want_name="${line%%:*}"
	want_value="${line#*: }"
	for path in "${paths[@]}"; do
		got="$(curl -sI "http://127.0.0.1:$port$path" | tr -d '\r' |
			awk -v n="$(printf '%s' "$want_name" | tr 'A-Z' 'a-z')" \
				'{ split($0, p, ": "); if (tolower(p[1]) == n) { sub(/^[^:]*: */, ""); print } }')"
		count="$(printf '%s' "$got" | grep -c '' || true)"
		if [ -z "$got" ]; then
			problem "$path: $want_name is missing"
		elif [ "$count" -ne 1 ]; then
			problem "$path: $want_name appears $count times"
		elif [ "$got" != "$want_value" ]; then
			problem "$path: $want_name is '$got', want '$want_value'"
		fi
	done
done <"$expected"

if [ "$fail" -eq 0 ]; then
	echo "OK: ${#paths[@]} responses carry every expected header; no inline code in the built pages"
fi
exit "$fail"
