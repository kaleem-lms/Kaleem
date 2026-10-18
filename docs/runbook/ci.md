# CI Runbook

## What it is

`ci.yml` (meta repo) runs the nine-job suite — `backend-lint`, `backend-test`,
`dashboard-lint`, `dashboard-build`, `marketing-build`, `e2e`, `security`, `image-scan`,
`deploy-staging` —
only when a change can actually break something, and only once per proven tree. ADR-0038
records why; this page is for reading a run and knowing which behaviour is a bug and which
is the design working as intended.

## `triage`'s two outputs

Every run starts with a single `triage` job. It always runs and produces two outputs:

- **`code`** — `"false"` iff every changed path is `docs/**` or a root `*.md`. Anything else,
  including a path the classifier does not recognise, is `"true"`. The classifier's default
  branch is `code`, deliberately: an unanticipated path runs the full suite rather than being
  silently skipped.
- **`verified`** — `"true"` iff a green run already tested this exact git tree. **On a pull
  request this is the empty string, not `"false"`.** The lookup step that sets it (`guard`)
  only runs `if: github.event_name == 'push'`; on a `pull_request` event the step is skipped
  entirely, and a skipped step's output is empty.

This is why every downstream job's condition reads `needs.triage.outputs.verified != 'true'`
and never `== 'false'`. Testing for the wrong value would make an empty string equal `false`
by coincidence today, but writing it correctly is one line and removes the coincidence. If
you add a new job gated on `verified`, copy the `!= 'true'` form, not `== 'false'`.

## Two things that look like a bug and are not

**A PR merged more than 7 days after going green runs the full suite.** The guard looks for
an artifact named `verified-tree-<hash>` uploaded by `record-verified-tree` on the PR's last
green run, and artifacts expire after 7 days (`retention-days: 7` in `ci.yml`). If the merge
happens later than that, the artifact is gone, the lookup finds nothing, and `triage` reports
`verified=false` — the full suite runs again on the push. This is not the guard breaking; it
is the guard correctly declining to trust a proof that has aged out.

**The same happens if `master` moved between the PR's last green run and the merge.** The
tree hash is content-addressed (`git rev-parse HEAD^{tree}`), so it changes if the base branch
changed underneath the PR — even if the PR's own diff did not. The merge commit then has a
tree nobody uploaded an artifact for, the guard misses, and the gates re-run. Same shape as
the expiry case: a hash nobody recorded is indistinguishable from a hash that was never
proven, and the safe answer to "I don't know if this was proven" is to prove it again.

Both directions are the fail-safe one: the worst outcome of either is a full-suite run that
didn't strictly need to happen, never a skipped gate that should have run.

## Forcing a full run deliberately

To make a push re-run the gates instead of trusting a stale or unwanted match, delete the
artifact before merging:

```sh
# find the artifact id for this tree
gh api /repos/kaleem-lms/Kaleem/actions/artifacts \
  --jq '.artifacts[] | select(.name|startswith("verified-tree-")) | "\(.id) \(.name)"'

# delete it
gh api -X DELETE /repos/kaleem-lms/Kaleem/actions/artifacts/<id>
```

This is exactly what the 7-day expiry does on its own, so it is a real exercise of the
artifact-miss path, not a simulation of one — see "What has not run" below.

## `deploy-staging` on a documentation-only push

Skipped entirely. Its own `if:` requires `needs.triage.outputs.code == 'true'`; a
documentation-only push reports `code=false`, so both the seven gates and the deploy skip and
nothing reaches staging. This is correct — there is nothing in a docs-only change for staging
to serve differently — but it means a `docs/**` push produces no deploy log to check if you
go looking for one.

## `triage` is a single point of failure for everything downstream

All seven gates and the deploy read `needs.triage.outputs.*`. If `triage` itself goes red —
most likely from a transient `gh api` hiccup in the `guard` step — every gate's `if:`
evaluates against an unset output and every one of them skips, and `deploy-staging`'s
`!contains(needs.*.result, 'failure')` clause catches `triage`'s own failure and blocks the
deploy too. The run ends up red with nothing having shipped. This is the safe direction: nothing
merges or deploys on the strength of a `triage` that never actually classified the change.

