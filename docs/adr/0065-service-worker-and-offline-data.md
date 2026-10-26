---
number: 0065
title: A service worker for the shell, and a small offline copy of the schedule
status: proposed
date: 2026-10-26
---

<!-- The number is allocated by the conductor. -->

## Context

The dashboard has a web app manifest (`rch-pwa-manifest-head`) and no service worker, so it cannot
open without a connection. Two things follow when a network drops: a person with the app installed
sees the browser's offline page, and `requireAuth` (`features/identity/require-auth.ts`) turns the
failed `/me` call into a redirect to `/login`, so a lost connection looks like a sign-out.

The owner decided (`rch-d-pwa-offline-scope`, 2026-10-26) that offline means the shell **and** the
signed-in person's schedule. That puts personal data, often a child's, on the device
(ADR-0023), so the policy is written down here rather than left to the code.

The initial JavaScript is on a byte budget (`scripts/check-bundle-budget.mjs`, 580,000 bytes) that
is nearly spent, which constrains where any of this can live.

## Decision

### 1. The worker answers the build's own files and nothing else

A hand-written worker (`src/sw/`), built into `dist/sw.js` by `scripts/sw-plugin.mjs`, answers
**same-origin `GET`s** only:

- a navigation goes to the network first and falls back to the cached `/index.html` **only when the
  fetch rejects** (an HTTP error is the server's answer, not an outage);
- a file in the build's precache list is served from the cache;
- a font under `/assets/` is cached on first use.

Every other request never reaches `respondWith`. That includes the whole API (a sibling subdomain,
ADR-0019, so cross-origin), every non-`GET`, anything under `/api/`, its own `/sw.js`, and the key
of the offline copy. WebSockets never reach a worker. **Nothing the API says is cached by the
worker**, and the React Query cache stays in memory with no persister.

Caches: `kaleem-shell-<build id>` (the build; other builds' shells are deleted on activate),
`kaleem-fonts-v1`, and `kaleem-offline-v1` (below; activate never touches it).

The worker is built by a separate, nested Vite library build (IIFE) in the plugin's `closeBundle`, not as a second Rollup input of the app build: an input would share modules with the app (the page and the worker both read `sw/mode` and `sw/policy`), shared modules become shared chunks, and a shared chunk is an `import`, which the worker must not have. The nested build also reads the precache list from `dist` as it really is, public files included. Measured: `caches` and workers are available on `http://app.kaleem.localhost` (a secure context), and neither `page.route` nor `context.route` sees the browser's update check of `sw.js`.

`scripts/check-sw.mjs` runs at the end of `pnpm build`: `sw.js` exists, is one file with no
`import`/`export`, lists `index.html` and every script the first page load needs, and mentions
no API path, URL or host.

### 2. Updates wait for the person, and never happen in a call

No `skipWaiting` on install. A waiting worker produces a polite, non-dismissing toast with
**Reload**; only the tab that tapped it reloads. While a `/_call` route is on screen the prompt is
held, and offered when the router leaves it. The page also checks for an update when a tab becomes
visible, at most hourly. Registration uses `updateViaCache: "none"`, and `nginx.conf` serves
`/sw.js` with `Cache-Control: no-cache` and the ADR-0056 header block.

### 3. The offline copy of the schedule

**What:** one record, `{ v, owner_id, owner_name, view, saved_at, lessons }`, built by
`lib/offline/schedule.ts` by **naming** fields, never spreading a server row. A lesson keeps
`id`, `starts_at`, `duration_minutes`, `status`, `subject_name`, `teacher_name`, `student_name`
and nothing else; anything the server adds later is dropped by default. Only lessons ending within
14 days of `saved_at` are kept. The owner's answers (2026-10-26): the teacher's and student's names
are kept; teachers' copies are included; 14 days for both look-ahead and maximum age; on by default
with no setting.

**Where:** Cache Storage, one entry under the same-origin key `/__offline/schedule` in
`kaleem-offline-v1`. IndexedDB was rejected (it needs a wrapper or a dependency, and
`deleteDatabase` can be blocked by a connection open in another tab, so a wipe would not be
immediate); `localStorage` was rejected (the kill-switch worker cannot reach it). Cache Storage gives
the page, the worker and the kill switch one wipe primitive. It is not encrypted; the device's own
protection applies, as for every browser store.

**Who writes it:** the page, never the worker, and only while a worker in mode `"on"` controls the
page and someone is signed in. Without a worker the app cannot open offline, so a copy would be data
kept for nothing.

**Wipes** (each unit-tested and mutation-checked; two proven end to end):

1. sign-out succeeded;
2. account deletion succeeded;
3. any API answer that says the session is gone: 401, or 403 with `error_code: "not_authenticated"`,
   through a response interceptor. A 403 `permission_denied` is a refusal and wipes nothing;
4. a different person turns out to be signed in;
5. the kill switch (both sides);
6. age: a copy more than 14 days old is deleted when read and never shown.

A save that was under way when a wipe happened takes its own write back.

**Shown** only on the offline screen, never mixed into a live page, labelled with whose copy it is
and when it was saved, with no control on any row. A cancelled lesson that has not yet happened is
shown as "Cancelled" (the live page files it under history; the offline list has no history, and
dropping it would leave a hole that reads as "this lesson is on").

**Residual risk, stated:** a device that is never opened again keeps its copy until the browser
clears site data; no web page can run code on a closed device. Expiry is enforced the next time the
app opens there.

### 4. Offline is not logged out

`requireAuth` throws `OfflineError` (never a redirect) when `navigator.onLine === false` or when
`/me` gets no HTTP response. Any HTTP answer keeps today's redirect to `/login`. `_authed` and
`_call` render the offline screen for it. In a page that was already open, mutations run with
`networkMode: "always"`, so a tap while offline fails at once instead of being queued and sent
unseen later (React Query's default).

### 5. The kill switch is the rollback

`src/sw/mode.ts` exports `SW_MODE`. `"off"` builds a worker that skips waiting, deletes **every**
`kaleem-*` cache (the offline copy included), unregisters itself and never navigates a client; the
page side unregisters, wipes and saves nothing. It ships through an ordinary deploy.
**A plain revert of this unit is not a rollback:** it would leave workers and saved copies on devices
with no page code left to remove them. The procedure is `docs/runbook/service-worker.md`.

### 6. Where the code lives, for the byte budget

Registration, the cache subscription, the update prompt, the offline screen and its text (a new
`offline` catalogue) are lazy chunks, loaded after `load` in a production build only. What is in the
entry: the `requireAuth` branch, `wipeOfflineData` (in `lib/api.ts`, deliberately, see below), the
interceptor, the mutation default and one dynamic import. Measured against `main`: **see
"Consequences"**.

## Consequences

- No new dependency, no migration, no backend change, no import-linter change.
- The previous release does not depend on a worker, so landing order is free.
- The first load after a deploy downloads about 1.1 MB once for the precache.
- `wipeOfflineData` lives in `lib/api.ts` and not in a file of its own. As a separate module it
  was imported by two chunks of the entry graph and the bundler split it into a chunk that a dozen
  route chunks then preloaded, which cost about 500 bytes of a budget with about 800 left. The
  cache name is pinned to `sw/policy.ts` by a test, because `api.ts` must stay importable under plain
  Node and may not import it.
- `RouteError` recognises the offline error by name rather than `instanceof` for the same reason.
- Initial JS grew by 1,914 bytes (577,306 on `main` at 45f80fa, 579,220 here), against a 1,000 byte
  target and a 580,000 byte budget. About 700 bytes are the unit's own code; the rest is the
  bundler splitting the new shared modules into extra chunks. The budget was not raised.
- Playwright cannot intercept a browser's service-worker update check, so the e2e "new build" is a
  changed `dist/sw.js` on disk (CI serves `dist/` through a bind mount), restored afterwards.
- The CSP stage of `rch-security-headers` must allow `worker-src 'self'`.

## Alternatives considered

**Workbox / `vite-plugin-pwa`.** A dependency change and far more machinery than these rules need;
the rules are the point, and a library's defaults (runtime caching of API calls, say) are exactly
what this policy forbids. Rejected.

**Shell only, no schedule.** The owner chose to keep the schedule.

**IndexedDB or `localStorage` for the copy.** See above.

**Persisting the React Query cache.** It would keep every response, not a named projection. Rejected.

**Letting the worker write the copy.** The worker would then see API responses. Keeping it away
from the API entirely is what makes "the worker never caches API data" checkable.

**Auto-updating (`skipWaiting` on install).** Replaces the page under a live lesson. Rejected.

## Not proven here

- Safari and iOS. This project has no Apple device; Playwright's WebKit on Linux is not iOS Safari.
  Nothing here claims they work; `rch-pwa-device-verification` owns that check.
- The browser's own `online` event: Playwright's offline emulation does not dispatch it into a page
  that loaded while offline, so retry-on-`online` is unit-tested only.
- Account deletion's wipe and the kill switch end to end (the first would consume a seeded account,
  the second is a build-time mode): unit tests and the runbook.
