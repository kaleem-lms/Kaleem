---
name: inf-brand-docs-land
phase: "n/a — brand stream, wave 1 of the v1 programme (ADR-0045)"
modules: [design-system]
status: draft
created: 2026-10-18
closed: null
---

## Goal

PR #232 (`docs/brand-identity`, head `ecc3936`) holds the brand-identity spec, its plan,
ADR-0043 and the brand brief. Nothing in it has been merged. Since it was written the code
has moved, and checking the PR against the current code finds instructions that would fail
or that conflict with another unit. This unit lands #232 with one errata commit, so that
the brand units after it (`inf-brand-tokens-pipeline`, `-mark-assets`, `-dashboard`,
`-marketing`, `-email-header`) build from correct documents.

The errata **amends** `docs/superpowers/specs/2026-09-14-brand-identity-design.md` and
`docs/superpowers/plans/2026-09-14-brand-identity.md`. It does not supersede them. This spec
only describes the amendment, because the brand spec is not on `master` until this unit
lands it.

## The errata

Each row was checked against the code at tokens `68567a3`, dashboard `d3101e5`, marketing
`7415349` and backend `d1c2be6` (the `origin/main` heads on 2026-10-18).

| # | Where in #232 | What is wrong | Correction |
| --- | --- | --- | --- |
| E1 | plan Task 4 `brand.json`, Task 8 `markColor`, Task 9 | Theme tokens are **flat**. `resolveTheme(light)` returns keys such as `primary-text` and `background`, so `{color.primary.text}` resolves to `undefined` and `markColor` throws. Measured on 2026-10-18: `primary-text` = `#146A51`, `color.primary.text` = undefined. | Aliases become `{primary-text}` and `{background}`. Task 9's reversed pair is `background` on `primary`, in the shape `contrast-pairs.json` uses. |
| E2 | ADR-0043 Decision (line 44) | The alias example `color.brand.primary` names a token that does not exist. | Use `{primary-text}` and say that theme aliases have no `color.` prefix. |
| E3 | plan Task 8 Steps 5, 7, 9; ADR-0043 costs | The tokens CI (`.github/workflows/ci.yml`) installs nothing, and says "No dependencies by design". The repo has no lockfile. With a devDependency on `@resvg/resvg-js`, both `node brand.mjs --check` and the tests fail in CI. | Task 8 adds a committed `pnpm-lock.yaml`, adds a frozen-install step to the tokens CI and rewrites that comment. ADR-0043 lists the install step as a cost. |
| E4 | plan Task 5 `outline.py` | It reads each letter through `cmap`, so it gets the isolated forms, then lays them out right to left by hand. كليم drawn this way does not join. The plan's note admits this and leaves the joins to a hand redraw. | Shape the word with HarfBuzz (`uharfbuzz`, RTL, Arabic script), then draw the glyph IDs it returns at the positions it returns. The raw output is then the joined word, and the redraw only stylises it. |
| E5 | plan Tasks 6, 7 | The lockups set Latin "kaleem" as live `<text>`. resvg rasterises text with whatever fonts the machine has, so the PNGs differ between machines and `--check` stops being reproducible. Inlined in a page, the text takes the page's font. | The lockup text is converted to outlines (paths) with the same tool. `svgIssues` reports `<text>`, and gets a test that a `<text>` is caught. |
| E6 | plan Task 8, spec deliverables (line 125) and test plan (line 198) | Task 8 emits `site.webmanifest`, and Tasks 10 and 11 copy it. `rch-pwa-manifest-head` owns the dashboard's manifest, and keeps the same icon file names so that the brand release only overwrites image files. | Task 8 emits image files only: icons, the OG card and the email rasters. `webmanifest()` and its manifest entry are removed. The drift mutation check targets `brand/dist/favicon.svg`. Spec line 198 becomes an "icon set" gate: every declared icon is emitted at its declared size. The manifest that references the icons belongs to the consumer. |
| E7 | plan Tasks 4-8 | Task 4 commits a gate that stays red "until the mark lands", and Task 8 mixes the emitter with the real assets. The programme splits this work: `inf-brand-tokens-pipeline` builds the manifest, validators, emitter and gates against fixtures, and must merge into tokens `main` while it is still green. `inf-brand-mark-assets` adds the real mark, the lockups and `dist/`. | Task 8 is split into **8a** (pipeline: `markColor`, `pngSize`, `emit`, `--check`, the size and drift gates) and **8b** (mark: the real `emitted` entries and the committed `dist/`). The manifest path is a parameter, so the gates run on `test/fixtures/brand/` until 8b. The shipped `brand/brand.json` starts with empty lists. The "declares the mark" test moves to 8b. Task 4 Step 7 no longer commits a red gate. |
| E8 | plan Task 10 | The dashboard has **two** hand-built wordmarks (`AppTopbar.tsx:43` and `src/ui/auth-layout.tsx:10`) and two G2 exemptions for their dots (`scripts/check-colors.mjs`, `TEXT_ON_SURFACE_ALLOW`). Two tests assert the text (`AppTopbar.test.tsx:42` and `auth-layout.test.tsx:23`). `rch-pwa-manifest-head` already owns `index.html` and the PNG names. | `Wordmark` replaces both copies, both tests move to the accessible name, and both exemptions are deleted. Step 3 copies the five image files over the same names. Step 6 only adds the SVG icon link next to the head that `rch-pwa-manifest-head` built. The manifest is not copied. |
| E9 | plan Task 11 | (a) `<h1 role="img">` takes away the heading's role. (b) A relative `og:image` is ignored by link previews, and `astro.config.mjs` sets no `site`. (c) Marketing now has a test suite with a 100/100/100 floor and an e2e harness. `tests/home.test.ts` matches `<h1[^>]*>kaleem`, so Step 4's "no test suite" is stale and the swap would fail CI. (d) It copies `site.webmanifest` (E6). | The mark goes **inside** the `<h1>` as a `role="img"` span. `og:image` is an absolute URL built from the site origin. Step 4 runs `pnpm test`, `pnpm check`, `pnpm build` and the e2e, and updates `tests/home.test.ts`. The manifest is not copied. The spec's Out of scope and Self-Review lines about "no marketing test suite" are corrected. |
| E10 | plan Task 12, File Structure line 56 | It says to "modify the SES email template header". The backend sends text-only email (`kaleem/templates/account/email/*.txt`), so there is no HTML header. The owner decided that `ntf-email-foundation` builds the header slot and the brand raster is swapped in later. | Task 12 swaps the hosted raster into the slot that `ntf-email-foundation` builds. The URL comes from an environment variable. The raster is hosted by marketing (Task 11 copies `email-header*.png`). This work is `inf-brand-email-header`. |
| E11 | `docs/brand/brief.md` | The owner decided to rewrite the brief before any further exploration. | A status line at the top says that the brief is being rewritten (`inf-brand-brief-rewrite`) and that no direction work may be judged against this version. |
| E12 | plan Task 8a Step 7 | The drift mutation check runs `node brand.mjs --check` on the shipped manifest, which is empty in 8a (E7). It emits nothing, finds no drift and exits 0 after the fixture byte is changed, and its "suite goes red" never runs the suite. It is a check that cannot go red. | `brand.mjs` takes an optional manifest path. Step 7 runs it against the fixture (rc=1 naming the file) and runs the suite, then restores and expects rc=0 for both. The same CLI produces the committed fixture `dist/`. |
| E13 | plan Task 11 Step 3 | `new URL("/og.png", Astro.site)` throws `TypeError: Invalid URL` under vitest. `tests/home.test.ts` and `tests/layout.test.ts` render through `AstroContainer`, which ignores `astro.config.mjs` (astro 6.1.5 `dist/container/index.js:116`), and `Astro.site` comes from `manifest.site`, which the container never sets. Every Layout render in the suite would break. `tests/layout.test.ts` was not in Task 11's files. | The URL is built from `Astro.url`, which cannot be undefined. `tests/layout.test.ts` is added to the files, with a test that `og:image` is absolute and ends in `/og.png`. The production origin is proven on the built `dist/index.html`, where `site` applies. |

