---
name: rch-pwa-service-worker
phase: v1 (wave 2, PWA stream)
modules: [dashboard main.tsx, dashboard require-auth, dashboard nginx.conf, dashboard vite.config.ts]
status: draft
created: 2026-10-26
closed: null
---

> **Draft on an open decision.** `rch-d-pwa-offline-scope` ("What is cached offline?") is
> still open. This spec is written on its recommended answer, **Shell only**, so the owner can
> answer the decision and approve the spec together. Any other answer voids it.

## Goal

The dashboard has a web app manifest (`rch-pwa-manifest-head`, landed) and no service worker.
This unit adds one, with four properties:

1. **Shell only.** It caches the static build (HTML, JS, CSS, icons, fonts). It never caches
   an API response, so no lesson, child or account data is left in a shared device's storage.
2. **Updates on the user's word only.** A new version waits until the user taps "Reload", and
   the prompt is never shown during a call.
3. **Offline is not logged out.** `requireAuth` today redirects to `/login` on *any* error.
   Offline, it shows an offline screen instead.
4. **A kill switch** retires the worker from every browser through an ordinary deploy.

Decisions: `rch-d-pwa-offline-scope` (open, see above). Process: `dec-spec-approval`,
`dec-floor-ownership`, `rch-d-security-disclosure`. Owner constraints for this unit: the
initial JS budget (577 KB of 580 KB) must not grow because of the worker; WCAG 2.2 AA and
full RTL. Push is out of scope (see below).

## What the code does today (dashboard `origin/main` 80e4290)

- `src/features/identity/require-auth.ts:12-20`: `requireAuth` awaits `ensureAuthed`
  (`qc.ensureQueryData(meQueryOptions)`, `retry: false`) and turns **every** rejection into
  `redirect({ to: "/login" })`. A network failure (axios error with no `response`) therefore
  looks exactly like a 401. `_authed.tsx` and `_call.tsx` both use it; neither route has an
  `errorComponent`.
- `src/main.tsx` mounts the router and `installChunkReloadGuard(window)`; no service worker.
- `src/lib/api.ts`: the API is a **different origin** (`VITE_API_URL`, the `api-` subdomain,
  ADR-0019). allauth and the admin are on that origin too.
- `nginx.conf`: three locations (`/assets/` immutable, `= /site.webmanifest` no-cache, `/`
  no-cache with the SPA fallback), each repeating the ADR-0056 header block. No CSP yet; the
  CSP is a later stage of `rch-security-headers`.
- `scripts/check-bundle-budget.mjs` runs at the end of `pnpm build`: initial JS (entry plus
  `modulepreload`s in `dist/index.html`) ≤ 580,000 raw bytes; any chunk ≤ 500,000.
- A recent build emits 78 JS files (~973 KB raw), one CSS file (~85 KB), 43 `woff2` and
  40 `woff` font files (~1.5 MB together), 4 PNGs and the manifest.
- `src/ui/toast.tsx`: `toast({ description, action, type })` exists, with a fixed
  `duration={5000}`.
- The call is the `/_call/sessions/$sessionId/room` route (full-bleed, under `_call`).
- `playwright.config.ts` sets no `serviceWorkers` option. CI serves `dist/` with the shipped
  nginx image and `nginx.conf`. `e2e/chunk-reload.spec.ts` and `availability.spec.ts` use
  `page.route`, which does not see requests a service worker answers.

## Decisions taken in this spec

- **Hand-written worker, no new dependency.** `src/sw/` holds the worker as plain TypeScript
  with no imports at runtime. A small Vite plugin in `vite.config.ts` builds it as a second
  input emitted at the fixed path `dist/sw.js` (never hashed, so the browser's update check
  always finds it) and injects the precache list and a build id. Workbox
  (`vite-plugin-pwa`) was considered and rejected: a dependency change, an unproven Vite 8
  pairing, and far more than four rules need. The ADR records this.
- **What the worker handles.** Only same-origin `GET` requests. Everything else (the API
  origin, any `POST`) is never passed to `respondWith`, and the signaling WebSocket never
  reaches a worker at all, so the
  browser handles it as if no worker existed. This is the "never caches the API" rule, made
  structural rather than a URL list.
  - **Navigations:** network first. Offline (the fetch rejects), the cached `/index.html`.
    So an online user always gets the deployed shell, as today.
  - **Precached files:** `index.html`, every emitted JS and CSS file, the manifest and its
    icons, served cache first. They are content-hashed or tiny.
  - **Fonts:** cached on first use (cache first), not precached, because only a few of the
    83 files are ever used by one browser.
  - Any other same-origin `GET`: passed through, not cached.
  - Caches are named `kaleem-shell-<build id>` and `kaleem-fonts-v1`. On activate, every
    `kaleem-shell-*` other than the current one is deleted.
