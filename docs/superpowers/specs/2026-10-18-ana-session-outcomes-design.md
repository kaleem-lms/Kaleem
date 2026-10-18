---
name: ana-session-outcomes
phase: v1 (wave 2, scheduling stream)
modules: [scheduling]
status: approved
created: 2026-10-18
closed: null
---

## Goal

Make closing a lesson a real, time-bound act with a recorded outcome, and give every later
close-out step (earnings, the event bus, notices, the teacher no-show remedy) one ordered
place to hang from.

Today (backend `origin/main` 18888b2) `booking.complete_session` (`booking.py:374`) takes a
`now` argument and never reads it. A teacher can mark a lesson delivered days before it
happens. The existing tests do exactly that: `test_booking_cancel.py:21` builds the session
three days ahead and completes it. There is also no way to say "the student did not come",
and once a lesson ends it drops out of `GET sessions/` (`upcoming_sessions` filters on
`ends_at >= now`). A teacher therefore cannot find the lessons they still have to close.

This unit implements the resolved decision **dec-lesson-outcomes**. A lesson has one of three
outcomes. The teacher records **held** or **student absent** inside a window that opens when
the lesson starts and closes 7 days later. **Teacher absent** is set only by staff adjudication,
which is built by `sched-teacher-no-show`. Pay and attendance rules that read the outcome belong
to later units. This unit only stores the outcome and guards who may write it, and when.

## User flow

No screen changes in this unit. The API flow, which `pay-lesson-completion` puts a UI on:

1. A lesson starts. Its teacher can now close it. `may_complete` is `true` on that teacher's
   payload for the lesson and `false` for everyone else.
2. The teacher records one outcome:
   - `POST sessions/<id>/complete/` records **held** (the existing endpoint, unchanged contract).
   - `POST sessions/<id>/no-show/` records **student absent** (new).

   Either way the lesson becomes `completed`, its unit stays spent and its call room is ended.
   Ending the room is existing behaviour. One consequence follows: closing a lesson while its
   call is still running ends that call. The window opens at the start (dec-lesson-outcomes),
   so this can happen, for example when a teacher records a no-show ten minutes in.
3. `GET sessions/to-close/` lists the teacher's lessons that have started, are still
   `scheduled` and are inside the window, oldest first. The lesson nearest its deadline comes
   first.
4. Refusals, checked in this order so a non-party learns nothing about someone else's lesson:
   - The actor is not the lesson's teacher: **403**.
   - The lesson is not `scheduled` (already closed or cancelled): **409** "This session is no
     longer scheduled."
   - The lesson has not started yet: **409** "This lesson has not started yet."
   - The window has passed: **409** "The time to close this lesson has passed."
5. A lesson nobody closes stays `scheduled` with no outcome after the window ends. It is not
   auto-closed; dec-lesson-outcomes rejected auto-complete. Later analytics units list such
   lessons and exclude them from their counts. Staff see them in Django admin, filtered by
   outcome.

**The window, exactly.** The teacher may close a lesson when `starts_at <= now < starts_at + 7
days`. The bounds are measured from the start, as the decision is worded. They are UTC instants,
so DST has no effect.

## Data model delta

`scheduling.Session` gains two nullable fields and one constraint. There is no new table.

```
Session
  + outcome              varchar(20) NULL  choices: held | student_absent | teacher_absent
  + outcome_recorded_at  timestamptz NULL
  + CHECK session_outcome_only_when_completed:  outcome IS NULL OR status = 'completed'
```

- `Session.Outcome` is a `TextChoices` on the model. `status` keeps its three values.
  `completed` now means "closed out", and `outcome` says how it went.
- `consumes_quota` is untouched. It is already `True` for every non-cancelled lesson, which is
  what "held" and "student absent" both need. Remedies for teacher absence, such as a reschedule
  or a credit, are decided in `sched-teacher-no-show`.
- There is no `outcome_recorded_by`. The teacher is the only writer in this unit, and the
  assignment already names them. Staff adjudication keeps its own record in
  `sched-teacher-no-show`.
