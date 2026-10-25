---
name: asm-e2e-fixtures
phase: v1 (wave 3, assessment stream)
modules: [identity (seed only), scheduling (seed only), assessment (seed only), dashboard e2e]
status: draft
created: 2026-10-25
closed: null
---

## Goal

The assessment flows that come next (asm-teacher-report-ui, asm-report-views, asm-ratings,
ana-report-panels) each need a lesson in a known state: started and not closed out, held
and not reported, held and reported, and one the student missed. They also need a parent
who may read the reports and one who may not. No seeded account has any of this today,
and the booked student's lessons belong to the call flows, which move one of them onto
`now`.

This unit adds four dedicated accounts and those four lessons to the e2e fixture, through
the seed manifest (`backend/config/e2e_seeds.txt`), plus the dashboard's
`e2e/accounts/assessment.ts`. It changes no product code, copy, schema or API.

Decisions it relies on: `dec-lesson-outcomes` (close-out window, outcomes),
`asm-d-report-audience` (who reads a report), and the owner's rules that each e2e
account is owned by one spec and that no shared account's password is rotated.

## User flow

There is no user-facing flow. What a consumer unit finds after `seed_e2e_all`:

**Accounts** (verified, password `E2E_PASSWORD`, created by `seed_e2e`):

| Key (TS) | Email | Name | Profile |
| --- | --- | --- | --- |
| `asmTeacher` | `e2e.asm.teacher@kaleem.test` | E2E Assessment Teacher | Teacher (male) |
| `asmStudent` | `e2e.asm.student@kaleem.test` | E2E Assessment Student | Student |
| `asmParent` | `e2e.asm.parent@kaleem.test` | E2E Assessment Parent | Parent, one child: `asmStudent` |
| `asmOtherParent` | `e2e.asm.otherparent@kaleem.test` | E2E Unrelated Parent | Parent, no children |

No name is a substring of another seeded name, so a `getByRole` name match cannot hit
two accounts.

