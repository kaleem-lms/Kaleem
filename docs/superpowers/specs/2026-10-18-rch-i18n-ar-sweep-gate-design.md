---
name: rch-i18n-ar-sweep-gate
phase: v1 (wave 1, i18n stream)
modules: [e2e, locales]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Make Arabic a merge gate for every authed dashboard route, not just `/login`. Today one e2e
flow switches `/login` to Arabic and checks `dir`/`lang` (`e2e/identity.spec.ts:81`). Nothing
renders an authed page in Arabic. The one known Arabic-only defect was found by hand: `/account`
scrolls sideways in Arabic at 1018px and is clean in English (ISSUES.md). This unit adds:

1. **An Arabic sweep** (`e2e/arabic-sweep.spec.ts`). It visits every authed route as the role that
   sees its content and checks `dir`/`lang`, reflow and axe. Known failures go on a shrink-only
   allowlist.
2. **A key-parity test** (`src/locales/parity.test.ts`) over `en/common.json` and `ar/common.json`.
3. **Per-area route lists** (`e2e/routes/<area>.ts`) plus a completeness check. A new authed route
   that no list names turns CI red. The English reflow spec reads the same lists.
4. **An e2e time budget** for the suite, enforced in CI.
5. **The i18n guide** (`docs/developer-guide/i18n.md`).

The next unit, `rch-i18n-rtl-leak-fixes`, empties the allowlists. This unit fixes no leak.

Grounded in dashboard `origin/main` e61e23e, backend `origin/main` and meta `origin/master`
8327003.

## User flow

None. No route, component, string or API changes. The users of this unit are developers and CI:

- A developer adds an authed route but no list entry. CI goes red and names the route file.
- A developer's page overflows at 320px in Arabic, fails axe in either theme, or loses `dir="rtl"`.
  CI goes red and names the account, path, check and the widest element or axe rule.
- A fix makes an allowlisted check pass. CI goes red with "stale allowlist entry". The fix PR
  removes the entry and lowers the ceiling.
- A developer adds an English key without its Arabic twin, or the reverse. Other parity failures:
  an Arabic plural family missing a CLDR form, or `{{var}}` placeholders that differ between the
  two files. The parity test fails, naming the key.

## Data model delta

None. **Personal data (ADR-0023): none.** The sweep logs in only as the existing seeded e2e
accounts (`seed_e2e`, `seed_e2e_matching`), on CI's throwaway database. It stores nothing and
adds no seed. **Expand/contract:** nothing to stage. No schema, API or cookie change.

## API delta

None.

## Frontend

No product code changes. Test and config files only, all in `dashboard`:

| File | Change |
| --- | --- |
| `e2e/routes/{identity,scheduling,curriculum,assessment,messaging,billing,analytics}.ts` | new. `RouteEntry[]` = `{ path, as: AccountName }`. A role-conditional page appears once per role |
| `e2e/routes/index.ts` | new. Concatenates the area lists (`AUTHED_ROUTES`) and lists the out-of-sweep routes with a reason (`NOT_SWEPT`) |
| `e2e/support/measure.ts` | new. `widestOverflow(page)`, moved verbatim from `reflow.spec.ts`, plus `settle(page)` (networkidle, the `h1`, finished animations) |
| `e2e/arabic-sweep.spec.ts` | new: the sweep and the completeness check |
| `e2e/arabic-sweep.allowlist.ts` | new: the allowlist and its ceiling |
| `e2e/reflow.spec.ts` | reads `AUTHED_ROUTES` instead of its own five-route teacher-only list. One test per account, widths inside |
| `src/locales/parity.test.ts` | new |
| `playwright.config.ts` | `globalTimeout` in CI (see the budget below) |

**Initial route lists.** These are the routes under `src/routes/_authed/` today, each as the account
that renders its real content rather than an empty state. Pages gate by role in the component, not
the route; for example `AvailabilityPage` shows an empty state to a non-teacher.

