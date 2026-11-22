---
name: lb-recurring-dst-spike
phase: C
modules: [scheduling]
status: shipped
created: 2026-11-22
closed: 2026-11-22
---

# Spike: recurring lessons across DST

Programme unit `lb-recurring-dst-spike` (stream `sched`, size S, backend only). It feeds the
owner decision `lb-dec-recurring-dst`, which `lb-recurring-dst-anchoring` needs before its
spec. Code read at backend `origin/main` e543505 and dashboard `origin/main` 756146c.

## Goal

Measure what happens to a weekly lesson when one or both people cross a DST switch, and
write a recommendation for `lb-dec-recurring-dst`. **The deliverable is evidence and a
written recommendation, not production code.** The evidence is a file of frozen-clock
characterization tests, which merges into backend and pins today's behaviour. The anchoring
unit will then change exactly the assertions it means to change. No production module
changes.

### Why the tests use a frozen clock

The plan was to seed staging lessons straddling the 2026 switches and read them after each
one. Those switches were London 25 Oct 01:00Z, Cairo 29 Oct 21:00Z and New York 1 Nov 06:00Z,
and the window closed 2 Nov. The programme record shows the seed task, `base-06`, still "in
progress". No staging read was ever recorded. The only reads on disk are a local rehearsal
against a throwaway database (2026-10-18). So this spike takes the agreed fallback,
frozen-clock tests. `hg-staging-accounts` is not needed on this path. One optional staging
read is in the plan (step 6), but only to add supporting evidence.

## What the code does today

- `RecurringSlot.start_time` is a UTC `TimeField` and `weekday` is the UTC weekday. Its
  docstring says why: a slot belongs to two people in two zones.
- `booking._occurrences` adds exactly 7 days in UTC, so every generated `Session.starts_at`
  is the same UTC instant every week.
- `WeeklyAvailability` is local wall-clock time. `services._to_utc` turns it into instants
  for the reference week of a given date, using `datetime.combine(..., tzinfo=ZoneInfo)`.
  That means `fold=0`: a local time that does not exist (spring) takes the pre-switch
  offset, and a local time that happens twice (autumn) takes its first occurrence.
- `claim_slot` and `slot_options` check `matching.overlap_intervals(..., reference_date=today)`.
  So a claim is checked against the current week's offsets only.
- Dashboard, `ClaimSlotCard.formatSlot`: the label for a standing weekly time is formatted
  from an anchor instant of **6 January 2024**, so it always uses the viewer's *winter*
  offset. A scratch check with Node in each zone found the card showing "Saturday 5:00 PM"
  in London for a 17:00Z slot, while the 4 July 2026 lesson itself is at 6:00 PM. Cairo
  and New York are one hour off the same way. The Schedule page formats each session's
  real instant, so in summer the two pages disagree with each other.
- `test_to_utc.py:23` says "Cairo = UTC+3 (no DST in 2026)". That is wrong: Egypt observes
  DST. Cairo is UTC+3 in June *because of* DST, and it goes back to UTC+2 on 29 Oct 2026.

## The prediction under test

1. A lesson keeps its UTC instant across every switch.
2. So each person's local lesson time moves one hour at *their own* switch. Two people in
   zones that switch on different dates see the move in different weeks.
3. After a switch, the booked instant no longer lies inside the declared local
   availability of a person who switched. A fresh claim at the old time is refused, and
   the slot options move by an hour, but the existing slot does not.
4. Cairo's skipped and repeated hours resolve with `fold=0`, as described above.

If any of these tests fails on today's code, that refutes the prediction, and the finding is
recorded as a finding. The test is not bent to pass.

## User flow

None. No user-facing behaviour changes. The tests only describe what students and teachers
already experience today.

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None in this unit. The repos are backend only. The `ClaimSlotCard` label finding goes to
`ISSUES.md` (D10) and is handed to `lb-recurring-dst-anchoring`, which owns the dashboard
side.

## Module boundaries

`scheduling` only. The test file goes through `booking` and `services`, the way the existing
`scheduling/tests` do. No new import-linter contract and no new event.