- **Updates wait for the user.** The worker never calls `skipWaiting` on install. When a new
  worker is waiting, the page shows a polite toast, "A new version of kaleem is ready", with a
  **Reload** action and no auto-dismiss (a new optional `duration` on `toast()`; the default
  stays 5000). Reload posts `SKIP_WAITING` to the waiting worker, and **only the tab that
  tapped** reloads on `controllerchange`. Another tab in a call sees the controller change and
  does nothing.
- **Never mid-call.** While any matched route is under `/_call`, the prompt is held and shown
  after the user leaves the call. Ignored, the update applies the next time every kaleem tab
  is closed, which is the browser's default.
- **Update checks.** The browser checks `sw.js` on each full load. The page also calls
  `registration.update()` when the tab becomes visible, at most once an hour.
- **Initial bundle: zero growth from the worker.** `main.tsx` registers after `load` through a
  dynamic `import("@/lib/sw/register")`, which is never a `modulepreload`. The prompt lives in
  that lazy chunk. The only initial-bundle additions are the offline branch in
  `requireAuth` and three strings per locale in `common.json`, measured in the plan with a
  1 KB target. If the budget check fails, the unit escalates; it does not raise the budget.
- **Offline is not logged out.** `requireAuth` redirects to `/login` only when the API
  *answered* (any HTTP status, as today). An axios error with no `response` throws an
  `OfflineError`, and `_authed` and `_call` render `OfflineScreen` as their `errorComponent`:
  a heading ("You're offline"), one sentence, and a **Try again** button that calls
  `router.invalidate()`. It also retries by itself on the window `online` event. Focus moves
  to the heading. Other errors keep the router's default error component.
- **Kill switch.** `src/sw/mode.ts` exports `SW_MODE: "on" | "off"`. With `"off"`, the build
  emits a `sw.js` that, on install, skips waiting; on activate, deletes every `kaleem-*` cache
  and unregisters itself; and has no fetch handler. It never navigates or reloads a client, so
  a lesson in progress is untouched. The page-side code with `"off"` unregisters instead of
  registering. Because the browser fetches `sw.js` from the network on every update check,
  bypassing the worker, this reaches browsers even when the old worker is broken. Pulling it
  is a one-line PR plus a normal deploy; `docs/runbook/service-worker.md` says how.
