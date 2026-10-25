---
spec: docs/superpowers/specs/2026-10-26-rch-pwa-service-worker-design.md
status: draft
---

Size L, about three days. Starts only after `rch-d-pwa-offline-scope` is answered and the spec
is approved. Dashboard work on `feat/rch-pwa-service-worker` in
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-pwa-service-worker` (runbook §1),
then `pnpm install --frozen-lockfile`. Meta work (ADR, runbook, arch doc, CLAUDE.md D3 row) in
`/home/abdulkhalek/Projects/kaleem-worktrees/meta-rch-pwa-service-worker`.

No dependency change, no migration, no backend change, no coverage floor edit
(`dec-floor-ownership`). `nginx.conf` is a serialization point: the conductor confirms no other
unit holds it before step 7.

## Files

| File | Change |
| --- | --- |
| `src/sw/policy.ts` (+ test) | new: pure request classification (`handled`, `strategy`) |
| `src/sw/worker.ts` (+ test) | new: `installWorker(scope, manifest)` wires install/activate/fetch/message on a scope object |
| `src/sw/kill.ts` (+ test) | new: the self-retiring worker |
| `src/sw/mode.ts` | new: `SW_MODE` (the kill switch) |
| `src/sw/entry.ts` | new: one call into `installWorker` or the kill worker with `self` and the injected manifest |
| `src/lib/sw/register.ts` (+ test) | new: lazy registration, update prompt, call hold, visibility check |
| `src/features/identity/require-auth.ts` (+ test) | `OfflineError` on a no-response failure |
| `src/features/shell/OfflineScreen.tsx` (+ test) | new |
| `src/routes/_authed.tsx`, `src/routes/_call.tsx` | `errorComponent` |
| `src/ui/toast.tsx` (+ test) | optional `duration` |
| `src/main.tsx` | dynamic import of the registration after `load` (prod only) |
| `src/locales/{en,ar}/common.json` | `offline.*`, `update.*` |
| `vite.config.ts` | the `sw` input, fixed `sw.js` name, manifest injection |
| `scripts/check-sw.mjs` (+ `.test.mjs`) | new: build check, run from `pnpm build` |
| `package.json` | `build` script appends `node scripts/check-sw.mjs` (no dependency change) |
| `nginx.conf` | `location = /sw.js` |
| `playwright.config.ts` | `serviceWorkers: "block"` |
| `e2e/pwa.spec.ts` | new |
| `e2e/security-headers.spec.ts` | add `/sw.js` |
| meta: `docs/adr/NNNN-service-worker-policy.md` | new (number from the conductor) |
| meta: `docs/runbook/service-worker.md` | new: the kill switch, step by step |
| meta: `docs/architecture/overview.md`, `CLAUDE.md` D3 table | PWA row and a short worker section |

## Steps

1. [ ] **Spike: the build shape (before any test).** In the worktree, add `src/sw/entry.ts` as a
   second Rollup input with `entryFileNames` mapping it to `sw.js`. Run `pnpm build`. Record:
   the output has no `import`, it is not in `dist/index.html`, and the budget line is
   unchanged. If Vite 8 shares a chunk with the worker or will not emit a fixed name, build the
   worker in the plugin's `closeBundle` with Vite's `build()` in library mode instead. Measure,
   in a throwaway spec, whether `context.route("**/sw.js")` serves a changed worker to
   Chromium's update check; that decides e2e flow 3. Record both results in the PR.
2. [ ] **Worker policy, red then green.** Write `src/sw/policy.test.ts` and
   `src/sw/worker.test.ts` with a fake scope (listeners map, fake `caches`, `fetch` and
   `clients`). The cases are the spec's "Worker policy" list. Then write `policy.ts` and
   `worker.ts`. Mutation-check: make `handled` accept cross-origin, see the API case go red.
3. [ ] **Kill worker, red then green.** `src/sw/kill.test.ts` (the spec's "Kill mode"
   cases), then `kill.ts`, `mode.ts`, `entry.ts`. Mutation-check: add a `clients.navigate`,
   see red.
4. [ ] **Build plugin and `check-sw.mjs`, red then green.** Write
   `scripts/check-sw.test.mjs` against fixture `dist` folders: a missing `sw.js`, an `import`
   in it, a list missing an initial script, and an entry containing the API base or `/api/`
   each fail. Then the plugin in `vite.config.ts` (injects the file list and a build id
   derived from it) and the script. `pnpm build` must pass budget and check.
5. [ ] **`requireAuth`, red then green.** In `require-auth.test.ts`: a 401 response
   redirects; a 500 response redirects (unchanged); an axios error without `response`
   throws `OfflineError` and no redirect. Mutation-check: revert to the bare `catch`, see the
   no-response case go red.
6. [ ] **`OfflineScreen` and `toast` duration, red then green.** Tests: en and ar render,
   heading focused, Try again calls `router.invalidate`, the `online` event retries, jest-axe
   clean; `toast({ duration: Infinity })` is not dismissed after 5 s while the default still
   is. Wire `errorComponent` on `_authed` and `_call`. Add the strings to both
   `common.json` files.
7. [ ] **Registration and prompt, red then green.** `src/lib/sw/register.test.ts` with a fake
   `navigator.serviceWorker`: the spec's "Registration" cases, including another tab's
   `controllerchange` not reloading this one and the hold on a `/_call` match. Then
   `register.ts` and the `main.tsx` dynamic import. Mutation-check: drop the call hold, see red.
8. [ ] **Bundle measurement.** `pnpm build`: the initial JS line must stay within 1 KB of
   main's (the `requireAuth` branch and the strings). Paste both numbers in the PR. Over the
   budget: stop and escalate; never raise it.
9. [ ] **nginx and headers e2e, red then green.** Add `/sw.js` to
   `security-headers.spec.ts`, asserting the header block plus a JavaScript media type and
   `Cache-Control: no-cache` (red: today the SPA fallback answers `text/html`). Then the
   location.
10. [ ] **`e2e/pwa.spec.ts`, red then green.** `test.use({ serviceWorkers: "allow" })`, one
    read-only seeded account from the conductor's allocation. Flows 1 and 2 as the spec
    describes, flow 3 if step 1 showed it can run. Set `serviceWorkers: "block"` in the config
    and run the whole suite locally in an e2e slot (runbook §2) to confirm nothing else moved.
    Mutation-check flow 1 against a build with step 5 reverted (expect `/login`).
11. [ ] **Meta docs.** ADR "Service worker policy" (hand-written vs Workbox, the four rules,
    the kill switch), `docs/runbook/service-worker.md`, a worker section in
    `docs/architecture/overview.md`, and the D3 table row stating exactly what the e2e proves,
    including "nothing on Safari/iOS".
12. [ ] **Gates and hand-back.** `dashboard-gate.sh <WT>` full; merge `origin/main` (never
    rebase) and re-run; `gitleaks-range.sh`; the runbook §3 checks and hand-back block.

## Gates

`/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh <WT> <test>` in the TDD
loop, and the full gate (tsc, lint, `test:coverage --maxWorkers=6`, build with budget and
`check-sw`, the colour check) before hand-back. e2e locally in slot 1 or 2; CI is the
authority. Time budget: about 40 s for `pwa.spec.ts`, within the suite's 9 minutes.

## Risks

- **The worker serves a broken shell to everyone.** Network-first navigation limits it to
  offline users, and the kill switch reaches every browser on its next update check. The
  runbook is written before merge.
- **Initial bundle over 580 KB.** Registration and the prompt are lazy; only the
  `requireAuth` branch and the strings are added. Measured in step 8; escalate if over.
- **Vite 8 will not emit an import-free fixed-name worker.** Fallback in step 1
  (`closeBundle` with library mode). Both fail: escalate (a dependency would be scope growth).
- **The update e2e cannot be driven.** Covered by unit tests, and the D3 row says so.
- **Existing specs change meaning under a worker.** `serviceWorkers: "block"` keeps every
  other spec as it is; step 10 runs the whole suite.
- **Blue-green switch mid-install.** `addAll` fails as a whole and the browser retries; no
  half-filled cache is ever used.
- **A tab in a call when another tab applies an update.** The call tab does not reload. Its
  next lazy chunk is fetched from the network, as without a worker, and the existing chunk
  reload guard applies as today.
- **CSP.** If `rch-security-headers`' CSP lands without allowing a same-origin worker,
  registration fails silently. Its spec and this one are held together by the conductor.
- **Safari/iOS.** Not verifiable here; stated in the spec and the D3 row, not claimed.

## Verification

Each step's tests go red before green, and the four named mutation checks are repeated by the
reviewer. The whole: the full dashboard gate, CI's e2e with `pwa.spec.ts` in its log, then
the staging click-through (`dec-d9-substitute`): install the worker, go offline in DevTools,
reload, see the offline screen in both themes, in Arabic RTL and at 320px; check Cache
Storage holds no API URL; after the next staging deploy, see the prompt outside a call and
not inside one. Real-device
install stays with `rch-pwa-device-verification`.
