#!/usr/bin/env bash
# Table-driven tests for the three scan wrappers in this directory:
#
#   gitleaks-history.sh   history scan plus the completeness guard
#   sca-gate.sh           the date guard (report-only before, blocking from)
#   pnpm-audit.sh         pnpm audit, allowlist filter, expiry, counts-only output
#   trivy-counts.sh       trivy report to counts-only output
#
# This runs as the first step of the `security` job, so the scanners that decide
# whether a PR may merge are themselves checked on every run (the
# test-classify-changes.sh precedent). A verifier nobody verified is how a scan
# reads "clean" while having looked at nothing.
#
# Needs docker (the pinned gitleaks image) and git. No other network. The fake
# credential is assembled at runtime from fragments so that neither this file nor
# the fixtures can trip the tree scan that runs right after it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gitleaks_history="$here/gitleaks-history.sh"
sca_gate="$here/sca-gate.sh"
pnpm_audit="$here/pnpm-audit.sh"
trivy_counts="$here/trivy-counts.sh"
fixtures="$here/fixtures"
fail=0

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Run a command, assert its exit code and, optionally, that its combined output
# contains a string. Usage: expect <name> <want-rc> <want-substring|-> cmd...
expect() {
	local name="$1" want="$2" needle="$3"
	shift 3
	local out rc=0
	out="$("$@" 2>&1)" || rc=$?
	if [ "$rc" -ne "$want" ]; then
		echo "FAIL: $name -- want rc=$want, got rc=$rc"
		printf '%s\n' "$out" | sed 's/^/      | /'
		fail=1
		return
	fi
	if [ "$needle" != "-" ] && ! printf '%s' "$out" | grep -qF -- "$needle"; then
		echo "FAIL: $name -- rc ok but output lacks '$needle'"
		printf '%s\n' "$out" | sed 's/^/      | /'
		fail=1
		return
	fi
	echo "ok: $name"
}

# Like expect, but for "any non-zero exit" (the exact code is not part of the contract).
expect_nonzero() {
	local name="$1" needle="$2"
	shift 2
	local out rc=0
	out="$("$@" 2>&1)" || rc=$?
	if [ "$rc" -eq 0 ]; then
		echo "FAIL: $name -- want a non-zero exit, got 0"
		printf '%s\n' "$out" | sed 's/^/      | /'
		fail=1
		return
	fi
	if [ "$needle" != "-" ] && ! printf '%s' "$out" | grep -qF -- "$needle"; then
		echo "FAIL: $name -- rc=$rc but output lacks '$needle'"
		printf '%s\n' "$out" | sed 's/^/      | /'
		fail=1
		return
	fi
	echo "ok: $name"
}

git_quiet() { git -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false "$@"; }

# A repo with two clean commits. Echoes its path.
make_clean_repo() {
	local d="$work/$1"
	mkdir -p "$d"
	git_quiet -C "$d" init -q -b main
	printf 'one\n' >"$d/a.txt"
	git_quiet -C "$d" add a.txt
	git_quiet -C "$d" commit -q -m one
	printf 'two\n' >>"$d/a.txt"
	git_quiet -C "$d" commit -q -am two
	echo "$d"
}

today="$(date -u +%F)"
past="2000-01-01"
future="2999-12-31"
soon="$(date -u -d '+30 days' +%F)"
edge="$(date -u -d '+90 days' +%F)"
beyond="$(date -u -d '+91 days' +%F)"

# ---------------------------------------------------------------------------
# sca-gate.sh <name> <rc> <finding-rc>
# ---------------------------------------------------------------------------
sg() { SCA_BLOCKING_FROM="$1" "$sca_gate" "${@:2}"; }