**The fix is to re-run the whole workflow run, not just the `triage` job.** Re-running only
`triage` in isolation can leave the downstream jobs' cached `if:` evaluations stale in the
GitHub Actions UI; re-running the full run is the same one extra minute either way and avoids
that ambiguity.

## Verifying the guard is still honest

The guard is only useful if it can both hit and miss correctly. Check both directions:

1. **The miss direction.** Delete a PR's `verified-tree-<hash>` artifact (see above) before
   merging, or wait 7 days, and confirm the merge's push run reports `verified=false` in
   `triage`'s log and the seven gates actually run.
2. **The hit direction.** Merge a PR promptly after it goes green and confirm the push run's
   `triage` step logs `verified=true` for the merge commit's tree, that all seven gates show
   `SKIPPED`, and that `deploy-staging` still runs and succeeds.

Do not trust one direction alone: a guard hard-wired to always report `true` would look
identical to a working one if you only ever check the hit case.

## Reading the security scans (ADR-0030, amended by ADR-0047)

Two jobs scan: `security` (secrets in every repository's history and in the checked-out tree,
`pip-audit`, `pnpm audit --prod`) and `image-scan` (`trivy` over the three production images,
built the way `deploy-staging` builds them and not pushed). The `security` job begins with a
self-test of its own wrappers; if that step is red, the scanners are broken, not the code.

**Report-only, then blocking.** `SCA_BLOCKING_FROM` at the top of `ci.yml` is one date. The two
dependency scans (`pnpm audit`, `trivy`) only warn before it and fail from it. A warning is
not noise: the findings are in the job's **step summary** (`pnpm audit`: severity, package,
advisory, patched range; `trivy`: its detailed table). A scanner *error* (registry or database
down, an unreadable report) fails the step on any day, because an error is not a clean result.
The two secret scans have no such window: a finding blocks at once.

**Never move the date later without an ADR.** It is a ratchet in the ADR-0026 sense. If the
date is near and the fixes are not in, the options are to land the dependency bumps or to
write the ADR; deleting the guard is not one.

**A secret scan that says `INCOMPLETE SCAN` (exit 4)** did not look at everything, so it did
not pass. The usual causes are a shallow checkout (the job must use `fetch-depth: 0`) and git
failing inside the container. Do not rerun until green; find out which. A real finding exits
1; report it privately, never in `ISSUES.md`, and rotate first.

**Allowlisting a finding** is for one case only: the finding is not reachable in what ships.
Fix everything reachable.

- `pnpm audit`: add `<GHSA-id> <review-by YYYY-MM-DD> <reason>` to
  `.github/security/pnpm-audit-allowlist.txt`. The review-by date may not be later than
  `SCA_BLOCKING_FROM`. An entry past its date fails the job even if the advisory is gone, so
  delete a line when its package is fixed.
- `trivy`: add `<id> exp:<YYYY-MM-DD>` to `.trivyignore`, with a comment above it.
- State the reason in the file; keep the detailed reasoning in the private record.

**Running them locally.** `bash .github/scripts/test-security-scripts.sh` needs only docker and
git. A history scan of one repository: `.github/scripts/gitleaks-history.sh <dir>`. An audit of
one lockfile: `.github/scripts/pnpm-audit.sh dashboard` (needs `pnpm` 10 and network).

**Known behaviours that look like bugs.**

- The history scans use `--all`, so a finding on any open branch that the checkout fetched
  can fail a PR that did not cause it.
- `image-scan` rebuilds the three images (a few minutes). That is deliberate: it scans what
  would be deployed.
- Third-party runtime images (traefik, postgres, redis, coturn) are not scanned.

## Related

- ADR-0038 — CI runs only what the change can break (the decision this runbook operates)
- `docs/superpowers/specs/2026-09-08-ci-cost-optimization-design.md` — the design, cost model,
  and what shipped verified versus what did not
- `.github/scripts/classify-changes.sh` / `test-classify-changes.sh` — the classifier and its
  self-test, which runs as a `triage` step on every run
- `.github/scripts/{gitleaks-history,pnpm-audit,sca-gate}.sh` and `test-security-scripts.sh` — the
  security wrappers and their self-test (ADR-0047)
