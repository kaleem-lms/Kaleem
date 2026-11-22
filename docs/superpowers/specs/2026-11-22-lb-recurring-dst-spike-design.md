---
name: lb-recurring-dst-spike
phase: C
modules: [scheduling]
status: draft
created: 2026-11-22
closed: null
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

Written at close. This section will hold, for each of `UTC`, `teacher's local time` and
`student's local time`:

- who sees the lesson move, and in which weeks of the year. For London and New York, the
  mismatch is about three weeks in March and one week in late October or early November;
  for Cairo, its own dates.
- what each option means for `_conflicts`, for the `unique_active_teacher_slot` constraint
  (both compare UTC weekly minutes today), for a student with two teachers in different
  zones, and for the data migration that the anchoring unit would need.
- the recommended option, compared against the programme's default ("teacher's local time,
  and notify students").

The owner makes the decision. This section only gives the measured grounds for it.

## Open questions

None for this spike. `lb-dec-recurring-dst` stays open, and it is the anchoring unit's
before-spec decision, not this one's.
