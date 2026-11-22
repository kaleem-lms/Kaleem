---
name: ana-tz-cross-zone-e2e
phase: B
modules: [scheduling, dashboard e2e]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Close the Phase B exit criterion "teacher in Cairo, student in London — session displays
correctly to both" (roadmap, Phase B exit criteria) with a Playwright flow. Today only the
backend proves cross-zone behaviour (`kaleem/scheduling/tests/test_booking_claim.py`,
`test_options_are_computed_across_a_timezone_difference`, which computes slot options);
nothing renders a lesson in a non-UTC browser, and no e2e spec sets `timezoneId`. CI runners
are UTC, so a display bug that treats the API's UTC instant as wall-clock time would pass
every existing flow.

This unit adds a test and nothing else: no product code, no seed, no copy.

## User flow

What the flow drives, as two real users at once:

1. The teacher (`e2e.teacher`) signs in from a browser whose time zone is `Africa/Cairo`, and
   the booked student (`e2e.booked`) from one whose time zone is `Europe/London`. Two
   Playwright contexts, the same browser, `locale: "en-US"`.
2. Each opens `/schedule`. The flow captures each page's own `GET scheduling/sessions/`
   response, the UTC values the UI rendered from.
3. For every lesson in both responses that is still `scheduled` and not past (end + 30 min
   grace, as `SessionList.hasEnded` uses), each viewer sees that lesson's start in their
   own zone: date and time, in the viewer's language.

No error cases are in scope. This is a display check over a seeded schedule.

## Data model delta

None.

## API delta

None. The flow reads the existing `GET /api/v1/scheduling/sessions/` (`starts_at`, ISO 8601
with a UTC offset).

## Frontend

No change. The code under test, at dashboard `origin/main`:

- `src/features/booking/components/SessionCard.tsx` formats `starts_at` with
  `Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" })`. It
  passes no `timeZone`, so it uses the browser's zone. It hands that string to `JoinButton`
  and `CancelSessionDialog`, which put it in their accessible names (`booking.joinFor`,
  `booking.cancelFor`: "… on {{date}}"). The card's leading time block is a **second,
  separate** `Intl.DateTimeFormat(i18n.language, { timeStyle: "short" })` call, also with
  no `timeZone`; it is the time a sighted viewer actually reads and is not part of any
  button name, so it is asserted on its own.
- The schedule route `/schedule` renders `SessionList` for both roles.

What the assertion keys on: a button whose accessible name **contains** the expected date
string. It does not match on the surrounding words, so it is independent of
`cur-session-wording` (which rewrites `joinFor`). A disabled Join button still has its name,
so future lessons count too. The time block is keyed on its exact text inside the card
(the list item that holds that button).

How the expected string is computed: inside the same page, with an **explicit** zone,
`new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: "medium",
timeStyle: "short", timeZone: "<zone>" }).format(new Date(starts_at))`. The app relies on
the context's **implicit** zone, so the check is not circular. Computing it in the browser
avoids a false red from Node's ICU differing from Chromium's (`" at "` against `", "`, or
U+202F before AM/PM).

"Correct" is defined against the browser's own time-zone data, not a hand-written offset
table. A test that hard-codes "+2" goes wrong at every DST switch: London 2026-10-25,
Cairo 2026-10-29.

## Module boundaries

e2e only (dashboard `e2e/`). It uses the existing `teacher` and `booked` accounts from
`e2e/fixtures.ts`, seeded by `seed_e2e` and `seed_e2e_matching` through the `seed_e2e_all`
manifest. No new account, so the scheduling fixture module (`e2e/accounts/scheduling.ts`)
is not needed and not created. That module belongs to the first unit that adds a
scheduling account.

**Personal data (ADR-0023):** none collected, stored or shown beyond what `/schedule`
already shows to these seeded accounts.

**Expand/contract:** not applicable. No schema, API or cookie change.

## Out of scope

- A per-user profile time zone (roadmap B2, "user sets timezone in profile"). Display
  follows the browser zone today, and `ntf-recipient-locale-tz` owns the setting. When it
  lands, this flow is where its display assertion belongs.
- Recurring slots across DST (`lb-recurring-dst-spike`, `lb-recurring-dst-anchoring`). This
  flow checks rendering of whatever instants the API returns, not where the backend puts
  them.
- Day headings ("Today", "Tomorrow", weekday). They depend on when CI runs. The date is
  already inside the asserted string.
- Arabic and RTL: the date format follows `i18n.language` and is not zone logic. Covered by
  the D9 click-through.

## Test plan

New `dashboard/e2e/timezone.spec.ts`, one flow, budget about 15 s (two sign-ins, two page
loads):

1. **Precondition (positive control):** each context reports the zone it was given:
   `Intl.DateTimeFormat().resolvedOptions().timeZone` is `Africa/Cairo` or
   `Europe/London`. Without this, a context that ignored `timezoneId` would make the rest
   compare UTC with UTC.
2. **Same lesson:** at least one session id is in both responses (no vacuous pass), and each
   shared id has the identical `starts_at` in both, ending in `Z` or `+00:00`.
3. **Per viewer, per shared upcoming lesson:** both are visible: a button whose name
   contains that viewer's expected date string, and, inside that lesson's card, the
   viewer's expected time (`timeStyle: "short"` in the viewer's zone) as the exact text of
   the card's own time block.
4. **The zones really differ:** for each shared lesson, the Cairo string is not the London
   string. Cairo is UTC+2 or +3 and London UTC+0 or +1, so the two always differ by 1 to
   3 hours.

Mutation checks (each must turn the flow red, then be reverted):

- M1: `timeZone: "UTC"` in `SessionCard`'s `formattedDate`. Assertion 3 goes red for Cairo.
  London alone would pass after 2026-10-25, which is why the teacher's side is in Cairo.
- M2: `timeZone: "Europe/London"` hard-coded. Red for Cairo.
- M3: parse `starts_at` with its offset stripped (read as local time). Red for Cairo.
- M5: `timeZone: "UTC"` added to the time block's formatter only, leaving `formattedDate`
  alone. The button-name assertion still passes, so only the time-block assertion in 3
  turns it red for Cairo. Without that assertion this mutation stayed green.
- M4 (test-side): drop `timezoneId` from the Cairo context. Assertion 1 goes red.

## Open questions

None. No decision id applies, and `dec-cur-terminology` does not reach this spec, whose
selectors use no wording.