## Personal data (ADR-0023)

None. The tests use synthetic users in the test database. Nothing is stored, logged or
shown to anyone.

## Expand/contract

Not applicable. Nothing in the schema or the API changes.

## Out of scope

- Changing how lessons are anchored. That is `lb-recurring-dst-anchoring`, after the owner
  answers `lb-dec-recurring-dst`. This spike only recommends.
- Fixing `ClaimSlotCard.formatSlot`. Recorded in `ISSUES.md` only.
- Notifying users about a move (`ntf-*`), and per-user timezone settings
  (`ntf-recipient-locale-tz`).
- Any staging write. The optional read is read-only, and any teardown of a staging seed
  stays the owner's `base-06` step.

## Test plan

New file: `backend/kaleem/scheduling/tests/test_dst_characterization.py`. It uses three
cross-zone pairs, matching the planned staging seed: P1 is a London teacher with a New York
student, P2 a Cairo teacher with a London student, P3 a New York teacher with a Cairo
student. Every lesson is on a Saturday, and `now` is pinned before 24 Oct 2026:

- **tz database guard.** The 2026 transitions the file relies on are as stated above, plus
  Cairo's spring switch on 23 Apr 2026 at 22:00Z. If tzdata ever changes, this test fails
  first, with a clear message.
- **UTC instant kept.** `generate_sessions(now=...)` over a cycle spanning all three
  switches writes four sessions at the same UTC time on 24 Oct, 31 Oct, 7 Nov and 14 Nov.
- **Local time moves at one's own switch.** This is the table of local start times, per
  person and per week, that the staging seed was meant to produce.
- **Availability drifts away from the lesson.** For P1, `overlap_intervals` contains the
  booked instant in the week of 24 Oct. It contains nothing in the week of 31 Oct. In the
  week of 7 Nov the overlap has moved an hour off the lesson.
- **A fresh claim follows the switch, the slot does not.** On 7 Nov, `claim_slot` at the old
  UTC time raises `platform.exceptions.ValidationError` (`code == "validation_error"`,
  `field == "start_time"`), while the hour after it succeeds. `slot_options` shows the same shift.
- **Cairo's skipped hour.** Availability starting at 00:00 on Fri 24 Apr 2026 begins at the
  first real instant, 22:00Z. The window is one hour shorter.
- **Cairo's repeated hour.** A range ending at 23:30 on Thu 29 Oct 2026 ends at the first
  occurrence (20:30Z).

The existing comment at `test_to_utc.py:23` gets corrected. Every test is mutation-checked:
a deliberate break in the code it describes must turn it red (see the plan).

e2e: none. The unit has no user-facing behaviour, and the programme entry says "None.". The
frozen-clock e2e flow belongs to `lb-recurring-dst-anchoring`.

## Findings and recommendation

**What was delivered.** Evidence and a recommendation. The evidence is
`backend/kaleem/scheduling/tests/test_dst_characterization.py`: 19 frozen-clock cases that
pin today's behaviour (backend feat branch `feat/lb-recurring-dst-spike`). The only other
change is a corrected comment in `test_to_utc.py`. No production code changed and there is
no migration. The owner decision `lb-dec-recurring-dst` stays open and is the owner's.

**Staging was not read.** The programme record still shows `base-06` (the staging seed) as
"in progress", with no completion recorded, and nothing from the 25 Oct / 29 Oct / 1 Nov
switches was ever read back. This unit did not read staging either (plan step 8 is a
conductor step needing ssh). Nothing below depends on staging: every claim is from the
frozen-clock tests, or from a scratch computation with the tz database (marked as such).

### Result against the prediction

All four predictions held on today's code. None was refuted, and no test was bent.

1. **A lesson keeps its UTC instant across every switch.**
   `test_generated_lessons_keep_their_utc_instant_across_every_switch[P1|P2|P3]`: four
   sessions on 24 Oct, 31 Oct, 7 Nov and 14 Nov, each at the slot's UTC time.
