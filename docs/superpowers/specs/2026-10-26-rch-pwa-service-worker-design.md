---
name: rch-pwa-service-worker
phase: v1 (wave 2, PWA stream)
modules: [dashboard main.tsx, dashboard require-auth, dashboard lib/api, dashboard nginx.conf, dashboard vite.config.ts]
status: approved
approved: 2026-10-26
created: 2026-10-26
closed: null
---

> **Approved by the owner on 2026-10-26** (`dec-spec-approval`): it keeps a copy of personal
> data, often a child's, on the device. The owner's answers to the product questions are
> recorded at the end.

## Goal

The dashboard has a web app manifest (`rch-pwa-manifest-head`, landed) and no service worker.
This unit adds one, with five properties:

1. **The shell works offline.** The static build (HTML, JS, CSS, icons, fonts) is cached.
2. **The schedule stays readable offline.** The signed-in person's upcoming lessons are kept
   on the device as a small, read-only copy with named fields only, labelled with when it was
   saved, and wiped whenever that person stops being the one signed in.
3. **Nothing else from the API is kept.** The worker never answers an API request; the only
   API-derived data on the device is the schedule copy the page writes itself.
4. **Updates on the user's word only**, never during a call.
5. **Offline is not logged out**, and **a kill switch** retires the worker and wipes
   everything it and the page stored, through an ordinary deploy.

Decisions: `rch-d-pwa-offline-scope` (answered 2026-10-26: shell **and** the schedule).
Process: `dec-spec-approval`, `dec-floor-ownership`, `rch-d-security-disclosure`. Owner
constraints: the initial JS (577 KB of a 580 KB budget) must not grow beyond the 1 KB below;
WCAG 2.2 AA and full RTL. Push is out of scope (VAPID deferred).

## What the code does today (dashboard `origin/main` 80e4290, backend `origin/main` 4fecfaf)

- `src/features/identity/require-auth.ts:12-20`: `requireAuth` awaits `ensureAuthed`
  (`qc.ensureQueryData(meQueryOptions)`, `retry: false`) and turns **every** rejection into
  `redirect({ to: "/login" })`, so a network failure looks like a sign-out. `_authed.tsx` and
  `_call.tsx` use it; neither has an `errorComponent`.
- The API answers a request without a valid session with **403** and
  `error_code: "not_authenticated"` (`SessionAuthentication`; `kaleem/platform/drf.py`,
  `test_me_requires_auth`), not 401. The session lifetime is Django's default, 14 days (no
  `SESSION_COOKIE_AGE` is set).
- `GET scheduling/sessions/` returns every session the caller may see that has not ended, in
  any status (`services.upcoming_sessions`): a parent gets each linked child's lessons, a
  teacher every student's. The dashboard keeps it in memory under `["sessions"]`
  (`features/booking/queries.ts`), read by `SessionList`, `CallRoom` and `CallStatus`. No
  query is persisted anywhere today.
- `useLogout` (`features/identity/queries.ts`) calls `qc.clear()` and `AppShell` then
  navigates to `/login`. `lb-gdpr-erasure` (on its branch, not yet on main) adds
  `useDeleteAccount` with the same `qc.clear()` and `POST identity/me/delete/`. Data export
  (`POST identity/me/export/`) is on main.
- `main.tsx` builds a bare `new QueryClient()`. React Query 5.99's default `networkMode` is
  `"online"` for mutations too: a mutation started offline is **paused and sent when the
  browser comes back online** (`query-core` `retryer.ts`, `resumePausedMutations`). So today
  a Cancel tapped offline can cancel the lesson later, unseen.
- `src/lib/api.ts` has a request interceptor and no response interceptor, and must stay
  importable under plain Node (no `@/` imports; it says why).
- `vite.config.ts` uses `autoCodeSplitting`, so a route's `errorComponent` is its own chunk.
  `src/lib/i18n-namespaces.ts` loads feature catalogues on demand; `common.json` is in the
  entry chunk.
- `nginx.conf`: three locations, each repeating the ADR-0056 header block.
  `scripts/check-bundle-budget.mjs` ends `pnpm build`: initial JS ≤ 580,000 bytes.
- `playwright.config.ts` sets no `serviceWorkers` option; `chunk-reload.spec.ts` and
  `availability.spec.ts` use `page.route`, which does not see requests a worker answers.

## Decisions taken in this spec

**The worker (unchanged from the shell-only draft).**

- **Hand-written, no new dependency.** `src/sw/` holds plain TypeScript with no runtime
  imports. A small Vite plugin builds it as `dist/sw.js` (fixed name, never hashed) and injects
  the precache list and a build id. Workbox was rejected: a dependency change and far more
  than these rules need. The ADR records it.
