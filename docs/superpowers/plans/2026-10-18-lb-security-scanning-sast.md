---
spec: docs/superpowers/specs/2026-10-18-lb-security-scanning-sast-design.md
status: draft
---

## Where the work happens

| Repo | Worktree | What changes |
| --- | --- | --- |
| meta | `/home/abdulkhalek/Projects/kaleem-worktrees/meta-lb-security-scanning-sast` | wrapper, fixtures, self-test cases, `ci.yml`, ADR-0047 addendum, runbook |
| backend | `.../kaleem-worktrees/backend-lb-security-scanning-sast` | comment-only `nosemgrep` annotations |
| dashboard | `.../kaleem-worktrees/dashboard-lb-security-scanning-sast` | one comment-only `nosemgrep` annotation |

Create the submodule worktrees with runbook section 1. The Bash tool is zsh, so brace
every variable a colon follows. The exact findings to annotate, and the ones that must
**not** be annotated, are listed in the private record
`/home/abdulkhalek/Projects/kaleem-worktrees/_ops/private/lb-security-scanning-sast.md`.
Re-measure them at build time.

**Precondition.** `lb-security-scanning-sca` has merged to master, and the meta branch
has merged `origin/master` (a merge, never a rebase). If it has not merged, stop and
report. Do not copy its scripts.

## Files

