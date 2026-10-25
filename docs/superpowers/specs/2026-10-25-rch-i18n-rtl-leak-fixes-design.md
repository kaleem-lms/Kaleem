---
name: rch-i18n-rtl-leak-fixes
phase: v1 (wave 2, stream i18n)
modules: [identity, scheduling]
status: approved
approved: 2026-10-25
created: 2026-10-25
closed: null
---

## Goal

Fix the Arabic and right-to-left leaks the Arabic sweep (`rch-i18n-ar-sweep-gate`) cannot see,
and empty the parity test's `ZERO_FORM_ALLOWLIST`. The sweep checks direction, reflow and axe; it
does not check that times are formatted for the locale, that the time-zone offset is in the page's
language, that directional icons mirror, or that arrow keys follow the reading direction. Each of
those is wrong today in the dashboard (measured at dashboard `origin/main` 9f64db1):

| # | Leak | Where | Today |
| --- | --- | --- | --- |
| 1 | Raw times | `WeeklyAvailabilityEditor`: the start/end `<option>` labels, the range pills (`{slot.start_time} – {slot.end_time}`), and the `{{range}}` in `availability.overlaps` | `"09:00 – 12:00"` in every language, while `SessionCard` and `ClaimSlotCard` print the same times through `Intl` (`"9:00 AM"`, `"9:00 ص"`). Seen on `/availability` (teacher), `/account` (student availability card) |
| 2 | `TimezoneBar` locale | `getOffsetLabel` calls `Intl.DateTimeFormat(undefined, …)` | the offset follows the browser's language, not the app's: `GMT+3` on an Arabic page (`غرينتش+3` is what `ar` gives). Seen on `/availability` and `/account` |
| 3 | Icon flips | `UserMenu`'s `LogOut` icon | points right in RTL. It is the only directional icon left unmirrored: `ArrowLeft` (`ExitToSchedule`) and the sidebar layout icon already carry `rtl:-scale-x-100`; every other lucide icon in `src` is non-directional (chevrons up/down, clock, check, …) |
| 4 | Arrow keys in RTL | Radix roving focus (`RadioCardGroup`, and any Radix group) | no Radix `DirectionProvider` is mounted, so Radix treats every group as LTR and ArrowRight moves to the card on the LEFT in Arabic. `RatingInput` works round it by passing `dir`. ISSUES.md entry, `asm-ui-primitives` |
| 5 | Missing Arabic `_zero` | `availability.copyConfirmBody`, `availability.weeklyTotal`, `billing.planFamilyDesc`, `billing.planIndividualDesc`, `booking.showPast` | at count 0 an Arabic page shows the English sentence (proven by the parity test's own "why the zero-form rule exists" case) |

The `/account` overflow that the programme first listed here is already fixed
(`ntf-recipient-locale-tz`); the sweep allowlist is empty with ceiling 0 and stays that way.

## User flow

1. An Arabic-speaking teacher opens `/availability`. The time pickers and the range pills read in
   Arabic (`9:00 ص`), formatted exactly like the times on `/schedule`; the zone line reads
   `Asia/Riyadh (غرينتش+3)`.
2. The same pills and offset in English read `9:00 – 10:00 AM` and `GMT+3`. **This changes the
   English availability editor from 24-hour `09:00` to the locale's own clock**, which is what the
   rest of the dashboard already shows for the same times. The `<option>` *values* stay `HH:MM`,
   so nothing sent to the API changes.
3. Adding an overlapping range shows `availability.overlaps` with the range formatted the same way.
4. In Arabic, the sign-out icon in the user menu points left (out of the start edge).
5. In Arabic, on `/account`'s "Preferred teacher gender" group, ArrowLeft moves to the next card
   and ArrowRight to the previous one, as in every RTL radio group.
6. A count of 0 in any of the five plural families shows Arabic.

No error case is new: the formatters take the strings the editor already validates.

## Data model delta

None. No migration.

## API delta

None. Wire times stay `HH:MM` (UTC wall times as today).

## Frontend

All in `dashboard`; no route added or removed.

- **`src/lib/wall-time.ts`** (new): `formatWallTime(hhmm, locale)` and
  `formatWallTimeRange(start, end, locale)`. A wall time is printed as a clock reading, not
  converted: a fixed UTC anchor date, `timeZone: "UTC"`, `{ hour: "numeric", minute: "2-digit" }`,
  and `Intl.DateTimeFormat.prototype.formatRange` for the range, so the separator and AM/PM
  placement are the locale's, not a string we join. Accepts `HH:MM` and `HH:MM:SS`. Lives in
  `src/lib` because both `scheduling` and `identity` render the editor.
- **`WeeklyAvailabilityEditor`**: option labels, pills and the overlap `{{range}}` go through it
  with `i18n.language`. No catalogue key changes.
- **`TimezoneBar`**: `getOffsetLabel(zone, i18n.language)`.
- **`UserMenu`**: `LogOut` gets `rtl:-scale-x-100`.
- **Directional-icon guard** (`src/lib/rtl-icons.test.ts`, new): reads every non-test source file,
  finds JSX uses of a closed list of directional lucide icons (`ArrowLeft/Right`,
  `ChevronLeft/Right`, `ChevronsLeft/Right`, `LogIn`, `LogOut`, `Undo*`, `Redo*`, `Reply`,
  `Send`, `CornerDown*`, `ArrowUpRight`, `ExternalLink`) and fails for any whose `className`
  lacks `rtl:-scale-x-100`. Exemptions are a named list in the test, empty at landing.
- **`src/lib/direction.tsx`**: the app's existing `DirectionProvider` (already mounted once in
  `main.tsx`, already the one place that maps the locale to `<html dir>`) also renders
  `Direction.Provider` from `radix-ui` (already a dependency; it exports `Direction`) around its
  children with the same `dir`. `main.tsx` does not change. `RatingInput`'s explicit `dir` stays:
  it is documented as the override for an element-level direction and still works.