| Area | Entries |
| --- | --- |
| identity | `/` as teacher and as parent; `/account` as teacher, parent and student (role-conditional panels); `/family` as parent and as student |
| scheduling | `/schedule` as booked and as teacher; `/availability` as teacher; `/match-requests` as teacher |
| curriculum | `/curriculum` as student |
| assessment | `/assessments` as student |
| messaging | `/messages` as teacher |
| billing | `/billing` as parent |
| analytics | `/insights` as teacher |

`/curriculum`, `/assessments`, `/messages` and `/insights` are placeholders today. They are swept
anyway, so their real pages inherit the gate when they land.

**The sweep.** There is one test per account, so 4 logins. Each test logs in through the real form
in English. The `login()` selectors are English, and the form must stay real (ADR-0019). The test
then sets `localStorage["kaleem-locale"]="ar"` (read at module init by `src/lib/i18n.ts`). For each
of the account's entries:

| Check | Where | Passes when |
| --- | --- | --- |
| `dir` | 1280px | `<html dir="rtl" lang="ar">` |
| `reflow-320` | 320px | `scrollWidth <= clientWidth + 1`. The failure names the widest element |
| `reflow-1280` | 1280px | the same. The known Arabic overflow is at desktop width, not phone width |
| `axe-light`, `axe-dark` | 1280px, `kaleem-theme` set, page reloaded and settled | no violation under `wcag2a/2aa/21a/21aa/22aa`, and `color-contrast` was actually evaluated (same guard as `identity.spec.ts`) |

The test collects every failure and asserts once at the end, so one run reports them all.

**Completeness.** A browserless test walks `src/routes/_authed/` the way `route-exports.test.ts`
walks routes: it skips `-` directories and test files, maps `index` to `/` and dots to `/`. Each
route must match at least one `AUTHED_ROUTES` entry or be in `NOT_SWEPT`. A `$param` segment
matches any one path segment. `NOT_SWEPT` starts empty, because every `_authed` route is static
today.

**Shrink-only allowlists.** Each allowlist entry is `{ locale, as, path, check, rule?, issue }`,
where `issue` names its ISSUES.md entry. The English reflow spec reads the same list with
`locale: "en"`, because widening it to every route may surface English failures too. An allowlisted check still runs. If it passes, the run fails
with "stale allowlist entry". `ALLOWLIST.length` must equal `ALLOWLIST_CEILING`. A fix PR therefore
lowers the ceiling in the same diff. Raising it is a gate decrease and **needs an ADR**, the same
ratchet rule as coverage floors (ADR-0026). Its initial contents are measured in the plan's step 3,
not guessed here. The one expected entry is `/account` `reflow-1280`.

**Parity rules** (`src/locales/parity.test.ts`). Plural suffixes are the CLDR categories from
`Intl.PluralRules`.

1. Both files have the same set of base keys (a key minus any plural suffix).
2. Every leaf is a non-empty string.
3. A plural family in `ar` has every category of `new Intl.PluralRules("ar")`: `zero`, `one`,
   `two`, `few`, `many` and `other`. In `en` it has `one` and `other`. `_zero` is accepted in `en`
   as i18next's optional count-0 override. Any other suffix fails.
4. Placeholders: `{{x}}` other than `count` must be identical in `en` and `ar`, form by form.
   Arabic forms may omit `{{count}}`, because the singular and dual state the number in words. That
   is the case for all eight Arabic `_one` forms today.
5. Every `ar` value contains at least one Arabic letter (U+0600–U+06FF). This catches English
   pasted into the Arabic file.

Measured today (dashboard origin/main): rules 1, 2, 4 and 5 pass. Rule 3 fails on five families
that lack `ar` `_zero`: `availability.copyConfirmBody`, `availability.weeklyTotal`,
`billing.planFamilyDesc`, `billing.planIndividualDesc` and `booking.showPast`. At `count=0` Arabic
selects `zero`. i18next then falls through to `fallbackLng: "en"`, which renders **English text on
an Arabic page**. The plan proves that with a failing test before the rule is written. Adding those
five strings is Arabic copy and needs `hg-arabic-review`, which `rch-i18n-rtl-leak-fixes` holds. So
they go on the parity test's own shrink-only allowlist (ceiling 5) and that unit clears them.

