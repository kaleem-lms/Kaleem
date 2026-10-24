---
spec: docs/superpowers/specs/2026-09-04-stripe-test-clock-harness-design.md (amendment 2026-10-19)
status: draft
---

# inf-stripe-clock-harness-red: implementation plan

**Cause, in one line:** since Stripe CLI v1.51.0, `stripe listen --forward-to` exits at once
unless it is given `--events`, `--all-snapshot` or `--all-thin`. The harness gives none of
them, and it threw the CLI's output away. The evidence is in the spec amendment.

**Repos and branches:** backend `feat/inf-stripe-clock-harness-red` (worktree
`/home/abdulkhalek/Projects/kaleem-worktrees/backend-inf-stripe-clock-harness-red`, runbook
section 1), and meta on the same branch (this worktree). Both sides touch only test code,
CI config and docs. There is no migration, no dependency change, no new route and no floor
edit.

## Files

| Repo | File | Change |
| --- | --- | --- |
| backend | `tests/stripe_clock/cli.py` (new) | `forward_command(api_key, target)`, `redact(text)`, `wait_for_ready(process, timeout_s)` returning ready, or a failure message with the exit code (or "still running") and the last 20 lines, redacted |
| backend | `tests/stripe_clock/conftest.py` | `webhook_secret` uses the three helpers; the `--print-secret` failure message is passed through `redact` |
| backend | `tests/test_stripe_clock_cli.py` (new) | unit tests, in the default run (see step 1 for why they sit outside `tests/stripe_clock/`) |
| meta | `.github/workflows/stripe-clock.yml` | replace the apt install with the pinned, digest-checked tarball; assert the version |
| meta | `docs/runbook/stripe-billing.md` | add `--all-snapshot` to the local `stripe listen` command; a short "Stripe CLI pin" note: version, digest, how to bump |

## Steps (TDD)

1. [ ] **Failing tests first** in `backend/tests/test_stripe_clock_cli.py`. They must not
   sit under `tests/stripe_clock/`: that package's session-scoped autouse
   `stripe_credentials` fixture fails any test there that runs without a Stripe key, and
   the default run deselects `stripe_clock` anyway. No network. Real child processes via
   `sys.executable -c`.
   - `test_forward_command_names_its_events`: the argv has `--forward-to <target>` and
     exactly one of `--events`/`--all-snapshot`/`--all-thin`. The docstring cites the
     v1.51 rule.
   - `test_redact_masks_webhook_secret_and_api_keys`: the fake values are realistic in
     shape and length (`whsec_` + 32 alphanumerics; `sk_test_`/`rk_live_` + 99). **Build
     them at runtime** (`"sk_" + "test_" + "a1" * 50`) so gitleaks does not flag the test
     file. Asserts no fake value survives and the prefixes stay readable.
   - `test_a_cli_that_exits_early_reports_exit_code_and_output`: the child prints the
     CLI's real refusal line plus a fake `whsec_` line, then exits 1. Asserts: not ready;
     the message contains `exit code 1` and the refusal text; the raw secret is absent;
     "within 60s" is absent; the call returns in under 5 s.
   - `test_a_cli_that_prints_ready_is_ready`: the child prints `Ready! … (^C to quit)`
     and sleeps. Asserts ready, then terminates the child by PID in a `finally`.
   - Run with `_tools/backend-gate.sh <wt> tests/test_stripe_clock_cli.py`. Expect red
     with an ImportError.
2. [ ] **Implement `tests/stripe_clock/cli.py`** until step 1 is green. Keep the existing
   blocking `readline()` loop. Bounding it is a separate `ISSUES.md` item (D10). Only
   collect the lines and call `process.poll()` after EOF.
3. [ ] **Wire the conftest** to the helpers. The marker constant and the 60 s timeout stay.
   `ruff check` and `ruff format --check` must stay clean (S603/S607 `noqa` remain where
   argv is built).
4. [ ] **Mutation checks**, each reverted afterwards, each seen red (the failure line goes
   in the hand-back):
   - drop `--all-snapshot` from `forward_command`, so test 1 goes red;
   - make `redact` the identity, so the redact test and the early-exit test go red;
   - restore the old "within 60s" message on EOF, so the early-exit test goes red.
5. [ ] **Full backend gate** `_tools/backend-gate.sh <wt>`: migrate,
   makemigrations --check, pytest with coverage at the unchanged floor, ruff, lint-imports.
   `tests/test_marker_deselection.py` must stay green. Commit
   `fix(billing): forward stripe-clock events explicitly and surface CLI output`.
6. [ ] **Mutant branch for the deliberate red.** In the backend worktree, create the local
   branch `feat/inf-stripe-clock-harness-red-mutant` from the fix commit. Add one commit
   that removes `--all-snapshot` in `cli.py` and changes only that, with the message
   `test: DO NOT MERGE, deliberate red for stripe-clock`. Its unit test is expected to be
   red, which is the point. It is never proposed for merge.