| File | Change |
| --- | --- |
| `.github/scripts/semgrep-scan.sh` | new: scan, completeness guard, suppression check, counts-only output, `--from-json` and `--expected` for tests |
| `.github/scripts/fixtures/semgrep-*.json` | new: clean, two-findings, errors, missing-file and malformed reports (fake paths) |
| `.github/scripts/fixtures/semgrep-canary/canary.py`, `canary.ts` | new: one known-bad line each (`subprocess.call(cmd, shell=True)`, `el.innerHTML = html`), verified to trip 2 rules each offline |
| `.github/scripts/test-security-scripts.sh` | add the `semgrep-scan.sh` cases |
| `.github/workflows/ci.yml` | `SEMGREP_RULES_SHA` env, new `sast` job, `sast` added to two `needs:` lists |
| `docs/adr/0047-…md` | addendum section; remove semgrep from "Not covered" |
| `docs/runbook/ci.md` | short section: reading the scan, adding a suppression, bumping a pin |
| backend `signaling/app.py`, `kaleem/templates/account/email/email_confirmation_message.txt` | annotations (private record #7, #8) |
| dashboard `src/features/billing/queries.ts` | annotation (private record #9) |

The conductor owns `CLAUDE.md`'s D3 scanner table, `ISSUES.md`, `STATE.md` and the
journal. Their replacement text goes in the hand-back.

## Steps

1. [ ] **Self-test cases first (red).** Add the spec's eight `semgrep-scan.sh` cases to
   `test-security-scripts.sh`, plus the JSON fixtures. Run
   `bash .github/scripts/test-security-scripts.sh`: the new cases fail, because the
   wrapper does not exist yet. The existing SCA cases stay green.

2. [ ] **`semgrep-scan.sh` (green).**
   - Usage: `semgrep-scan.sh --rules <dir> <root>` scans; `--from-json <f> --expected <list>`
     classifies only.
   - The constants are the target list, the rule directories and the exclusions, each
     exclusion with a one-line reason.
   - Scan: `docker run --rm --network none` with
     `semgrep/semgrep:1.180.0@sha256:529ee8a277ec8adc5b534d7c74eea0a47e9de21d62852b6ba7ac6ba9566845c3`, `-w` set to the
     checkout, `--json --output`, one `--config` per rule directory and one `--exclude`
     per exclusion. Do **not** pass `--error`.
   - Expected set: `git -C <submodule> ls-files` for the targets, with the five
     extensions, minus the same exclusions. A path missing from `paths.scanned` gives
     exit 4; a non-empty `errors` gives exit 4; invalid JSON or missing keys give exit 3.
   - Suppressions: `grep -rn nosemgrep` over the targets. A match without
     `nosemgrep: <id>` gives exit 3. Count the named ones.
   - Output: counts per severity, the suppression count and the per-target scanned
     counts, to stdout and `$GITHUB_STEP_SUMMARY`. With `SEMGREP_DETAILS=1`, also print
     `rule path:line`. Exit 5 if any result remains.
   - Run the self-test until it is fully green.

3. [ ] **Wire `ci.yml`.**
   - `env: SEMGREP_RULES_SHA: 17e31e11ebac99fb7dfe1cd288f7a32151b6f3f9`, next to
     `SCA_BLOCKING_FROM`. Re-check that this is still the intended commit at build time.
   - Job `sast`:
     - `timeout-minutes: 10`, `needs: triage`, the three-clause guard;
     - checkout with `submodules: recursive` and `SUBMODULE_TOKEN`;
     - fetch the rules by SHA into `$RUNNER_TEMP`, and assert that
       `git rev-parse HEAD` equals the SHA;
     - **canary step**: run the wrapper on the fixtures and require exit 5, else fail;
     - scan step:
       `rc=0; semgrep-scan.sh … || rc=$?; .github/scripts/sca-gate.sh semgrep "$rc" 5`.
   - Add `sast` to `needs:` of `record-verified-tree` and `deploy-staging`. Check that
     `deploy-staging`'s failure and cancelled clauses read `needs.*`, so no other edit is
     needed.
   - Run `actionlint` if it is available; otherwise rely on the first CI run.

4. [ ] **Baseline annotations, tests first.**
   - **Template, backend.** First write a test in `kaleem/identity/tests/` that renders
     `account/email/email_confirmation_message.txt` with a fixed context and asserts the
     exact body. Check first whether `test_email_branding.py` already does; extend it if
     so. Run it green on the unchanged template. Then add `{# nosemgrep: <id> #}`
     **before** `{% autoescape off %}` on that line, never inside `{% blocktranslate %}`,
     and re-run: it must still be green and byte-identical. Run it through
     `backend-gate.sh <wt> kaleem/identity/tests/<file>`.
   - **signaling and dashboard.** Add the preceding-line `nosemgrep: <id>` with its
     reason comment. No test is possible for a comment: the proof is the scan in step 5.
   - Use the **last segment** of the rule id. The full id carries a path prefix when rules
     load from a directory, and the short form is verified to work.
   - Do not annotate any finding the private record marks as real.
   - Then run the full gates: `backend-gate.sh <wt>` and `dashboard-gate.sh <wt>` (heavy
     slot). Floors are untouched.

5. [ ] **Local proof against the worktrees.** Use a scratch copy of the meta tree with
   the two submodule worktrees in place, or point the wrapper's `<root>` at a directory
   that holds `backend/` and `dashboard/`. Run `semgrep-scan.sh` and confirm:
   - the result count equals the private record's real-finding count, and nothing else
     remains;
   - errors = 0;
   - the scanned counts match the expected set.

   Record the numbers in the private record, not in a commit.

6. [ ] **Mutation checks** (hand-back evidence). Each must fail as stated:
   - a planted `subprocess.call(x, shell=True)` in a backend worktree gives exit 5;
   - `SCA_BLOCKING_FROM=2026-01-01` gives a red gate;
   - deleting the `errors` check, the missing-file check, or the bare-`nosemgrep` check
     in turn turns the self-test red;
   - an empty rules directory makes the canary red;
   - removing each annotation brings its finding back.

7. [ ] **Docs.**
   - ADR-0047 addendum. Describe the controls only, never a finding.
   - Runbook section.

   Then commit per repo with explicit paths and `PIP_CONFIG_FILE=/dev/null`.
   Conventional Commits: `feat(ci): …` (meta), `chore(security): annotate semgrep false
   positives` (backend, dashboard).

8. [ ] **Hand-back** (runbook section 3): the five readiness checks per repo, gitleaks
   range CLEAN, the mutation results, and the conductor-file texts:
   - the D3 scanner row: `semgrep` | backend `kaleem`/`signaling`/`config` +
     `dashboard/src`, pinned rules | `ci.yml` `sast` | from `SCA_BLOCKING_FROM`;
   - the `ISSUES.md` line edit;
   - the out-of-scope `ISSUES.md` line.

   The first CI run is read in full: the canary at 5, every per-target scanned count,
   and the finding counts as expected.

## Gates

- meta: `test-security-scripts.sh` green; the first CI run all green (the `sast` step
  stays report-only until the date).
- backend: full `backend-gate.sh`.
- dashboard: full `dashboard-gate.sh`.
- every repo: `gitleaks-range.sh`.

There are no migrations and no e2e (D3: no user-facing behaviour). Coverage floors are
not touched.

## Risks

- **The date arrives before the real findings are fixed.** Every PR goes red on
  2026-11-30 (ADR-0047's intended pressure). Mitigation: the hand-back asks the conductor
  to queue the fix unit now. Its spec is likely owner-approved (dec-spec-approval).
- **A future TypeScript syntax that semgrep cannot parse** fails the guard on every day
  and blocks merges. That is intended (unscanned is not clean). The fix is bumping the
  image pin, never a looser guard.
- **The 1.1 GB image pull** adds about 30-60 s per code PR. That is acceptable on a free
  public runner.
- **`ci.yml` conflicts** with other units that edit `needs:` lists. The conductor
  resolves them at freshness.
- **The rule licence.** The rules are fetched at run time and never committed. If that
  reading of the licence is wrong, the fallback is the registry ruleset, which needs an
  ADR addendum, since it gives up pinning.
- **semgrep's `nosemgrep` parsing changes** in a later image. The self-test and the
  annotation mutation check catch that on the bump PR.

## Verification

Steps 1 and 2 are proved by the self-test, step 3 by the first CI run with the canary at
5, step 4 by the gates and the golden render test, and steps 5 and 6 by recorded local
runs. The whole is proved by one green CI run on the meta PR with all three pins, in which
the `sast` step reports exactly the real-finding count and nothing else.
