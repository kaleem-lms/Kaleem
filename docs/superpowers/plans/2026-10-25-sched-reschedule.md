---
spec: docs/superpowers/specs/2026-10-25-sched-reschedule-design.md
status: approved
---

The unit uses two worktrees on `feat/sched-reschedule`, each made from `origin/main` (runbook
§1):

- `/home/abdulkhalek/Projects/kaleem-worktrees/backend-sched-reschedule`
- `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-sched-reschedule`

Every step starts with a failing test, seen red through
`_tools/backend-gate.sh <wt> <test path>` or `_tools/dashboard-gate.sh <wt> <test path>`.
Backend paths are under `backend/kaleem/scheduling/`. Every new error message uses gettext
and gets an Arabic `msgstr` in `locale/ar/LC_MESSAGES/django.po` (`test_server_strings.py`
covers this). Never edit a coverage floor. Merge `origin/main` (never rebase) in both
worktrees right before hand-back.

The conductor allocates the following before step 1:

- the migration slot `scheduling/0014`;
- the e2e accounts `e2e.rebook.student@kaleem.test` and `e2e.rebook.teacher@kaleem.test`;
- the feature namespace `reschedule`.

## Steps

1. [ ] **The cancellation rule (backend).**
   - Tests first, in `tests/test_close_out_matrix.py`. This file is extended, never forked.
     - Add the clock `"24h before start": START - 24h`.
     - In `_refusal`, add the guard `(cancel and now >= START, ConflictError, "already
       started")` after the state guard. Rewrite the docstring to state the rule: a session
       can be cancelled only before it starts.
     - In `_expect`, a cancel at the new clock refunds for every actor (`consumes_quota`
       False).
     - `_observed(session, now)` gains two columns:
       - `may_cancel`, which is `booking.may_cancel(session, now)`;
       - `rebooked_count`, which is `Session.objects.filter(rescheduled_from=session).count()`.
       The second goes red until step 2's field exists, so step 1 adds only `may_cancel` and
       step 2 adds `rebooked_count`.
     - `_before(prior, now)` is updated to match.
   - Tests first, in `tests/test_booking_api.py`:
     - `may_cancel` is false from `starts_at` onwards;
     - `POST cancel/` on a started session returns 409 with `error_code` `conflict`.
   - Then, in `booking.py`:
     - add `may_cancel(session, now) -> bool` (`status == scheduled and starts_at > now`);
     - in `cancel_session`, refuse with `ConflictError(_("This session has already
       started."))` after the state check.
   - Then, in `api/views.py`: `_session_payload` uses `booking.may_cancel`.
   - Grep `cancel_session(` and `session-cancel` in the tests, and keep every cancel's clock
     before the start. The private note lists the known case.
   - **Mutation checks:**
     - Delete the new guard. The matrix's `cancel-*-scheduled-{at start..start+7d}` cells go
       red. Restore it and they go green.
     - Make `may_cancel` ignore `starts_at`. The `may_cancel` column goes red.
     - Record both checks in the private note.

2. [ ] **Model and migration.**
   - Tests first, in `tests/test_booking_models.py`:
     - `rescheduled_from` is nullable;
     - a second row with the same `rescheduled_from` raises `IntegrityError`
       (`one_rebook_per_session`);
     - deleting the source nulls the link.
   - Then add the field and constraint, and run `makemigrations scheduling` to produce
     `0014_session_rescheduled_from`.
   - In `admin.py`, `rescheduled_from` is read-only in `SessionAdmin`. Cover it in
     `tests/test_admin.py`.
   - Add the `rebooked_count` matrix column here.

3. [ ] **The read side.**
   - Tests first, in `tests/test_read_api.py`:
     - `SessionInfo.rescheduled_from_id` round-trips;
     - `services.sessions_to_rebook(actor, student, now)` includes or excludes each
       rebookable condition from the spec, one test per condition, ascending by start.
   - Tests first, in `tests/test_personal_data.py`: the export row carries `rescheduled_from`.
   - Then:
     - add the last `SessionInfo` field, mapped in `_session_info`;
     - add `sessions_to_rebook` to `services.py` and its docstring;
     - add the export field to `personal_data.py`.