**Lessons** (`asmTeacher` teaches `asmStudent` Quran; one active assignment; times are UTC
offsets from the seed's run, truncated to the minute; 60-minute lessons):

| Lesson | Starts | Status / outcome | Report | Owned by |
| --- | --- | --- | --- | --- |
| `heldReported` | now − 3 days | completed / held | the fixture report | asm-report-views (reads), asm-ratings (rates) |
| `heldUnreported` | now − 2 days | completed / held | none | ana-report-panels (files one) |
| `studentAbsent` | now − 1 day | completed / student_absent | none | nobody: a read-only negative control |
| `toClose` | now − 3 hours | scheduled / none | none | asm-teacher-report-ui (closes it, then reports) |

All four are inside the 7-day close-out window, so after seeding `reports_due(asmTeacher)`
returns exactly `heldUnreported`, and `sessions_to_close(asmTeacher)` returns exactly
`toClose`. The report on `heldReported` is readable by the teacher, the student and
`asmParent`, and refused to `asmOtherParent`.

**The fixture report** (schema version 1, written through `assessment.services.save_report`):
`covered` "E2E fixture lesson notes", `homework` "E2E fixture homework", `next_plan`
"E2E fixture next plan", `focus` `revision`, `passage` surah 1, ayahs 1 to 7. The texts are
exported from `accounts/assessment.ts` so a reading flow can assert them.

**Rules for consumers**, written into the seed docstrings and the TS module header:

- A flow writes only to the lesson it owns. A flow that asserts on a list (Reports due,
  to-close, a report list) asserts on its own row, never on the list's length.
- A unit that needs a state not listed here amends this fixture in its own spec and owns
  the new row. The dev subscription allows four lessons per cycle and all four are used,
  so a fifth lesson needs a second student.

## Data model delta

None. The seeds write rows in existing tables. No migration.

## API delta

None.

## Frontend

No product change. Test side only:

- New `dashboard/e2e/accounts/assessment.ts`: `ASSESSMENT_ACCOUNTS` (the four accounts
  above, `email` and `name`) and `ASSESSMENT_REPORT` (the three fixture texts).
- `dashboard/e2e/fixtures.ts`: `ACCOUNTS` spreads `ASSESSMENT_ACCOUNTS` (one import, one
  spread), so `login(page, "asmTeacher")` works.
- New `dashboard/e2e/assessment-fixtures.spec.ts`, one flow: each of the four accounts
  signs in through the real form. It is the only check that the TS emails match the
  Python constants; without it a drift surfaces in wave 4 as a consumer's login failure.

## Module boundaries

Three seed commands, each in the module that owns the rows it writes:

1. **identity, `seed_e2e`** (existing): the four accounts and the `asmParent` →
   `asmStudent` link, through the existing `_account` and `_link_guardian`. The
   `asmOtherParent`'s links are deleted every run so it converges on no children.
2. **scheduling, new `seed_e2e_assessment_lessons`**: the assignment and the four
   lessons, by the real paths the family-booking seed uses: `set_teacher_subjects` /
   `set_student_subjects` (curriculum services), `set_availability`,
   `grant_dev_subscription` (billing services), `sync_match_requests`, `accept_offer`,
   `claim_slot`, `generate_sessions(student_id=...)`. The four generated lessons are
   repositioned onto the offsets above (the same move `seed_e2e_matching` makes for the
   joinable lesson), then closed out through `booking.complete_session` and
   `booking.mark_student_absent`, so the close-out window guard is exercised rather than
   bypassed. It resets only `asmStudent`'s scheduling rows (`_reset_student_state`), so it
   never touches the call flows' lesson or any other account's. Availability is Thursday
   15:00–18:00 UTC for both, a window no other seeded account uses, so the global
   reconciler never offers `e2e.student`'s open request to `asmTeacher`.
3. **assessment, new `seed_e2e_assessment`**: finds the teacher's lessons through
   `scheduling.services.sessions_between(..., role="teacher")`, deletes any report or
   rating on them, and files the fixture report on the earliest held lesson through
   `services.save_report`. It imports only `scheduling.services` and its own models, so
   every import-linter contract holds unchanged.

Both new commands refuse to run with `DEBUG=False`, like every e2e seed. The manifest
gains two lines after `seed_e2e_billing`, lessons first; `test_shipped_manifest_is_todays_ci_order`
gains the same two. No `ci.yml` edit.

Deleting a lesson cascades to its report and ratings (both `on_delete=CASCADE`), so a
reseed of the whole manifest converges; running `seed_e2e_assessment` alone also converges
on the report state.

**Personal data (ADR-0023):** none real. Fixture accounts at `@kaleem.test`, created only by
DEBUG-guarded commands that never run on staging or production; the "child" is a fixture
student; the report text is fixed fixture text. No retention question. Staging accounts are
the owner's (`hg-staging-accounts`), not this unit's.

**Expand/contract:** not applicable: no schema, API or cookie change.

**e2e time budget:** about 8 s (four sign-ins).

## Out of scope

- The rating threshold state (three distinct raters): asm-ratings adds its raters.
- Any flow that writes a report or a rating: those are the consumer units' flows.
- A lesson past the close-out window, a cancelled lesson, a `teacher_absent` lesson.
- Staging accounts and lesson states (`hg-staging-accounts`, owner).
- The D3 table row and `docs/architecture/assessment.md`'s "Not here yet" line: updated at
  close-out.

## Test plan

Backend tests, written first:

- `identity/tests/test_seed_e2e.py`: the four accounts exist with their profiles, are
  verified and authenticate with `E2E_PASSWORD`; `asmParent` has exactly `asmStudent`;
  a stray link on either parent is dropped by a reseed; the count line reads 21.
- `scheduling/tests/test_seed_e2e_assessment_lessons.py`: refuses outside DEBUG; one
  active assignment (Quran, `asmTeacher`) and no open request; exactly the four lessons
  with the declared status, outcome and offset; all inside the close-out window and
  ended; `sessions_to_close` is exactly `toClose`; `asmTeacher` has no offer
  (`list_offers_for`) after the full manifest; the booked student's lessons (ids,
  starts, statuses) are identical before and after; a reseed after a spec closed
  `toClose` puts it back to scheduled.
- `assessment/tests/test_seed_e2e_assessment.py`: refuses outside DEBUG; the earliest held
  lesson has the fixture report, authored by `asmTeacher`, and no other lesson has one;
  no ratings; `reports_due` is exactly `heldUnreported`; `can_read_report` admits the
  teacher, student and `asmParent` and refuses `asmOtherParent`; a reseed removes a report
  and a rating a spec left on the other lessons.
- `platform/tests/test_seed_e2e_all.py`: the shipped manifest lists the two new lines.

e2e: the sign-in flow above.

Mutation checks (each turns its test red, then is reverted):

- M1: drop the `complete_session` call for `heldUnreported`: the lessons test and the
  `reports_due` test go red.
- M2: file the report on the latest held lesson instead of the earliest: the report test
  goes red.
- M3: scope the reset to the teacher instead of the student, or drop it: the reseed test
  goes red.
- M4: give `asmTeacher` the Saturday 09:00–12:00 window: the no-offer test goes red.
- M5: change one email in `accounts/assessment.ts`: the e2e flow goes red.
- M6: drop `asmOtherParent`'s link clearing: the stray-link test goes red.

## Open questions

None. Account ownership and no shared password rotation are owner-answered; report
content follows the shipped `ReportContentV1`.