- **It handles only same-origin `GET`s.** Cross-origin requests (the whole API, ADR-0019) and
  every non-`GET` never reach `respondWith`, and WebSockets never reach a worker. Navigations
  go network first, falling back to the cached `/index.html` only when the fetch rejects.
  Precached build files are served cache first; fonts are cached on first use. Caches:
  `kaleem-shell-<build id>` and `kaleem-fonts-v1`; activate deletes other `kaleem-shell-*`.
- **Updates wait for the user.** No `skipWaiting` on install. A waiting worker produces a
  polite toast, "A new version of kaleem is ready", with **Reload** and no auto-dismiss (a new
  optional `duration` on `toast()`). Only the tab that tapped reloads. On any `/_call` route
  the prompt is held until the user leaves the call. The page also checks for an update when
  the tab becomes visible, at most hourly.
- **Kill switch.** `src/sw/mode.ts` exports `SW_MODE: "on" | "off"`. `"off"` builds a worker
  that skips waiting, deletes **every** `kaleem-*` cache (the schedule copy included),
  unregisters, and never navigates a client; the page side unregisters, wipes, and saves
  nothing. A one-line PR and a normal deploy; `docs/runbook/service-worker.md` says how.
- **nginx.** `location = /sw.js`: `Cache-Control: no-cache`, `try_files $uri =404`, the
  ADR-0056 block. Registration uses `updateViaCache: "none"`. The CSP stage of
  `rch-security-headers` must allow a same-origin worker (serialization point `nginx.conf`).
- No worker in `vite dev`. `playwright.config.ts` sets `serviceWorkers: "block"`; only
  `e2e/pwa.spec.ts` allows them.

**The offline schedule (new).**

- **Exactly what is kept.** One record: `{ v: 1, owner_id, owner_name, view, saved_at,
  lessons }`. `owner_id` and `owner_name` are the signed-in user's `id` and `full_name`; `view`
  is the display role `resolveViewerRole` already computes (`parent | teacher | student`);
  `saved_at` is an ISO instant. Each lesson keeps **only** `id`, `starts_at`,
  `duration_minutes`, `status`, `subject_name`, `teacher_name`, `student_name`. Dropped:
  `may_cancel`, `cancellation_refunds`, `can_join_at`, `may_join`, `may_complete`, `outcome`
  and anything the server adds later (the projection names fields; it never spreads).
  Only lessons ending within 14 days of `saved_at` are kept. Nothing from messages, reports,
  billing, profiles, children's details, availability, curriculum or the call is kept.
- **Where: Cache Storage**, one entry in the cache `kaleem-offline-v1`, under the fixed key
  `/__offline/schedule` (a same-origin key no server route serves and the worker never
  answers), body = the JSON record. Why not IndexedDB: it needs a wrapper or a dependency,
  and `deleteDatabase` can be blocked by a connection open in another tab, so a wipe would not
  be immediate. Why not `localStorage`: the kill-switch worker cannot reach it. Cache Storage
  gives the page, the worker and the kill switch one wipe primitive, `caches.delete`.
  It is not encrypted; the device's own protection is what applies (as for every browser
  store).
- **Who writes it: the page, never the worker.** The lazily loaded registration module
  subscribes to the React Query cache. When `["sessions"]` succeeds it writes the projection,
  but only if (a) a worker in `"on"` mode controls the page, and (b) `["me"]` holds a user.
  No worker (Safari without support, blocked, dev) means no copy: without a worker the app
  cannot open offline, so a copy would be data kept for nothing.
- **Every other API response stays uncached.** The worker never sees API requests; the
  React Query cache stays in memory with no persister; the export download and every
  mutation are `POST`s to the API origin. A build check and an e2e flow prove it.
- **Wipes.** `wipeOfflineData()` deletes `kaleem-offline-v1`. It runs:
  1. on **sign-out** success (`useLogout`);
  2. on **account deletion** success (`useDeleteAccount`, whichever of this unit and
     `lb-gdpr-erasure` lands second adds the call);
  3. on **any API answer that says the session is gone**: HTTP 401, or 403 with
     `error_code: "not_authenticated"`, through a response interceptor in `lib/api.ts`.
     A 403 `permission_denied` is a refusal, not a sign-out, and wipes nothing;
  4. on an **account switch**: when `["me"]` holds a user whose id differs from `owner_id`,
     the copy is wiped before anything is saved or shown;
  5. through the **kill switch** (both sides);
  6. on **age**: a copy whose `saved_at` is more than 14 days old (the session lifetime) is
     deleted when read, and never shown.
- **How a stale copy is shown.** Only on the offline screen, never mixed into a live page.
  Heading "Your upcoming lessons", a line "Saved <date, time in the browser zone>. Changes
  since then are not shown." and the zone, as the schedule page shows it. Lessons that have
  ended (the same `hasEnded` rule as `SessionList`) are filtered out at read. Rows show day,
  time, length, subject, the names the live page shows for that `view`, and "Cancelled" where
  it applies. **No row has a control.** The screen says "You can't book, cancel or join a
  lesson while offline."