expect "sca-gate: a clean scan passes before the date" 0 - sg "$future" scanner 0 5
expect "sca-gate: a clean scan passes after the date" 0 - sg "$past" scanner 0 5
expect "sca-gate: a finding is a warning before the date" 0 "::warning::" sg "$future" scanner 5 5
expect "sca-gate: a finding blocks on the date itself" 1 "::error::" sg "$today" scanner 5 5
expect "sca-gate: a finding blocks after the date" 1 "::error::" sg "$past" scanner 5 5
expect "sca-gate: a scanner error blocks before the date" 1 "::error::" sg "$future" scanner 1 5
expect "sca-gate: a scanner error blocks after the date" 1 "::error::" sg "$past" scanner 1 5
expect "sca-gate: an error code keeps its value" 3 "::error::" sg "$future" scanner 3 5
expect_nonzero "sca-gate: a malformed date is refused" "SCA_BLOCKING_FROM" sg "2026-13-45" scanner 0 5
expect_nonzero "sca-gate: a relative date word is refused" "SCA_BLOCKING_FROM" sg "tomorrow" scanner 0 5
expect_nonzero "sca-gate: a date without zero padding is refused" "SCA_BLOCKING_FROM" sg "2026-2-3" scanner 0 5
expect_nonzero "sca-gate: a non-date is refused" "SCA_BLOCKING_FROM" sg "soon" scanner 0 5
expect_nonzero "sca-gate: an unset date is refused" "SCA_BLOCKING_FROM" env -u SCA_BLOCKING_FROM "$sca_gate" scanner 0 5
expect "sca-gate: missing arguments are a usage error" 2 "usage" sg "$future" scanner

# ---------------------------------------------------------------------------
# pnpm-audit.sh <dir> [--from-json <file>]   (allowlist: $PNPM_AUDIT_ALLOWLIST)
# ---------------------------------------------------------------------------
allow_future="$work/allow-future.txt"
allow_expired="$work/allow-expired.txt"
allow_empty="$work/allow-empty.txt"
allow_bad="$work/allow-bad.txt"
printf '# header\n\nGHSA-fake-aaaa-0001 %s build-time only, never reaches the shipped bundle\n' "$soon" >"$allow_future"
printf 'GHSA-fake-aaaa-0001 %s build-time only\n' "$past" >"$allow_expired"
printf '# nothing allowed\n' >"$allow_empty"
printf 'GHSA-fake-aaaa-0001 %s\n' "$soon" >"$allow_bad"

pa() { PNPM_AUDIT_ALLOWLIST="$1" "$pnpm_audit" "${@:2}"; }

expect "pnpm-audit: a clean report passes" 0 - pa "$allow_empty" fixture --from-json "$fixtures/pnpm-audit-clean.json"
expect "pnpm-audit: an unlisted advisory is a finding" 5 "1 to act on (high 1)" pa "$allow_empty" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: an allowlisted advisory is filtered out" 0 - pa "$allow_future" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: only the unlisted one remains" 5 "1 allowlisted, 1 to act on (critical 1)" pa "$allow_future" fixture --from-json "$fixtures/pnpm-audit-two.json"
allow_edge="$work/allow-edge.txt"
allow_beyond="$work/allow-beyond.txt"
allow_forever="$work/allow-forever.txt"
printf 'GHSA-fake-aaaa-0001 %s build-time only\n' "$edge" >"$allow_edge"
printf 'GHSA-fake-aaaa-0001 %s build-time only\n' "$beyond" >"$allow_beyond"
printf 'GHSA-fake-aaaa-0001 %s build-time only\n' "$future" >"$allow_forever"
expect "pnpm-audit: a review-by date exactly 90 days ahead is accepted" 0 - pa "$allow_edge" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: a review-by date 91 days ahead is an error" 3 "more than 90 days ahead" pa "$allow_beyond" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: a review-by date in the year 2999 is an error" 3 "more than 90 days ahead" pa "$allow_forever" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: the horizon is not tied to the blocking date" 0 - \
	env SCA_BLOCKING_FROM=2026-11-30 PNPM_AUDIT_ALLOWLIST="$allow_edge" "$pnpm_audit" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: an expired entry is an error" 3 "expired" pa "$allow_expired" fixture --from-json "$fixtures/pnpm-audit-clean.json"
