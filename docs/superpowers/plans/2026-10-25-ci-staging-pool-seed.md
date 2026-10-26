---
spec: docs/superpowers/specs/2026-10-25-ci-staging-pool-seed-design.md
status: approved
---

Backend only, one worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-ci-staging-pool-seed`
on `feat/ci-staging-pool-seed` (runbook section 1). No migration, no dependency, no env var, no
`ship.sh` change, no coverage-floor edit. Every step is test-first: write the tests named, run
them red with `backend-gate.sh <wt> <test file>`, then write the code.

## Steps

1. [x] **Platform helper.** Tests first in `kaleem/platform/tests/test_staging_pool.py`:
   - `is_staging()` true for `https://app-staging.kaleem.academy`; false for
     `https://app.kaleem.academy`, `http://app.kaleem.localhost:5173`, `https://stagingx.example`.
   - `pool_email("lb-x", "teacher") == "pool.lb-x.teacher@pool.kaleem.test"`; `validate_unit`
     rejects `""`, `"A"`, `"a_b"`, `"a.b"` and 41 characters.
   - `is_pool_email` accepts every role's address and rejects another domain, an unknown role,
     uppercase, and an extra label.

   Code: `kaleem/platform/staging_pool.py` (constants `POOL_DOMAIN`, `ROLES`,
   `MIN_PASSWORD_LENGTH = 16`; pure functions, no business imports).

2. [x] **Billing guard.** Tests first, appended to `kaleem/billing/tests/test_entitlement.py`:
   DEBUG + any user → granted (unchanged); `DEBUG=False` + staging + pool address → granted;
   staging + non-pool address → `RuntimeError`; production-like `FRONTEND_URL` + pool address →
   `RuntimeError`. Code: the guard in `grant_dev_subscription` becomes
   `settings.DEBUG or (staging_pool.is_staging() and staging_pool.is_pool_email(user.email))`,
   docstring updated. Nothing else in `billing/services.py` changes.

3. [x] **Identity command** `kaleem/identity/management/commands/seed_staging_pool_accounts.py`.
   Tests first in `kaleem/identity/tests/test_seed_staging_pool_accounts.py`:
   - refuses off staging; refuses when run without the `password_hash` stealth option;
   - creates the three accounts, verified primary addresses, profiles, the parent link, teacher
     gender male and `is_in_pool=False`; the password checks;
   - repairs drift: a changed password, `is_staff`/`is_superuser` true, language `ar`, another
     time zone, `is_active=False`, an unverified address;
   - leaves another unit's pool accounts and a non-pool user unchanged.

   Code: options `--unit` (repeatable) and stealth `password_hash`; converges like `seed_e2e`'s
   `_account`, storing the given hash (as `seed_load_accounts` does).

