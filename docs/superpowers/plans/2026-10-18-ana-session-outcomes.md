---
spec: docs/superpowers/specs/2026-10-18-ana-session-outcomes-design.md
status: draft
---

Backend only. Worktree `/home/abdulkhalek/Projects/kaleem-worktrees/backend-ana-session-outcomes`
on `feat/ana-session-outcomes` from `origin/main` (runbook §1). It depends on `ci-parallel-guards`,
which is merged (backend 3d638b6), so the gate's `makemigrations --check` is live. Every step
starts with a failing test. Run each test with
`backend-gate.sh <wt> kaleem/scheduling/tests/<file>` and see it red before writing the code.
All paths below are under `backend/kaleem/scheduling/`.

## Steps

1. [ ] **Model and migration.**
   - Tests first, in `tests/test_booking_models.py`:
     - `Session.Outcome` has exactly `held`, `student_absent` and `teacher_absent`.
     - A scheduled row with an outcome raises `IntegrityError`, and a completed row with a NULL
       outcome is allowed.
   - Tests first, in a new `tests/test_migration_0013.py` (the `test_migration_0009.py`
     pattern, calling the forward function directly):
     - Completed rows get `held`.
     - Scheduled and cancelled rows stay NULL.
   - Then:
     - Add `Outcome`, `outcome` and `outcome_recorded_at` to `models.py`, plus the
       `session_outcome_only_when_completed` CheckConstraint.
     - `makemigrations scheduling` → `0013_session_outcome`, then hand-add the RunPython
       backfill (reverse no-op).
     - Add `outcome` to `SessionAdmin.list_display`/`list_filter`, and make both new fields
       `readonly_fields` so admin cannot bypass the sequence.
     - Cover the admin change with `tests/test_admin.py`.

2. [ ] **The read side.**
   - Tests first, in `tests/test_read_api.py`:
     - `SessionInfo.outcome` round-trips.
     - `CLOSE_OUT_WINDOW == timedelta(days=7)`.
     - `may_close` truth table: teacher, student or parent × before start, at start,
       `+7d−1s`, `+7d` × scheduled or completed.
     - `sessions_to_close` includes and excludes the cases the spec lists, is ascending, and
       for a teacher who is also a parent returns teaching rows only.
     - A naive `now` raises `ValidationError`.
   - Then, in `services.py`:
     - Add `outcome: str | None = None` as the last `SessionInfo` field, mapped in
       `_session_info`.
     - Add `CLOSE_OUT_WINDOW`, `may_close` and `sessions_to_close`. Use the `"teacher"` role
       scope, with `status=SCHEDULED`, `starts_at__lte=now` and
       `starts_at__gt=now - CLOSE_OUT_WINDOW`.
     - Add all of it to the module docstring.

3. [ ] **The close-out sequence and its guard.**
   - Tests first, in a new `tests/test_close_out_matrix.py`. It holds the combined matrix from
     the spec as a list of `Case(action, actor, prior, clock, expect)` rows.
     - Each row expects either an exception type or the `_observed(session)` dict:
       `status`, `outcome`, `outcome_recorded_at`, `consumes_quota` and `active_rooms`.
     - Seed one ACTIVE `Room` per session directly, so room ending is observable.
     - Add one row-independent assertion that no case yields `teacher_absent`.
   - Then, in `booking.py`:
     - Add `_close_out(actor, session_id, outcome, *, now)` with the eight-step docstring.
       Steps 6 and 8 are marked as reserved, with the unit that owns each.
     - `complete_session` becomes `now = now or timezone.now()`, then
       `_close_out(..., Session.Outcome.HELD, now=now)`.
     - Add `mark_student_absent(actor, session_id, *, now=None)`, which calls it with
       `STUDENT_ABSENT`.
     - Refusals:
       - Use `ConflictError("This lesson has not started yet.")` and
         `ConflictError("The time to close this lesson has passed.")`.
       - Check them after the existing 403 and status checks, so the spec's refusal order holds.
   - Fix the existing tests that complete a future lesson. `test_booking_cancel.py:83` and
     `:112`, plus the matching `test_a_completed_session_*` tests, pass
     `now=scheduled.starts_at + 5 min`. Change them; do not delete them.
   - Mutation checks:
     - Delete the window check → the before-start and `+7d` rows go red.
     - Drop `outcome=` from the write → every success row goes red.
     - Restore each and see green.