4. [ ] **Offered times.**
   - Tests first, in a new `tests/test_booking_reschedule.py`. `booking.reschedule_options(actor,
     session_id, now)`:
     - includes a time exactly 24h ahead and excludes one at 24h - 1min;
     - includes `cycle_end` itself and excludes `cycle_end + 1h`;
     - is limited to both people's availability, across a week boundary and through a DST
       change in one party's zone;
     - excludes another student's scheduled session with the teacher, and the student's own
       session in another subject;
     - excludes active weekly slots of either person;
     - is ascending.
   - Then implement it, reusing `matching.overlap_intervals` per week and `_fitting_candidates`.
     Before computing options, apply the refusals from step 5's table (404 and the 409s).

5. [ ] **Rebooking.**
   - Tests first, in the same file. `booking.reschedule_session(actor, session_id, starts_at,
     now)`:
     - writes the row the spec describes. The source is unchanged, and quota `used` goes up
       by exactly 1;
     - refuses each table row in the spec's order, asserting the exception type and message;
     - lets a parent rebook, and refuses the teacher with 404 (as for a stranger or an unknown
       id);
     - supports a chain: rebook, cancel ≥ 24h ahead, rebook again. A late cancel is refused;
     - after a rebook, `generate_sessions` writes nothing even when a fifth occurrence fits;
     - after the generator has spent the refund, the rebook is refused ("no sessions left");
     - `@pytest.mark.django_db(transaction=True)`: two threads rebook two sources against one
       remaining unit and produce exactly one row. Use the `test_matching_accept.py` threading
       pattern.
   - Then implement it as `@transaction.atomic`:
     1. Read the source unlocked, to learn the teacher and student.
     2. Lock the teacher's and student's active assignments, ordered by id. This is
        `claim_slot`'s statement, so the lock order matches `claim_slot` and
        `generate_sessions`.
     3. `_locked_session(source)`.
     4. Re-check the conditions.
     5. `get_quota(student, now)`.
     6. Validate `starts_at` against the options recomputed inside the lock, deciding 400 or
        409 as `claim_slot` does.
     7. Create the row.
   - **Mutation checks:**
     - Drop the `remaining > 0` check. The fifth-occurrence test and the race test go red.
     - Drop the already-rebooked check. Its refusal test goes red, then the IntegrityError
       surfaces.

6. [ ] **The weekly-time side.**
   - Tests first, in `tests/test_booking_claim.py`. An upcoming rebooked session of the
     teacher, or of the student:
     - is removed from `slot_options`;
     - makes `claim_slot` refuse with the existing conflict message;
     - is not counted once it is in the past or cancelled.
   - Then add the future `scheduled` rows with `rescheduled_from` set to `taken` and to the
     own-conflict set in both functions.
   - **Mutation check:** revert the addition. The claim test goes red.

7. [ ] **API.**
   - Tests first, in `tests/test_booking_api.py`:
     - each new route's status codes and `error_code`;
     - `to-rebook` scoping: self, child, teacher `[]`, stranger-named student 404;
     - the 201 payload, including `rescheduled_from`;
     - English and Arabic messages for one 409.
   - Then add to `api/views.py` and `api/urls.py`:
     - `SessionToRebookView` (`sessions/to-rebook/`, registered before `<int:session_id>`);
     - `SessionRescheduleOptionsView`;
     - `SessionRescheduleView` with a `RescheduleSerializer` (`starts_at` DateTimeField).
   - Add `rescheduled_from` to `SessionSerializer`.
   - `test_api_versioning_is_enforced` must stay green.

8. [ ] **e2e fixture (backend).**
   - Tests first, in a new `tests/test_seed_e2e_rebook.py`. The seed converges:
     - one assignment;
     - wide availability for both people;
     - a 4-unit, 30-day subscription;
     - a claimed weekly time 3 or more days ahead, so 4 sessions exist with
       `used == limit`.
     The seed is idempotent across two runs.
   - Then:
     - add the accounts to `identity/management/commands/seed_e2e.py` and its test;
     - add `scheduling/management/commands/seed_e2e_rebook.py`, reusing
       `seed_e2e_matching._reset_student_state`;
     - append the command to `config/e2e_seeds.txt`.
   - Run the full backend gate: `_tools/backend-gate.sh <backend wt>`.

9. [ ] **Dashboard data layer.**
   - Tests first, in `schemas.test.ts`, `api.test.ts` and `queries.test.tsx`:
     - `Session.rescheduled_from` is accepted as an int or null;
     - the three new `bookingApi` calls use relative paths;
     - `useReschedule` invalidates sessions, quota and to-rebook;
     - `useCancelSession` also invalidates to-rebook;
     - options are fetched only when enabled.
   - Then update `schemas.ts`, `api.ts`, `queries.ts` and `index.ts`.

