#!/usr/bin/env bash
# Tests for deploy-outcome.sh. The needs context is the shape `toJSON(needs)` produces in a
# workflow: {"<job>": {"result": "...", "outputs": {...}}}.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="${here}/deploy-outcome.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
fail=0

needs() { # <triage> <backend-test> <e2e> <deploy-staging>   results
	cat <<EON
{
  "triage": {"result": "$1", "outputs": {"code": "true"}},
  "backend-test": {"result": "$2", "outputs": {}},
  "e2e": {"result": "$3", "outputs": {}},
  "security": {"result": "success", "outputs": {}},
  "deploy-staging": {"result": "$4", "outputs": {}}
}
EON
}

# run <NEEDS_JSON> <CODE> <ACTOR>: runs the script with those inputs and a step summary file.
run() {
	: >"${work}/summary"
	NEEDS_JSON="$1" CODE="$2" ACTOR="$3" GITHUB_STEP_SUMMARY="${work}/summary" "${check}"
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

expect "deploy_success_passes" 0 - run "$(needs success success success success)" true alice

expect "docs_only_passes_with_notice" 0 "::notice::" run "$(needs success skipped skipped skipped)" false alice

expect "gate_failed_deploy_skipped_fails_names_gate" 1 "master is not on staging" \
	run "$(needs success failure success skipped)" true alice
expect "the failing gate is named" 1 "backend-test" run "$(needs success failure success skipped)" true alice
expect "the gate's result is shown" 1 "backend-test=failure" run "$(needs success failure success skipped)" true alice
blamed_out="$(run "$(needs success failure success skipped)" true alice 2>&1 || true)"
if grep -q 'e2e=' <<<"${blamed_out}" || ! grep -q 'backend-test=' <<<"${blamed_out}"; then
	echo "FAIL: a passing gate is not blamed"
	echo "${blamed_out}" | sed 's/^/    /'
	fail=1
else
	echo "ok:   a passing gate is not blamed"
fi

expect "deploy_failed_fails" 1 "master is not on staging" run "$(needs success success success failure)" true alice
expect "a cancelled deploy fails" 1 "master is not on staging" run "$(needs success success success cancelled)" true alice

expect "dependabot_skip_fails" 1 "master is not on staging" run "$(needs success skipped skipped skipped)" true "dependabot[bot]"
expect "dependabot skip says why" 1 "Dependabot" run "$(needs success skipped skipped skipped)" true "dependabot[bot]"

expect "a failed triage is not a docs-only push" 1 "triage" run "$(needs failure skipped skipped skipped)" "" alice

expect "the step summary lists every job" 0 - bash -c '
	set -e
	NEEDS_JSON="$1" CODE=true ACTOR=alice GITHUB_STEP_SUMMARY="$2" "$3" >/dev/null
	for j in triage backend-test e2e security deploy-staging; do grep -q "$j" "$2"; done
' _ "$(needs success success success success)" "${work}/summary2" "${check}"

expect "no summary file is fine" 0 - env -u GITHUB_STEP_SUMMARY NEEDS_JSON="$(needs success success success success)" CODE=true ACTOR=alice "${check}"

expect "bad json is rc=2" 2 - run "not json" true alice
expect "a missing deploy-staging job is rc=2" 2 "deploy-staging" run '{"triage":{"result":"success","outputs":{"code":"true"}}}' true alice

exit "${fail}"
