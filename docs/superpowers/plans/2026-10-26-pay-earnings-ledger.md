---
spec: docs/superpowers/specs/2026-10-26-pay-earnings-ledger-design.md
status: approved
---

The owner approved the spec on 2026-10-26 and accepted all six recommendations, so the steps
below stand as written (currency USD; ADR-0066; migration `billing/0008`).

## Before starting (conductor)

- Allocate migration `billing/0008`, the ADR number, and the `feat/pay-earnings-ledger`
  branch.
- The serialization rule applies: `booking._close_out` and the close-out matrix are shared
  with `eng-event-bus-publish`, which edits the same `_observed()`. Never put both units in the
  freshness step at once. Start from an `origin/main` that already has the publish step when
  possible.
- Backend worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-pay-earnings-ledger`,
  created per runbook §1.

## Steps

Each step starts with a failing test, run with
`_tools/backend-gate.sh "${WT}" <test file>`.

1. [x] **Models and migration.** First write `billing/tests/test_earnings_models.py`, then add
   `TeacherRate` and `TeacherEarning` to `billing/models.py` and generate `0008`. The tests:
   - `test_rate_is_unique_per_teacher_and_instant`
   - `test_earning_is_unique_per_session`
   - `test_money_fields_are_all_null_or_all_set` (three partial combinations, each an
     `IntegrityError`)
   - `test_deleting_a_teacher_with_earnings_is_protected`
   - `test_a_deleted_session_leaves_its_earning` (the earning's `session_id` is not a FK)
2. [x] **`set_teacher_rate`.** First write `billing/tests/test_teacher_rate.py`, then add
   `billing/earnings.py` and re-export it from `billing/services.py`. The tests:
   - `test_sets_a_rate`
   - `test_refuses_a_user_without_a_teacher_profile`, via
     `identity_services.get_teacher_profile`, as a not-found error
   - `test_refuses_amount_below_one`
   - `test_refuses_a_malformed_currency` (uppercase, two letters)
   - `test_refuses_a_second_currency`
   - `test_refuses_the_same_instant_twice`
   - `test_refusals_report_their_field`
3. [x] **`record_lesson_earning`.** First write `billing/tests/test_earnings.py`. The tests:
   - `test_each_paying_basis_writes_one_line` (parametrised over `held`, `student_absent` and
     `late_cancellation`)
   - `test_teacher_absent_writes_nothing`
   - `test_unknown_basis_raises_value_error`
   - `test_rate_effective_at_the_start_applies`
   - `test_rate_effective_one_second_after_the_start_does_not`
   - `test_latest_earlier_rate_wins`
   - `test_another_teachers_rate_is_never_used`
   - `test_no_rate_writes_an_unpriced_line_and_logs` (`caplog`, `billing.earning_unpriced`)
   - `test_second_line_for_a_session_raises`
   - `test_amount_and_currency_are_copied_not_referenced` (a later rate leaves the line
     unchanged)
4. [x] **Close-out step 6.** Extend `scheduling/tests/test_close_out_matrix.py`, and do not
   write a second matrix:
   - Seed a rate for `teacher` effective before `START` through `billing.services`.
   - Add an `earning` column to `_observed()`, read through a billing service or the test-only
     model import that the contract's `tests.*` ignore already allows.
   - Set expected values in `_expect()`: `("held", AMOUNT)` and `("student_absent", AMOUNT)`
     for an accepted close-out, `None` for every refusal.

   Then call `billing_services.record_lesson_earning(..., basis=outcome,
   recorded_at=now)` in `booking._close_out` at step 6, and replace the "RESERVED" note with
   that call. Also add `test_a_failing_earning_rolls_the_close_out_back`: monkeypatch the
   service to raise, then assert that status, outcome and the room are unchanged.
5. [x] **Late cancellation.** Add the matrix expectation `("late_cancellation", AMOUNT)` when
   the actor is the student or parent and `START - now < NOTICE`, and `None` for teacher and
   in-time cancellations. Then, in `_apply_cancellation`, after the save, add
   `if session.consumes_quota: record_lesson_earning(..., basis="late_cancellation")`. Also
   add `test_ending_a_weekly_time_inside_24h_earns_the_late_lesson` in
   `test_booking_cancel.py`.
6. [x] **Personal data.** First extend `billing/tests/test_personal_data.py`. The tests:
   - `test_earnings_hooks_honour_the_registry_contract`, using the `personal_data_contract`
     helpers
   - `test_earnings_export_is_exactly_the_teachers_own_rows`
   - `test_earnings_erase_keeps_rows_and_is_idempotent`
   - `test_earnings_export_names_no_student`

   Then register `billing.earnings` (both models) from `billing/personal_data.py`. Add both
   model labels to the coverage guard wherever it lives at build time.
7. [x] **Management command.** First write `billing/tests/test_set_teacher_rate_command.py`:
   - `test_prints_the_created_rate`
   - `test_each_refusal_exits_non_zero_with_the_message`
   - `test_effective_from_must_be_timezone_aware`

   Then add `billing/management/commands/set_teacher_rate.py`.
8. [x] **Strings.** Run `makemessages` for billing and add the Arabic entries for every new
   message to `billing/locale/ar/LC_MESSAGES/django.po`. Then `compilemessages`.
9. [x] **Docs** (meta worktree):
   - Write the ADR "Lesson earnings are written in the close-out transaction through
     billing.services": the context, the bus and pull alternatives, and the consequences from
     the spec.
   - Add a ledger section to `docs/architecture/billing.md`. It must say that
     `sched-teacher-no-show`'s reversal line needs a conditional unique key.
10. [x] **Gates and hand-back** (runbook §2–3):
    - Run the full `backend-gate.sh "${WT}"`: migrate, `makemigrations --check`, pytest with
      the floor enforced, ruff, format, `lint-imports` and `mypy`.
    - Merge `origin/main`; never rebase.
    - Run `gitleaks-range.sh`, and confirm no floor line was touched.
    - Write the hand-back block. Under "needs", list `migration billing/0008` and "billing
      unit: green stripe-clock dispatch on the meta branch before merge" (programme rule).

## Files touched

- **Backend, new:**
  - `kaleem/billing/earnings.py`
  - `kaleem/billing/migrations/0008_*.py`
  - `kaleem/billing/management/commands/set_teacher_rate.py`
  - `kaleem/billing/tests/test_earnings*.py`, `test_teacher_rate.py` and
    `test_set_teacher_rate_command.py`
- **Backend, changed:**
  - `kaleem/billing/models.py` (shared file)
  - `kaleem/billing/services.py` (re-export)
  - `kaleem/billing/personal_data.py`
  - `kaleem/billing/locale/ar/LC_MESSAGES/django.po`
  - `kaleem/scheduling/booking.py` (shared file)
  - `kaleem/scheduling/tests/test_close_out_matrix.py` and `test_booking_cancel.py`
  - `kaleem/billing/tests/test_personal_data.py`
- **Meta:**
  - `docs/adr/NNNN-earnings-in-the-close-out-transaction.md`
  - `docs/architecture/billing.md`
- **Not touched:** `pyproject.toml` (no import contract change: scheduling → billing.services
  is already allowed, ADR-0033), every coverage floor, and the dashboard.

## e2e (D3)

None, by design. Nothing in this unit is user-facing: the close-out controls look and behave
the same, and no screen shows earnings until `pay-earnings-dashboard`. The close-out matrix
covers every action × actor × state × clock. At close-out, the conductor adds a D3 row:
"`billing` — earnings ledger: ❌ by design, no surface until pay-earnings-dashboard".

## Risks

- **The matrix collides with `eng-event-bus-publish`.** Both units add a column to `_observed()`
  and a step to `_close_out`. *Fallback:* merge `origin/main` and keep both columns. The order
  stays earning (6) → rooms (7) → publish (8).
- **An existing test hard-deletes a teacher who now has an earning** (`PROTECT`). Today's
  delete tests create no closed-out lessons. *If one appears:* that is the protection working.
  Seed that test without an earning; do not weaken `PROTECT`.
- **Unpriced lines pile up on staging,** because there are no rates there. This is expected.
  The staging check sets one rate first.
- **mypy on the new module.** Type every service signature, and keep `basis` as a `str` (callers pass `Session.Outcome` members, which a `Literal` would reject; the service validates it at runtime).
- **Real figures leak into the public repo.** Tests use obviously fake amounts. Real rates are
  set on the server by command and are never committed.

## Verification

- **Per step:** the named tests fail first, then pass. The rollback test and step 5's matrix
  rows are mutation-checked (revert the fix, see red) and reported in the hand-back.
- **The whole unit:**
  - the full backend gate is green;
  - the stripe-clock dispatch is green (conductor);
  - after deploy, the staging check (dec-d9-substitute, conductor with owner access): set a
    fake rate for the pool teacher (`seed_staging_pool --unit pay-earnings-ledger`), close a
    pool lesson as `held` and one as `student_absent`, cancel one late as the pool parent, and
    read the three lines in the Django shell. There is no UI to click through.
