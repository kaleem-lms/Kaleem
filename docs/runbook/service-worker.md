# Service worker runbook

The dashboard registers a service worker (`dashboard/src/sw/`, built into `dist/sw.js`). The policy
is ADR-0065. This page is for operating it.

## What a device holds

| Where | What | Removed by |
| --- | --- | --- |
| Cache `kaleem-shell-<build id>` | the build's own files (about 1.1 MB) | the next build's worker, or the kill switch |
| Cache `kaleem-fonts-v1` | fonts, after first use | the kill switch |
| Cache `kaleem-offline-v1` | one entry: the signed-in person's upcoming lessons (seven fields each, names kept), at most 14 days old | sign-out, account deletion, a "session gone" API answer, another person signing in, 14 days, the kill switch |

Nothing the API says is cached by the worker. Inspect it in DevTools, Application, Cache Storage: every
URL is on the app's own origin, and `kaleem-offline-v1` has one entry.

## Rolling back: the kill switch, never a revert

A plain revert of the unit leaves workers and saved copies on devices with no page code left to
remove them. To retire the feature:

1. Branch `fix/sw-kill-switch` off the dashboard trunk. In `src/sw/mode.ts` change
   `SW_MODE` from `"on"` to `"off"`. Nothing else.
2. PR, green CI, merge, deploy the normal way (blue-green; the meta pin follows the usual path).
3. A device picks it up on its next navigation (nginx sends `/sw.js` with `no-cache`; the browser
   also checks at least daily). The new worker installs at once, deletes every `kaleem-*` cache
   (the saved schedule included), unregisters itself, and never navigates the page. The page side
   unregisters any worker, deletes the same caches and saves nothing.
4. Verify on staging: DevTools, Application, Service Workers shows none after one reload, and Cache
   Storage has no `kaleem-*` entry.
5. Leave it off until the cause is fixed. Turning it back to `"on"` is a normal change.

A device that is never opened again keeps whatever it holds until the browser clears site data. That
is a property of the web, not of this feature.

## A bad build is installed on devices

The worker goes to the network first for every navigation and only falls back to the cached shell when
the network is unreachable, so a bad deploy is fixed by the next deploy like any other. If a worker
itself misbehaves, use the kill switch above.

## Updates

A new build produces a new `sw.js`. A device that has the worker sees a toast, "A new version of
kaleem is ready", with Reload; it never appears on a call screen and is offered when the person
leaves it. Nothing updates until they tap. A tab left open for days keeps the old build, and its
requests for files the new build removed come back 404; the stale-chunk guard
(`lib/chunk-reload.ts`) reloads it once.

## Things that must stay true

- `nginx.conf` serves `location = /sw.js` with `Cache-Control: no-cache` and the full security header
  block (`e2e/security-headers.spec.ts` checks it). A cached `sw.js` means a device cannot be updated or
  retired.
- The CSP (`rch-security-headers`) must allow `worker-src 'self'`.
- `scripts/check-sw.mjs` runs at the end of `pnpm build`; if it fails, the worker would have shipped
  with an import, a missing file, or an API path in it.

## Not verified on Safari or iOS

This project has no Apple device. Whether the worker and the offline copy behave on Safari or iOS is
checked by `rch-pwa-device-verification`, not here.