2. **Each person's local time moves at their own switch.**
   `test_each_persons_local_lesson_time_moves_at_their_own_switch` (six people). P1's London
   teacher sees 18:00, then 17:00 from 31 Oct. P1's New York student sees 13:00, still 13:00
   on 31 Oct, then 12:00 from 7 Nov. The two people of one lesson see it move in different
   weeks, and neither move is announced anywhere.
3. **The booked instant leaves the declared availability, and a fresh claim follows the
   switch but the existing slot does not.**
   `test_the_shared_window_leaves_the_booked_instant_after_a_switch`: for P1 the shared
   window is exactly the lesson on 24 Oct, **empty on 31 Oct**, and an hour after the lesson
   on 7 Nov. So after both have switched the lesson sits outside both people's own declared
   hours, and stays there until the next switch back (about five months).
   `test_a_fresh_claim_at_the_pre_switch_time_is_refused_after_it` (`validation_error`,
   `field == "start_time"`), `test_a_fresh_claim_an_hour_later_succeeds_after_it` and
   `test_slot_options_move_with_the_switch` show a new claim following the switch while the
   existing slot does not. Nothing flags the mismatch to anyone.
   **A related fact:** `claim_slot` checks the window of one reference week, so a claim that
   fits today can have an empty shared window the next week (P1 on 31 Oct).
4. **Cairo's skipped and repeated hours resolve with `fold=0`.**
   `test_cairo_availability_in_the_skipped_hour_starts_at_the_first_real_instant`: 00:00 to
   02:00 on Fri 24 Apr is one real hour (22:00Z to 23:00Z). The repeated-hour test shows
   23:30 on Thu 29 Oct ends at the first occurrence, 20:30Z. Either way, a lesson placed in
   that hour is ambiguous or absent and nothing says so.

One more measured fact, outside the suite. `ClaimSlotCard.formatSlot` labels a standing
weekly time at the viewer's winter offset all year (checked with Node in each zone: London
"Saturday 5:00 PM" for a 17:00Z slot whose 4 July 2026 lesson is at 6:00 PM; Cairo and New
York off by the same hour). It is in `ISSUES.md` for the anchoring unit.

### Who sees the lesson move, and when (2026, Saturday lessons)

Scratch computation with the host tz database, not part of the suite. A lesson's local time
moves for a person for the whole half-year after their own switch. The two people disagree
about how far it moved in these Saturdays, which is the span where their offset gap differs
from the winter gap:

| Pair | Saturdays with a different gap in 2026 |
| --- | --- |
| London and New York | 14, 21, 28 Mar and 31 Oct (4 weeks) |
| Cairo and London | 4, 11, 18 Apr (3 weeks); none in autumn: Cairo (29 Oct) switches four days after London (25 Oct), and no Saturday falls between |
| New York and Cairo | 14, 21, 28 Mar, 4, 11, 18 Apr and 31 Oct (7 weeks) |

Other weekdays differ, since the span between two switches covers other days. The count is
three weeks in March and one in late October or early November for London and New York,
and several more for any pair that includes Cairo.

### The three options

| | **UTC (today)** | **Teacher's local time** | **Student's local time** |
| --- | --- | --- | --- |
| Who sees the lesson move | Both people, each at their own switch, permanently until the next switch | The student, only in the weeks the two zones disagree (the table above), and back again after. The teacher never | The teacher, in those weeks. The student never |
| Inside declared availability | Not after a switch, for the whole half-year (test 3) | Always the teacher's. The student's, except in the disagreeing weeks | Always the student's. The teacher's, except in the disagreeing weeks |
| `_conflicts` and `unique_active_teacher_slot` | Sound: both compare UTC weekly minutes | The teacher side stays exact, because one teacher's slots compare in one zone. A student with two teachers in different zones can collide in the disagreeing weeks, which `conflicts_with_own` no longer catches | Not sound for a teacher with students in different zones: two slots equal in the winter can collide in the disagreeing weeks, and the constraint cannot see it |
| Student with teachers in different zones | Fine | Each lesson moves with its own teacher, so two of the student's lessons can touch or overlap in some weeks | Fine |
| Data migration | None | A new anchor-zone column on `RecurringSlot` (expand/contract), a backfill that must pick an offset for each existing UTC slot, and a rule for a teacher who changes timezone. Future sessions need re-materialising, because `generate_sessions` is `get_or_create` on `(assignment, starts_at)` and would add a second row | The same, with the student's zone |
| `claim_slot` | Checks one week | Must check every week to the horizon, or a claim can be accepted that fails the next week | The same |
| Cairo gap and overlap | Resolved in availability only | Resolved when generating each session: a lesson at 00:30 on that Friday must be given a rule | The same |

