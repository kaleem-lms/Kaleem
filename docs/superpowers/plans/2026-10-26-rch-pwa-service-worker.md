---
spec: docs/superpowers/specs/2026-10-26-rch-pwa-service-worker-design.md
status: approved
---

Size L, about four days. The owner approved the spec and answered its questions on 2026-10-26 (all as recommended). Dashboard work on
`feat/rch-pwa-service-worker` in
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-pwa-service-worker` (runbook §1),
then `pnpm install --frozen-lockfile`. Meta work (ADR, runbook, arch doc, D3 row, ISSUES line)
in `/home/abdulkhalek/Projects/kaleem-worktrees/meta-rch-pwa-service-worker`.

No dependency change, no migration, no backend change, no coverage-floor edit
(`dec-floor-ownership`). Serialization points for the conductor: `nginx.conf` and
`vite.config.ts` (listed), plus `src/main.tsx` and `src/lib/api.ts` (not listed: check
`rch-dashboard-code-splitting` and `rch-security-headers`), and `features/identity/queries.ts`
with `lb-gdpr-erasure` (whichever lands second adds the wipe to `useDeleteAccount`).

## Files

| File | Change |
| --- | --- |
| `src/sw/policy.ts`, `worker.ts`, `kill.ts`, `mode.ts`, `entry.ts` (+ tests) | new: the worker, as in the shell-only draft; activate keeps `kaleem-offline-v1` |
| `src/lib/offline/projection.ts` (+ test) | new: `toOfflineSchedule(me, sessions, now)` keeps the named fields only |
| `src/lib/offline/store.ts` (+ test) | new: `saveSchedule`, `readSchedule(now)` (age and ended-lesson filter, owner check) on `kaleem-offline-v1` |
| `src/lib/offline/wipe.ts` (+ test) | new: `wipeOfflineData()`, no `@/` imports (imported by `lib/api.ts`) |
| `src/lib/sw/register.ts` (+ test) | new: lazy registration, prompt, call hold, visibility check, the query-cache subscription that saves and switch-wipes |
| `src/lib/api.ts` (+ test) | response interceptor: wipe on 401 or 403 `not_authenticated` |
| `src/features/identity/require-auth.ts` (+ test) | `OfflineError` on no response or `navigator.onLine === false` |
| `src/features/identity/queries.ts` (+ test) | `useLogout` (and `useDeleteAccount` if landed) wipe on success |
| `src/features/shell/OfflineScreen.tsx` (+ test) | new: offline message, saved schedule, Try again |
| `src/routes/_authed.tsx`, `src/routes/_call.tsx` | `errorComponent` |
| `src/ui/toast.tsx` (+ test) | optional `duration` |
| `src/main.tsx` | `mutations: { networkMode: "always" }`; dynamic import of the registration after `load` (prod) |
| `src/lib/i18n-namespaces.ts` (+ test), `src/locales/{en,ar}/offline.json` | new `offline` catalogue |
| `vite.config.ts`, `scripts/check-sw.mjs` (+ `.test.mjs`), `package.json` `build` | worker build, manifest injection, build check |
| `nginx.conf`, `e2e/security-headers.spec.ts` | `location = /sw.js` |
| `playwright.config.ts`, `e2e/pwa.spec.ts` | `serviceWorkers: "block"`; the new flows |
| meta: `docs/adr/NNNN-service-worker-and-offline-data.md` | new, number from the conductor |
| meta: `docs/runbook/service-worker.md`, `docs/architecture/overview.md`, `CLAUDE.md` D3, `ISSUES.md` | kill switch and rollback; worker section; PWA row; privacy-notice follow-up |

## Steps

1. [ ] **Spike (before any test).** Build `src/sw/entry.ts` as a second Rollup input named
   `sw.js`; record that it has no `import`, is not in `dist/index.html`, and the budget line
   is unchanged (fallback: build it in `closeBundle` with Vite's library mode). In a
   throwaway spec, measure (a) whether `context.route("**/sw.js")` reaches Chromium's update
   check (decides e2e flow 4) and (b) that `caches` and a worker are available on
   `http://app.kaleem.localhost` in CI's topology (a secure context). Record both in the PR.
2. [ ] **Worker, red then green.** `policy.test.ts`, `worker.test.ts`, `kill.test.ts` with a
   fake scope (listeners, `caches`, `fetch`, `clients`): the spec's worker and kill cases.
   Mutation-checks: let `handled` accept cross-origin (API case red); add a
   `clients.navigate` to kill mode (red); let activate delete `kaleem-offline-v1` (red).
3. [ ] **Projection, red then green.** `projection.test.ts`: a row carrying every current
   field plus an unknown one yields exactly the seven keys (asserted with `Object.keys`, so a
   spread fails); 14-day cut-off; `view` from `resolveViewerRole`. Mutation-check: replace
   the named pick with a spread, see red.
4. [ ] **Store and wipe, red then green.** `store.test.ts` and `wipe.test.ts` with a fake
   `caches`: no save without a controller or `me`; save then read round-trips; a 15-day-old
   copy is deleted and `null`; ended lessons filtered; a different owner id is never
   returned. Mutation-check: drop the age check, see red.
