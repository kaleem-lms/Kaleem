---
name: rch-dashboard-code-splitting
phase: v1 (wave 1, PWA & bundle stream)
modules: [dashboard routes]
status: built
created: 2026-10-18
closed: null
---

## Goal

The dashboard ships as one JavaScript chunk. At dashboard `origin/main` 8612523,
`pnpm build` emits `index-*.js` at **852.90 KB** (256.44 KB gzip) and prints Vite's
"chunks larger than 500 kB" warning. `ISSUES.md` (Lighthouse findings) records the cost:
`app-staging` performance measured 0.94 / 0.95 / 0.95 against a 0.95 floor in
`.lighthouserc.json`, so one run in three is already under it. The login page, which is
the only dashboard URL Lighthouse measures, downloads the code for every route, including
the call room and `/design-preview`.

This unit splits the bundle by route and adds a build-time bundle budget so the single
chunk cannot come back unnoticed. Splitting creates a new failure mode, a stale chunk
after a deploy, and the unit handles that too.

## What the code does today (measured, not assumed)

- `vite.config.ts` runs `TanStackRouterVite({ routeFileIgnorePattern })` without
  `autoCodeSplitting`. Router plugin 1.167.18, Vite 8.0.8 (Rolldown).
- **Turning on `autoCodeSplitting` alone barely helps.** In a probe build it produced 34
  chunks, but `index.html` still modulepreloaded about 795 KB, and no `login` chunk
  existed. The cause: 19 route files `export` their page component (`LoginPage`,
  `Account`, `RoomPage` and others), because their tests import it. The splitter cannot
  move an exported binding out of the route module, so those components stay on the
  critical path.
- **With the components moved out of the route files**, a probe build preloads 15 files:
  **570 KB raw / 182 KB gzip** of initial JS (-33%). The largest chunk is 292 KB. The
  shell (`_authed`, 48.7 KB), the call room (52.7 KB) and `/design-preview` are no longer
  loaded on `/login`. `routeTree.gen.ts` does not change.
- The router's generator ignores `-`-prefixed directories under `src/routes`. A probe
  confirmed that `src/routes/-pages/` and `src/routes/_authed/-pages/` leave
  `routeTree.gen.ts` byte-identical.
- `vitest.config.ts` does not load the router plugin, so unit tests import real modules.
  Splitting cannot change what a unit test sees.

## Decisions taken in this spec

- **Page components move to `-pages/` folders next to their routes.** Each of the 19 route
  files keeps only `Route`, along with its `beforeLoad`, `validateSearch` and the thin
  inline wrapper components (for example `AccountRoute`, `BillingRoute`). The page
  component and the helpers only it uses (`resolveViewerRole`, `Specimens`,
  `joinFailureMessageKey`) move to `src/routes/<dir>/-pages/<ComponentName>.tsx`
  unchanged. They do not go to `src/features/`: pages compose several features, and the
  dashboard rule is "no cross-feature imports". Tests stay where they are, and only their
  import paths change.
- **A guard test keeps route files from exporting anything but `Route`.** One exported
  page component quietly defeats splitting for that route, which is what happened here.
  A small regression like that stays under the budget, so the test catches it at the
  source. `__root.tsx` may also export its `RouterContext` type.
- **The budget is measured on raw (minified) bytes, not gzip.** Staging serves the JS
  uncompressed (see Out of scope), and parse cost follows raw size anyway. The script
  reports gzip only for information. There are two budgets:
  - **Initial JS:** the entry `<script>` plus every `modulepreload` in `dist/index.html`.
    It is set to the implementing build's measured value rounded up to the next 10 KB
    (the probe measured 570 KB).
  - **Any single JS chunk:** 500 KB, which is Vite's own warning threshold.
  Both are ratchets in the ADR-0026 sense: lowering one is normal, raising one needs an
  ADR. The script fails, rather than passing, if it finds no entry script.
- **The budget runs inside `pnpm build`** (`tsc && vite build && node
  scripts/check-bundle-budget.mjs`). That way CI's `dashboard-build` and `e2e` jobs, the
  local `dashboard-gate.sh` and the Docker build all enforce it with no `ci.yml` or
  `_tools` change. It takes milliseconds.
- **A stale chunk triggers one reload.** After a blue-green switch, an open tab that
  navigates asks for a hashed chunk the new container does not have (`nginx.conf` returns
  404 under `/assets/`). Vite's preload helper dispatches `vite:preloadError` on `window`,
  as verified in Vite 8.0.8's helper source. `src/lib/chunk-reload.ts` listens for it and
  reloads the page once. A `sessionStorage` timestamp stops a reload loop: there is no
  second reload within 10 s. If storage throws, it does not reload at all. The guard is
  installed in `main.tsx`.

## Corrections found while building (2026-10-18)

- **The router already reloads on a missing component chunk.** TanStack's
  `lazyRouteComponent` reloads once per distinct "Failed to fetch dynamically imported
  module" message (Chrome, Firefox and Safari wordings), keyed in `sessionStorage`. With
  the guard's install line removed, the stale-chunk e2e still passes. The guard is kept:
  it answers every `vite:preloadError` (for example a CSS preload failure, which the
  router does not match), it has a 10 s loop limit, and `rch-pwa-service-worker`
  inherits it. The e2e therefore has two flows: one proves the recovery in the real
  build, and one proves the guard itself is installed and does not loop (mutation-checked).
