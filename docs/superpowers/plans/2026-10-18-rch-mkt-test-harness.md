---
spec: docs/superpowers/specs/2026-10-18-rch-mkt-test-harness-design.md
status: draft
---

Size S. Repos: `marketing` (worktree `/home/abdulkhalek/Projects/kaleem-worktrees/marketing-rch-mkt-test-harness`,
branch `feat/rch-mkt-test-harness` off `origin/main` `aa24602`, created per runbook §1) and
meta (`/home/abdulkhalek/Projects/kaleem-worktrees/meta-rch-mkt-test-harness`). No migrations, no backend,
no dashboard. Dependency change in marketing: the hand-back says `needs: dependency change`.

## Files

| Repo | File | Change |
| --- | --- | --- |
| marketing | `package.json`, `pnpm-lock.yaml` | devDeps `vitest@^3.2.7`, `@vitest/coverage-v8@^3.2.7`, `@playwright/test@1.62.1`, `playwright-core@1.62.1`, `@axe-core/playwright@4.13.0`; scripts `test`, `test:coverage`, `e2e` |
| marketing | `vitest.config.ts` | new: `getViteConfig`, `include: ["tests/**/*.test.ts"]`, v8 coverage over `src/**/*.{ts,astro}`, `all: true`, **no `thresholds`** |
| marketing | `tests/layout.test.ts`, `tests/home.test.ts` | new unit tests (never under `src/pages/`) |
| marketing | `playwright.config.ts`, `e2e/routes.ts`, `e2e/site.spec.ts` | new |
| marketing | `.gitignore` | add `coverage/`, `playwright-report/`, `test-results/` |
| marketing | `CLAUDE.md` | test commands, and the rule that tests stay out of `src/pages/` |
| meta | `.github/workflows/ci.yml` | `marketing-build` (line 635): timeout 10→15 (637); after `Type-check` (685), add `Unit tests` (`pnpm test:coverage`); after `Build` (687), add `Install Playwright chromium` (`pnpm exec playwright install --with-deps chromium`) and `Run e2e` (`pnpm e2e`); add `Upload the Playwright report` on `failure()` (`actions/upload-artifact@v7`, `marketing/playwright-report/` + `marketing/test-results/`, 7 days). Job name, `needs`, `if` unchanged |
| meta | `CLAUDE.md` | D3 coverage row `marketing` (line 42): `vitest.config.ts`, ✅, floor cell left for the conductor; a new e2e table row `marketing` — site |

## Steps

1. [ ] **Worktree + deps.** Create the marketing worktree (runbook §1). Write the lockfile
   with `npx -y pnpm@10.28.0 add -D <the five packages above>`, then
   `pnpm install --frozen-lockfile` must pass. Check the lock:
   `grep "@axe-core/playwright@4.13.0(playwright-core@1.62.1)" pnpm-lock.yaml` must match,
   and `git diff pnpm-workspace.yaml` must be empty.
2. [ ] **Red: unit tests first.** Write `tests/layout.test.ts`:
   - (a) renders `<html lang="en" dir="ltr">` and the meta description;
   - (b) `renderToString` with `description: " "` rejects `/non-empty/`.

   Write `tests/home.test.ts`: (c) the home page renders `<h1…>kaleem` and its description.
   Run `pnpm test` before `vitest.config.ts` exists. Expect red: the `.astro` import fails
   without the Astro Vite plugin.
3. [ ] **Green.** Add `vitest.config.ts`. Run `pnpm test:coverage`, which must show both
   `.astro` files in the table. **Mutation:** disable the layout's `throw`; (b) must go red.
   Restore it.
4. [ ] **e2e harness.** Add `playwright.config.ts`: `testDir: "e2e"`, Chromium,
   `baseURL http://127.0.0.1:${E2E_PORT ?? 4322}`, `webServer: pnpm preview --host 127.0.0.1
   --port <port> --strictPort`, `reuseExistingServer: false`, plus the dashboard's
   CI/retry/reporter settings. Add `e2e/routes.ts`: `[{ path: "/", lang: "en", dir: "ltr" }]`.