- **Nothing can be booked, cancelled or joined offline.** The offline screen has no actions
  but **Try again**. In a page that was already open, `main.tsx` sets
  `mutations: { networkMode: "always" }`, so a tap while offline fails at once with the
  existing error message instead of being queued and sent later.
- **Offline detection.** `requireAuth` throws `OfflineError` (never a redirect) when
  `navigator.onLine === false`, or when `/me` fails with no HTTP response. Any HTTP answer
  keeps today's redirect to `/login`. `_authed` and `_call` render `OfflineScreen` for an
  `OfflineError` and the router's default for anything else. The screen retries on **Try
  again** and on the window `online` event, and moves focus to its heading.
- **A shared or family device.** The copy belongs to the browser profile's signed-in
  session, so it shows exactly what that session shows online, no more: a parent's copy has
  the lessons of each linked child, a child's has their own. When the parent signs out, the
  copy goes; when the child then signs in, theirs is saved and the parent's is not there to
  see. A parent who leaves themselves signed in and hands over the device has handed over the
  session, which already shows far more online. The offline screen names whose copy it is
  ("Saved for <owner_name>"), so nobody mistakes one person's lessons for another's.
  Private windows lose the copy when they close. Two people who each want their own copy use
  separate browser profiles; the help text does not need to say so in v1.
- **Initial bundle.** Registration, the subscription, the prompt, the offline screen and its
  text (a new `offline` feature catalogue) all load lazily: `main.tsx` imports
  `@/lib/sw/register` after `load`, in production only. Initial additions: the `requireAuth`
  branch, `wipeOfflineData` and the interceptor in `lib/api.ts`, the `networkMode` default and
  the dynamic import. Target ≤ 1 KB, measured. Over budget: escalate, never raise it.

## User flow

1. Signed in and online: nothing visible changes. The worker precaches the shell (about
   1.1 MB, once per deploy). Each time the schedule loads, the copy is refreshed.
2. **Opening the app offline:** the shell loads; the offline screen shows "You're offline",
   then the saved schedule with its "Saved …" line and the no-actions sentence, or, with no
   copy, just the offline message. Back online, it retries and the asked-for page renders.
3. **Going offline inside the app:** the next navigation shows the offline screen. A tap on
   Cancel, Book or Join in a page already open fails at once with its existing error.
4. **Sign-out, deletion, a session that expired or was ended elsewhere:** the copy is gone
   before the user next sees anything; `/login` follows as today.
5. **A deploy lands:** the Reload toast, never inside a call.
6. **Error case:** a precache download fails mid-install (the blue-green switch): the install
   fails as a whole, the previous worker (or none) stays, the browser retries later. Writing the
   copy fails (quota, private mode): nothing is shown and nothing breaks.

## Data model delta

None on the server; no migration. **Personal data on the device (ADR-0023):**