expect "pnpm-audit: an expired entry never silences its advisory" 3 "expired" pa "$allow_expired" fixture --from-json "$fixtures/pnpm-audit-one.json"
expect "pnpm-audit: an entry with no reason is an error" 3 "reason" pa "$allow_bad" fixture --from-json "$fixtures/pnpm-audit-clean.json"
expect "pnpm-audit: a missing allowlist is an error" 3 "allowlist" pa "$work/does-not-exist.txt" fixture --from-json "$fixtures/pnpm-audit-clean.json"

printf 'this is not json\n' >"$work/garbage.json"
expect "pnpm-audit: malformed JSON is an error" 3 - pa "$allow_empty" fixture --from-json "$work/garbage.json"
expect "pnpm-audit: a registry error body is an error" 3 "metadata" pa "$allow_empty" fixture --from-json "$fixtures/pnpm-audit-no-metadata.json"
expect "pnpm-audit: a missing report is an error" 3 - pa "$allow_empty" fixture --from-json "$work/missing.json"

# The audited repositories are private and the Actions page is public, so CI output is
# COUNTS ONLY: severity totals, never a package or advisory identifier. The itemised rows
# are an opt-in for a local run, and even then never reach the step summary.
summary="$work/summary.md"
: >"$summary"
out_default="$(GITHUB_STEP_SUMMARY="$summary" PNPM_AUDIT_ALLOWLIST="$allow_empty" "$pnpm_audit" fixture --from-json "$fixtures/pnpm-audit-two.json" 2>&1 || true)"
if grep -qF "critical 1, high 1" "$summary" && printf '%s' "$out_default" | grep -qF "critical 1, high 1"; then
	echo "ok: pnpm-audit: the summary and the log carry the count per severity"
else
	echo "FAIL: pnpm-audit: the summary or log lacks the per-severity count"
	sed 's/^/      | /' "$summary"
	fail=1
fi
if grep -qE "fake-package|GHSA-fake|>=3.1.0" "$summary" || printf '%s' "$out_default" | grep -qE "fake-package|GHSA-fake|>=3.1.0"; then
	echo "FAIL: pnpm-audit: a package, advisory or patched range reached the default output"
	sed 's/^/      | /' "$summary"
	printf '%s\n' "$out_default" | sed 's/^/      | /'
	fail=1
else
	echo "ok: pnpm-audit: the default output names no package, advisory or patched range"
fi
: >"$summary"
out_details="$(GITHUB_STEP_SUMMARY="$summary" PNPM_AUDIT_DETAILS=1 PNPM_AUDIT_ALLOWLIST="$allow_empty" "$pnpm_audit" fixture --from-json "$fixtures/pnpm-audit-two.json" 2>&1 || true)"
if printf '%s' "$out_details" | grep -qF "GHSA-fake-bbbb-0002" && printf '%s' "$out_details" | grep -qF "fake-package-two" && printf '%s' "$out_details" | grep -qF ">=3.1.0"; then
	echo "ok: pnpm-audit: PNPM_AUDIT_DETAILS=1 prints severity, package, advisory and patched range"
else
	echo "FAIL: pnpm-audit: the opt-in did not print the itemised rows"
	printf '%s\n' "$out_details" | sed 's/^/      | /'
	fail=1
fi
if grep -qE "fake-package|GHSA-fake|>=3.1.0" "$summary"; then
	echo "FAIL: pnpm-audit: the opt-in leaked the itemised rows into the step summary"
	sed 's/^/      | /' "$summary"
	fail=1
else
	echo "ok: pnpm-audit: even with the opt-in the step summary stays counts only"
fi

# The real invocation must audit production dependencies only, as JSON, and must not
# swallow registry errors. A shim `pnpm` records its arguments and replays a fixture.
shim="$work/shim-pnpm"
mkdir -p "$shim"
cat >"$shim/pnpm" <<SHIM
#!/usr/bin/env bash
printf '%s\n' "\$*" >"$work/pnpm-args.txt"
cat "$fixtures/pnpm-audit-clean.json"
exit \${SHIM_PNPM_RC:-0}
SHIM
chmod +x "$shim/pnpm"
mkdir -p "$work/frontend"
: >"$work/frontend/pnpm-lock.yaml"
PATH="$shim:$PATH" PNPM_AUDIT_ALLOWLIST="$allow_empty" "$pnpm_audit" "$work/frontend" >/dev/null 2>&1 || true
args="$(cat "$work/pnpm-args.txt" 2>/dev/null || true)"
if [ "$args" = "audit --prod --json" ]; then
	echo "ok: pnpm-audit: runs 'pnpm audit --prod --json' with no registry-error bypass"