4. [ ] **HTTP.**
   - Tests first, in `tests/test_booking_api.py`:
     - `no-show/` by the teacher on a started lesson → 200, with `status: "completed"` and
       `outcome: "student_absent"`.
     - `no-show/` by the student or a parent → 403.
     - `complete/` on a lesson 3 days out → 409. This is the default-clock regression test for
       the unused `now`.
     - `to-close/` for a teacher → their in-window rows only.
     - `to-close/` for a user with no teacher profile → 403.
     - `may_complete` on `GET sessions/` is true only for the teacher of an in-progress
       lesson.
   - Tests first, in `tests/test_payload_characterization.py`:
     - Append `"may_complete"` and `"outcome"` to `PAYLOAD_KEYS`, and extend `_expected`.
     - Move `test_the_complete_response` to a started lesson.
     - Keep the list query-count assertions unchanged.
   - Then:
     - In `api/booking_serializers.py`, add `may_complete = BooleanField()` and
       `outcome = CharField(allow_null=True)` after `may_join`.
     - In `api/views.py`, `_session_payload` sets `may_complete` from `services.may_close` and
       `outcome` from `SessionInfo`.
     - Add `SessionNoShowView` (POST, re-reads through `services.get_session`, as
       `SessionCompleteView` does).
     - Add `SessionToCloseView` (GET). It refuses a user with no teacher profile using its own
       message, and lists `services.sessions_to_close`.
     - In `api/urls.py`, add `sessions/to-close/` (`session-to-close`) and
       `sessions/<int:session_id>/no-show/` (`session-no-show`).
   - Mutation check: hardcode `may_complete=True` → the payload tests go red.

5. [ ] **Docs, in the meta worktree.**
   - Rewrite the "Completing" paragraph of `docs/architecture/scheduling.md` (around line 319)
     into "Closing a lesson". It covers the outcomes, the window, the ordered sequence with its
     reserved steps, the to-close read and the payload flags.
   - Update the `Session` entry at line 166.
   - No ADR (`needs_adr: none`).
   - The D3 table is unchanged, because this unit has no e2e.

## Gates

- Use `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/backend-gate.sh <wt>` for the full
  gate. It runs:
  - `migrate`
  - `makemigrations --check`
  - `pytest --cov=kaleem --cov=signaling`
  - `ruff check`
  - `ruff format --check`
  - `lint-imports`
- `tests/test_api_versioning_is_enforced.py` covers the two new routes.
- Do not touch the coverage floor (dec-floor-ownership).
- Before hand-back, run runbook §3's five checks, including `gitleaks-range.sh <wt>
  origin/main..HEAD`.
- **e2e:** none. This unit has no user-facing surface; `pay-lesson-completion` adds the flows.
  No dashboard change, and the additive keys are stripped by zod.

## Risks

- **Migration number collision.** Another scheduling unit could land `0013` first. Renumber at
  freshness (runbook step 10a), and never edit another unit's migration.
- **The blue-green window writes a NULL outcome.** The old release's `complete` can close a
  lesson with no outcome during a deploy. This is accepted and documented in the spec. Readers
  in this unit never infer an outcome from NULL. `pay-earnings-ledger` must decide how to treat
  such rows if any exist.
- **Ending the room mid-call.** Closing at the start of the window ends a live call. This is
  intended, and the spec asks the owner to confirm it. The UI unit should confirm before posting.
- **Hidden callers that complete a future lesson.** None exist outside tests: `grep
  complete_session` finds only `views.py:320` and tests. No seed completes a lesson. If an
  e2e flow is found to POST `complete/` on a future lesson, it will turn red in CI. Fix that
  fixture's time, never the guard.
- **Locking.** `_locked_session` takes `select_for_update()` together with
  `select_related("assignment")`, so it also locks the assignment row. That is existing
  behaviour, not changed here (D10).

## Verification

- Each step: a red test first, then green.
- Run the mutation checks named in steps 3 and 4, and record them in the hand-back block.
- Whole unit:
  - The full backend gate passes with rc 0.
  - The matrix file is the single table the later close-out units extend.
- After merge, on staging:
  - `POST complete/` on a future lesson returns 409.
  - `GET sessions/to-close/` as a pool teacher lists the seeded started lessons.