5. [ ] **Wipe triggers, red then green.** `api.test.ts`: the interceptor wipes on 401 and 403
   `not_authenticated`, not on 403 `permission_denied`, 404, 500 or no response, and still
   rejects with the original error. `queries.test.tsx`: `useLogout` (and `useDeleteAccount`)
   success wipes. `register.test.ts`: a `["me"]` update with another id wipes before the next
   save. Mutation-check each: remove the call, see red.
6. [ ] **`requireAuth`, red then green.** 401, 403 and 500 still redirect; no response and
   `navigator.onLine === false` throw `OfflineError`. Mutation-check: restore the bare
   `catch`, see red.
7. [ ] **`OfflineScreen`, catalogue and toast, red then green.** en and ar, with and without a
   copy, the "Saved for … / Saved …" lines, no button inside the list, heading focused, retry
   on click and `online`, jest-axe clean; `i18n-namespaces.test.ts` still forbids a static
   import; `toast({ duration: Infinity })` survives 5 s. Wire both `errorComponent`s.
8. [ ] **Registration and offline mutations, red then green.** `register.test.ts` with a fake
   `navigator.serviceWorker` and a real `QueryClient`: the spec's registration cases; a
   `["sessions"]` success saves only under a controller; `"off"` wipes and unregisters. A
   `main`-shaped client test: with `onlineManager.setOnline(false)` a mutation rejects instead
   of pausing (mutation-check: drop the option, see it pause). Then `main.tsx`.
9. [ ] **Build check, red then green.** `check-sw.test.mjs` on fixture `dist` folders (no
   `sw.js`; an `import`; a missing initial script; an API-base or `/api/` entry), then the
   plugin and the script. `pnpm build` passes budget and check.
10. [ ] **Bundle measurement.** Initial JS within 1 KB of main's; both numbers in the PR. Over:
    stop and escalate, never raise the budget.
11. [ ] **nginx, red then green.** `/sw.js` in `security-headers.spec.ts` (header block, a
    JavaScript type, `no-cache`; red today: the SPA fallback answers `text/html`), then the
    location.
12. [ ] **`e2e/pwa.spec.ts`, red then green.** The spec's flows with one seeded student who has
    lessons (`seed_e2e_matching`; the conductor allocates it, used read-only but for its own
    sign-out). Set `serviceWorkers: "block"` and run the whole suite in an e2e slot (runbook
    §2). Mutation-checks: flow 1 against step 6 reverted (expect `/login`); flow 3 against the
    `useLogout` wipe removed (expect the copy to survive).
13. [ ] **Meta docs.** ADR "Service worker and offline data" (hand-written worker, the rules,
    Cache Storage over IndexedDB, the field list, the wipes, the kill switch as the rollback),
    the runbook, the architecture section, the D3 row (what the flows prove; deletion wipe and
    kill switch unit-only; nothing on Safari/iOS), and an `ISSUES.md` line for the
    privacy-notice sentence.
14. [ ] **Gates and hand-back.** Full `dashboard-gate.sh <WT>`; merge `origin/main` (never
    rebase) and re-run; `gitleaks-range.sh`; runbook §3 checks.

## Gates

`/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh <WT> <test>` in the TDD
loop; the full gate (tsc, lint, `test:coverage --maxWorkers=6`, build with budget and
`check-sw`, colours) before hand-back. e2e locally in slot 1 or 2; CI is the authority. Time
budget: about 60 s for `pwa.spec.ts`, inside the suite's 9 minutes.

## Risks

- **A child's data left on a device.** Named-field projection (step 3 test fails on a
  spread), six wipe triggers each unit-tested and mutation-checked, a 14-day ceiling, no copy
  without a worker. Residual, stated in the spec: a device never opened again keeps it until
  the browser clears it.
- **A wipe missed on a path not listed.** Every path to "not signed in" passes through an API
  answer (wipe 3) or sign-out/deletion; the e2e proves two of them end to end.
- **The worker serves a broken shell.** Network-first navigation and the kill switch; the
  runbook is written before merge.
- **Initial bundle over 580 KB.** Everything but the guard, wipe, interceptor and option is
  lazy; measured in step 10; escalate if over.
- **`networkMode: "always"` changes app-wide mutation behaviour.** Offline taps now fail at
  once rather than firing later; the full unit suite and e2e show whether anything relied on
  pausing.
- **Vite 8 will not emit an import-free fixed-name worker.** Fallback in step 1; both fail:
  escalate (a dependency is scope growth).
- **The update e2e cannot be driven.** Unit tests only; the D3 row says so.
- **CSP blocks the worker** if `rch-security-headers` omits it; the conductor holds the two.
- **Collision with `lb-gdpr-erasure` and other `main.tsx`/`api.ts` units.** Merge
  `origin/main` before hand-back; the second to land adds the deletion wipe.
- **Safari/iOS.** Not verifiable here; stated, not claimed.

## Verification

Every step red before green; the named mutation checks repeated by the reviewer. Then the
full gate, CI's e2e with `pwa.spec.ts` in its log, and the staging click-through
(`dec-d9-substitute`): load the schedule, go offline in DevTools, reload, see the offline
screen with the saved lessons in both themes, Arabic RTL and 320px; inspect Cache Storage
(only app-origin URLs; the offline entry has the named fields only); sign out and see the
entry gone; after the next staging deploy see the prompt outside a call and not inside one.
Real-device installs stay with `rch-pwa-device-verification`.