10. [ ] **Copy.**
    - Add `locales/en/reschedule.json` and `locales/ar/reschedule.json` with the card, dialog,
      chip, announcement and empty-options strings. Use "session", not "lesson".
    - Add the namespace to `FEATURE_CATALOGUES`, and `loader: () => loadNamespace("reschedule")`
      on `routes/_authed/schedule.tsx`.
    - `parity.test.ts`, `terminology.test.ts` and `i18n-namespaces.test.ts` must pass. Extend
      the route test for the loader.

11. [ ] **Components.**
    - Tests first:
      - `RebookCard.test.tsx`: loading, error, empty (renders nothing) and list states, and
        each button's accessible name.
      - `RescheduleDialog.test.tsx`: the day select and the time radios, confirm and the
        announcement, a 409 that shows the message and refetches, no options, and RTL (`dir`).
      - `SessionCard.test.tsx`: the chip shows only when `rescheduled_from` is set.
      - `CancelSessionDialog.test.tsx`: a 409 refetches sessions.
      - `BookingPanel.test.tsx`: the card is rendered for the chosen student.
    - Then build them with `@/ui` primitives and tokens only. Targets are 44px or larger.
    - Mutation-check the SessionCard chip and the 409 refetch.
    - Run the full dashboard gate: `_tools/dashboard-gate.sh <dashboard wt>`. It covers the
      bundle budget and the built-CSS check.

12. [ ] **e2e (D3).**
    - Add `e2e/rebook.spec.ts`, with the accounts in `e2e/accounts/booking.ts`. Serial, one
      flow:
      1. Log in as the rebook student. Expect 4 upcoming sessions and "4 of 4 used".
      2. Cancel the farthest one, through the refund wording, and expect "3 of 4 used".
      3. "Sessions to rebook" lists it. Choose the first offered day and time and confirm.
      4. `page.reload()`. A card shows the "Rebooked" chip at the chosen time, the quota reads
         "4 of 4 used", and the rebook card is absent.
    - Budget: 20 s or less. Optional local run in an e2e slot (runbook §2); CI is the
      authority.
    - **Mutation check:** run the flow against a backend whose rebook view returns the payload
      without writing the row. The post-reload assertion goes red.

13. [ ] **Docs (meta, same branch).**
    - `docs/architecture/scheduling.md`:
      - add the cancellation rule;
      - add rebooking: the rules, the endpoints and the generator interplay;
      - remove "Rescheduling" from "Deliberately not here".
    - Mark OQ-C2-4 as answered in the C2 spec.
    - Hand the conductor the CLAUDE.md D3 e2e table row `scheduling — rebook`, 1 flow, to
      land.

## Risks

- **Teacher double-booking through a gap the spec did not list.** Step 6 covers weekly claims.
  Rebooks against other rebooks are covered by the overlap filter, under the shared lock.
  Fallback: refuse any time within 60 minutes of any scheduled session of either person.
- **Lock order.** Taking the session row lock before the assignments would invert
  `claim_slot`'s order. Step 5 fixes the order, and the race test exercises it.
- **Migration collision.** `sched-teacher-no-show` and `adm-*` also touch scheduling. The
  number is allocated by the conductor and renumbered at freshness.
- **Shared files.** `booking.py` and `SessionCard.tsx` are on the programme's shared list. Merge
  `origin/main` before hand-back and re-run the gates.
- **The options payload size.** A 30-day cycle with wide availability is at most about 700
  hourly starts, which is small JSON. If that is wrong, cap the list at the first 14 days that
  have options.
- **Bundle.** New copy is lazy, and the components are route-split (`autoCodeSplitting`). The
  gate's budget check is the proof.
- **Blue-green window.** The old release has no rebook routes, and the old bundle never calls
  them. Additive only.

## Verification

- Every step: the named test red first, then green.
- Every mutation check above: red with the fix reverted, green restored. Record each in the
  hand-back block.
- Hand-back:
  - the full backend gate (migrate, `makemigrations --check`, pytest with coverage, ruff and
    lint-imports), plus mypy as CI runs it if the gate script does not;
  - the full dashboard gate;
  - `gitleaks-range.sh` over each branch;
  - the floor-grep;
  - `origin/main` merged in.
- CI e2e green, with `rebook.spec.ts` present in the run log.
- After the staging deploy, a D9 click-through in both themes and RTL on the staging pool
  accounts: cancel, rebook, reload.
- `hg-arabic-review` on the new Arabic strings before the spec closes.
