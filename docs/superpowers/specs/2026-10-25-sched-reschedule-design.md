---
name: sched-reschedule
phase: v1 (wave 3, scheduling stream)
modules: [scheduling]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Let a family rebook a session they cancelled in time. BR-03 says a student who cancels with at
least 24 hours' notice gets a reschedule and is not charged the session. Today the unit comes
back (`consumes_quota=False`, `booking._apply_cancellation`), but it can only be spent if the
weekly time has another unmaterialised occurrence left in the cycle (C2 spec, "A refunded unit is
re-materialised only if..."). Otherwise it goes unused.

This unit implements **dec-reschedule**, option 1: *a refunded unit can be spent on a one-off
session in the same cycle.* It answers C2's OQ-C2-4. OQ-C2-1 (moving a single occurrence) is
not built, because the decision chose option 1 instead.

The unit also adds a cancellation rule, as stated in the next paragraph. Rebooking depends on
it: a cancellation is the only way to get a unit back.

**A session can be cancelled only before it starts.** From its start onwards it is closed out
(`held` or `student_absent`, dec-lesson-outcomes) and not cancelled. This applies to every
party (student, parent and teacher) and to every path that cancels.

Backend `origin/main` 3cf6e75 and dashboard `origin/main` were read for this spec. Both
dependencies have merged: `ana-session-outcomes` (044bef7) and `lb-parent-acts-for-child`
(6b596c8).

## User flow

**Cancelling (all parties).**

1. Before the session starts, Cancel works as it does today. The 24-hour rule decides the
   refund, and a teacher's cancellation always refunds.
2. From `starts_at` onwards the Cancel control is gone (`may_cancel` is false). A request still
   sent gets **409** "This session has already started." The refusal order is: not a party
   (403), not scheduled (409), started (409).

**Rebooking (the student, or a parent linked to them).**

1. The family cancels a session and the unit comes back. A **"Sessions to rebook"** card
   appears in the booking panel for that student. It sits under the quota badge and lists each
   rebookable session with its original date and subject, and a "Choose a new time" button.
2. The button opens a dialog. The family picks a day from the days that have free times, then
   a time on that day, and confirms.
3. The new session appears in the upcoming list with a **"Rebooked"** chip. The quota goes back
   up by one, so "3 of 4 used" becomes "4 of 4 used", never "5 of 4". The card stops listing
   that cancellation.

**What counts as rebookable.** A cancelled session is rebookable when all of these hold:

- its unit was refunded (`consumes_quota=False`). That covers a family cancellation made 24
  hours or more ahead, and a teacher cancellation at any notice;
- nothing has been rebooked from it yet;
- its cycle is still current (`cycle_end > now`), and its assignment is still `active`;
- the student's quota has `remaining > 0`.

A rebooked session is an ordinary session. It can be joined, closed out and cancelled under
the same rules. If it is cancelled in time, it becomes rebookable in turn. If it is cancelled
late, the unit is spent.

**Which times are offered.** A time is offered when all of these hold:

- it starts at least 24 hours from now (`CANCELLATION_NOTICE`, the same constant);
- it starts no later than the current cycle's end;
- a whole 60-minute session fits inside both people's availability for that week
  (`matching.overlap_intervals`, the same source as weekly booking);
- it does not overlap any scheduled session of the teacher or the student;
- it does not fall on the weekly time of any active slot of the teacher or the student.

The last check is deliberately conservative. A weekly time stays taken even on a week where
its session was cancelled, because the nightly generator may yet write that week's session.

**One unit, one spender.** The nightly generator (C2, unchanged) can still spend a refunded
unit on the weekly time's next unmaterialised occurrence. Whichever comes first, the rebook or
the generator, takes the unit. The second one finds `remaining == 0`: the generator writes
nothing, and the rebook is refused. Both take the same per-student lock, so they cannot both
spend it.

**The weekly-time side.** While a rebooked session is upcoming, it holds its weekly time
against new weekly bookings by the same teacher or student. `slot_options` hides that time and
`claim_slot` refuses it, with the existing messages. Without this rule, a slot claimed later
could generate a session on top of the rebooked one.

**Refusals for a rebook**, in this order:

| Case | Response |
| --- | --- |
| Unknown session, or the caller is not that student or their linked parent (a teacher included) | 404 `not_found`, the same body as an unknown id |
| Not cancelled, or its unit was spent | 409 "Only a session cancelled in time can be rebooked." |
| Already rebooked | 409 "This session has already been rebooked." |
| Assignment ended, or cycle over | 409 "This session can no longer be rebooked." |
| No unit left this cycle | 409 "There are no sessions left to book this cycle." |
| Time not offered: out of range, or outside the shared availability | 400 `validation_error` on `starts_at`, "That time is not available for both of you." (existing string) |
| Inside the shared availability but taken | 409, with the existing "Your teacher is already booked at that time." or a new "You already have a session then." |

A refusal for a time outside the shared window always reads as 400, whatever the teacher's
calendar holds there. This is the same rule `claim_slot` uses, so probing cannot reveal the
teacher's other bookings.

## Data model delta

```
Session
  + rescheduled_from   FK -> Session  NULL  on_delete=SET_NULL  related_name="rescheduled_to"
  + UNIQUE one_rebook_per_session (rescheduled_from) WHERE rescheduled_from IS NOT NULL
```

- A rebooked session uses the source's `assignment` and `slot`, so `Session.slot` stays NOT
  NULL. It also gets `cycle_end` = the quota's current `cycle_end`, `consumes_quota=True` and
  `duration_minutes=SESSION_DURATION_MINUTES`. The source row is never modified.
- `end_slot` already cancels a slot's future sessions by `slot=`, so ending a weekly time also
  cancels an upcoming rebooked session under the 24-hour rule. That is intended.
- Migration `scheduling/0014_session_rescheduled_from` (renumbered at freshness) does
  AddField and AddConstraint. It has no data step.

**Expand/contract.** Adding a nullable column is additive. During the blue-green window the
previous release ignores the column and never writes it. The previous dashboard bundle ignores
the new payload field. Nothing needs a contract step.

**Personal data (ADR-0023).** No new category is added.

- **What:** a link from one session to the cancelled session it replaces. Students may be
  minors.
- **Why:** it records why a unit was spent twice in one cycle, and stops a cancellation from
  being rebooked twice (dec-reschedule).
- **How long:** the life of the session row. The link is nulled if the source is ever deleted.
- **Who sees it:** the session's parties, through the payload. Staff see it in Django admin.
  The `scheduling.lessons` export gains `rescheduled_from` on each row.

## API delta

All routes are under `/api/v1/scheduling/`.

- **`GET sessions/to-rebook/?student=<id>`** (new). Returns the rebookable sessions for the
  caller, or for the named child (`student_for`, as `slot-options/` does), oldest first. It
  uses the existing `SessionSerializer` shape. A teacher, or any caller outside the family,
  gets `[]` for themselves and 404 for a named student.
- **`GET sessions/<id>/reschedule-options/`** (new). Returns `[{"starts_at": "<UTC ISO>"}]`,
  ascending. It refuses exactly as the POST does, apart from the time-specific rows.
- **`POST sessions/<id>/reschedule/`** (new). The body is `{"starts_at": "<ISO>"}`. On success
  it returns **201** with the new session's `SessionSerializer` payload, re-read through
  `services.get_session`.
- **`SessionSerializer`** gains `rescheduled_from` (an int or null). `may_cancel` is
  `status == scheduled and starts_at > now`. Both changes are additive for older clients.
- **`services.SessionInfo`** gains `rescheduled_from_id: int | None = None` as its last field,
  so callers that build one by hand are unaffected.

## Frontend

- **Route:** `/_authed/schedule`, for students and parents. Teachers see only the chip. The
  route gains `loader: () => loadNamespace("reschedule")`. All new copy goes in a new feature
  catalogue `locales/{en,ar}/reschedule.json` (initial-JS budget: 577 of 580 KB used), and the
  terminology guard covers it.
- **`RebookCard`**, rendered in `BookingPanel` under `QuotaBadge`, reads `useSessionsToRebook`.
  Its states:
  - loading: a skeleton;
  - error: an Alert;
  - empty: renders nothing;
  - otherwise: one row per session with a "Choose a new time" button. Each button's accessible
    name includes the subject and date.
- **`RescheduleDialog`** reads `useRescheduleOptions(id)` only while open.
  - It shows a day `Select` and a radio group of times. Times use the viewer's locale and zone,
    with `tabular-nums`.
  - Confirm runs `useReschedule`. On success it invalidates sessions, quota and to-rebook,
    closes the dialog and announces "Session rebooked." through the existing `role="status"`
    pattern.
  - On a 409 it shows the server message and refetches. If no option remains, it says
    "No free times left this cycle."
  - The dialog follows the existing `CancelSessionDialog` pattern: focus trap, Escape, focus
    restored, 44px targets, RTL logical properties, tokens only.
- **`SessionCard`** shows a neutral "Rebooked" `StatusChip` when `rescheduled_from` is set.
- **`CancelSessionDialog`**: on a 409 it refetches sessions, so a control left open past the
  start disappears.
- API calls go through `bookingApi`, which uses relative paths under `VITE_API_URL`.

## Module boundaries

All of this is in `scheduling`. Quota still comes from `billing.services.get_session_allowance`
through `scheduling.services.get_quota`, and the parent link from `identity.services`. There
are no new cross-module imports, events or contracts.

## Out of scope

- Moving a single occurrence in place (OQ-C2-1). This is not what dec-reschedule chose.
- Carrying a unit into the next cycle (BR-02).
- Notifying the teacher of a rebooked session (`ntf-booking-notifications`).
- The teacher no-show remedy (`sched-teacher-no-show`).
- Staff rebooking for a family (`adm-*`).
- Changing what the nightly generator spends.

## Test plan

- **The close-out matrix** (`tests/test_close_out_matrix.py`) carries the cancellation rule:
  - a cancel at `at start` or any later clock is refused for every party;
  - a new clock, `24h before start`, refunds for every party;
  - `_observed` gains `may_cancel` and `rebooked_count` (always 0, because no close-out or
    cancel writes a rebook).
- **Rebook service:** the offered-time rules, one boundary each side. Also:
  - every refusal in the table, in order;
  - a parent may rebook, a teacher may not;
  - a chain: rebook, cancel in time, rebook again;
  - generator interplay both ways;
  - `claim_slot` and `slot_options` respect an upcoming rebooked session;
  - a threaded race in which two rebooks against one remaining unit produce exactly one
    session.
- **API:** status codes and `error_code`s, the `to-rebook` scope, and the payload fields.
- **Dashboard:** unit tests for the card, the dialog and the hooks. The card covers its
  loading, error, empty and list states, and the dialog its options, confirm, 409 and empty
  states, in both directions.
- **e2e (D3), one new flow, own accounts, budget ≤ 20 s:** a student cancels a session more
  than 24 hours ahead. They rebook it from "Sessions to rebook" and **reload**. The rebooked
  session persists with its chip, the quota reads "4 of 4 used" (no extra unit), and the card
  is gone.

## Open questions

None block implementation. dec-reschedule is answered (option 1). The choices below are this
spec's own and are put to the owner with it:

1. Teacher-cancelled sessions are rebookable by the family. Their unit is refunded, and
   dec-reschedule speaks of "a refunded unit".
2. A rebooked time must start at least 24 hours ahead and inside the current cycle.
3. The nightly generator and a rebook share the unit, and the first to use it wins.
4. An upcoming rebooked session blocks its weekly time for new weekly claims.

Arabic copy (both catalogues and the backend `.po`) goes through `hg-arabic-review` before the
spec closes.
