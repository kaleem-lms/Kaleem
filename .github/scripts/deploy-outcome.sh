#!/usr/bin/env bash
# Makes a deploy that did not happen visible.
#
# `deploy-staging` is skipped, with no signal, whenever a gate is red (ISSUES.md #88): the run
# shows a grey job among green ones and master quietly stops being what staging runs. This
# runs after it on every master push, whatever happened, and goes red unless staging has the
# commit, or the push was documentation-only (no deploy expected).
#
# Inputs, all from the workflow (never interpolated into a command line):
#   NEEDS_JSON  toJSON(needs): {"<job>": {"result": "...", "outputs": {...}}, ...}
#   CODE        needs.triage.outputs.code, "true" when the push changed code
#   ACTOR       github.actor
#   GITHUB_STEP_SUMMARY  optional; a results table is appended when set
#
# A Dependabot push is red on purpose: its gates skip, so deploy-staging skips, and staging
# lagging master is exactly the thing that should be seen.
#
# Exit codes: 0 staging has the commit or none was expected   1 master is not on staging
#             2 the inputs are unusable
set -euo pipefail

needs="${NEEDS_JSON:-}"
code="${CODE:-}"
actor="${ACTOR:-}"

jq -e 'type == "object"' >/dev/null 2>&1 <<<"${needs}" || { echo "NEEDS_JSON is not a JSON object" >&2; exit 2; }
jq -e 'has("deploy-staging")' >/dev/null <<<"${needs}" || { echo "NEEDS_JSON has no deploy-staging job: this job must list it in needs" >&2; exit 2; }

result() { jq -r --arg j "$1" '.[$j].result // "missing"' <<<"${needs}"; }

summary() {
	[ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
	{
		echo "### Staging deploy outcome"
		echo
		echo "| job | result |"
		echo "| --- | --- |"
		jq -r 'to_entries[] | "| \(.key) | \(.value.result) |"' <<<"${needs}"
	} >>"${GITHUB_STEP_SUMMARY}"
}
summary

triage="$(result triage)"
deploy="$(result deploy-staging)"

# Without a triage result `code` cannot be read, and "not a code change" would be a guess.
if [ "${triage}" != "success" ]; then
	echo "::error::master is not on staging: triage was ${triage}, so nobody can say whether this push needed a deploy"
	exit 1
fi

if [ "${deploy}" = "success" ]; then
	echo "staging deploy succeeded"
	exit 0
fi

if [ "${code}" != "true" ]; then
	echo "::notice::documentation-only push: no staging deploy expected (deploy-staging: ${deploy})"
	exit 0
fi

# Every gate that is not green, worst first: failure and cancelled before skipped.
gates="$(jq -r '
	to_entries
	| map(select(.key != "deploy-staging" and .key != "triage" and .value.result != "success"))
	| sort_by(if .value.result == "skipped" then 1 else 0 end)
	| map("\(.key)=\(.value.result)")
	| join(", ")' <<<"${needs}")"

reason="deploy-staging was ${deploy}"
if [ "${actor}" = "dependabot[bot]" ]; then
	reason="${reason} (a deliberate skip for Dependabot, whose pushes are never deployed)"
fi
echo "::error::master is not on staging: ${reason}. Gates that did not pass: ${gates:-none}"
exit 1