- Migration `scheduling/0013_session_outcome` (renumbered at freshness if another scheduling
  migration lands first) does three things:
  1. AddField × 2.
  2. AddConstraint.
  3. RunPython: existing `completed` rows get `outcome='held'`. "Complete" has only ever meant
     "mark delivered". The reverse operation is a no-op.

**Expand/contract.** Both columns are nullable with no default, so the previous release keeps
working beside this one during the blue-green window. Its inserts omit the columns. Its
`complete` writes `completed` with a NULL outcome, which the constraint allows. A lesson
completed through the old release during that window keeps a NULL outcome. That is accepted
because no reader in this unit treats NULL as an outcome. No contract step is planned. The
columns stay nullable because scheduled and cancelled lessons have no outcome.

**Personal data (ADR-0023).**

- **What:** whether a student attended a lesson (`held` / `student_absent`), and when the
  teacher recorded it. Students may be minors, so this is children's attendance data.
- **Why:** it is the basis for attendance, reports, pay and no-show handling (dec-lesson-outcomes).
- **For how long:** the life of the `Session` row. This unit adds no separate retention.
  Scheduling has not yet joined the personal-data registry (`kaleem/platform/personal_data.py`).
  Registering its export and erase hooks is outside this unit's scope; see Open questions.
- **Who sees it:** the lesson's parties through the session payload: the student, the
  teacher, and the student's parents. Staff see it in Django admin. Other modules see it only
  through `services.SessionInfo`.

## API delta

All routes are under `/api/v1/scheduling/` (ADR-0029).

| Change | Route | Who | Body / response |
| --- | --- | --- | --- |
| guarded | `POST sessions/<id>/complete/` | lesson's teacher | no body. Records `held`. Session payload |
| **new** | `POST sessions/<id>/no-show/` | lesson's teacher | no body. Records `student_absent`. Session payload |
| **new** | `GET sessions/to-close/` | teacher profile | list of session payloads |
| additive | every session payload | — | `+ may_complete: bool`, `+ outcome: str \| null`, appended after `may_join` |

`may_complete` is computed server-side against the server clock, like `may_cancel` and
`may_join`. Its rule is: the viewer is the lesson's teacher, the lesson is `scheduled`, and
`now` is inside the window. The window rule is written once, in `services.py`. Zod strips unknown
keys, so the current dashboard is unaffected by the two new payload keys.

**Python public API** (`kaleem/scheduling/services.py`). These additions are reads only:

- `CLOSE_OUT_WINDOW = timedelta(days=7)`
- `SessionInfo.outcome: str | None` (last field, default `None`)
- `may_close(user, session: SessionInfo, now) -> bool`
- `sessions_to_close(user, *, now) -> list[SessionInfo]`: the teacher's own `scheduled`
  lessons with `starts_at <= now < starts_at + CLOSE_OUT_WINDOW`, ascending. `ana-teacher-dashboard`
  counts this list.

**The ordered close-out sequence** (`booking.py`). `complete_session` and the new
`mark_student_absent` both call one private function, `_close_out(actor, session_id, outcome,
*, now)`. Inside one transaction it runs these steps in order:

1. Lock the row (`_locked_session`).
2. Authorize: the actor is the lesson's teacher (403).
3. State: the lesson is `scheduled` (409).
4. Window: `starts_at <= now < starts_at + CLOSE_OUT_WINDOW` (409, one message per side).
5. Write `status=completed`, `outcome` and `outcome_recorded_at=now`.
6. *(reserved for `pay-earnings-ledger`: earning line, same transaction)*
7. End the lesson's rooms (`rooms.end_rooms_for_session`).
8. *(reserved for `eng-event-bus` and the notification units: `on_commit` publish and notices)*

The docstring holds this list. Each later unit adds its step there and extends the combined
matrix test (Test plan). Per the programme's serialization rule, never two at once.
`cancel_session` keeps its current behaviour. Its rows are in the matrix so the later units
that act on cancellation extend the same table. `now` is honoured on every path; it is no
longer ignored.