Each amended document gets a dated **Errata** section at the top, listing E1–E13. The task
text is also corrected in place, so the plan can be followed without reconstructing it from
the list.

## User flow

None. Documentation only.

## Data model delta

None.

## API delta

None.

## Frontend

None in this unit. It changes the instructions that `inf-brand-dashboard` and
`inf-brand-marketing` will follow. It changes no code.

## Module boundaries

`design-system` docs only. No submodule is touched.

## Out of scope

- Rewriting the brief (`inf-brand-brief-rewrite`, owner-gated by `hg-brand-brief`).
- Choosing a direction, a typeface or any artwork.
- ADR-0044 (`inf-brand-close`).
- Errors in #232 beyond E1–E13. If more turn up, they go to `ISSUES.md` (D10).
- Facts recorded in #232 as "verified 2026-09-14" (for example the `v0.2.2` pin). They are
  dated records, not instructions, and stay as written.

## Test plan

There is no code, so the check is a fact check. A script outside the repo,
`_ops/checks/inf-brand-docs-land-facts.py`, reads the landed files and fails for each
erratum whose old text is still present or whose correction is missing. It must fail on
`origin/docs/brand-identity` and pass after the errata commit. CI's `security` job
(gitleaks, which ADR-0042 runs on docs) must pass, and `gitleaks-range.sh` must be clean
locally. D3 requires no e2e flow, because nothing user-facing changes.

## Open questions

None. The owner decisions involved, `dec-brand-direction` (rewrite the brief) and
`dec-brand-email-header` (header slot in `ntf-email-foundation`), are both resolved.