**e2e time budget.** Measured on CI run 2026-10-18T15:09 (meta master): the whole e2e job took
4m04s, of which `pnpm e2e` took 2m13s, serial, against a 15-minute job timeout. Budgets:

| Part | Budget (CI) |
| --- | --- |
| `arabic-sweep.spec.ts` | ≤ 150 s (16 entries × about 6 s, plus 4 logins) |
| `reflow.spec.ts` (widened) | ≤ 90 s |
| whole `pnpm e2e` step | **9 minutes**, enforced by `globalTimeout: 9 * 60_000` when `CI` is set |

The projected step is about 5½ minutes. That is under the budget, so **sharding is not done in this
unit.** The `globalTimeout` is the trigger. A suite that crosses 9 minutes fails as a Playwright
timeout and the job is red, so its `if: failure()` step still uploads `test-results/` and the
service logs. (Measured in the plan's step 5: on a global timeout Playwright does not write the HTML
report.) Without the budget the job would hit the 15-minute kill. That run counts as cancelled, not
failed, so nothing would be uploaded. A red budget means sharding by area (a matrix job with one Postgres per
shard, specs grouped by the same areas as the route lists) is due as its own unit. Raising the
budget needs an ADR. `ci.yml` is listed in the unit's `shared_files` for that sharding branch, and
this unit does not edit it.

**i18n guide** (`docs/developer-guide/i18n.md`, meta). One page: adding keys (en and ar together,
under the feature's own top-level key, tab-indented, the conflict-resolution script rule), plurals
(all six Arabic forms), placeholders, logical CSS properties and directional icons, the route lists
and allowlists, and `hg-arabic-review` for any new Arabic copy.

## Module boundaries

Dashboard test code only. No backend change, no import-linter contract, no new dependency.
`@axe-core/playwright` and `@playwright/test` are already present.

## Out of scope

- **Fixing any leak.** That is `rch-i18n-rtl-leak-fixes`, which empties both allowlists.
- **Leaks this sweep cannot see**, which stay with that unit as unit-tested fixes: raw (unlocalised)
  times, the `TimezoneBar` locale and directional-icon mirroring. Arabic-Indic digits wait on
  `rch-d-ar-numerals`.
- **Untranslated server strings** (subject names and similar). That is `rch-i18n-server-strings`. A
  "visible Latin text" check would only flag those today, so it is not added here.
- **The call room** (`_call/sessions.$sessionId.room`). It needs a session in progress and live media.
  `session-ui.spec.ts` and `call-ui.spec.ts` cover it in English at phone widths. The gap is recorded
  in ISSUES.md at close-out.
- **Unauthenticated routes** beyond what `identity.spec.ts` already covers.
- **Sharding** (see the budget above) and **any `ci.yml` change**.
- **Type-checking or linting `e2e/`.** `tsconfig.json` includes `src` only and `biome.json` lints
  `src/**`. That is pre-existing and goes to ISSUES.md (D10).

## Test plan

- Parity: a vitest test shows `i18n.t("availability.weeklyTotal", { lng: "ar", count: 0 })`
  returns the English string, so rule 3 is grounded. Each of the five rules is mutation-checked on a
  scratch copy of the catalogues (drop a key, drop an `ar` form, add `{{name}}` to `en` only, blank a
  value, put English in `ar`), and each turns red.
- Sweep: mutation-checked per check. A route with locale left `en` fails `dir`. An injected 2000px
  element fails reflow. An injected low-contrast style fails axe. A bogus allowlist entry on a
  passing check fails as stale. A ceiling one above the length fails. Removing one area entry fails
  completeness with the route named.
- English reflow keeps passing on every listed route. Any failure the wider list surfaces gets an
  ISSUES.md entry and an `en` allowlist line, under the same ceiling. None is dropped silently.
- CI: the e2e log shows both new spec names and the measured durations, which go into the D3 row.

## Open questions

None. No owner decision is needed. `rch-d-ar-numerals` belongs to the follow-on unit.
