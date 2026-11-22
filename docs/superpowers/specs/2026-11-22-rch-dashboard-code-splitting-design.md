---
name: rch-dashboard-code-splitting (round 2: entry headroom)
phase: v1 (wave 1, PWA & bundle stream)
modules: [dashboard routes, dashboard i18n]
status: draft
created: 2026-11-22
closed: null
---

Round 1 (`2026-10-18-rch-dashboard-code-splitting-design.md`, merged) split the bundle by
route and added the budget. This round makes room under that budget. It does not raise it.

## Goal

Initial JS (entry script plus every `modulepreload` in `dist/index.html`, measured by
`scripts/check-bundle-budget.mjs`) is at **579,631 of 580,000 bytes** on CI after
`rch-pwa-service-worker` and `fix/availability-load-race`, so 369 bytes are left. Staff,
earnings and analytics screens still have to land. Owner option (c) stands: per-feature
text catalogues that load on demand (`FEATURE_CATALOGUES` in `src/lib/i18n-namespaces.ts`).
This unit moves the text that only some authed routes show out of `common.json`, which is
in the entry, into lazy catalogues. The target is **at least 25,000 bytes of headroom** with
the budget left at 580,000.

## What the code does today (measured at dashboard `origin/main` 756146c)

- A local `vite build` measures initial JS at 579,807 bytes in 21 files. CI's line reads
  176 bytes lower (pnpm 10 / node 22 on CI, pnpm 12 / node 24 here). The **CI build line**
  is the number that counts.
- `common.json` is 19,313 bytes (en) and 28,822 bytes (ar). Rolldown places both, together
  with i18next, react-i18next, tailwind-merge and the `@/ui` primitives, in one shared
  chunk, `ui-*.js` (214.6 KB). The entry preloads that chunk.
- Of common's 19 top-level blocks, these are shown only by authed routes that can load a
  namespace in their `loader`. The file-to-page reachability was traced over the import
  graph. The byte sizes are en+ar.

  | Block | en+ar bytes | Shown on |
  | --- | --- | --- |
  | `booking` | 9,059 | `/schedule`; a few keys also in the call room and the offline screen |
  | `billing` | 7,276 | `/billing`; a few keys also in the shell's dunning banner and on Home |
  | `availability` | 5,276 | `/availability`, `/account`, `/schedule` |
  | `account` | 4,467 | `/account`; `account.locale.*` also from `AccountLocaleSync` in the authed shell |
  | `family` | 4,319 | `/family` |
  | `matching` | 2,574 | `/match-requests`, `/account` |
  | `subjects`, `teacherProfile` | 2,153 | `/account` |

- **Probe.** With those keys removed from both `common.json` files, a build measures initial
  JS at **549,922 bytes** (−29,885). `ui-*.js` drops to 184.7 KB. That build has no new
  loader code yet, which is expected to cost about 1 KB back.
- Today 0 shipped keys fail to resolve. A prototype of the guard below flagged 205
  references once `family` and `billing` were deleted from common, so it can detect the
  breakage this unit risks.

## Decisions taken in this spec

- **What moves, and where.** A key moves when every surface that shows it is a route that
  loads the namespace. A key stays in `common.json` when the shell, Home, the call room or
  the offline screen shows it. Those surfaces have no loader, and the offline screen may
  have no network.

  | Namespace | Takes | Stays in common | Loaded by |
  | --- | --- | --- | --- |
  | `booking` (new) | `booking.*` | `today`, `tomorrow`, `withStudent`, `withTeacher`, `joinNotOpen`, `joinUnavailable`, `joinError`, `timezoneNote`, `durationMinutes_*` | `/schedule` |
  | `billing` (new) | `billing.*` | `subtitle`, `dunningBannerLabel`, `recoveryPastDue`, `recoveryUnpaid`, `updatePaymentMethod`, `manageBilling`, `portalError` | `/billing` |
  | `availability` (new) | all of `availability.*` | none | `/availability`, `/account`, `/schedule` |
  | `family` (new) | all of `family.*` | none | `/family` |
  | `matching` (new) | all of `matching.*` | none | `/match-requests`, `/account` |
  | `account` (exists) | `account.*` at its root, `subjects.*` and `teacherProfile.*` under those two keys | `account.locale.*` | `/account` (already) |

  The residual lists are the measured starting point. The key guard has the final word: a
  key that turns out to be shown outside its routes stays in common.
