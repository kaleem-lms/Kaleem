---
spec: docs/superpowers/specs/2026-10-18-ana-tz-cross-zone-e2e-design.md
status: implemented
---

Repo: dashboard only. Worktree `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-ana-tz-cross-zone-e2e`,
branch `feat/ana-tz-cross-zone-e2e`, created per runbook section 1 **after**
`cur-session-wording` has merged (depends_on). No migrations, no backend change, no
dependency change, no locale change, no floor change.

## Files

| File | Change |
| --- | --- |
| `dashboard/e2e/timezone.spec.ts` | new, the only file |

Not touched: `e2e/fixtures.ts` (it already has `teacher` and `booked`), `e2e/accounts/scheduling.ts`
(no new account; see the spec), `playwright.config.ts`, `ci.yml` (the suite picks up
`e2e/*.spec.ts`; seeds come from `seed_e2e_all`).

## Steps

1. [x] **Write the flow first.** In `e2e/timezone.spec.ts`, one `test` that:
   - opens two contexts with `browser.newContext({ timezoneId: "Africa/Cairo", locale: "en-US" })`
     and `{ timezoneId: "Europe/London", locale: "en-US" }`, and closes both in `finally`;
   - in each, before navigating, arms `page.waitForResponse(r => r.url().endsWith("/scheduling/sessions/") && r.request().method() === "GET")`,
     then `login(page, "teacher" | "booked")` and `page.goto("/schedule")`, and keeps the parsed body;
   - asserts the precondition: `page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)`
     equals the zone given;
   - intersects the two bodies by `id`, keeping rows with `status === "scheduled"` and
     `starts_at + duration_minutes + 30 min > Date.now()`. Asserts `length >= 1`, equal
     `starts_at` on both sides, and `/(Z|\+00:00)$/` on it;
   - for each shared row and each page: `expected = await page.evaluate(([iso, tz]) => new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)), [row.starts_at, zone])`,
     then `expect(page.getByRole("button", { name: expected }).first()).toBeVisible()`;
   and the same in-page formatter with `timeStyle: "short"` only gives the expected time,
   which must be the exact text inside the card (the list item holding that button);
   - asserts the Cairo `expected` differs from the London `expected` for each row.

   A header comment states what the flow proves and what it does not: browser zone, not
   profile zone; rendering, not DST anchoring. It also gives the 15 s budget, and explains
   why it is read-only and safe to run after `booking.spec.ts`'s cancellation (it filters
   to rows still scheduled in both views).
2. [x] **See it pass on main, then mutation-check it.** This is a regression test over code
   that is already right, so "failing first" means the mutations. Apply M1, M2, M3 and M5 to
   `src/features/booking/components/SessionCard.tsx` one at a time, and M4 to the spec.
   Run the flow and see it red each time, then revert. Record each red line for the PR body.
   Use e2e port slot 1 or 2 (runbook section 2): Django on the gate image with the shim,
   `pnpm build` with `VITE_API_URL`, `pnpm preview`, then
   `CI=1 E2E_APP_URL=… pnpm exec playwright test e2e/timezone.spec.ts`. If no slot is
   free, the mutation runs go in the PR as a CI-run checklist for the reviewer, and CI is
   the authority.
3. [x] **Gates.** `"${R}/_tools/dashboard-gate.sh" "${WT}"` (note: neither `tsc` nor `biome` includes `e2e/` today; the file was checked with a temporary biome config and a one-file tsc project outside the repo, and `check-colors` does scan `e2e/`),
   then the runbook section 3 hand-back checks, `gitleaks-range.sh` included.
4. [x] **Hand the conductor the D3 row** for `CLAUDE.md` (conductor-only doc):
   "`scheduling` — cross-zone display | ✅ 1 flow | teacher in `Africa/Cairo`, booked student
   in `Europe/London`, same lessons; each sees the API's UTC start as their own wall-clock
   date and time. Expected strings are computed in-page with an explicit `timeZone`.
   Browser zone only; profile zone arrives with `ntf-recipient-locale-tz`."

## Risks

- **ICU string mismatch.** Avoided by computing `expected` in the same Chromium, not in Node.
- **Join label rewording** (`cur-session-wording`). The selector matches only the date
  substring. `getByRole` with a string `name` matches a case-insensitive substring after
  whitespace normalisation, which also absorbs U+202F.
- **Earlier specs mutate the booked schedule** (the cancellation, the call flows). The flow
  filters on both responses' current state, and `length >= 1` keeps it from passing
  vacuously. After `booking.spec.ts`, three lessons remain.
- **The lesson `seed_e2e_matching` puts on `now`** has an arbitrary minute and may cross
  midnight in Cairo. Both are fine, because the expected string is computed for the same
  instant.
- **Time-dependent coverage of DST.** A run in late October checks lessons on both sides of
  the London and Cairo switches; a run in July checks none. This is accepted:
  DST-specific proof belongs to `lb-recurring-dst-anchoring`'s frozen-clock flow.

## Verification

- Step 1 and 2: the flow is green on an unmodified build, and red under each of M1 to M5.
- Step 3: the full dashboard gate is green, and the five hand-back checks hold.
- Whole unit: CI's e2e job log lists `timezone.spec.ts` as passed on the first attempt (a
  pass on retry is a finding). The D9 click-through on staging covers both themes, Arabic
  RTL and 320px: `/schedule` as the teacher with the OS zone set to Cairo, and as the
  student with it set to London.

## Outcome (2026-10-18)

- Flow green on an unmodified build (about 1 s). Mutation checks, each red then reverted:
  M1 (`timeZone: "UTC"`), M2 (`timeZone: "Europe/London"`) and M3 (offset stripped from
  `starts_at`) all failed at the visibility assertion for the Cairo viewer. M4 (Cairo
  context without `timezoneId`) failed at the precondition (`Expected "Africa/Cairo"`,
  `Received "UTC"`) when run with host `TZ=UTC`, as CI runs. On a host that already sits in
  Cairo's zone the same mutation stays green, which is why the check is run in a UTC host.
- Review round 1 found that the first version asserted only the date inside the button
  names, so a build showing UTC times on the card's time block still passed. Fixed: the
  flow now also asserts the viewer's expected time inside the lesson's card. M5
  (`timeZone: "UTC"` on the time block's formatter only) was green before and is red now.
  M1 to M5 were re-run after the change.
- Not run: full e2e suite locally; CI is the authority.
