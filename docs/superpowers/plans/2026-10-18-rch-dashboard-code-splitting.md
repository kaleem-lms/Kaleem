---
spec: docs/superpowers/specs/2026-10-18-rch-dashboard-code-splitting-design.md
status: done
---

Worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-dashboard-code-splitting`
on `feat/rch-dashboard-code-splitting`. The worktree already exists, made from `origin/main`
8612523 and installed with `pnpm install --frozen-lockfile`. There is no dependency change,
no migration, no meta CI change and no floor edit.

TDD loop: `_tools/dashboard-gate.sh "${WT}" <test path>`.

## Steps

1. [ ] **Split guard first (red).** Write `src/routes/route-exports.test.ts`.
   - It uses `node:fs` to walk `src/routes`, skipping `*.test.*` and anything under a
     `-`-prefixed directory.
   - It collects each file's `export` declarations with a regex over
     `^export (async )?(function|const|let|class|interface|type) (\w+)`.
   - It asserts that the set is `{Route}`, or `{Route, RouterContext}` for `__root.tsx`.
   - On `origin/main` it must fail and list 19 files.

2. [ ] **Move the page components (green).** Create these files and move each component,
   with its own helpers and constants, unchanged. Each route file then imports its
   component, and each test's `./x` import is repointed to the new file.

   | Route file | New file | Moves |
   | --- | --- | --- |
   | `login.tsx` | `-pages/LoginPage.tsx` | `LoginPage` |
   | `register.tsx` | `-pages/RegisterPage.tsx` | `RegisterPage` |
   | `forgot-password.tsx` | `-pages/ForgotPasswordPage.tsx` | `ForgotPasswordPage` |
   | `reset-password.tsx` | `-pages/ResetPasswordPage.tsx` | `ResetPasswordPage`, `State` |
   | `verify-email.tsx` | `-pages/VerifyEmailPage.tsx` | `VerifyEmailPage` |
   | `verify-pending.tsx` | `-pages/VerifyPendingPage.tsx` | `VerifyPendingPage` |
   | `design-preview.tsx` | `-pages/DesignPreviewPage.tsx` | `DesignPreviewPage`, `Specimens`, `Section`, `RADIO_OPTIONS`, `MODES` |
   | `_authed/index.tsx` | `_authed/-pages/Home.tsx` | `Home`, `SOON`, `DESCRIPTION_KEY` |
   | `_authed/account.tsx` | `_authed/-pages/Account.tsx` | `Account` |
   | `_authed/availability.tsx` | `_authed/-pages/AvailabilityPage.tsx` | `AvailabilityPage` |
   | `_authed/billing.tsx` | `_authed/-pages/BillingPage.tsx` | `BillingPage`, `CheckoutStatus` |
   | `_authed/family.tsx` | `_authed/-pages/Family.tsx` | `Family` |
   | `_authed/schedule.tsx` | `_authed/-pages/SchedulePage.tsx` | `SchedulePage`, `resolveViewerRole` |
   | `_authed/match-requests.tsx` | `_authed/-pages/MatchRequestsPage.tsx` | `MatchRequestsPage` |
   | `_authed/assessments.tsx` | `_authed/-pages/AssessmentsPage.tsx` | `AssessmentsPage` |
   | `_authed/curriculum.tsx` | `_authed/-pages/CurriculumPage.tsx` | `CurriculumPage` |
   | `_authed/insights.tsx` | `_authed/-pages/InsightsPage.tsx` | `InsightsPage` |
   | `_authed/messages.tsx` | `_authed/-pages/MessagesPage.tsx` | `MessagesPage` |
   | `_call/sessions.$sessionId.room.tsx` | `_call/-pages/RoomPage.tsx` | `RoomPage`, `joinFailureMessageKey`, `MAX_VISIBILITY_RECOVERIES` |

   - Inline route wrappers (`AccountRoute`, `BillingRoute`, `HomeRoute` and the others)
     stay in the route files, because they read `Route.useSearch()` or `useMe()`.
   - Read each file before moving it. If a helper is shared by the wrapper and the page,
     it goes with the page and is exported from there.
   - Run the step-1 test and the 14 route test files whose imports changed. The room test drives
     `routeTree`, so it is unaffected and runs unchanged.
   - Then run `pnpm exec vite build` and `git status`: `src/routeTree.gen.ts` must be
     unchanged.

3. [ ] **Budget script test first (red).** Write `scripts/check-bundle-budget.test.mjs`
   against exported pure functions:
   - `initialScripts(html)` returns the module entry `src` plus each
     `rel="modulepreload"` `href` ending in `.js`. It ignores stylesheet and font links,
     and returns `[]` when none are found.
   - `violations({ initialBytes, chunks }, { initial, chunk })` returns readable lines
     for an initial total over budget and for any chunk over budget.
   - The CLI's `main(distDir)` throws or exits 1 when `initialScripts` is empty.
   - Vitest's default include picks up `scripts/*.test.mjs`. If it does not, run the test
     by its path, and say so in the hand-back.

4. [ ] **Budget script (green), then wire it up.** Write `scripts/check-bundle-budget.mjs`.
   - It reads `dist/index.html` and `dist/assets/*.js` and sums raw bytes.
   - It prints a table of raw and gzip sizes (`node:zlib`).
   - It exits 1 on any violation.
   - It holds two constants, `INITIAL_JS_BUDGET` and `CHUNK_BUDGET = 500_000`. Each has a
     comment giving the measured value, the date and the rule: "ratchet; lowering is
     normal, raising needs an ADR (ADR-0026 sense)."

   Then:
   - Set `package.json` `build` to `tsc && vite build && node scripts/check-bundle-budget.mjs`.
   - Set `vite.config.ts` to `TanStackRouterVite({ autoCodeSplitting: true,
     routeFileIgnorePattern: ... })`.
   - Build, and set `INITIAL_JS_BUDGET` to the measured initial raw bytes rounded up to
     the next 10 KB. The probe measured about 570 KB; a number far from that means
     something did not split, so investigate before recording it.
   - The Vite >500 kB warning must be gone.

5. [ ] **Reload guard test first (red).** Write `src/lib/chunk-reload.test.ts` for
   `installChunkReloadGuard(win, { now, storage, reload })`. Inject these three
   dependencies so the test does not touch jsdom's `location`. Cases:
   - the first `vite:preloadError` calls `reload` once and writes `kaleem-chunk-reload-at`;
   - a second error within 10 s does not call it;
   - an error 10 s or more later calls it again;
   - a `storage.getItem` that throws means no reload;
   - a `storage.setItem` that throws means no reload;
   - an unrelated event does nothing;
   - the returned function removes the listener.

6. [ ] **Reload guard (green).** Write `src/lib/chunk-reload.ts`. Its defaults are
   `Date.now`, `window.sessionStorage` (read inside try/catch) and `() =>
   window.location.reload()`. Do not call `preventDefault`: the router's error boundary
   stays the fallback. Add one line to `src/main.tsx`, before `createRoot`:
   `installChunkReloadGuard(window);`.

7. [ ] **e2e** `e2e/chunk-reload.spec.ts`. It needs no login and no fixture account.
   - `page.goto("/login")`, then wait for the heading.
   - `page.evaluate(() => { window.__kaleemProbe = 1 })`.
   - `page.route("**/assets/register-*.js", ...)` fulfils 404 the first time and continues
     after that, counting hits.
   - Click the "new to Kaleem" link.
   - `expect.poll(() => page.evaluate(() => window.__kaleemProbe)).toBeUndefined()`.
   - The register heading is visible, and the hit count is 1.
   - Time budget: under 10 s.
   - Before writing the glob, confirm in `dist/assets` that the register component chunk
     is named `register-*.js`. If two files match, make the route match only the lazy one
     (installing it after the `/login` load already excludes the modulepreloaded part).

