---
name: rch-mkt-test-harness
phase: v1
modules: [marketing, ci]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Give `marketing` the test harness every other surface has: vitest unit tests with a coverage
ratchet (ADR-0026) and a Playwright suite against the built site (`astro preview`) that
checks `lang`/`dir`, axe, reflow and links. Run both in CI. Today marketing has no tests at
all (CLAUDE.md D3 table: "no test suite exists yet"). Its only checks are `pnpm check` and
`pnpm build` in ci.yml's `marketing-build` job.

This unit adds no page and no user-facing behaviour. Every later `rch-mkt-*` unit depends on
it (`rch-mkt-foundation` first), and each adds its routes to this suite.

State at marketing `origin/main` `aa24602`: one page (`src/pages/index.astro`) and one layout
(`src/layouts/Layout.astro`). The layout hardcodes `lang="en" dir="ltr"` and throws at render
time when `description` is empty. The site has no links, and it has no way to reach the
tokens' `.dark` class.

## What was measured before writing this (spike in a scratch copy of `aa24602`)

- **vitest 3.2.7 + `getViteConfig` + `experimental_AstroContainer` renders `.astro` files,
  and `@vitest/coverage-v8` reports them.** With `all: true`, `Layout.astro` and
  `index.astro` showed 100% lines and branches once each had a render test. With the
  layout's `throw` disabled, the empty-description test went red.
- **A test file under `src/pages/` breaks `astro build`.** Astro treats any `.ts` file there
  as an endpoint route, and the build died with "Vitest failed to access its internal
  state". Unit tests therefore live in `tests/`, never in `src/pages/`.
- **`@axe-core/playwright` resolves its `playwright-core` peer independently.** With
  `@playwright/test@1.62.1`, the peer resolved to 1.64.1, and `astro check` (which
  type-checks `e2e/` because `tsconfig` includes `**/*`) failed with `ts(2739)` on `Page`.
  A direct `playwright-core@1.62.1` devDependency fixed it: the lock showed
  `@axe-core/playwright@4.13.0(playwright-core@1.62.1)` and `astro check` reported 0 errors.
  1.62.1 / 4.13.0 are the dashboard's locked versions.
- Against `astro preview`, the home page is axe-clean under WCAG 2.2 A/AA tags, and
  `color-contrast` actually ran. Its `scrollWidth` equals its viewport at 320, 360 and 430px.
  An unknown path returns 404. The run took 2.1 s.

## Design

**Unit tests (`tests/**/*.test.ts`)**: they render through the Astro container. First
tests: the layout emits `lang`, `dir` and `<meta name="description">`, it refuses an empty
description, and the home page renders its `h1` and description. Coverage config:
`include: ["src/**/*.{ts,astro}"]`, `all: true`, v8, with no directory exclusions.
**The unit writes no `thresholds`.** Per dec-floor-ownership, the conductor adds the
CI-measured floor to `vitest.config.ts` at the freshness step. Until then the step reports
coverage and enforces nothing; the merged state is enforced.

**e2e (`e2e/`)**: Playwright, Chromium only. `webServer` runs `pnpm preview` on
`127.0.0.1:${E2E_PORT:-4322}`, and `reuseExistingServer` is false so that the owner's dev
server on 4321 is never tested by accident. The build must already exist. The config matches
the dashboard's: CI gets 1 retry, `forbidOnly` and the list+html reporters. A pass on retry
is a finding. `e2e/routes.ts` holds the route list (`["/"]`), and the shared checks iterate
it, so later units add a route in one place:

| Check | Asserts | Not proved |
| --- | --- | --- |
| page basics | 200; `html[lang]` and `html[dir]` match the route's expected locale; exactly one `h1`; non-empty `<title>` and meta description | — |
| axe | no violations under `wcag2a/2aa/21a/21aa/22aa`, **and** `color-contrast` is in passes or violations (a silent skip is not a pass) | dark theme: marketing cannot reach it; the unit that adds a theme switch adds its scan |
| reflow (SC 1.4.10) | `scrollWidth <= clientWidth + 1` at 320/360/430px, naming the widest element on failure | — |
| links | crawls same-origin `a[href]` from every listed route (bounded at 50 pages); each answers 200. External links are listed, not fetched. Negative control: an unknown path must return 404, or the crawl could never see a broken link | today's home has no links, so the crawl visits one page; it starts proving something when `rch-mkt-foundation` adds `/ar/` |

**CI**: extend the existing `marketing-build` job rather than adding a job. Its name stays,
so `record-verified-tree`, `deploy-staging` and any required-check name are untouched. New
steps follow `Type-check`, in this order: `pnpm test:coverage`, then `Build`, then
`playwright install --with-deps chromium`, then `pnpm e2e`. The Playwright report goes up as
an artifact on `failure()`. `timeout-minutes` goes from 10 to 15.

**Docs**: in CLAUDE.md, the D3 coverage row for `marketing` and a new e2e table row. The
floor cell is filled by the conductor along with the floor. `marketing/CLAUDE.md` gains the
test commands.

## Data, schema, API

No personal data (ADR-0023: none collected, stored or shown). No model, migration, endpoint
or route. Expand/contract does not apply. Dependency change: marketing `package.json` and
`pnpm-lock.yaml` (vitest, `@vitest/coverage-v8`, `@playwright/test`, `playwright-core`,
`@axe-core/playwright`, and `@types/node@^22`, all devDependencies), so the conductor allocates the unit as
marketing's one dependency-changing unit. The new packages have no install scripts, so
`pnpm-workspace.yaml` `allowBuilds` is unchanged; the spike's install did not prompt.

`@types/node` was not in the spike's list. `playwright.config.ts` reads `process.env`, and
`astro check` (which type-checks the config) failed with four `ts(2591)` errors until it was
added; with it, `astro check` reports 0 errors again. It matches CI's Node 22.

## Module boundaries

Marketing only, plus meta's `ci.yml` (a shared file: one merge at a time, conflicts resolved
at freshness). No backend or dashboard code changes.

## Out of scope

Pages, i18n, the `/ar/` route and a theme switch (`rch-mkt-foundation`). Lighthouse
per-URL assertions (`rch-mkt-seo-infra`). The `just test` recipe, which does not run
marketing (D10: noted, not changed here). The stale "CI runs only the build" comment in
`Layout.astro`.

## Test plan

The unit tests and the four e2e checks above. Each must be shown red against a deliberately
broken build before it is trusted (mutation checks in the plan). e2e time budget: under 30 s
of test time. The job grows by about 1.5 min, mostly the Chromium install.

## Open questions

None. No decision ids apply. needs_adr: none.