- **Components follow the existing convention** (`docs/developer-guide/i18n.md`): a
  component that shows moved text calls `useTranslation(["<ns>", "common"])` and drops the
  block prefix only for the keys that moved. Residual keys keep their prefix and resolve
  through the `common` fallback in that array. Shared components that a no-loader surface
  renders (`ManageBillingButton`, `groupSessionsByDay`, the call room's pieces, the offline
  screen) keep `useTranslation()` and are left untouched.
- **Catalogue files are written by script.** The script parses each file, moves the keys
  and writes it back with tab indentation (guide rule 4). Text moves byte for byte. No
  English or Arabic string changes, so `hg-arabic-review` is not triggered.
- **A key-resolution guard** (`src/locales/key-usage.test.ts`) replaces "every key a shipped
  file names exists" as a reviewer's job. It applies two rules to shipped `src` (not tests):
  1. A closed string literal whose first segment is a common block or a feature
     namespace name (`"billing.title"`) must resolve in `en/common.json`.
  2. A literal first argument to a `t` bound by `useTranslation(X)`, aliases included and
     calls with an `ns:` option skipped, must resolve in one of X's namespaces (X empty
     means `common`).

  "Resolve" accepts a plural family (`_one`, `_other` and so on). Template keys (`${…}`) are
  not checked. The only one is `prefs.*`, which does not move.
- **The budget stays at 580,000.** Lowering a ratchet is allowed, not required, and the
  headroom is the point. The script's comment records the new measured value.
- **The budget line prints exact bytes and the headroom**, for example
  `initial JS: 21 files, 579,631 bytes raw, 369 under budget`. Today it prints `579.6 KB`,
  which cannot show a few hundred bytes, and the next units are measured against this line.

## User flow

No visible change. One difference: the first visit to `/billing`, `/family`,
`/availability`, `/match-requests`, `/account` or `/schedule` in a tab fetches one or two
small JSON chunks (both locales) before rendering. This is the same mechanism `/messages`
and `/curriculum` already use. A language switch needs no second download.

Error case: the chunk fails to download. The route's loader rejects and `RouteError`
shows, which is today's behaviour for any failed route load. Offline, the service worker
already precaches every `assets/*.js` (`scripts/check-sw.mjs` `precacheList`), so the new
chunks are in the precache and `check-sw` still finds no API path in it.

## Data model delta / API delta

None. No backend change, no migration, no endpoint.

## Frontend

- `src/locales/{en,ar}/`: new `booking.json`, `billing.json`, `availability.json`,
  `family.json`, `matching.json`; `account.json` grows; `common.json` shrinks.