- **nginx.** `location = /sw.js` with `Cache-Control: no-cache`, `try_files $uri =404` and the
  ADR-0056 header block (the file's existing rule). The registration uses
  `updateViaCache: "none"`. `e2e/security-headers.spec.ts` gains `/sw.js`.
- **CSP (with `rch-security-headers`).** The CSP stage must allow a same-origin worker
  (`worker-src 'self'`, or a `script-src`/`default-src` of `'self'` it falls back to). The
  conductor holds the two units to this (serialization point: dashboard `nginx.conf`).
- **Development.** No worker in `vite dev` (registration only when `import.meta.env.PROD`), so
  HMR is unchanged.
- **Tests opt in.** `playwright.config.ts` sets `serviceWorkers: "block"` for the suite, and
  only the new `e2e/pwa.spec.ts` sets `"allow"`. Existing specs keep their `page.route` mocks
  and their meaning.

## User flow

1. A signed-in user loads the dashboard online. Nothing visible changes. In the background
   the worker installs and precaches the shell (about 1.1 MB raw, once per deploy).
2. **Offline, opening the app** (installed or a tab): the shell loads from cache. `/me` fails
   with no response, and the user sees the offline screen in their language and direction,
   not `/login`. Back online, the screen retries by itself or on **Try again**, and the page
   they asked for renders.
3. **Offline, already in the app:** pages that fetch show their existing error states. No
   cached data appears anywhere.
4. **A deploy lands while the app is open:** a toast offers **Reload**. Reload applies it.
   Dismissing or ignoring it changes nothing now.
5. **A deploy lands during a lesson:** no toast and no reload in the call tab, whatever other
   tabs do. The toast appears after the user leaves the call.
6. **Sign-out on a shared device:** nothing about the user remains in Cache Storage, because
   nothing about the user was ever put there.
7. **Error case:** a precache download fails mid-install (for example during the blue-green
   switch). The install fails as a whole, the previous worker (or none) stays in charge, and
   the browser retries on a later load.

## Data model delta / API delta

None. No backend change and no migration.

**Personal data (ADR-0023): none stored.** Cache Storage holds the public static build only.
The rule is enforced in code (cross-origin and non-`GET` requests never reach `respondWith`)
and proven in the browser (the e2e reads every cached URL). The React Query cache stays
in memory, as today; this unit adds no persister.

**Expand/contract.** The previous release has no worker, and nothing in it depends on one. A
browser on the new worker that is served the previous release (a rollback) keeps working:
navigations go to the network, and the old release's hashed files miss the cache and go to
the network too. A rollback leaves the worker installed but harmless; the kill switch removes
it.

## Frontend

- No new route. `OfflineScreen` (`src/features/shell/OfflineScreen.tsx`) is the
  `errorComponent` of `_authed` and `_call`, for all roles.
- States: offline (screen), retrying (button busy, `aria-busy`), back online (route renders).
- The update toast: `type: "background"` (polite), action **Reload**, no auto-dismiss.
- Copy (en and ar) in `common.json` under `offline.*` and `update.*`. Arabic copy goes to
  `hg-arabic-review`, which holds spec closure, not the merge.
- Tokens-only styles, logical properties, 44px targets, and RTL checked at 320px.

## Module boundaries

Dashboard only: `src/sw/` (the worker), `src/lib/sw/` (registration and the prompt),
`features/identity/require-auth.ts`, `features/shell/OfflineScreen.tsx`, `src/ui/toast.tsx`
(the optional `duration`). No backend module and no import-linter contract change.

## Out of scope

- **Push notifications.** The follow-up unit in `ISSUES.md` (VAPID keys are deferred to the
  setup-and-deployment step). This worker has no `push` handler; that unit adds one.
- Caching any API data or an offline schedule (other answers to `rch-d-pwa-offline-scope`).
- Offline behaviour of `/login` and the other public routes beyond loading the shell.
- Install prompts or install UI. Installing on real devices is `rch-pwa-device-verification`.
- Compression of JS in `nginx.conf` (an existing follow-up), and the CSP itself.
- **Safari and iOS.** Nothing here is verified on them: Playwright's WebKit on Linux is not
  iOS Safari, and no Apple-device check is part of this unit. Any such check belongs to
  `rch-pwa-device-verification`.

## Test plan

Unit (vitest, written first):

- Worker policy: a cross-origin `GET` (the API base) and a same-origin `POST` are never
  passed to `respondWith`. (WebSockets never reach a worker at all.) A navigation goes network first and falls back to
  the cached `/index.html` only when the fetch rejects. A precached asset is served from the
  cache. A font is cached on first use. Activate deletes old `kaleem-shell-*` caches only.
  Install does not call `skipWaiting`, and a `SKIP_WAITING` message does.
- Kill mode: install skips waiting; activate deletes `kaleem-*` caches and unregisters; there
  is no fetch handler, and no client is navigated.
- Registration: not registered in dev; registered with `updateViaCache: "none"` in prod; in
  `"off"` mode existing registrations are unregistered. A waiting worker shows the prompt; on
  a `/_call` route it is held until the route changes. Only the tab that tapped Reload reloads
  on `controllerchange`. The visibility update check is throttled to once an hour.
- `requireAuth`: a 401 (and any other HTTP status) still redirects to `/login`. A no-response
  error throws `OfflineError` and does not redirect.
- `OfflineScreen`: renders in en and ar, focuses its heading, retries on click and on
  `online`, and has no axe violations.
- Build: a `scripts/check-sw.mjs` step after the budget check asserts that `dist/sw.js`
  exists, has no `import` or `importScripts`, lists `index.html` and every initial script,
  and lists only relative same-origin paths: none containing the API base or `/api/`.

e2e (`e2e/pwa.spec.ts`, Chromium, service workers allowed; about 40 s added to the run):

1. **Offline screen.** Sign in, wait for the worker to control the page, go offline, reload:
   the offline screen shows and the URL is not `/login`. Back online, **Try again** renders
   the page.
2. **Nothing from the API cached.** After browsing signed in, every request URL in every
   `kaleem-*` cache is on the app origin and none is on the API origin.
3. **Update prompt, never mid-call.** A changed `sw.js` produces the prompt, and Reload
   applies it. On the room route no prompt appears until the user leaves. This flow depends
   on serving a changed `sw.js` from a test (`context.route`). The plan measures that first.
   If Chromium will not route the update fetch, the flow is covered by the unit tests only,
   and the D3 table says so.

Also: `security-headers.spec.ts` covers `/sw.js`; the existing suite passes with
`serviceWorkers: "block"`.

## Open questions

- `rch-d-pwa-offline-scope`: confirm **Shell only** (this spec's basis).