4. [x] **Scheduling command** `kaleem/scheduling/management/commands/seed_staging_pool_lessons.py`.
   Tests first in `kaleem/scheduling/tests/test_seed_staging_pool.py` (scheduling tests may
   import identity, billing and curriculum models; platform tests may not):
   - refuses off staging;
   - after the accounts command and this one: `joinable`'s `rooms.join_window` contains now;
     `toClose` scheduled and `now < starts_at + CLOSE_OUT_WINDOW`; `held` completed/held; one
     scheduled lesson in the future; student entitled with an active assignment.

   Code: mirrors `seed_e2e_assessment_lessons` (subjects, availability Thursday 15:00–18:00 UTC,
   `grant_dev_subscription`, a reset scoped to the pool student via
   `seed_e2e_matching._reset_student_state`, `sync_match_requests`, `accept_offer`,
   `claim_slot`, reposition the three earliest lessons, `complete_session` on `held` with the
   seed's clock). Raises if the cycle does not yield exactly four lessons.

5. [x] **Platform orchestrator** `kaleem/platform/management/commands/seed_staging_pool.py`.
   Tests first in `kaleem/platform/tests/test_seed_staging_pool.py`, with `call_command`
   mocked as `test_seed_e2e_all.py` does:
   - refuses off staging, on an empty or 15-character password, on no / repeated / malformed
     `--unit`, each with the mock never called;
   - dispatches `seed_staging_pool_accounts` then `seed_staging_pool_lessons` per unit, in
     order; the passed hash satisfies `check_password(stdin_password, hash)`; the plaintext is in
     no call argument and not in stdout.

   Code: `stealth_options = ("stdin",)` and `self.stdin = options.get("stdin", sys.stdin)` (the
   Django `createsuperuser` pattern), one `make_password` per run, one `transaction.atomic()`
   per unit, per-unit addresses and lesson times printed, then a counts line.

6. [x] **Idempotency and scope, end to end** (the D3 substitute), in
   `kaleem/scheduling/tests/test_seed_staging_pool.py`, calling the real orchestrator with
   `stdin=io.StringIO(...)` under `override_settings(DEBUG=False, FRONTEND_URL=<staging>)`:
   - two runs → identical counts of users, addresses, profiles, links, subscriptions,
     assignments, slots and sessions, and identical lesson states;
   - drift (cancel `joinable`, close out `toClose`, change the password, make staff) → a third
     run restores every declared state;
   - a run naming unit `a` leaves unit `b`'s pool rows and a non-pool student with a
     subscription and lessons byte-identical (compared as `values()` snapshots).

   Then the full gate: `backend-gate.sh <wt>` (migrate, `makemigrations --check`, pytest with
   coverage at the existing floor, ruff, format, `lint-imports` with 0 broken contracts).

7. [ ] **Staging verification** (after the conductor lands it; `hg-vps-access`, delegated). The
   exact commands are in the private record `_ops/private/ci-staging-pool-seed.md`. Run for one
   unit twice and compare the counts lines; log in as that unit's pool student with Playwright
   and see the joinable lesson's Join control, as the teacher see `toClose` in the close-out
   list, in both themes, Arabic RTL and 320px (dec-d9-substitute).

8. [x] **Close-out notes for the conductor:** `docs/architecture/platform.md` (the helper and the
   command), `docs/architecture/billing.md` (the guard's second case), a short
   `docs/runbook/staging-pool.md` (how and when to run it, no secrets), the D3 statement "no
   e2e, by design", the `hg-staging-accounts` text ("Django shell until ...") updated in the
   programme, and an `ISSUES.md` line for the `.test` mail suppression the notification units
   need.

## Mutation checks (each must go red with its fix reverted)

- Step 1/5: make `is_staging()` return `True` → the off-staging tests fail.
- Step 2: drop the `is_pool_email` half of the guard → "staging + non-pool refused" fails.
- Step 3: drop `is_staff = False` → the drift test fails.
- Step 4/6: drop the scoped reset → the second run fails (`IntegrityError` on the slot or
  extra sessions) and the counts test fails.
- Step 6: widen the reset to every student → the non-pool snapshot test fails.

## Risks

- **A future `PROTECT`/`RESTRICT` foreign key to `Session`** (the earnings ledger is reserved in
  `booking.py`) would make the reset fail on a unit whose lesson carries such a row. Fail-loud
  is acceptable; that unit must extend the reset. Named in the command's docstring.
- **Notification mail.** Once staging sends notification mail, seeding lessons for `.test`
  addresses could bounce at the mail provider. Out of scope here; recorded in `ISSUES.md` for
  the notification units.
- **Wrong marker on staging.** If staging's `FRONTEND_URL` host lacks a `staging` label the
  command refuses (fail-closed). The private record checks the value before the first run.
- **The joinable window lasts 75 minutes.** A click-through later in the day needs a fresh
  run for its unit first; the runbook says so.
- **`billing/services.py` is shared** with other billing units. The change is one guard line
  plus a docstring; the later lander merges main.

## Verification

Each step: its named tests red first, then green with `backend-gate.sh <wt> <file>`. The whole:
the full backend gate green, the mutation checks above, `gitleaks-range.sh` CLEAN over
`origin/main..HEAD`, and step 7 on staging. e2e: none (no user-facing behaviour).
