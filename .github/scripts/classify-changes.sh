#!/usr/bin/env bash
# Classify a change as documentation-only or code.
#
#   classify-changes.sh <base-ref> <head-ref>
#   classify-changes.sh --paths-from-stdin      (newline-separated paths)
#
# Prints "true" if the change contains code, "false" if every changed path is
# documentation. Callers skip CI gates only on "false".
#
# THE DEFAULT IS "true". A path nobody anticipated, an unreadable diff, an
# empty diff and an all-zero base SHA all return "true" and run the full
# suite. Skipping a gate we needed is unrecoverable; running one we did not
# need costs a minute.
set -euo pipefail

readonly ZERO_SHA="0000000000000000000000000000000000000000"

# Documentation is `docs/**` and root-level `*.md`, and nothing else.
# Ordering matters: the `*/*` arm catches every nested non-docs path
# (.github/workflows/ci.yml, infra/..., src/docs/x.md) before the `*.md` arm
# can mistake it for root markdown.
is_docs_path() {
	case "$1" in
	docs/*) return 0 ;;
	*/*) return 1 ;;
	*.md) return 0 ;;
	*) return 1 ;;
	esac
}

main() {
	local paths

	if [ "${1:-}" = "--paths-from-stdin" ]; then
		paths="$(cat)"
	else
		local base="${1:-}" head="${2:-}"
		if [ -z "$base" ] || [ -z "$head" ] || [ "$base" = "$ZERO_SHA" ]; then
			echo "true"
			return 0
		fi
		if ! paths="$(git diff --name-only "$base" "$head" 2>/dev/null)"; then
			echo "true"
			return 0
		fi
	fi

	if [ -z "$paths" ]; then
		echo "true"
		return 0
	fi

	while IFS= read -r path; do
		[ -z "$path" ] && continue
		if ! is_docs_path "$path"; then
			echo "true"
			return 0
		fi
	done <<<"$paths"

	echo "false"
}

main "$@"