- **What:** the record above: the account holder's id and name; per upcoming lesson its
  time, length, status, subject, teacher's name and student's name (for a parent, the child's;
  for a teacher, each student's).
- **Why:** so the people a lesson is for can see when it is without a connection
  (`rch-d-pwa-offline-scope`).
- **How long:** until the first of: sign-out, account deletion, a "session gone" answer, a
  different person signing in, the kill switch, or 14 days after it was saved. A device that
  is never opened again keeps it until the browser clears site data: no web page can run code
  on a closed device. Expiry is enforced the next time the app opens there.
- **Who sees it:** whoever uses that browser profile, the same people who can use the
  signed-in session. It never leaves the device and is not on the server.

**Erasure (`lb-gdpr-erasure`).** The deleting device wipes at once (wipe 2). Every other
device of that person wipes on its next API request, which answers `not_authenticated`
(the erasure ends every session; wipe 3), or at age (wipe 6). A teacher's or parent's
erasure removes nothing from the other person's copy until that person's next online
schedule load replaces it. **Data export (`lb-gdpr-data-export`).** The export is built from
server records; the device copy is a subset of them and is not exported. The export download
is an API `POST` the worker never touches.

**Expand/contract.** Nothing in the previous release depends on a worker. But a plain
revert of this unit would leave the worker installed and the copy on devices with no page
code left to wipe it. So **the rollback of this unit is the kill switch, not a revert**:
ship `SW_MODE = "off"` first, and the runbook says so.

## API delta

None. The client reads the existing `GET scheduling/sessions/` and `error_code`.

## Frontend

- No new route. `OfflineScreen` (`src/features/shell/OfflineScreen.tsx`, a lazy chunk) is
  the `errorComponent` of `_authed` and `_call`, for all roles, with the saved schedule as a
  read-only list grouped by day like `SessionList`.
- States: offline with a copy, offline without one, retrying (`aria-busy`), back online.
- Copy in a new `offline` catalogue (en, ar), loaded by the screen and the prompt. Arabic goes
  to `hg-arabic-review` (holds closure, not the merge).
- Tokens-only styles, logical properties, 44px targets, the "Saved" line as text (not colour
  alone), RTL at 320px, times through the existing `Intl` formatting.

## Module boundaries

Dashboard only: `src/sw/`, `src/lib/sw/`, `src/lib/offline/` (projection, store, wipe),
`lib/api.ts`, `main.tsx`, `features/identity/{require-auth,queries}.ts`,
`features/shell/OfflineScreen.tsx`, `src/ui/toast.tsx`. No backend change, no import-linter
contract change. Shared files beyond the unit's list: `src/main.tsx`, `src/lib/api.ts`.

## Out of scope

- Push (its own unit; no `push` handler here). Install UI and real-device installs
  (`rch-pwa-device-verification`).
- Any other offline data: messages, reports, billing, profile, curriculum, availability.
  Offline booking or queued actions of any kind.
- The CSP itself, JS compression in `nginx.conf`, a privacy-notice sentence (see questions).
- **Safari and iOS: not verified.** This project has no Apple device; Playwright's WebKit on
  Linux is not iOS Safari. Nothing here claims they work; `rch-pwa-device-verification` owns
  that check.

## Test plan

Unit (vitest, written first):

- Worker: a cross-origin `GET` and a same-origin `POST` never reach `respondWith`;
  navigation network-first with the `/index.html` fallback only on rejection; precache and
  font rules; activate deletes old `kaleem-shell-*` only and never `kaleem-offline-v1`;
  `skipWaiting` only on `SKIP_WAITING`. Kill mode: deletes every `kaleem-*` cache,
  unregisters, navigates no client.
- Projection: a server row with extra and future fields yields exactly the seven named
  fields; lessons ending after 14 days are dropped; `view` and owner come from `me`.
- Store and wipes: no write without a controlling worker or without `me`; a different
  `me.id` wipes before saving; a copy older than 14 days is deleted on read and not
  returned; ended lessons are filtered on read; `useLogout` and `useDeleteAccount` success
  wipe; the interceptor wipes on 401 and on 403 `not_authenticated`, not on 403
  `permission_denied`, 404 or a network error.
- `requireAuth`: any HTTP status redirects as today; no response or `navigator.onLine`
  false throws `OfflineError`.
- `OfflineScreen`: en and ar, with and without a copy, the "Saved" line, no buttons in rows,
  focus on the heading, retry on click and on `online`, jest-axe clean.
- Registration: dev does not register; prod registers with `updateViaCache: "none"`; `"off"`
  unregisters and wipes; prompt held on `/_call`; only the tapping tab reloads; hourly throttle.
- `main.tsx`'s client: a mutation started while `onlineManager` is offline rejects instead
  of pausing.
- Build: `scripts/check-sw.mjs` asserts `dist/sw.js` exists, has no `import`, lists
  `index.html` and the initial scripts, and lists no URL on the API base or under `/api/`.

e2e (`e2e/pwa.spec.ts`, Chromium, workers allowed, a seeded student with lessons, about 60 s):

1. **Offline screen with the schedule.** Sign in, open the schedule, wait for the worker to
   control the page, go offline, reload: not `/login`; the offline screen, the "Saved" line
   and the seeded lesson, and no button but **Try again**. Online again, the page renders.
2. **Only the named fields, nothing from the API.** Every URL in every `kaleem-*` cache is on
   the app origin; `kaleem-offline-v1` holds one entry whose lesson keys are exactly the
   seven named.
3. **Wipes.** Sign out: `kaleem-offline-v1` is gone. Sign in again, load the schedule, clear
   the cookies, reload online: `/login`, and the copy is gone.
4. **Update prompt, never mid-call**, if the plan's spike shows Chromium lets a test serve a
   changed `sw.js`; otherwise unit tests only, and the D3 row says so.

Also: `security-headers.spec.ts` covers `/sw.js`; the rest of the suite passes with
`serviceWorkers: "block"`. Not in e2e: the deletion wipe (unit only; an e2e deletion would
consume a seeded account) and the kill switch (a build-time mode; unit tests and the runbook).

## Owner's answers (2026-10-26)

1. **Names in the copy: kept.** The teacher's and the student's names stay in the offline copy.
2. **Teachers: included.** A teacher's copy is kept like everyone else's.
3. **14 days** for both the look-ahead and the maximum age.
4. **On by default, no setting.** Sign-out is the control.
5. **Privacy notice:** the wording is legal text and the legal pass is deferred. This unit adds
   one `ISSUES.md` line and does not depend on it.
