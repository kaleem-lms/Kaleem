---
name: inf-brand-tokens-pipeline
phase: v1 (wave 2, brand stream)
modules: [design-system]
status: draft
created: 2026-10-18
closed: null
---

## Goal

`@kaleem/tokens` gets the brand **pipeline** with no brand in it yet: the asset manifest,
the source-SVG hygiene gate, and the emitter that bakes a token colour into favicons,
icons and the OG card, with drift and size gates. This is brand plan Tasks 4, 6 and 8a
(`docs/superpowers/plans/2026-09-14-brand-identity.md`, errata E1, E3, E5, E7, E12, E15).
Every gate runs against fixtures under `test/fixtures/brand/`. The shipped manifest stays
empty until `inf-brand-mark-assets` adds the real mark (Task 8b).

The point of landing it now is that the gates exist, and have been seen to fail, before
the first real asset depends on them. It needs no brand direction, so it does not wait
for `dec-brand-direction`.

## Starting point (tokens `origin/main` 2a78fb0 = tag v0.2.4)

- No `brand/`, no `brand.mjs`, no lockfile, no dependencies of any kind. CI installs
  nothing ("No dependencies by design").
- `build.mjs` exports `resolveTheme`, `light` and `dark`. `resolveTheme(light)` returns
  flat keys. `primary-text` resolves to `#146A51` in light and `#9FD0BC` in dark, and
  `background` to `#FBF5EB` and `#191C1B`. This confirms E1: the aliases are
  `{primary-text}` and `{background}`.
- `test/build.test.mjs` "package exports every file the consumers import" reads every
  `exports` value as a file. A wildcard such as `./brand/dist/*` would fail that test.
- v0.2.4 is tagged on `main` (`lb-known-wcag-gaps`, the `merge_after` edge). Main can take
  this merge.

## Decisions taken in this spec

- **The package's public surface does not change in this unit.** `files` and `exports`
  stay as they are. The brand plan's Task 4 Step 6 moves to `inf-brand-mark-assets`,
  where the paths it exports first have files in them. Reasons:
  1. With no new surface, a hotfix tag cut from `main` before v0.3.0 ships exactly what
     v0.2.4 shipped. That is what "main stays releasable" asks for.
  2. The existing exports test would fail on wildcard entries that point at empty
     directories.
- **`brand.mjs` is never exported** (resolves E15 and the matching `ISSUES.md` entry).
  No consumer step in the brand plan (Tasks 10-12) imports it. Consumers take files only:
  `brand/src/*.svg` and `brand/dist/*`. A test asserts that neither `files` nor `exports`
  names `brand.mjs`, so `inf-brand-mark-assets` cannot re-introduce the export.
  `emit()` therefore stays synchronous with a top-level `@resvg/resvg-js` import.
- **`@resvg/resvg-js` is pinned exactly at 2.6.2 as a devDependency.** 2.6.2 is the
  current `latest` dist-tag. It runs no install script: it ships prebuilt binaries as
  optional per-platform packages. The lockfile is written with pnpm 10.28.0 and installed
  `--frozen-lockfile` in tokens CI (E3, ADR-0043).
- **The hygiene gate checks paint values, not only hex and `rgb()`.** As planned,
  `fill="black"` or `fill="hsl(…)"` would have passed. `svgIssues` also reports any
  `fill`, `stroke`, `stop-color`, `color`, `flood-color` or `lighting-color` whose
  value, as an attribute or inline style, is not `currentColor`, `none`, `inherit` or a
  `url(#…)` reference. It catches `<feImage>` and `data:image` along with `<image>`.
  It accepts `<title …>` with attributes.

## User flow

None. No user-facing surface changes. Consumers keep v0.2.4, and the meta tokens pin does
not move: a tokens pointer moves only with a release, and the next release is v0.3.0
from `inf-brand-mark-assets`. A developer runs `node brand.mjs [manifest] [--check]` in
`tokens`. The command mirrors `node build.mjs [--check]`.

## Data model delta

None. No backend, no migration. Personal data (ADR-0023): none collected, stored or shown.

## API delta

None.

## Frontend

None in either consumer. In `tokens`:

- **New:** `brand/brand.json`, with the colour block and empty `source`, `emitted` and
  `extras`. Also `brand.mjs`, `test/brand.test.mjs`, `test/fixtures/brand/` (the manifests,
  two source SVGs and a committed `dist/`) and `pnpm-lock.yaml`.
- **Changed:** `package.json` (`scripts.test`, `scripts.brand`, `devDependencies`) and
  `.github/workflows/ci.yml` (pnpm setup, a frozen install, a `node brand.mjs --check`
  step, the rewritten "no dependencies" comment).
- **Done:** tokens CI green on the PR and on `main` after the merge. There is no staging
  deploy, because nothing deploys until the v0.3.0 release unit.

## Module boundaries

`design-system` (the `tokens` package) only. `brand.mjs` imports `build.mjs`, the only
source of resolved colour. It does not read the token JSON directly.

## Out of scope

- Any real mark, lockup, emitted asset or `contrast-pairs.json` entry (Tasks 5, 7, 8b and
  9: `inf-brand-mark-assets`).
- `files` and `exports` for `brand/` (moved to `inf-brand-mark-assets`; see Decisions).
- A tag or version bump, and any consumer or meta-pin change.
- The Arabic `font-display` fallback (`ISSUES.md`). That entry names this unit, but
  choosing an Arabic display face is a taste call that follows the brand direction
  (`dec-brand-typeface`). It belongs with `inf-brand-direction` or
  `inf-brand-mark-assets`, and the conductor should re-point the entry.

## Test plan

All tests use `node --test` in `tokens/test/brand.test.mjs`. There is no e2e: nothing
renders. Cases:

- **Presence.** The fixture manifest declares `mark`, and every file it declares exists.
  A manifest that declares an absent file is reported by `missing()`. The shipped
  manifest's declarations all exist (vacuous until 8b).
- **Hygiene.** Fixture sources are clean. `svgIssues` reports a hex fill, `fill="black"`,
  an `<image>`, a `data:image` href, live `<text>`, a missing `viewBox` and a missing
  `<title>`. A clean `<title id="t">` source passes.
- **Colour.** `markColor` resolves to a hex literal in both themes and is not `#863bff`.
  An unknown key throws, and so does an alias that does not resolve, such as
  `{color.primary.text}` (E1's original bug).
- **Size.** Every emitted PNG matches its declared size, and the OG card is 1200x630.
  A mis-declared icon is reported by `iconSetIssues`, and `pngSize` throws on non-PNG
  bytes.
- **Drift.** The committed fixture `dist/` matches `emit()`, and a changed byte is
  reported. The CLI `node brand.mjs test/fixtures/brand/brand.json --check` exits 1 on a
  changed byte and 0 once it is restored (E12).
- **Surface.** Neither `files` nor `exports` names `brand.mjs`.
- **Determinism.** The fixture PNGs written on the host (node 24) pass `--check` under
  node 22, the CI version. "resvg determinism unmeasured" is a recorded programme gap,
  and this unit measures it.

## Open questions

None. The unit needs no owner decision: it is fixtures-only and needs no brand direction.