8. [ ] **Mutation checks**, each red with the change reverted and green restored, quoted
   in the hand-back:
   - `autoCodeSplitting` removed: `pnpm build` fails on the budget;
   - `export` re-added on `LoginPage` in a route file: `route-exports.test.ts` fails;
   - the `main.tsx` install line removed: `chunk-reload.spec.ts` fails (run it in e2e
     slot 1 or 2, per runbook section 2);
   - the 10 s check removed: `chunk-reload.test.ts` fails.

9. [ ] **Full gate and hand-back.** Run `_tools/dashboard-gate.sh "${WT}"`: tsc, lint,
   `test:coverage --maxWorkers=6`, build with the budget, and the built-CSS check. Then run
   `_tools/gitleaks-range.sh "${WT}" origin/main..HEAD`, check that `vitest.config.ts`
   thresholds are untouched, and run the four hand-back checks in runbook section 3.
   Commit explicit paths as `perf(dashboard): split routes and enforce a bundle budget`,
   with tests in the same commits as their code.

## e2e (D3)

- **Two new flows:** `chunk-reload.spec.ts`: recovery from a missing chunk, and the installed guard reloading once without looping (see the spec's corrections).
- **Existing flows:** they cover every shipped area, run against `pnpm build`, and prove
  that every split route still loads. The suite stays green.
- **D3 row at close-out:** "dashboard — code splitting: 2 flows (stale-chunk recovery; the guard reloads once and never loops). It
  does not prove the Lighthouse score (staging, weekly dispatch) or a real blue-green
  switch."

## Risks

- **Splitting does not clear 0.95 three times out of three.** The probe cuts initial JS by
  33% but does not change transfer encoding. The fallback is compression in
  `dashboard/nginx.conf`, which another unit owns (spec, Out of scope); the conductor
  escalates it. The floor is never lowered.
- **A test relies on the page being exported from the route file.** Step 2 repoints the
  imports. `module-scaffolds.test.tsx` imports four pages.
- **Coverage moves.** The same functions move with the same tests, so it should not.
  Floors are not edited here (`dec-floor-ownership`); the conductor sets them from CI.
- **Route files shared with concurrent wave-1 units.** The programme lists only
  `vite.config.ts` as shared, but this unit moves code out of route files that other units
  edit:
  - `asm-ui-primitives` names `src/routes/design-preview.tsx` as a shared file, and
    `cur-file-upload-primitive` renders on that page too.
  - `lb-access-log-redaction` moves the email-confirm and reset keys into the URL
    fragment, so it will likely edit `verify-email.tsx` and `reset-password.tsx`.

  A text conflict there becomes a move conflict. The conductor either merges this unit
  first or, at freshness, re-applies the other unit's edit in the `-pages/` file. The
  step-1 guard test turns red if that edit lands back in the route file as an export.
- **Dev HMR with `autoCodeSplitting`.** Check `pnpm dev` once on one route edit. This is
  not a gate.

## Verification

- Steps 1, 3 and 5 are red before green. Step 8's four mutation checks are quoted.
- The full dashboard gate passes, and `routeTree.gen.ts` is unchanged.
- In CI, `dashboard-build` and `e2e` are green, and the e2e log names
  `chunk-reload.spec.ts`.
- After deploy (conductor): the agent Playwright pass on staging, with both themes, RTL
  and 320px, on every nav route. A `workflow_dispatch` of `lighthouse.yml` must read
  `app-staging` performance ≥ 0.95 in all three runs; record the three values in the
  close-out.