else
	echo "FAIL: pnpm-audit: ran 'pnpm $args', want 'pnpm audit --prod --json'"
	fail=1
fi
# pnpm exits 1 when it has findings; that alone is not an error. The JSON decides.
expect "pnpm-audit: pnpm's own exit 1 with a valid report is not an error" 0 - \
	env PATH="$shim:$PATH" SHIM_PNPM_RC=1 PNPM_AUDIT_ALLOWLIST="$allow_empty" "$pnpm_audit" "$work/frontend"

# jq exits 5 on a runtime error, and 5 is this wrapper's "findings" code. A tool failure
# must never be read as a finding (nor as clean).
jshim="$work/shim-jq"
mkdir -p "$jshim"
# The report validation (`jq -e`) is delegated to the real jq so the failure lands in the
# later row-building call, which only the ERR trap can catch.
cat >"$jshim/jq" <<'SHIM'
#!/usr/bin/env bash
case " $* " in
*" -e "*) PATH="${PATH#*:}" exec jq "$@" ;;
esac
echo "jq: error: synthetic" >&2
exit 5
SHIM
chmod +x "$jshim/jq"
expect "pnpm-audit: a jq failure (exit 5) is an error, not a finding" 3 - \
	env PATH="$jshim:$PATH" PNPM_AUDIT_ALLOWLIST="$allow_empty" "$pnpm_audit" fixture --from-json "$fixtures/pnpm-audit-one.json"

# ---------------------------------------------------------------------------
# trivy-counts.sh <app> <json> <trivy-rc>
# ---------------------------------------------------------------------------
tc() { "$trivy_counts" "$@"; }
tsum="$work/trivy-summary.md"
: >"$tsum"
tout="$(GITHUB_STEP_SUMMARY="$tsum" "$trivy_counts" fixture "$fixtures/trivy-two.json" 5 2>&1 || true)"
if grep -qF "**3** HIGH or CRITICAL" "$tsum" && grep -qF "critical 1, high 2" "$tsum" && printf '%s' "$tout" | grep -qF "critical 1, high 2"; then
	echo "ok: trivy-counts: the summary and the log carry the count per severity"
else
	echo "FAIL: trivy-counts: the summary or log lacks the per-severity count"
	sed 's/^/      | /' "$tsum"
	fail=1
fi
if grep -qE "fake-trivy|CVE-0000|1\.0\.1|2\.0\.1" "$tsum" || printf '%s' "$tout" | grep -qE "fake-trivy|CVE-0000|1\.0\.1|2\.0\.1"; then
	echo "FAIL: trivy-counts: a package, CVE or fixed version reached the output"
	sed 's/^/      | /' "$tsum"
	printf '%s\n' "$tout" | sed 's/^/      | /'
	fail=1
else
	echo "ok: trivy-counts: the output names no package, CVE or fixed version"
fi
expect "trivy-counts: a clean report says none" 0 "0 HIGH or CRITICAL with a fix available (none)" tc fixture "$fixtures/trivy-clean.json" 0
expect "trivy-counts: a scanner error is left to sca-gate.sh, not counted" 0 "scanner exit 1" tc fixture "$work/trivy-absent.json" 1
expect "trivy-counts: a finished scan with no report is an error" 3 "no usable report" tc fixture "$work/trivy-absent.json" 5
expect "trivy-counts: a finished scan with a garbage report is an error" 3 "no usable report" tc fixture "$work/garbage.json" 0

# ---------------------------------------------------------------------------
# gitleaks-history.sh <dir>
# ---------------------------------------------------------------------------
gl() { "$gitleaks_history" "$@"; }

clean="$(make_clean_repo clean)"
expect "gitleaks-history: a clean repo passes and says how much it scanned" 0 "CLEAN: 2 commits" gl "$clean"