5. [ ] **e2e checks, each written red-first via a throwaway mutation of `src/` (never
   committed).** All four are in `e2e/site.spec.ts`, looping the routes:
   - basics: status 200, `lang`/`dir`, one `h1`, non-empty title and description. Mutation:
     `lang="fr"` in the layout.
   - axe (WCAG 2.2 A/AA tags), asserting `color-contrast` ran. Mutation: an `<img>` with no
     `alt` in the home page.
   - reflow at 320/360/430, naming the widest element. Mutation: a `style="width:400px"` div.
   - links: a same-origin crawl capped at 50 pages, each 200, external links listed. Control:
     `/__no-such-page__` returns 404. Mutation: `<a href="/missing">`.

   Run with `pnpm build && pnpm e2e`. Each check must be red under its mutation and green
   without it. Record the failure lines for the hand-back.
6. [ ] **Hygiene.** `.gitignore` and `marketing/CLAUDE.md`. Then run the local gate in the
   worktree: `pnpm install --frozen-lockfile && pnpm check && pnpm test:coverage &&
   pnpm build && pnpm e2e`. `astro check` must report 0 errors: it type-checks `tests/`,
   `e2e/` and the configs.
7. [ ] **Commit (marketing):** `test(marketing): vitest and Playwright harness`, staged by
   explicit paths. Run the runbook §3 hand-back checks: freshness, a clean tree,
   `gitleaks-range.sh`, and the floor grep. The floor grep must print nothing, because no
   `thresholds` were written.
8. [ ] **Meta.** Make the `ci.yml` edits above. Check them with
   `actionlint .github/workflows/ci.yml`: no new findings against the pre-edit baseline.
   Make the CLAUDE.md D3 edits. Commit:
   `ci: run marketing unit tests and e2e in marketing-build`.
9. [ ] **Conductor** (not the agent): push, then open the submodule PR and the draft meta
   proof PR. Watch CI. The log must show `Run e2e` executing `site.spec.ts`, and the
   coverage table. At freshness, add `coverage.thresholds` from CI's measured figures to
   `vitest.config.ts` and fill the CLAUDE.md floor cell. Then merge per runbook §5.

## e2e (D3)

The required flow is the home-page smoke: four checks on `/`. A new CLAUDE.md row says
precisely what they cover. They do not cover the dark theme (marketing cannot reach it), or
links beyond the one page (none exist yet). Budget: under 30 s of test time; measured 2.1 s
in the spike.

## Risks

- **Peer drift**: `@axe-core/playwright` pulls the newest `playwright-core` unless one is
  pinned directly. The step 1 grep guards it, and `astro check` fails loudly if it drifts.
- **Tests under `src/pages/` break the build.** The `tests/` layout and the
  `marketing/CLAUDE.md` rule prevent it.
- **Host pnpm 12**: running `pnpm preview` through Playwright's `webServer` on the host
  re-verified dependencies with pnpm 12 in the spike. That was harmless, and the lockfile was
  unchanged. CI uses pnpm 10. If it ever rewrites the lock locally, discard the change and
  rerun the install with pnpm 10.28.0.
- **`experimental_AstroContainer`** may be renamed in an Astro upgrade. The tests then fail
  loudly at import; they cannot pass silently.
- **`ci.yml` is shared** with other units: merge one at a time and resolve at freshness.
  Keeping the job name avoids touching the `needs:` lists.
- **No floor is enforced until the conductor adds it.** That is deliberate
  (dec-floor-ownership). The reviewer checks that the floor lands before merge.

## Verification

Steps 3 and 5: every test is red with its fix reverted or its mutation applied, and green
without. Step 6: the full local gate passes. Step 9: a fully green CI run whose log names
`site.spec.ts`. The floor is in place before merge.
