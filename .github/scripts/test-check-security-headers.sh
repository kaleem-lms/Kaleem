#!/usr/bin/env bash
# Tests for check-security-headers.sh: a header check that cannot fail proves nothing, so
# each way it should fail is built here and the exit code asserted (the
# test-security-scripts.sh precedent). Fixtures are generated into a temp dir.
#
# Needs docker and the nginx image. No other network.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-security-headers.sh"
image="${NGINX_IMAGE:-nginx:alpine}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail=0

# A two-location conf like the real ones: `/` and a second location for hashed assets.
write_conf() { # <path> <header lines for / > <header lines for /_astro/>
	cat >"$1" <<EOF
server {
    listen 80;
    root /usr/share/nginx/html;
    location /_astro/ {
        $3
        try_files \$uri =404;
    }
    location / {
        $2
        try_files \$uri \$uri/index.html \$uri.html =404;
    }
}
EOF
}
good='add_header X-Frame-Options "DENY" always; add_header Referrer-Policy "no-referrer" always;'
mkdir -p "$work/site/_astro"
printf '<!doctype html><title>a</title><link rel=stylesheet href=/_astro/a.css>\n' >"$work/site/index.html"
printf '<!doctype html><title>b</title><p>about\n' >"$work/site/about.html"
printf 'p{}\n' >"$work/site/_astro/a.css"
cat >"$work/expected" <<'EOF'
# comment
X-Frame-Options: DENY
Referrer-Policy: no-referrer
EOF

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

write_conf "$work/good.conf" "$good" "$good"
expect "every location carries the headers" 0 "OK:" \
	"$check" "$work/good.conf" "$work/site" "$work/expected" "$image"

write_conf "$work/no-asset.conf" "$good" ""
expect "a location that lost them is caught on the asset" 1 "/_astro/a.css: X-Frame-Options is missing" \
	"$check" "$work/no-asset.conf" "$work/site" "$work/expected" "$image"

write_conf "$work/no-root.conf" "" "$good"
expect "a location that lost them is caught on the page" 1 "/: X-Frame-Options is missing" \
	"$check" "$work/no-root.conf" "$work/site" "$work/expected" "$image"

# The extensionless route is a distinct request from `/`; here both land in the same
# location, so it is exercised by the check on /about.
expect "the extensionless route is requested" 1 "/about: Referrer-Policy is missing" \
	"$check" "$work/no-root.conf" "$work/site" "$work/expected" "$image"

write_conf "$work/wrong.conf" 'add_header X-Frame-Options "SAMEORIGIN" always; add_header Referrer-Policy "no-referrer" always;' "$good"
expect "a wrong value is caught" 1 "X-Frame-Options is 'SAMEORIGIN', want 'DENY'" \
	"$check" "$work/wrong.conf" "$work/site" "$work/expected" "$image"

write_conf "$work/dup.conf" "$good add_header X-Frame-Options \"DENY\" always;" "$good"
expect "a duplicated header is caught" 1 "X-Frame-Options appears 2 times" \
	"$check" "$work/dup.conf" "$work/site" "$work/expected" "$image"

write_conf "$work/no-always.conf" 'add_header X-Frame-Options "DENY"; add_header Referrer-Policy "no-referrer";' "$good"
expect "a header without 'always' is missing on the 404" 1 "X-Frame-Options is missing" \
	"$check" "$work/no-always.conf" "$work/site" "$work/expected" "$image"

for bad in '<script>var a=1</script>' '<style>p{}</style>' '<p style="color:red">x</p>' '<a onclick="x()">y</a>'; do
	rm -rf "$work/dirty" && cp -r "$work/site" "$work/dirty"
	printf '%s\n' "$bad" >>"$work/dirty/about.html"
	expect "inline code is caught: $bad" 1 "about.html has" \
		"$check" "$work/good.conf" "$work/dirty" "$work/expected" "$image"
done

rm -rf "$work/ok2" && cp -r "$work/site" "$work/ok2"
printf '<script src="/x.js"></script><p class="a">z</p>\n' >>"$work/ok2/about.html"
expect "an external script and a class are not inline code" 0 "OK:" \
	"$check" "$work/good.conf" "$work/ok2" "$work/expected" "$image"

printf 'server { this is not nginx }\n' >"$work/broken.conf"
expect "a conf nginx refuses is rc=2, not a pass" 2 - \
	"$check" "$work/broken.conf" "$work/site" "$work/expected" "$image"

expect "no built pages is rc=2" 2 "no built" \
	"$check" "$work/good.conf" "$work/site/_astro" "$work/expected" "$image"

exit "$fail"
