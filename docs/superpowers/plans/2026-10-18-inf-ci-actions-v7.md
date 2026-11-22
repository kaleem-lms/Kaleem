---
spec: docs/superpowers/specs/2026-10-18-inf-ci-actions-v7-design.md
status: draft
---

Meta-only, size S. All work happens in `/home/abdulkhalek/Projects/kaleem-worktrees/meta-inf-ci-actions-v7`
on `feat/inf-ci-actions-v7`. There are no submodule worktrees, no migrations, no floors and no
dependency changes. The agent's steps are 1-3; steps 4-7 need GitHub writes, so the conductor
runs them.

## Files

| File | Lines (at `789400c`) | Change |
| --- | --- | --- |
| `.github/workflows/ci.yml` | 128, 189, 408, 573 | `setup-python@v5` → `@v7` |
| | 233, 296, 414, 660 | `setup-node@v6` → `@v7` |
| | 504, 629 | `upload-artifact@v4` → `@v7` |
| `.github/workflows/lighthouse.yml` | 37 / 49 | `setup-node@v6` / `upload-artifact@v4` → `@v7` |
| `.github/workflows/stripe-clock.yml` | 75 | `setup-python@v5` → `@v7` |

Only the `uses:` line changes. Every `with:` input and `if:` stays byte-identical, and no
`archive:` input is added.

## Steps

1. [ ] **Red.** In the worktree:
   - `grep -nE 'actions/(setup-python@v5|setup-node@v6|upload-artifact@v4)' .github/workflows/*.yml | wc -l`
     must print `13`.
   - `actionlint .github/workflows/*.yml > <scratchpad>/actionlint-before.txt`. Expect rc 1
     with exactly 5 shellcheck findings (`ci.yml:97` ×2, `:623` ×2, `:737` ×1).
2. [ ] **Edit** the 13 lines with Edit (no sed sweep), one action at a time.
3. [ ] **Green**, then commit:
   - The step-1 grep prints `0`.
   - `grep -oE 'actions/(setup-python|setup-node|upload-artifact)@v7' .github/workflows/*.yml | sort | uniq -c`
     shows 5 / 5 / 3.
   - `actionlint … > after.txt; diff before.txt after.txt` prints nothing.
   - `.github/scripts/test-classify-changes.sh` passes.
   - `git diff --stat origin/master` shows 3 files, 13 insertions and 13 deletions.
   - `gitleaks-range.sh` is for submodules. For meta, the conductor's PR run `security` job
     is the scan.
   - Commit `ci: take setup-python, setup-node and upload-artifact v7 by hand`, with
     explicit paths and `PIP_CONFIG_FILE=/dev/null`. Then hand back.
4. [ ] **Conductor: PR run** (runbook §4). Push, open the PR, and run
   `gh run watch --exit-status`. The jobs query must print `0` non-success jobs (excluding
   deploy-staging), and `record-verified-tree` must be `success`. A first-attempt pass is
   required; a rerun pass is a finding.
5. [ ] **Conductor: verified-tree proof.**
   - Compute `T=$(git merge-tree --write-tree origin/master origin/feat/inf-ci-actions-v7)`.
   - The artifacts query for `verified-tree-${T}` must return ≥ 1.
   - `gh run download <id> -n "verified-tree-${T}"`, then `cat verified-tree.txt` must
     equal `${T}`.
   - Negative control: the query for `verified-tree-0000000000000000000000000000000000000000`
     must return `0`.
6. [ ] **Conductor: Lighthouse dispatch.** Run
   `gh workflow run lighthouse.yml --ref feat/inf-ci-actions-v7` and watch it. The steps
   `Run actions/setup-node@v7` and `Upload the Lighthouse report` must succeed, and so must
   the run.
7. [ ] **Conductor: merge and watch** (runbook §5 b-e). The push run must log
   `tree=${T} verified=true` and deploy-staging must succeed; read `Disk now:`. Within a
   week, check the next stripe-clock run's `Run actions/setup-python@v7` and
   `Install dependencies` steps for success. The harness step's result is out of scope.
8. [ ] **Close-out text for the conductor:**
   - `ISSUES.md`, in the ADR-0038 Dependabot entry: replace "Three real Dependabot PRs are
     open: #182 … review it deliberately rather than merging on a green tick that verified
     nothing." with "#182-#184 were closed on 2026-10-18 and taken by hand in
     `inf-ci-actions-v7`, with every job run." The rest of the entry (skipped required
     checks once master is protected) stays.
   - D3 table: no row change.
   - Journal line.
   - Spec `shipped`, and this plan `done`.

## Tests written first

The red/green static check in steps 1 and 3 is the test, together with the actionlint
baseline diff. The behavioural proof can only come from GitHub's runners (steps 4-7).

There is no regression test to mutation-check. The negative control in step 5 is what shows
the lookup can return 0, so a hit really means something.

## e2e

No new flows; the change has no user-facing behaviour. D3's requirement is that the full
existing Playwright suite runs and passes in step 4's e2e job. The `failure()`-only Playwright
report upload is not exercised by a green run (see the risks).

## Risks

- **`setup-node@v7` changes `cache: pnpm` handling.** It would show as red dashboard,
  marketing or e2e setup in step 4. Fallback: keep `setup-node@v6` and land the other two
  bumps. Changing the unit's scope like that needs the conductor's agreement.
- **The v7 artifact is not found by name** (step 5 miss, or step 7 `verified=false`). The
  gates re-run, so nothing ungated deploys. Hold `ci-parallel-guards` and every other
  CI-changing merge until the cause is known; a fix that cannot be made within the unit is
  escalated.
- **The e2e failure-path upload is unexercised.** It uses the same v7 action with a multi-path
  list, which `archive: true` (the default) still supports. The first red e2e run shows it,
  and the stakes are diagnostics only.
- **Master moves before the merge.** The PR's tree changes, so `T` no longer matches. Run
  `gh pr update-branch` and wait for a fresh green run (runbook §5a).
- **Conflict with `ci-parallel-guards`** (also `ci.yml`). It merges after this unit and takes
  master's version of the `uses:` lines at its freshness step.

## Verification

The unit is done when all of these hold:

- Steps 1 and 3 are red then green.
- The PR run is all green on its first attempt.
- The verified-tree artifact is found, its content matches, and the negative control
  returns 0.
- The Lighthouse dispatch is green.
- The push run logs `verified=true` and deploy-staging succeeds.
- stripe-clock's setup steps are green on its next weekly run.
