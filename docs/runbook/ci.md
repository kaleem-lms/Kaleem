# CI Runbook

## What it is

`ci.yml` (meta repo) runs the eleven-job suite — `backend-lint`, `backend-test`,
`dashboard-lint`, `dashboard-build`, `marketing-build`, `e2e`, `security`, `image-scan`,
`sast`, `deploy-staging`, `deploy-outcome` —
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

## `deploy-outcome`: a skipped deploy is no longer silent

`deploy-outcome` runs after `deploy-staging` on every master push (`always()`), so a red gate no
longer leaves a grey, skipped deploy among green jobs. It passes when staging has the commit, or
when `triage` says the push was documentation-only (with a notice), and fails otherwise with
"master is not on staging", naming each gate that did not pass. Dependabot pushes are red by
design: their gates skip, and staging lagging master is what should be seen. The decision is
`.github/scripts/deploy-outcome.sh`, tested by `test-deploy-outcome.sh` in the `security` job. See
`docs/runbook/deploy.md`.

## What the `security` job checks about the deploy pipeline itself

Beside the scanners, it runs `infra/scripts/test-deploy-lib.sh` (image retention, deploy history,
the service-list comparison, `ship.sh --list-services`; infra has no CI of its own),
`check-shipsh-services.sh` on the real compose file and `ship.sh` (every non-profile compose
service is in `ship.sh`'s start lists), the tests for `deploy-outcome.sh`, and
`check-staging-host-key.sh` (the pinned host-key file is one well-formed ed25519 entry under the
alias). None of these needs Docker running, and none needs a secret.

What no PR run can prove, because `deploy-staging` runs only on a master push: the OpenSSH
transport and the host-key pin, the buildx cache (the second deploy's log shows `CACHED` layers),
and the retention step's real removals. They are verified on the first master runs after a change.

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

Three jobs scan: `security` (secrets in every repository's history and in the checked-out tree,
`pip-audit`, `pnpm audit --prod`) and `image-scan` (`trivy` over the three production images,
built the way `deploy-staging` builds them and not pushed), and `sast` (`semgrep`, below). The `security` job begins with a
self-test of its own wrappers; if that step is red, the scanners are broken, not the code.

**Report-only, then blocking.** `SCA_BLOCKING_FROM` at the top of `ci.yml` is one date. The
three scans that have findings to triage (`pnpm audit`, `trivy`, `semgrep`) only warn before it and fail from it. A warning is
not noise: the job's log and **step summary** give the count per severity. They give counts
only, because the audited repositories are private and this page is public. To see the
itemised list, run `PNPM_AUDIT_DETAILS=1 .github/scripts/pnpm-audit.sh dashboard` or scan a
local build with trivy (`--format table`), and keep triage notes in the private record. A scanner *error* (registry or database
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
  `.github/security/pnpm-audit-allowlist.txt`. The review-by date may be at most 90
  days ahead of the day the job runs (checked by `pnpm-audit.sh`; the rule does not depend on
  `SCA_BLOCKING_FROM`, so it keeps working after that date). An entry past its date fails the
  job even if the advisory is gone, so delete a line when its package is fixed.
- `trivy`: add `<id> exp:<YYYY-MM-DD>` to `.trivyignore`, with a comment above it. Trivy
  enforces the expiry; keep `exp:` within 90 days by review (no code checks the horizon).
- State the reason in the file; keep the detailed reasoning in the private record.

**Running them locally.** `bash .github/scripts/test-security-scripts.sh` needs only docker and
git. A history scan of one repository: `.github/scripts/gitleaks-history.sh <dir>`. An audit of
one lockfile: `.github/scripts/pnpm-audit.sh dashboard` (needs `pnpm` 10 and network).

**Reading the semgrep scan (the `sast` job).** It scans `backend/{kaleem,signaling,config}`
and `dashboard/src` with the `security` rules of `semgrep/semgrep-rules`, fetched at the
commit in `SEMGREP_RULES_SHA`. Three steps, in order:

1. *Fetch the pinned rules* fails if the commit cannot be fetched or does not match.
2. *Canary* scans two fixture files that each hold a known-bad line and must exit 5 with
   both flagged. If this step is red, the rules are not loading, and the real scan below it
   would have read "clean" for the wrong reason: fix the pin or the path, do not touch the
   scan.
3. *semgrep — shipped code* prints counts and exits through `sca-gate.sh`. Its exit codes:
   `0` clean, `5` findings (a warning before `SCA_BLOCKING_FROM`, a failure from it), `4`
   **incomplete** (a parse error, or a tracked source file semgrep did not read; it did not
   pass, find out why), `3` a bad report or a suppression that names no rule, `6` semgrep or
   docker itself failed.

The log and step summary give counts only (findings per severity, named suppressions, files
scanned per target). To see which rule fired where, run it locally:

```sh
git fetch --depth 1 https://github.com/semgrep/semgrep-rules.git <SEMGREP_RULES_SHA>   # in a scratch clone
SEMGREP_DETAILS=1 .github/scripts/semgrep-scan.sh --rules <rules-clone> .             # needs docker; submodules checked out
```

**Suppressing a semgrep false positive.** Only when you have read the code and it is not
exploitable. Put the reason in a comment, and name the rule on the line the finding starts
on or the line before it, using the last segment of the rule id (the part after the final
dot):

```python
# The values logged are two ids; the token is never logged.
# nosemgrep: python-logger-credential-disclosure
logger.warning(...)
```

A bare `nosemgrep` (or `nosem`) is refused by the wrapper, because it silences every rule on
the line. In a Django template use a `{# nosemgrep: <rule-id> #}` comment tag **outside** any
`{% blocktranslate %}`, and check the rendered output is unchanged. A real finding is fixed,
not suppressed.

**Bumping the semgrep pins.** The image (digest in `semgrep-scan.sh`) and the rules commit
(`SEMGREP_RULES_SHA` in `ci.yml`) change only by a commit. Run the scan locally with the new
pin first; whatever it newly reports follows the date guard like any other finding.

**Known behaviours that look like bugs.**

- The history scans use `--all`, so a finding on any open branch that the checkout fetched
  can fail a PR that did not cause it.
- `image-scan` rebuilds the three images (a few minutes). That is deliberate: it scans what
  would be deployed.
- Third-party runtime images (traefik, postgres, redis, coturn) are not scanned.
- `sast` pulls a ~1.1 GB image each run (about a minute).

## Related

- ADR-0038 — CI runs only what the change can break (the decision this runbook operates)
- `docs/superpowers/specs/2026-09-08-ci-cost-optimization-design.md` — the design, cost model,
  and what shipped verified versus what did not
- `.github/scripts/classify-changes.sh` / `test-classify-changes.sh` — the classifier and its
  self-test, which runs as a `triage` step on every run
- `.github/scripts/{gitleaks-history,pnpm-audit,sca-gate,semgrep-scan}.sh` and `test-security-scripts.sh` — the
  security wrappers and their self-test (ADR-0047)
- `.github/scripts/{check-shipsh-services,deploy-outcome,check-staging-host-key}.sh` and their
  `test-*.sh` — the deploy-pipeline checks above
