---
spec: docs/superpowers/specs/2026-10-18-lb-security-scanning-sca-design.md
status: draft
---

Everything is done in the meta worktree
`/home/abdulkhalek/Projects/kaleem-worktrees/meta-lb-security-scanning-sca` on
`feat/lb-security-scanning-sca`. No submodule worktree is needed. The Bash tool is zsh,
so brace every variable a colon follows. Scripts are bash with `set -euo pipefail`, in
the style of `.github/scripts/classify-changes.sh`.

## Files

| File | Change |
| --- | --- |
| `.github/scripts/test-security-scripts.sh` | new: table-driven self-test, written first |
| `.github/scripts/sca-gate.sh` | new: date guard (`<scanner> <rc> <finding-rc>`) |
| `.github/scripts/gitleaks-history.sh` | new: gitleaks git mode plus completeness guard |
| `.github/scripts/pnpm-audit.sh` | new: `pnpm audit --prod --json`, allowlist filter, step-summary table, `--from-json` for tests |
| `.github/scripts/fixtures/pnpm-audit-*.json` | new: synthetic advisories (fake GHSA ids) |
| `.github/security/pnpm-audit-allowlist.txt` | new: `<GHSA> <review-by> <reason>` |
| `.trivyignore` | new: header comment only, plus any triaged `exp:` entries |
| `.github/workflows/ci.yml` | `SCA_BLOCKING_FROM`; `security` steps; new `image-scan` job; both `needs:` lists |
| `docs/adr/00NN-*.md` | new ADR amending ADR-0030; the conductor allocates the number |
| `docs/adr/0030-security-and-performance-scanning-gates.md` | inline "AMENDED BY ADR-00NN" note, as ADR-0032 did |
| `docs/runbook/ci.md` | short section: reading a scan, and how and when to allowlist |

Conductor-only files are not edited: `CLAUDE.md`'s D3 scanner table, `ISSUES.md`,
`STATE.md` and the journal. Their replacement text goes in the hand-back (step 8).

## Steps

1. [ ] **Self-test first (red).** Write `test-security-scripts.sh` with every case in
   the spec's test plan, calling the three wrappers, which do not exist yet. Run it with
   `bash .github/scripts/test-security-scripts.sh` and see it fail.
   - The fake key is assembled from fragments at runtime, so neither the test file nor
     the fixtures can trip the `dir` scan. Prove this with
     `docker run --rm -v "${PWD}:/repo:ro" zricethezav/gitleaks:v8.30.1 dir /repo/.github --redact --no-banner --exit-code 1`,
     which must exit 0.
   - The test repos and the shallow clone are built under `mktemp -d`.

2. [ ] **`sca-gate.sh` (green).** The scanner exits with a dedicated finding code:
   - `pnpm-audit.sh` exits 5;
   - trivy is run with `--exit-code 5`, because its fatal errors also exit 1;
   - gitleaks keeps 1, but its wrapper does not route through the date guard.

   Compare today's date (`date -u +%F`) with `SCA_BLOCKING_FROM` as an ISO string. A
   finding before the date prints `::warning::` and exits 0; on or after the date it
   exits 1. Any other non-zero code is an error and passes straight through. An unset or
   malformed `SCA_BLOCKING_FROM` is an error.

3. [ ] **`gitleaks-history.sh` (green).**
   - Refuse a shallow repo: `git rev-parse --is-shallow-repository` must print `false`.
   - Set the lower bound to the non-merge `--all` commits with at least one added text
     line, counted from `git log --all --no-merges --numstat`, where a `-` (binary)
     entry counts as 0.
   - Run `zricethezav/gitleaks:v8.30.1 git <dir> --redact --no-banner --no-color --exit-code 1`.
     Mount the meta checkout so a submodule's `gitdir: ../.git/modules/<s>` resolves.
   - Exit 4 on an `ERR` line or when the scanned count is below the bound. Exit 1 on
     leaks.
   - Print `CLEAN: <scanned> commits (bound <n>) in <dir>`.

4. [ ] **`pnpm-audit.sh` (green).**
   - Run `pnpm audit --prod --json` in the given directory, or read `--from-json`.
   - Do not pass `--ignore-registry-errors`. A missing `metadata` key is an error, exit 3.
   - Drop allowlisted advisories, and exit 3 on an expired entry.
   - Write the remainder to `$GITHUB_STEP_SUMMARY` as a table of severity, package,
     advisory and patched range, then exit 5 if anything remains.
   - Run the self-test until it is fully green.