There is no endpoint or service path in this unit that writes `teacher_absent`. The value
exists so the enum is fixed now (dec-lesson-outcomes). Its staff-only setter comes with
`sched-teacher-no-show`.

## Frontend

None in this unit. The repos field is `backend` only. `pay-lesson-completion` builds the
close-out control, the To-close list and the zod fields. Payload changes are additive.

## Module boundaries

`scheduling` owns all of it. It calls `rooms` (in-module) and nothing new outside the module.
It adds no event. The bus is `eng-event-bus`, which publishes from step 8. `import-linter`
contracts are unchanged.

## Out of scope

- Any UI (`pay-lesson-completion`).
- Setting `teacher_absent`, student and parent no-show reports, and staff adjudication and its
  remedy (`sched-teacher-no-show`).
- Earnings (`pay-earnings-ledger`), events (`eng-event-bus`), notices, reports
  (`asm-report-api` shares the window), and attendance and dashboard counts (`ana-*`).
- Changing a recorded outcome. Once a lesson is closed it is final in this unit.
- `cancel_session` has no time bound: a party can cancel a lesson that has already ended.
  This unit pins that behaviour in the matrix and does not change it (D10). Flagged to the
  conductor for a follow-up.
- Scheduling's personal-data export and erase hooks.

## Test plan

Backend pytest only. There is no e2e because this unit has no user-facing surface; the D3
table is unchanged. The guard is mutation-checked.

- **Combined close-out matrix** (`tests/test_close_out_matrix.py`, new). Each row is one
  (action, actor, prior status, clock) case. Each row expects either an error type or every
  observable column: `status`, `outcome`, `outcome_recorded_at`, `consumes_quota`, and the count
  of active rooms. Later units add columns to the one `_observed()` helper. The rows:
  - **Actions:** complete, no-show, cancel.
  - **Actors:** teacher, student, parent, stranger.
  - **Clocks:** 1 s before start, at start, mid-lesson, after the end, `start + 7d − 1 s`,
    `start + 7d`.
  - **Prior status:** scheduled, completed, cancelled.

  The matrix also asserts that no row ever yields `teacher_absent`.
- **Window edges:** before start is refused, at start is allowed, `+7d − 1 s` is allowed and
  `+7d` is refused, each with its 409 message.
- **Default clock:** the API path, with no `now`, refuses a future lesson. This is the
  regression test for the unused argument.
- **`sessions_to_close`:** includes a started, in-window lesson and a lesson in progress.
  Excludes a future lesson, one past the window, one that is completed or cancelled, and
  another teacher's lesson. Gives a teacher-and-parent only their teaching rows. Ascending.
- **Payload:** `may_complete` is true only for the teacher, in the window, while `scheduled`.
  `outcome` round-trips. `test_payload_characterization.py` gets the two keys appended
  (a deliberate, additive change) and keeps its query count.
- **Endpoints:** `no-show/` and `to-close/` return 403 for a non-teacher, `to-close/` returns
  403 for a user with no teacher profile, the versioning test stays green, and every refusal maps
  to the right status code.
- **Migration:** backfills `held` on completed rows only, and the constraint refuses an outcome
  on a scheduled row.
- **Existing tests** that complete a future lesson (`test_booking_cancel.py`, the
  `test_booking_api.py` complete test and the characterization complete test) move to a lesson
  that has started. They must not be deleted.

## Open questions

None block the build. dec-lesson-outcomes is resolved. Three readings are stated for the
owner's approval rather than assumed:

1. **The window is measured from `starts_at`**, as worded ("start to +7 days"), not from the
   lesson's end.
2. **Closing ends the call**, even mid-lesson. This keeps today's `complete` behaviour; the
   alternative would leave rooms open with nothing to end them.
3. **Scheduling's DSAR hooks** are owned by no programme unit. This unit adds attendance data to
   a table that is not yet registered. Proposed: the conductor assigns the registration to a
   unit, and this unit does not grow to do it.