- `src/lib/i18n-namespaces.ts`: five new `FEATURE_CATALOGUES` entries.
- Loaders on `_authed/billing.tsx`, `family.tsx`, `availability.tsx`, `match-requests.tsx`,
  `account.tsx` (adds `availability` and `matching`) and `schedule.tsx` (adds `booking` and
  `availability`). Route files still export only `Route` (round 1's `route-exports` guard).
- 50 shipped files name a moved block today: 7 in billing, 9 in booking, 18 in identity,
  3 each in matching and scheduling, 1 in curriculum, and 6 `_authed/-pages`, plus the
  call room, `CallStatus` and `OfflineScreen`, which only read residual keys and stay
  untouched. In the others, only the `useTranslation` argument and the key prefixes change.
- Not touched: `src/main.tsx`, `src/lib/api.ts`, `vite.config.ts`, the service worker,
  `nginx.conf`.
- WCAG 2.2 AA and RTL baseline unchanged: same text, same markup.
- Done means the existing e2e suite, the new raw-key flow and the Arabic sweep all pass on
  CI's real build, and the CI build line shows initial JS ≤ 555,000. After the deploy, an
  agent Playwright pass on staging (`dec-d9-substitute`) opens each of the six routes in
  English and Arabic.

## Module boundaries

Dashboard only. Every component keeps its own feature's text, and no new cross-feature
import appears. The shell and Home keep reading `common`.

## Personal data (ADR-0023)

None.

## Expand/contract

Safe in the blue-green window. Text is bundled, not fetched from the API. An old tab keeps
its old chunks, and a missing old route chunk is handled by round 1's reload guard. New
namespace chunks are new hashed files that old tabs never request.

## Out of scope (measured, for the conductor to route)

- **`sideEffects` in `package.json`.** A probe with `"sideEffects": ["**/*.css",
  "./src/main.tsx", "./src/lib/i18n.ts"]` measured initial JS at 527.2 KB (−52.6 KB, 37
  files). The `@/ui` barrel pulls radix dialog, radio-group, checkbox and alert-dialog into
  the entry, because the modules' top-level `forwardRef` calls count as side effects. This
  is a different lever from option (c) and can drop side-effect-only modules (the reload
  guard, theme init), so it needs its own unit with its own e2e.
- `tailwind-merge` (26 KB in the entry), the `auth.*` block (shown on `/login`), and
  lazy-loading the inactive locale.
- Raising or lowering the budget, and the Lighthouse floors.

## Test plan

1. **Key guard** (`src/locales/key-usage.test.ts`): green on `origin/main`. Mutation:
   deleting `family` from `en/common.json` turns it red with every reference listed.
2. **Loaders** (`src/lib/i18n-namespaces.test.ts`): one test per changed route asserts that
   the route's `loader` registers each of its namespaces for en and ar. The `account` test
   also asserts that `i18n.getFixedT("en", ["account", "common"])` resolves a moved key and
   a residual `auth.*` key, which proves the fallback the convention relies on. All are red
   before the loaders exist.
3. **Parity and terminology** pick up the new files through directory listing. The "lazy
   loader for exactly the feature namespaces" check is red until `FEATURE_CATALOGUES` has
   each line.
4. **Existing component tests** stay green. A test that renders a migrated component
   without the router adds `import "@/test/feature-i18n";`. `groupSessionsByDay.test.ts`,
   `WeeklyAvailabilityEditor.test.tsx` and `parity.test.ts` reference keys and are updated
   to match.
5. **e2e** `e2e/feature-catalogues.spec.ts` (read-only, seeded accounts, ≤ 30 s). For each
   of `/billing` (parent), `/family` (parent), `/availability` (teacher), `/match-requests`
   (teacher), `/account` (teacher, parent) and `/schedule` (booked, teacher), it reaches
   the route by **client-side navigation** from Home and also by a fresh load. It then
   asserts that no visible text node and no `aria-label`/`placeholder`/`title` equals a key
   path of a moved catalogue (bare or `<ns>.`-prefixed). `/family` also runs in Arabic.
   This is the only check that the real build's chunks load and register before render.
   Mutation: remove the `/family` loader and the flow goes red.
6. **Budget**: `pnpm build` passes, and the CI `dashboard-build` log's `initial JS:` line
   is recorded before and after in the hand-back, along with the `ui-*.js` size.
7. `chunk-reload.spec.ts`, `pwa.spec.ts`, `arabic-sweep.spec.ts` and the rest of the suite
   stay green unchanged.

## Open questions

None. Owner option (c) is resolved, and the budget stays at 580,000. No children's data,
money, legal text or new behaviour is involved.
