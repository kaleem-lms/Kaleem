---
spec: docs/superpowers/specs/2026-10-25-rch-i18n-rtl-leak-fixes-design.md
status: approved
---

Repos: `dashboard` (code), `meta` (this plan and the spec). Branch `feat/rch-i18n-rtl-leak-fixes`
in both. Dashboard worktree
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-i18n-rtl-leak-fixes`, created as
conductor-runbook section 1 says, then `pnpm install --frozen-lockfile`. No dependency, no
migration, no seed change, no `ci.yml` change, no coverage-floor edit. Shared file:
`src/locales/ar/common.json` (programme `shared_files`); a conflict there is resolved by script
(i18n guide rule 4).

**Gate before Step 1:** `rch-d-ar-numerals` was answered 2026-10-25: CLDR default digits. Steps 1 to 7
run; Step 8 is NOT run.

## Steps

1. [x] **`src/lib/wall-time.ts`, test first** (`src/lib/wall-time.test.ts`).
   Red cases: `formatWallTime("09:00","en")` is `9:00 AM` (match `/^9:00\sAM$/`, ICU puts U+202F
   before AM); `"13:30"` → `/^1:30\sPM$/`; `"09:00:00"` equals `"09:00"`; `formatWallTime("09:00","ar")`
   contains `ص` and no `AM`; `formatWallTimeRange("09:00","10:00","en")` equals
   `new Intl.DateTimeFormat("en",{hour:"numeric",minute:"2-digit",timeZone:"UTC"}).formatRange(a,b)`
   for the anchored dates (proves `formatRange`, not a joined dash); `"23:45"` still prints 11:45 PM.
   Then implement: anchor `Date.UTC(2024, 0, 6, h, m)`, `timeZone: "UTC"`. Mutation check: drop
   `timeZone: "UTC"` and run the suite under `TZ=Asia/Tokyo pnpm vitest run src/lib/wall-time.test.ts`;
   the clock cases go red.

2. [x] **`WeeklyAvailabilityEditor` uses it.** Tests first in `WeeklyAvailabilityEditor.test.tsx`:
   - new: after `i18n.changeLanguage("ar")`, the Saturday pill's text equals
     `formatWallTimeRange("09:00","12:00","ar")` and `screen.queryByText(/09:00/)` is null;
   - new: an overlap in Arabic puts the formatted range in the error;
   - new: every `<option>`'s `value` is still `HH:MM` while its label is formatted;
   - update the existing `"09:00 – 12:00"`/`"14:00 – 16:00"` assertions to the helper's English
     output (build the expected string with the helper, never hard-code the separator).
   Then change `SlotPill`, the two `TIME_OPTIONS.map` label children and the `overlaps` range.
   Update `StudentAvailabilityCard.test.tsx:52` and `src/routes/_authed/availability.test.tsx` if
   they assert raw text. Mutation check: restore `{slot.start_time} – {slot.end_time}`; the Arabic
   pill case goes red.

3. [x] **`TimezoneBar` offset in the app's language.** Test first in `TimezoneBar.test.tsx`: with
   `i18n.changeLanguage("ar")` (restored in `afterEach`) the bar's text contains `غرينتش`; the
   existing `/GMT[+-]\d|UTC[+-]\d/` case stays. Then `getOffsetLabel(timeZone, i18n.language)`
   and add `i18n.language` to the `useMemo` deps. Mutation check: put `undefined` back; red.

4. [x] **Sign-out icon mirrors; directional-icon guard.**
   - `UserMenu.test.tsx`: open the menu, the sign-out item's `svg` has class `rtl:-scale-x-100`.
     Then add the class to `<LogOut>`.
   - `src/lib/rtl-icons.test.ts`: `import.meta.glob("/src/**/*.tsx", { query: "?raw", eager: true })`
     minus `*.test.tsx`; for each JSX element `<Name … className="…">` whose `Name` is on the
     spec's closed list, require `rtl:-scale-x-100` in the same opening tag. A pure
     `findUnmirrored(source)` is exported from the test module's helper section and proven red on
     scratch strings (`<ChevronRight className="size-4" />` flagged; `ChevronDown` ignored;
     `<ArrowLeft className="rtl:-scale-x-100" />` passes). `EXEMPT` list empty. Mutation check:
     remove the class from `ExitToSchedule`'s `ArrowLeft`; the real-tree case goes red.

5. [x] **Radix reads the reading direction.** Test first in `src/lib/direction.test.tsx`: render
   `<DirectionProvider><RadioCardGroup …three options…/></DirectionProvider>` with the locale `ar`,
   focus the first radio, `userEvent.keyboard("{ArrowLeft}")`, expect the second focused; in `en`,
   ArrowRight does that. Then wrap `children` in `<Direction.Provider dir={dir}>` (import
   `{ Direction } from "radix-ui"`), computing `dir` once for both the effect and the provider.
   Mutation check: remove the wrapper; the Arabic case goes red (this is the ISSUES.md defect).
   Run the `rating-input` tests too: its explicit `dir` must still win.

6. [x] **Five Arabic `_zero` strings; allowlist to zero.** In `src/locales/ar/common.json`, insert by
   script (parse, set, write with tabs), next to each family:

   | Key | DRAFT for hg-arabic-review |
   | --- | --- |
   | `availability.copyConfirmBody_zero` | لن يستبدل هذا الفترات في أي يوم آخر. |
   | `availability.weeklyTotal_zero` | لا توجد ساعات أسبوعيًا |
   | `billing.planFamilyDesc_zero` | لولي أمر وأبنائه. لا حصص لكل طفل كل شهر. |
   | `billing.planIndividualDesc_zero` | لطالب واحد. لا حصص كل شهر. |
   | `booking.showPast_zero` | لا توجد جلسات سابقة |

   In `parity.test.ts`: `ZERO_FORM_ALLOWLIST = [] as const` (typed `readonly string[]`),
   `ZERO_FORM_CEILING = 0`. Rewrite the three cases that used the real list as a fixture:
   "why the zero-form rule exists" now proves the fix (`i18n.t("availability.weeklyTotal",
   {lng:"ar",count:0})` matches `ARABIC_LETTER`); "a stale zero-form allowlist entry" and
   "removing an allowlist line" use a scratch Arabic family with its `_zero` deleted and a scratch
   one-entry allowlist. Red first: set the ceiling to 0 before adding the strings and watch rule 3
   name all five. Update the i18n guide's "Five families still lack" paragraph in meta.

7. [x] **e2e.** New `e2e/rtl-leaks.spec.ts` (teacher account, `localStorage` locale and theme set
   after `login`, as `arabic-sweep.spec.ts` does; never saves the locale on the server):
   - (a) `/availability` in Arabic: open the add form on one day, add `09:00`–`10:00` by value,
     the pill's text matches `/ص/` and not `/09:00/`; the time-zone line contains `غرينتش`. Leave
     without saving (close the context; the navigation guard is not exercised here).
   - (b) Open the user menu in Arabic: `getComputedStyle` of the sign-out `svg` has a transform
     starting `matrix(-1`; reload in English: `none` or `matrix(1`.
   Update `availability.spec.ts` lines 91, 104, 138, 187, 188, 209, 255, 298: build the expected
   pill text with a local `range("09:00","10:00")` helper that calls the same `Intl` options in
   the test process, or a `\s`-tolerant regex. Keep `selectOption("09:00")` (it matches values).
   Check `timezone.spec.ts` and `account-locale.spec.ts` for raw-time text and update likewise.

8. [-] **NOT RUN: `rch-d-ar-numerals` resolved as CLDR default digits (2026-10-25).** Kept for the record: Add `intlLocale(lng)` to `src/lib/i18n.ts`
   (`ar` → `ar-u-nu-latn`, else `lng`), test it, and route through it: `billing`
   `CancelSubscriptionDialog`, `PlanList`, `SubscriptionCard`; `booking` `ClaimSlotCard` (4 calls),
   `QuotaBadge`, `SessionCard` (2), `SessionList`; `matching` `MatchOfferList`; `ui`
   `format-bytes`, `rating-input`, `relative-time`; plus `wall-time` and `TimezoneBar`. Add a guard
   test: no shipped file passes `i18n.language` or a bare `locale` straight into `Intl.*`. Each
   file's test asserts `٠-٩` never appears under `ar`.

9. [x] **Close-out (meta + ISSUES).** Mark fixed in `ISSUES.md`: the five `_zero` families, the
   `RadioCardGroup` arrow keys, and the "keeps the rest of its list" sentence under the `/account`
   overflow entry. Add the `hg-arabic-review` batch line for the five drafts. `docs/developer-guide/i18n.md`:
   the zero-form paragraph, the "not covered" line (raw times and directional icons are now
   covered by unit guards and `rtl-leaks.spec.ts`), and a sentence pointing at `wall-time.ts` for
   `HH:MM` values. D3 e2e table row in `CLAUDE.md` is the conductor's (meta trunk file).

## Gates

TDD loop: `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh <WT> <test path>`.
Before hand-back: the full `dashboard-gate.sh <WT>` (tsc, lint, coverage at the existing floors,
build, built-CSS colours). The built-CSS check also confirms `rtl:-scale-x-100` is emitted for the
sign-out icon (grep the built CSS; Tailwind v4 scans comments, so do not write the class in prose).
e2e locally in a port slot if one is free; CI is the authority. Then runbook section 3: merge
`origin/main` (never rebase), clean tree, `gitleaks-range.sh`, floor grep.

e2e time budget: the new spec's two flows under 30 s; the suite stays under its 9-minute
`globalTimeout`.

## Risks

- **ICU whitespace.** `en` time strings carry U+202F before AM/PM and `formatRange` uses U+2009
  around the dash. Hard-coded expectations will fail by one invisible character. Fallback: build
  expectations with the same formatter, or `\s`-tolerant regexes; Playwright's `getByText`
  normalises `\s`.
- **Node ICU vs Chromium ICU** may disagree on `ar` output (digits, `ص`). Unit tests assert
  properties (`ص` present, no raw `09:00`), not exact Arabic strings; the e2e runs real Chromium.
- **English visual change** on `/availability` (24-hour to the locale clock). English option labels
  get wider (`11:45 PM`): the 320px reflow and sweep runs cover `/availability`; if a row
  wraps badly, keep `w-auto` and let the flex row wrap, never fix a width.
- **Radix provider changes every Radix group and menu** (keyboard direction, `DropdownMenu`
  side in RTL). Expected and correct, but `shell.spec.ts`, `touch-targets.spec.ts` and the Arabic
  sweep must stay green; a menu that now opens toward the start edge could move a target.
- **Arabic drafts are machine-written.** They are DRAFTS; `hg-arabic-review` holds spec closure.
  Do not mark the spec closed until the owner has reviewed them.
- **`rch-d-ar-numerals` = Latin digits** grows the diff to 11 more files; still M. If it would need
  more than Step 8 lists, escalate (scope).

## Verification

Each step's red-then-green and its mutation check, recorded in the hand-back block. The whole:
full dashboard gate green; Arabic sweep green with `ALLOWLIST_CEILING` 0; `rtl-leaks.spec.ts`
green in CI; a manual check on staging in Arabic and English of `/availability`, `/account` and
the user menu (D9), Chromium only, the Safari gap stated.
