---
name: inf-ci-actions-v7
phase: v1
modules: [ci]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Take the three GitHub Actions bumps Dependabot proposed in #182 (`actions/setup-python` 5→7),
#183 (`actions/upload-artifact` 4→7) and #184 (`actions/setup-node` 6→7) in one PR written by
hand, so that every CI job runs against them. The Dependabot PRs tested nothing: every gate
skips for `github.actor == 'dependabot[bot]'` (ADR-0038, `ISSUES.md`). They were closed on
2026-10-18 with a pointer to this unit.

`upload-artifact` is the one that matters. `record-verified-tree` uploads
`verified-tree-<tree>`, and on a push `triage` looks that name up through
`GET /actions/artifacts?name=...` to decide whether the gates can be skipped. The conductor's
merge rule depends on the same lookup (serialization point "meta master merges"). This unit
must show that an artifact uploaded by v7 is still found by that query.

This is the first CI-changing merge of the programme. `ci-parallel-guards` merges after it.

State at meta `789400c`:

| Action | Uses | Files |
| --- | --- | --- |
| `actions/setup-python@v5` | 5 | `ci.yml` ×4 (backend-lint, backend-test, e2e, security), `stripe-clock.yml` ×1 |
| `actions/setup-node@v6` | 5 | `ci.yml` ×4 (dashboard-lint, dashboard-build, e2e, marketing-build), `lighthouse.yml` ×1 |
| `actions/upload-artifact@v4` | 3 | `ci.yml` ×2 (e2e report on `failure()`, record-verified-tree), `lighthouse.yml` ×1 (`always()`) |

`actions/checkout` is already on v7, and `pnpm/action-setup` and the two appleboy actions are
not part of this unit.

**Each v7 change, checked against the inputs these workflows pass** (from the release notes
in #182-#184):

- `setup-python` v7 moves to ESM and removes the `pip-install` input. We pass only
  `python-version: "3.13"` and install with our own `pip install` step.
- `setup-node` v7 moves to ESM, adds cache-key outputs and drops a dummy `NODE_AUTH_TOKEN`
  export. We pass `node-version`, `cache: "pnpm"` and `cache-dependency-path`. The private
  `@kaleem/tokens` install authenticates through our own `git config insteadOf`, not npm
  auth, so it does not read `NODE_AUTH_TOKEN`.
- `upload-artifact` v5/v6 move to node24 (runner ≥ 2.327.1, which hosted runners meet). v7
  adds `archive: false`. With that flag set, v7 ignores `name` and names the artifact after
  the file, which would break the `verified-tree-<tree>` lookup. We do not set it, and the
  default `archive: true` keeps `name`.

## User flow

There is no end-user flow. What contributors see:

1. The PR run executes every job: triage, backend-lint, backend-test, dashboard-lint,
   dashboard-build, e2e, security, marketing-build and record-verified-tree all succeed.
   deploy-staging is skipped, as it is on every PR.
2. `record-verified-tree` uploads `verified-tree-<T>` with v7. The artifacts API returns it
   by name, and its content is `<T>`.
3. After the merge, the push run's `triage` logs `tree=<T> verified=true`, the gates skip,
   and deploy-staging succeeds.
4. The weekly Lighthouse and stripe-clock runs use v7. Lighthouse is dispatched on the
   branch before the merge (see the test plan).

Error case: if the push run logs `verified=false`, the gates run again. That is the safe
direction, so nothing ungated deploys. It still fails this unit's acceptance, and the
conductor investigates before the next CI-changing merge.

## Data model delta

None. No migrations.

## API delta

None.

## Frontend

None. The change is CI only and has no dashboard slice.

## Module boundaries

The change is meta-only: three files under `.github/workflows/`, edited in place. No
submodule changes, no import-linter contracts, no new dependency.

- **Personal data (ADR-0023):** none.
- **Expand/contract:** not applicable. Workflow files take effect atomically with the merge,
  and the blue-green deploy steps are unchanged.
- **e2e time budget:** no time added. The existing suite has to run, and the change adds no
  flows.
- **Decisions:**
  - dec-spec-approval: the conductor approves this spec.
  - dec-push-rights: only the conductor pushes, dispatches and merges.
  - dec-floor-ownership: no floor changes.
  - The CI-changing serialization rule: this unit merges first, and only when no meta run is
    in progress.

## Out of scope

- Pinning actions to commit SHAs, and bumping `pnpm/action-setup` or the appleboy actions.
- Using `archive: false` or any other new v7 input.
- The underlying ADR-0038 problem: a Dependabot PR shows green while testing nothing, and
  that matters once meta master has required checks (base-10). The `ISSUES.md` entry stays
  open; only its "three PRs are open" sentence becomes stale.
- The red stripe-clock harness. It fails at "Run the dunning harness", after setup has
  succeeded, and belongs to `inf-stripe-clock-harness-red`.
- The five actionlint/shellcheck findings that already exist in `ci.yml` (D10).

## Test plan

1. **Static check (red, then green).** Before the edit,
   `grep -nE 'actions/(setup-python@v5|setup-node@v6|upload-artifact@v4)' .github/workflows/*.yml`
   prints 13 lines. After it, the grep prints nothing.
2. **actionlint 1.7.12.** Its output after the change is identical to the baseline (the 5
   existing shellcheck findings at `ci.yml:97`, `:623` and `:737`). The edits are in place,
   so line numbers do not move.
3. **PR run.** All nine non-deploy jobs succeed on the first attempt. A pass that needs a
   rerun is a finding.
4. **Verified-tree.**
   - The lookup `GET /repos/kaleem-lms/Kaleem/actions/artifacts?name=verified-tree-<T>`
     returns at least 1 non-expired artifact, for `<T>` equal to
     `git merge-tree --write-tree origin/master <head>`.
   - `gh run download -n verified-tree-<T>` yields a file containing `<T>`.
   - Negative control: the same query for a tree that does not exist returns 0.
5. **Lighthouse on the branch.** A `workflow_dispatch` of `lighthouse.yml` on
   `feat/inf-ci-actions-v7` succeeds, with `setup-node@v7` and `upload-artifact@v7` both
   green. It is the only pre-merge use of the `always()` upload and of a directory path.
6. **Push run after the merge.** `triage` logs `tree=<T> verified=true` and deploy-staging
   succeeds. This is the first `verified=true` observed under the programme's merge rule.
7. **stripe-clock, after the merge.** The next weekly run shows `Run actions/setup-python@v7`
   and `Install dependencies` green. It is not dispatched before the merge: its inputs are
   identical to the four `ci.yml` setup-python steps that test 3 proves, and its harness step
   is already red for an unrelated reason.

No Playwright flow is added. Under D3 this is not a user-facing area. The existing suite
running in step 3 is the e2e requirement.

## Open questions

None. needs_adr is none, there are no human gates, and every decision this unit uses is
answered.