- **Measured budget.** Initial JS is 570,290 raw bytes in 16 files, so
  `INITIAL_JS_BUDGET` is 580,000. The probe's "15 files" was one short.
- **`RoomPage` uses `useParams({ from })`**, not `Route.useParams()`: importing `Route`
  back from the route module would be a cycle with the lazy chunk.

## User flow

There is no new feature. Users see the same pages. Two things differ:

1. Moving to a route that has not been visited yet fetches its chunk first. No pending
   UI is configured, and TanStack's `defaultPendingMs` is 1000 ms, so on a normal
   connection there is nothing new to see. `src` has no other dynamic `import()`.
2. A tab left open across a deploy reloads once when it next moves to an unvisited route,
   then shows that route. A call in progress is never interrupted: the room loads no
   chunks after it mounts, and the reload only fires on navigation.

Error case: if the chunk is still missing after the reload, the router's error boundary
shows, as it does for any failed route load today. There is no second reload.

## Data model delta / API delta

None. No backend change, no migration, no endpoint.

## Frontend

- `vite.config.ts`: `autoCodeSplitting: true`.
- 19 route files under `src/routes/`, where the page components move out to `-pages/`
  folders. The plan lists every file.
- New `scripts/check-bundle-budget.mjs` and its test. `package.json`'s `build` script
  changes.
- New `src/lib/chunk-reload.ts` and its test, and one line in `src/main.tsx`.
- New `src/routes/route-exports.test.ts`, the split guard.
- New e2e spec `e2e/chunk-reload.spec.ts`.
- No route paths, roles, API calls or visible states change. Done means an agent
  Playwright pass on staging (`dec-d9-substitute`) loads every nav route in both themes,
  in Arabic RTL and at 320px. In the Lighthouse run the conductor dispatches after the
  deploy, `app-staging` performance must be ≥ 0.95 in all three runs.

## Module boundaries

Dashboard only. There are no backend modules, contracts or events. `-pages/` files import
from features exactly as the route files do now, so no new cross-feature import appears.

## Personal data (ADR-0023)

None. The reload guard stores one timestamp in `sessionStorage`, under the key
`kaleem-chunk-reload-at`. It identifies no one and clears when the tab closes.

## Expand/contract

This is safe in the blue-green window. Tabs on today's single-chunk bundle make no lazy
loads, so the first deploy of this change cannot strand them. The stale-chunk case only
exists from the second split deploy on, and the reload guard ships in the same release
that creates it. No API or cookie changes.

## Out of scope

- **Compression.** Staging serves the JS uncompressed. On 2026-10-18,
  `GET /assets/index-D2tRKJKL.js` with `Accept-Encoding: gzip, br` returned
  `content-length: 852921` with no `content-encoding`. gzip would cut the transfer by
  about 70% on its own. It belongs in `dashboard/nginx.conf`, which wave-1 units
  `lb-access-log-redaction` and `rch-security-headers` own, so this unit does not touch it.
  The conductor logs it in `ISSUES.md` and routes it. If splitting alone does not reach
  0.95 in three of three runs, this is the next lever, not a looser floor.
- Lazy-loading the non-active locale (about 54 KB of JSON in the entry), splitting the
  `@/ui` barrel, and `defaultPreload: "intent"`.
- Raising the Lighthouse performance floor above 0.95, and per-URL assertions
  (`rch-mkt-seo-infra`).
- Service-worker precaching (`rch-pwa-service-worker`, wave 2), which inherits the reload
  guard.

## Test plan

1. **Budget script** (`scripts/check-bundle-budget.test.mjs`). Fixture `index.html`
   strings check that:
   - the entry script and modulepreloads are counted, and stylesheets and fonts are not;
   - an initial total over budget is reported;
   - a single chunk over 500 KB is reported;
   - an `index.html` with no module entry is an error, not a pass.
2. **Reload guard** (`src/lib/chunk-reload.test.ts`):
   - the first `vite:preloadError` reloads;
   - a second error within 10 s does not;
   - an error after 10 s reloads again;
   - storage that throws means no reload;
   - the guard does nothing for unrelated events.
3. **Split guard** (`src/routes/route-exports.test.ts`): every non-test file in
   `src/routes` exports only `Route`, plus `RouterContext` in `__root.tsx`. It is red on
   `origin/main` (19 offenders).
4. **Existing unit tests** pass unchanged except for import paths. Coverage does not drop,
   because the same lines move with the same tests.
5. **e2e** (`e2e/chunk-reload.spec.ts`, unauthenticated, no seeded account, about 5 s):
   - open `/login` and set a marker on `window`;
   - make the next `register-*.js` request return 404 once, then follow the link to
     register;
   - assert the marker is gone (the page reloaded) and the register page renders;
   - assert the route was hit exactly once.
   This is the only check that Rolldown's real build fires `vite:preloadError`, which no
   jsdom test can show. The rest of the e2e suite (every shipped flow, against
   `pnpm build`) proves that every split route still loads.
6. **Mutation checks:**
   - revert `autoCodeSplitting`: the budget turns red;
   - re-export one page component: the split guard turns red;
   - delete the guard's install line in `main.tsx`: the e2e turns red;
   - drop the loop check: the unit test turns red.

## Open questions

None. No owner decision applies (`decision_ids: []`).