5. [ ] **Wire `ci.yml`.**
   - Top-level `env: SCA_BLOCKING_FROM: "2026-11-30"`.
   - **`security`**:
     - The self-test runs as the first step after checkout.
     - The meta history step is replaced by `gitleaks-history.sh .`.
     - One new step loops over `backend dashboard marketing infra tokens`.
     - The checkout already uses `submodules: recursive` and `fetch-depth: 0`. Whether
       that yields full submodule clones with all branches is verified on the first CI
       run by the shallow refusal and the printed counts, not assumed.
     - `pnpm/action-setup@v6` (version 10) and `actions/setup-node@v6` (node 22) come
       before `sca-gate.sh pnpm-audit "$(… pnpm-audit.sh dashboard)" 5`, and the same
       for marketing. No `TOKENS_REPO_TOKEN` is needed: audit reads the lockfile and
       never fetches the git dependency (measured locally).
     - Raise `timeout-minutes` only if the first run needs it.
   - **New `image-scan`** job, `timeout-minutes: 25`, with the standard three-clause
     guard:
     - Check out with submodules. Build the three `--target production` images with the
       exact flags `deploy-staging` uses: the dashboard and marketing builds take
       `--secret id=tokens_token` and `VITE_API_URL`, but no push and no GHCR login.
     - Restore the trivy DB cache with `actions/cache`, keyed by date.
     - For each image, run
       `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "${PWD}:/src:ro" -v <cache> aquasec/trivy:0.72.0@sha256:<digest> image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --ignorefile /src/.trivyignore --exit-code 5 <img>`
       through `sca-gate.sh`.
     - Before pinning, confirm the digest with `docker pull aquasec/trivy:0.72.0` and
       `docker inspect`. The tag must resolve to a digest that matches the one the build
       recorded locally (`sha256:cffe3f51…dd6f`). Pin the image, never
       `aquasecurity/trivy-action`.
   - Add `image-scan` to the `needs:` of `record-verified-tree` and `deploy-staging`.
   - Run `actionlint` through Docker (`rhysd/actionlint:1.7.7`) over the workflow, and
     keep it clean.

6. [ ] **Triage the baseline.**
   - Re-run both audits locally. Build and scan the backend production image locally.
     The frontend images need the tokens secret, which agents do not hold, so CI's
     first `image-scan` report is their baseline.
   - Allowlist only findings that are not reachable in what ships (build-time only),
     each with a review-by date no later than 2026-11-30 and a one-line public reason.
   - The full triage, and the list of findings that need a fix, goes to
     `/home/abdulkhalek/Projects/kaleem-worktrees/_ops/private/lb-security-scanning-sca.md`.
     Nothing reachable is described in a public file.

7. [ ] **Docs.**
   - Write the ADR. Context: the gaps ADR-0030 named. Decision: the scopes, the
     completeness guard, the date guard and its ratchet rule, allowlist expiry. Name the
     shared date for semgrep. Alternatives: block immediately, report-only with no
     date, `trivy-action`, scanning the third-party images. Consequences: the date turns
     PRs red on an unchanged tree if the fixes do not land, and that is intended.
   - Add the ADR-0030 inline note.
   - Add the runbook section to `docs/runbook/ci.md`.

8. [ ] **Hand back** with the runbook's section-3 block, plus:
   - the mutation-check lines;
   - the first CI run's counts and summary tables, with sensitive detail sent only to
     the private record;
   - replacement text for the `CLAUDE.md` D3 scanner table rows and for the two
     `ISSUES.md` entries ("semgrep, trivy and pnpm audit still do not run" narrowed to
     semgrep; "Submodule git histories are unscanned" closed);
   - one new `ISSUES.md` line for the third-party images;
   - `needs: dependency units for dashboard and marketing before 2026-11-30`.

## Gates

- `bash .github/scripts/test-security-scripts.sh`: all cases `ok`.
- actionlint over the workflow is clean, and
  `bash .github/scripts/test-classify-changes.sh` still passes.
- `"${R}/_tools/gitleaks-range.sh"` does not apply, because this is a meta worktree.
  Instead, run the pinned image in `git` mode over `origin/master..HEAD`
  (`--log-opts`, braced variables) and in `dir` mode over the worktree. Both must be
  clean.
- No backend or dashboard gate: neither submodule changes. No migrations, and no
  coverage floor is touched.
- e2e: none (D3). No user-facing behaviour changes, and the mutation checks stand in.
  CI's PR run is the authority, and every job must be green except the report-only
  warnings.

## Mutation checks (each red with the guard removed, green restored)

- Delete the ERR/count check in `gitleaks-history.sh`. The self-test's
  "unreachable gitdir" case must go red.
- Make `sca-gate.sh` treat every non-zero code as a finding. The "error after date"
  and "error before date" cases must go red.
- Remove the expiry check in `pnpm-audit.sh`. The "expired entry" case must go red.
- Set `SCA_BLOCKING_FROM` to yesterday on a scratch commit (not pushed by the agent).
  Run the wrappers locally against the real lockfiles: the step must exit 1. Then run
  trivy on `alpine:3.10` through `sca-gate.sh` and see a finding.

## Risks

- **`ci.yml` conflicts.** `inf-ci-actions-v7`, `ci-parallel-guards` and the
  `sast` unit all edit it. Branch from fresh `origin/master`, keep the hunks local to
  `security`, the new job and two `needs:` lists, and leave the merge to the
  conductor.
- **Registry or DB outages turn CI red.** This is intended, since an error must never
  read as clean, and `pip-audit` already behaves this way. The trivy DB is cached.
  `ghcr.io` rate limits are a known trivy failure, and the fallback is
  `--db-repository mirror.gcr.io/aquasec/trivy-db`.
- **`image-scan` builds the images a second time** (a few minutes per PR, at no Actions
  cost on a public repo). A floating base tag could differ between the PR build and the
  deploy build. This is stated in the ADR and accepted.
- **The date passes before the fixes land.** Every PR then goes red. The way out is the
  fix units, or an ADR to move the date. Never delete the guard.
- **Submodule clone shape in CI is unverified.** The shallow refusal and the printed
  counts turn a wrong assumption into a red step instead of a silent pass.
