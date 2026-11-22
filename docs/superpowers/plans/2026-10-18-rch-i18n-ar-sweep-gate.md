---
spec: docs/superpowers/specs/2026-10-18-rch-i18n-ar-sweep-gate-design.md
status: draft
---

Repos: `dashboard` (code), `meta` (this plan, the spec, the i18n guide). Branch
`feat/rch-i18n-ar-sweep-gate` in both. Dashboard worktree:
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-i18n-ar-sweep-gate`, created and
installed exactly as conductor-runbook §1 says (`pnpm install --frozen-lockfile`). Adds no
dependency, no migration, no seed, no `ci.yml` change, and no coverage-floor edit.

## Steps

1. [ ] **Parity, test first** (`src/locales/parity.test.ts`).
   - First write `it("an Arabic count of 0 with no _zero form renders English")`. It initialises the
     real `@/lib/i18n` and calls `i18n.t("availability.weeklyTotal", { lng: "ar", count: 0 })`.
     Assert the result equals the English `_other` string. This records the bug that rule 3 exists
     for. If i18next does *not* fall back to English, stop and rewrite rule 3's rationale in the
     spec before going on.
   - Then write rules 1–5 as five `it` blocks over a shared `leaves()` walker (the same shape as
     `terminology.test.ts`). Take plural categories from
     `new Intl.PluralRules(lng).resolvedOptions().pluralCategories`.
   - Add `ZERO_FORM_ALLOWLIST` (the five measured families) and assert its length equals
     `ZERO_FORM_CEILING = 5`. Add a stale check: an allowlisted family that now has `_zero` fails.
   - Mutation-check each rule on a scratch copy passed to the same functions, not on the real JSON.
     The scratch cases: drop an `ar` key, drop `ar` `_few`, add `{{name}}` to `en` only, blank a
     value, put English in an `ar` value. Each must go red. Also delete one allowlist line and watch
     it go red.
   - Gate: `dashboard-gate.sh <wt> src/locales/parity.test.ts`.

2. [ ] **Route lists and completeness** (`e2e/routes/*.ts`, `e2e/routes/index.ts`).
   - Write the completeness test first, in `e2e/arabic-sweep.spec.ts`, as a browserless
     `test("every authed route is in a route list")`. It walks `src/routes/_authed` with `node:fs`
     (skipping `-` dirs and `*.test.*`, mapping `index` to `/` and `.` to `/`) and expects
     unmatched routes to equal `[]`.
   - Run it with empty lists and watch it fail naming all 11 routes. Then add the 16 entries from the
     spec's table.
   - Mutation: delete `/insights` from `analytics.ts` and watch it fail naming
     `_authed/insights.tsx`.

3. [ ] **The sweep** (`e2e/support/measure.ts`, `e2e/arabic-sweep.spec.ts`,
   `e2e/arabic-sweep.allowlist.ts`).
   - Move `reflow.spec.ts`'s in-page measurement into `widestOverflow(page)` unchanged. Add
     `settle(page)`: `networkidle`, `h1` visible, then
     `await Promise.all(document.getAnimations().map(a => a.finished))`. Settling matters because
     axe scanned a half-faded dialog once and reported 1.02:1.
   - One `test` per account in `AUTHED_ROUTES`. Log in, set `kaleem-locale=ar`, then for each entry
     run `dir`, `reflow-320`, `reflow-1280` and `axe-light`/`axe-dark` (set `kaleem-theme`, reload,
     settle). Push every failure as `${locale} ${as} ${path} ${check}[ ${rule}]: detail`, then make
     one assertion against the allowlist split: unexpected failures `[]`, stale entries `[]`.
     `test.setTimeout(150_000)`.
   - Test `ALLOWLIST.length === ALLOWLIST_CEILING` in the browserless block.
   - Measure: run the sweep with an empty allowlist in an e2e port slot (runbook §2, slot 1 or 2).
     Record every failure. For each one, write or find its ISSUES.md entry (meta, close-out), add an
     allowlist line naming it, and set the ceiling to the count. The expected entry is
     `ar teacher /account reflow-1280` (and possibly the parent and student variants). Any failure
     outside dir/reflow/axe, or more than about 10 entries, means the unit is bigger than the spec:
     escalate.
   - Mutations, each seen red, then reverted:
     - skip the locale set (`dir`)
     - `page.addStyleTag` with a 2000px-wide block on one route (`reflow-320`)
     - `page.addStyleTag` with `color` equal to the background on body text (`axe-*`)
     - a bogus allowlist entry for a passing check (stale)
     - ceiling + 1 (ceiling)

4. [ ] **English reflow on the shared lists** (`e2e/reflow.spec.ts`).
   - Replace `ROUTES` and the teacher-only login with one test per account over `AUTHED_ROUTES`,
     looping widths 320/360/430 inside. Keep the header comment's history.
   - Consult the allowlist with `locale: "en"`.
   - Run in the e2e slot. Expected green: the five original routes already pass. A new failure gets
     an ISSUES entry and an `en` allowlist line, never a dropped route.
   - Mutation: the same 2000px injection goes red.

5. [ ] **Time budget** (`playwright.config.ts`).
   - Add `globalTimeout: process.env.CI ? 9 * 60_000 : undefined`, with a comment. The comment says
     why 9 minutes: it is under the 15-minute job kill, so a red run still uploads its report. It
     also says that crossing the budget triggers sharding by area, and that raising it needs an ADR.
   - Locally, prove it with `CI=1` and a temporary `globalTimeout: 5_000` against the slot: the run
     fails as a global timeout and `playwright-report/` is written. Revert the temporary value.

6. [ ] **i18n guide** (meta `docs/developer-guide/i18n.md`). One page, covering the topics the spec
   lists. Link it from `docs/developer-guide/common-tasks.md`.

7. [ ] **Full gates and hand-back.**
   - Run `dashboard-gate.sh <wt>` (tsc, biome, `test:coverage --maxWorkers=6`, build,
     `check-colors --built`).
   - Run the full e2e suite once in a port slot. Record the `pnpm e2e` duration and the two new
     specs' durations.
   - Commit (explicit paths, `PIP_CONFIG_FILE=/dev/null`):
     - dashboard: `test(e2e): Arabic sweep gate, per-area route lists, e2e time budget`, and
       `test(locales): en/ar key parity`
     - meta: `docs: i18n developer guide`
   - The conductor pushes and reads CI's e2e log for `arabic-sweep.spec.ts` and the widened
     `reflow.spec.ts`. The CI-measured durations replace the local ones in the D3 row.

**Close-out items for the conductor:**
- CLAUDE.md D3 row: `i18n — Arabic sweep`, with the flow count and what it does not cover (the call
  room, server strings, digits, icon mirroring, any browser but Chromium).
- ISSUES.md lines: one per allowlist entry; the call room missing from the Arabic sweep; `e2e/` not
  type-checked or linted.
- Spec closed, journal line.

## Risks

- **Login rate limit.** The sweep adds 4 real-form logins, and reflow goes from 3 to 4, against
  about 46 today. allauth's login limit is per IP per minute. If CI shows a 429 on login, spread the
  sweep across fewer accounts rather than overriding the limit in `local.py`. An override would be a
  backend change outside this spec, so escalate first.
- **Shared seeded state.** Files run alphabetically and serially, so `arabic-sweep` runs before
  `booking`/`matching` mutate their accounts. The checks are layout and a11y properties, not
  content, so either state passes. Settling avoids asserting mid-fetch.
- **axe flakiness from animation or late fonts.** `settle()` waits for animations. If the Arabic
  font swap still races contrast, wait on `document.fonts.ready` too. Never retry-to-green.
- **The allowlist grows beyond about 10 entries** or shows a failure class the spec did not
  predict. That is a scope signal: escalate, do not absorb it.
- **Budget miss.** If the measured sweep exceeds 150 s, first trim duplicate role entries whose
  pages render the same shell content. Then escalate, rather than raise `globalTimeout` or start
  sharding here.

## Verification

- Every regression check above was seen red with its precondition removed, then green. A check that
  stays green when mutated twice means escalate (programme trigger).
- `dashboard-gate.sh` is green. The CI e2e log lists both specs and the job finishes inside its
  budget.
- e2e for this unit is the sweep itself (D3). There is no user-facing behaviour to click through.
  The D9 staging substitute is the conductor's post-deploy run of the sweep's account/route set in
  both themes, Arabic, at 320px.