7. [ ] **Meta: workflow.** In `stripe-clock.yml`, replace the "Install the Stripe CLI" step
   with:
   ```yaml
   - name: Install the Stripe CLI (pinned)
     env:
       STRIPE_CLI_VERSION: "1.53.1"
       STRIPE_CLI_SHA256: "032fe0b849a9d6a222488bc846445bafeae993af1026b78a8121d02321ca1fd1"
     run: |
       cd "${RUNNER_TEMP}"
       curl -fsSL -o stripe.tar.gz \
         "https://github.com/stripe/stripe-cli/releases/download/v${STRIPE_CLI_VERSION}/stripe_${STRIPE_CLI_VERSION}_linux_x86_64.tar.gz"
       echo "${STRIPE_CLI_SHA256}  stripe.tar.gz" | sha256sum -c -
       tar -xzf stripe.tar.gz stripe
       sudo install -m 0755 stripe /usr/local/bin/stripe
       stripe version | tee /dev/stderr | grep -Fqx "stripe version ${STRIPE_CLI_VERSION}"
   ```
   The archive layout is unverified here (sub-agents cannot download it). If `stripe` is
   not at the archive root, the first dispatch fails at `tar`; fix the member path.
   Add a two-line comment: the pin exists because v1.51 changed `listen` without notice
   (spec amendment); bump it deliberately. Validate the YAML locally with
   `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))'`.
8. [ ] **Meta: runbook** edits as in the table. Commit in meta:
   `ci: pin the Stripe CLI for stripe-clock and document the pin`.
9. [ ] **Hand-back** (runbook section 3): both worktrees clean and containing their trunk,
   `gitleaks-range.sh` CLEAN on both ranges, the floor grep empty, the mutation-check
   lines, the mutant branch's SHA, and `needs: none`.

## Conductor steps (sub-agents cannot dispatch)

10. [ ] Push backend `feat/inf-stripe-clock-harness-red`. Pin it on the meta branch with
    the ancestry guard. Dispatch `stripe-clock` on the meta branch. Pass condition: a
    `success` conclusion, `5 passed`, and the log line `stripe version 1.53.1`.
11. [ ] Push the mutant backend branch. On a throwaway meta branch
    `feat/inf-stripe-clock-harness-red-mutant` (the step 10 meta branch with the backend
    pin moved to the mutant SHA), dispatch `stripe-clock`. Pass condition: a `failure`
    conclusion **and** the log contains `must specify events to forward` and
    `exit code 1`. A `cancelled` conclusion is not a result; dispatch again. Then delete
    both mutant branches.
12. [ ] Land per the queue. `lb-billing-state-gaps` (merge_after) is unblocked once step 10
    is green. Confirm that the first scheduled run after the merge reports the merge's
    SHA and `stripe version 1.53.1`. Until mid-October, scheduled runs reported the stale
    `cf0e82a`.

## Gates

- Backend: `_tools/backend-gate.sh` full (step 5). Dashboard and marketing: untouched.
- Meta: CI on the docs/CI PR (`gitleaks`, `pip-audit`). The workflow change itself is
  proven only by the step 10 dispatch.
- e2e: none required by D3. The harness is the end-to-end check, and its own two
  dispatches are the proof.

## Risks

- **Second failure behind the first.** Setup has failed since 09-24, so nothing after
  setup has run since then. If `test_forwarded_events_match_our_configured_api_version`
  goes red, the account's default API version has moved. Do not edit
  `DJANGO_STRIPE_API_VERSION` to chase it: escalate with the observed version. If the
  scenario tests go red, debug them as a new failure within this unit if the cause is in
  harness code. Escalate if it is in Stripe configuration (owner access).
- **The diagnosis came from source, not a local run.** If the step 10 log shows a
  different refusal, the printed output now names it. Fix within scope if it is a flag.
  Escalate per `hg-stripe-key-conditional` only if it names the key.
- **CLI self-update or an upgrade notice.** Auto-update (v1.52.0) targets install-script
  installs, not tarballs. The version assertion matches one exact line, so an upgrade
  notice on another line does not break it.
- **Shared file.** `.github/workflows/stripe-clock.yml` is listed in `shared_files`.
  The conductor orders it in the queue.
- **Test fixtures tripping gitleaks.** Covered by building fake values at runtime (step 1).
  `gitleaks-range.sh` confirms this before the hand-back.

## Verification

Unit tests red, then green, then mutation-checked (steps 1 to 4). The full backend gate is
green at the unchanged floor (step 5). The green dispatch and the deliberate-red dispatch
both meet their pass conditions (steps 10 and 11). At close-out the spec status goes back
to `shipped` with a closed date, and `STATE.md`'s red-harness line is removed.