### Recommendation

**Anchor to the teacher's local time, store the anchor zone on the slot, and notify the
student of a move.** This is the programme's default, and the measurements above support it:

- Teachers hold many slots, students usually one or two. Option B keeps `unique_active_teacher_slot`
  and the teacher-side `_conflicts` exact. Option C breaks them for any teacher whose
  students are in different zones, which is the normal case for a platform that teaches
  across countries.
- Today's behaviour (A) leaves every lesson outside the declared hours of at least one
  person for half the year (test 3), with nothing telling them. B removes that for the
  teacher entirely.
- The cost of B is a one-hour move for the student in the disagreeing weeks (4 Saturdays a
  year for London and New York, up to 7 for pairs with Cairo). Without notification this is
  the same silent problem as today, so the notice is part of the recommendation, not an
  extra. `ntf-*` and `ntf-recipient-locale-tz` are where it would be sent.

**Conditions on the anchoring unit** (they come from the measurements, so its spec should
list them): validate a claim over every week to the horizon, not one reference week; store
the anchor zone on the slot so a teacher's later timezone change cannot move lessons
silently; define what happens when a lesson lands in a skipped hour or an overlap; and list
each assertion in `test_dst_characterization.py` it flips.

**Open for the owner** (`lb-dec-recurring-dst`): (1) is a one-hour move for the student in the
disagreeing weeks, with a notice, acceptable; (2) when a move puts a lesson outside the
student's declared hours, should it stand, or should it ask them to reschedule through
`sched-reschedule`; (3) should a teacher's timezone change re-anchor existing slots.
Option A (UTC, today) is the cheapest and needs no migration, but it needs the notice too, and
at that point it announces a move it could have avoided.

## Verification

Mutation checks (each reverted afterwards with `git checkout`, then green again):

- `test_the_tz_database_has_the_switches_these_tests_assume`: moving London's switch in the
  test's table by an hour is red (`Europe/London no longer switches at 2026-10-25 02:00Z`).
- `test_generated_lessons_keep_their_utc_instant_across_every_switch[P1|P2|P3]` and
  `test_each_persons_local_lesson_time_moves_at_their_own_switch` (all six): combining the
  occurrence with `ZoneInfo("Europe/London")` instead of `dt.UTC` in `booking._occurrences`
  is red, 9 failed.
- `test_the_shared_window_leaves_the_booked_instant_after_a_switch`,
  `test_a_fresh_claim_an_hour_later_succeeds_after_it`, `test_slot_options_move_with_the_switch`
  and both Cairo tests: `tz = dt.UTC` in `services._to_utc` is red, 5 failed.
- `test_a_fresh_claim_at_the_pre_switch_time_is_refused_after_it`: that mutation leaves it
  green, because a UTC window is also empty there. A second mutation, fixing the week to
  24 Oct in `_to_utc` (offsets never change), turns it red (`DID NOT RAISE ValidationError`)
  along with the window, option and skipped-hour tests, 5 failed.
- Both Cairo tests: `.replace(fold=1)` on both `combine` results in `_to_utc` is red, 2 failed.

Full backend gate rc=0: 3377 passed, coverage 98.87% against the 97.8 floor, ruff and format
clean, 32 import contracts kept, mypy clean on 450 files. The floor was not touched.

## Open questions

None for this spike. `lb-dec-recurring-dst` stays open, and it is the anchoring unit's
before-spec decision, not this one's.