- **Catalogues** (`src/locales/{ar}/common.json`): five Arabic `_zero` strings, DRAFTS for
  `hg-arabic-review` (in the plan). English needs none: i18next uses `_other` at 0 in English, and
  the parity rule allows an optional English `_zero` without requiring one.
- **Parity test**: `ZERO_FORM_ALLOWLIST` becomes `[]`, `ZERO_FORM_CEILING` 0. The cases that used
  the list as a fixture switch to a synthetic family so they still prove the rule.

Done = built, on staging, and checked in the browser in Arabic and English on `/availability`,
`/account` and the user menu.

## Arabic digits (`rch-d-ar-numerals`, RESOLVED 2026-10-25)

Resolved by the owner on 2026-10-25: **CLDR default digits for bare `ar`** (ADR-0020). The unit
passes `i18n.language` to `Intl` as above and adds no `intlLocale` helper, no `ar-u-nu-latn` pin and
no guard against `Intl` call sites (plan Step 8 is not run).

Context kept for the record: on Node 24.19's ICU bare `ar` resolves to Latin digits (`1,234`,
`12:00 ص`), while `ar-SA` and `ar-EG` resolve to Arabic-Indic. A browser whose ICU predates the CLDR
change that moved bare `ar` to Latin may show Arabic-Indic digits in `Intl`-formatted numbers; that is
accepted. Fixes 1 and 2 remove two raw-string sources whichever way the decision went.

## Personal data (ADR-0023)

None collected, stored or shown that is not already.

## Module boundaries

Dashboard only. `src/lib` gains one pure helper; no feature imports another feature. No backend
change, no import-linter contract, no new dependency (`radix-ui` already ships `Direction`).

## Out of scope

- Localised time-zone *names*: the picker keeps IANA ids, which are also its search keys.
- The `billing.plan*Desc` noun (حصة where the rest of the app says جلسة, ISSUES.md). The new
  `_zero` drafts follow their siblings; the reviewer may change the family.
- `TimezoneBar` offering `UTC`, Escape-to-close and its listbox label (separate ISSUES entries).
- The call room's Arabic sweep, Arabic `font-display`, server strings, zod messages.
- Any refactor of `ClaimSlotCard`'s own formatter (D10).
- Raising, lowering or editing any coverage floor (`dec-floor-ownership`).

## Test plan

Unit (vitest), each written red first and mutation-checked:

- `wall-time.test.ts`: `en` → `9:00 AM`, `ar` → contains `ص`, `13:30` → `1:30 PM`, `HH:MM:SS`
  accepted, a range uses `formatRange` (no hand-joined dash), and `23:45` stays on the same
  clock reading (the UTC anchor and `timeZone: "UTC"` keep the host zone out of it).
- `WeeklyAvailabilityEditor.test.tsx`: in Arabic the pill text equals
  `formatWallTimeRange(...,"ar")` and contains no raw `09:00`; English assertions updated to the
  formatted text; option values still `HH:MM`.
- `TimezoneBar.test.tsx`: with `i18n.changeLanguage("ar")` the offset contains `غرينتش`;
  English still matches `/GMT[+-]\d/`.
- `UserMenu.test.tsx`: the sign-out icon carries `rtl:-scale-x-100`; `rtl-icons.test.ts` goes red
  on a scratch string with an unmirrored `ChevronRight`.
- `radio-card-group.test.tsx`: under the real provider and `ar`, ArrowLeft from the first card
  focuses the second.
- `parity.test.ts`: allowlist empty at ceiling 0; zero-rule fixtures still red on breakage.

e2e (D3, `scheduling` and `identity` areas have shipped):

- New `e2e/rtl-leaks.spec.ts`, teacher account, locale switched by `localStorage` only (never
  saved on the server, so no later serial spec inherits Arabic): **(a)** `/availability` in Arabic:
  a range added in the editor shows an Arabic-formatted pill and the zone line shows `غرينتش`;
  **(b)** the user menu's sign-out icon computes to a mirrored `scale` (`-1 1`) in Arabic and `none` in
  English (Tailwind v4 emits the mirror as the individual `scale` property, so `transform` stays `none`). Real Chromium ICU, which jsdom's Node ICU is not.
  Budget: under 30 s for both.
- `availability.spec.ts`: its pill-text assertions move from `"09:00 – 10:00"` to the formatted
  English text; `selectOption("09:00")` keeps working by value.
- The Arabic sweep still passes with its empty allowlist (the unit's programme e2e line).

Not covered, said plainly: Safari and iOS (no Apple device in this project), browsers with an
older ICU (where the digit question bites), and the call room.

## Drafts for `hg-arabic-review`

Machine-written; the reviewer may change any of them (and the `billing.plan*Desc` noun).

| Key | Draft |
| --- | --- |
| `availability.copyConfirmBody_zero` | لن يستبدل هذا الفترات في أي يوم آخر. |
| `availability.weeklyTotal_zero` | لا توجد ساعات أسبوعيًا |
| `billing.planFamilyDesc_zero` | لولي أمر وأبنائه. لا حصص لكل طفل كل شهر. |
| `billing.planIndividualDesc_zero` | لطالب واحد. لا حصص كل شهر. |
| `booking.showPast_zero` | لا توجد جلسات سابقة |

## Open questions

- **`rch-d-ar-numerals`**: resolved 2026-10-25, CLDR default digits (see above).
- **`hg-arabic-review`**: the five `_zero` drafts. Holds spec closure, not the merge.