leaky="$(make_clean_repo leaky)"
# Assembled from fragments: the literal never appears in this file.
fake_key="sk_""live_""A1b2C3d4E5f6G7h8I9j0K1l2"
printf 'STRIPE_KEY=%s\n' "$fake_key" >"$leaky/config.env"
git_quiet -C "$leaky" add config.env
git_quiet -C "$leaky" commit -q -m "add config"
# The secret is then deleted: a history scan must still find it.
git_quiet -C "$leaky" rm -q config.env
git_quiet -C "$leaky" commit -q -m "remove config"
expect "gitleaks-history: a secret in history is found even after deletion" 1 "leaks found" gl "$leaky"

shallow="$work/shallow"
git clone -q --depth 1 "file://$clean" "$shallow"
expect "gitleaks-history: a shallow clone is refused" 4 "shallow" gl "$shallow"

expect "gitleaks-history: a directory that is not a repository is refused" 4 - gl "$work/frontend"

# The real CI shape: a submodule checkout, whose `.git` is a FILE pointing at
# `../.git/modules/<name>` in the superproject. It must resolve inside the container.
super="$work/super"
mkdir -p "$super"
git_quiet -C "$super" init -q -b main
git_quiet -C "$super" -c protocol.file.allow=always submodule add -q "file://$clean" sub
git_quiet -C "$super" commit -q -m "add submodule"
expect "gitleaks-history: a submodule checkout (gitdir pointer file) is scanned" 0 "CLEAN: 2 commits" gl "$super/sub"

# A scanner that cannot read the repository inside its container logs an error,
# scans zero commits and still exits 0 (observed 2026-10-17). Replay exactly that.
dshim="$work/shim-docker"
mkdir -p "$dshim"
cat >"$dshim/docker" <<'SHIM'
#!/usr/bin/env bash
case "${SHIM_DOCKER_MODE:-}" in
err)
	echo "7:00AM ERR [git] fatal: not a git repository"
	echo "7:00AM INF 0 commits scanned."
	echo "7:00AM INF no leaks found"
	exit 0
	;;
errfull)
	echo "7:00AM ERR [git] fatal: detected dubious ownership"
	echo "7:00AM INF 2 commits scanned."
	echo "7:00AM INF no leaks found"
	exit 0
	;;
short)
	echo "7:00AM INF 1 commits scanned."
	echo "7:00AM INF no leaks found"
	exit 0
	;;
none)
	echo "7:00AM INF no leaks found"
	exit 0
	;;
full)
	echo "7:00AM INF 2 commits scanned."
	echo "7:00AM INF no leaks found"
	exit 0
	;;
esac
exit 99
SHIM
chmod +x "$dshim/docker"
dk() { env PATH="$dshim:$PATH" SHIM_DOCKER_MODE="$1" "$gitleaks_history" "$clean"; }
expect "gitleaks-history: an ERR line with 0 commits scanned is incomplete, not clean" 4 "INCOMPLETE" dk err
expect "gitleaks-history: an ERR line is incomplete even when the count looks right" 4 "INCOMPLETE" dk errfull
expect "gitleaks-history: fewer commits scanned than the bound is incomplete" 4 "INCOMPLETE" dk short
expect "gitleaks-history: no 'commits scanned' line at all is incomplete" 4 "INCOMPLETE" dk none
expect "gitleaks-history: scanned equal to the bound is complete" 0 "CLEAN: 2 commits (bound 2)" dk full

# A commit that adds no text line (a pure deletion) cannot carry a secret, and
# gitleaks does not count it; the bound must not demand that it did.
delonly="$(make_clean_repo delonly)"
git_quiet -C "$delonly" rm -q a.txt
git_quiet -C "$delonly" commit -q -m "delete everything"
expect "gitleaks-history: a pure-deletion commit is not demanded of the scanner" 0 "CLEAN: 2 commits (bound 2)" gl "$delonly"

if [ "$fail" -ne 0 ]; then
	echo "security script self-test FAILED"
	exit 1
fi
echo "security script self-test passed"
