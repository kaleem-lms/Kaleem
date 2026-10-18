---
name: cur-session-wording
phase: v1 (wave 1, scheduling stream)
modules: [dashboard (call, booking, prefs)]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Make the dashboard call a live, booked occurrence a **session**, everywhere, and keep
**lesson** for the curriculum. The owner settled this in `dec-cur-terminology` (option 1:
"calls become session; lesson is kept for curriculum").

Today the copy uses both words. At dashboard `origin/main` 9d21e01, `src/locales/en/common.json`
already says "session" for the quota, the list, cancelling and the nav. It still says "lesson" in
28 places, and 27 of them mean a live session:

| Namespace | Keys | Count |
| --- | --- | --- |
| `prefs.genderDesc` | `male`, `female` | 2 |
| `booking` | `join`, `joinFor`, `joinNotOpen`, `joinError`, `pastHeading`, `showPast_one`, `showPast_other`, `hidePast`, `emptyDescription` | 9 |
| `call` | `roomHeading`, `lobbyTitle`, `leave`, `stateReconnectingStudent`, `roomFull`, `replacedElsewhere`, `linkExpired`, `connectionLostTitle`, `deviceCheckBody`, `leaveTitle`, `leaveBody`, `leaveConfirm`, `leaveStay`, `shareUnsupportedHelp`, `replacedElsewhereHelp`, `joinFailedTitle` | 16 |

The 28th, `modules.curriculum.description` ("Lessons and materials for your studies."), is about
curriculum. It stays as it is.

Arabic has the same split. It uses جلسة where English says session, and الدرس / دروس at the
same 27 keys, plus three extra plural forms (`booking.showPast_two`, `_few`, `_many`). That makes
30 Arabic values. Arabic moves to جلسة, so a reader of either language sees one noun.

The work lands before any other unit touches the `call`, `booking` or `prefs` namespaces. Those
units then write new copy in the settled vocabulary.

## User flow

- No behaviour changes. Every button, dialog, heading and error stays in the same place and does
  the same thing. Only the noun changes.
- Example: the call's red control now reads "Leave session". Its confirmation dialog reads
  "Leave this session?" and offers "Stay in the session" or "Leave session".
- On the schedule, a session row offers "Join session". History sits behind
  "Show 2 past sessions".
- A teacher-gender preference card describes "Sessions with a female teacher."
- Error cases keep their meaning. For example: "This session's room is not open yet.",
  "Two people are already in this session…", "We couldn't open this session".

## Data model delta

None. There is no model, field or migration.

**Personal data (ADR-0023):** none. The unit does not read, store or show any new personal data.

## API delta

None. The backend's `Session` model and its `/api/v1/scheduling/sessions/` routes already use
"session". The backend and marketing have no user-facing "lesson" copy (grepped at their
`origin/main`).

## Frontend

- **Locale values.** In both `en` and `ar` `common.json`, the values of the keys above change.
  Key names do not change, so no component or `t()` call is edited.
- **A terminology guard.** A new unit test, `src/locales/terminology.test.ts`, keeps the
  decision from rotting:
  - No `en` value under `call`, `booking` or `prefs` matches `/\blessons?\b/i`.
  - No `ar` value under those namespaces contains `درس` or `دروس`.
  - Positive control, so a broken walker cannot pass on nothing: `modules.curriculum.description`
    still matches in both locales.
- **Unit tests** that match the old English copy move to the new wording. This includes the three
  negative `queryByRole(… /past lesson/i)` checks in `SessionList.test.tsx`. Those would pass on
  any copy once the word changes, so each one gets a positive control on the same locator.
- **e2e selectors** that match the noun move to roles or patterns that do not name it:
  - `call.spec.ts` lines 173–193: the leave trigger is scoped to `getByTestId("call-controls")`
    with `/^leave\b/i`. The dialog heading is matched by role alone. The dialog buttons use
    `/^stay\b/i` and `/^leave\b/i`.
  - `call-ui.spec.ts` line 1244: `/leave lesson/i` becomes `/^leave\b/i`.
  - `booking.spec.ts` line 128: the past-sessions toggle becomes `/^show \d+ past\b/i`.
  - `booking.spec.ts` line 154 asserts the teacher sees no `/sessions this cycle/i`. That locator
    gains a positive control in the booked student's first flow.
- **Expand/contract:** an open tab on the previous bundle keeps showing the old copy until it
  reloads. Nothing breaks.
- **"Done":** both themes, Arabic RTL and 320px on staging show the new noun on `/schedule`,
  the lobby, the call and the leave dialog.

## Module boundaries

The work stays inside the dashboard. There is no new import, contract or event.

## Out of scope

- **Code identifiers, comments and test titles.** For example, `CallStatus.tsx`'s
  `LessonClock` / `lessonClock`, the comments that say "lesson", and the e2e test titles. Renaming
  them is a refactor (D10). They do not reach a user.
- **`src/routes/design-preview.tsx`.** Its sample copy is hard-coded placeholder text for the
  primitives gallery, not product copy. Close-out adds an `ISSUES.md` spot.
- **Billing's Arabic.** `billing.plan*Desc` say حصة where the rest of the app says جلسة. That
  is a pre-existing inconsistency outside these namespaces. Close-out adds an `ISSUES.md` spot.
- **Curriculum copy.** `modules.curriculum.description` stays "lesson" by decision.
- **The D3 table's prose in `CLAUDE.md`.** It says "lesson" in several rows. The conductor's
  close-out docs PR updates it.

## Test plan

- **Red first:** `terminology.test.ts` fails on the current locales, with 27 `en` and 30 `ar`
  offenders. The updated unit-test regexes fail against the current copy.
- **Green:** after the locale edit, the full dashboard gate passes: tsc, lint,
  `test:coverage` at the existing floors (no source logic changes), build and the built-CSS check.
- **Mutation checks:**
  - Restore one `call.leave` value to "Leave lesson". `terminology.test.ts` and
    `CallControls.test.tsx` both go red.
  - Change `booking.quotaTitle` in a scratch build. The new positive control in `booking.spec.ts`
    goes red.
- **e2e:** no new flow (time budget +0 s). The existing `booking`, `call` and `call-ui` flows
  pass with the wording-neutral selectors against the new copy. The selectors also pass against
  the old copy, which is what makes them wording-neutral. CI is the authority.

## Open questions

None. `dec-cur-terminology` is resolved (option 1). The Arabic noun جلسة is the one the app
already uses for "session" in `booking.*` and `modules.schedule`. It is not a religious term.
The changed Arabic strings go into the wave-1 Arabic batch for the owner to read. That batch
does not gate this unit (`human_gates: []`).
