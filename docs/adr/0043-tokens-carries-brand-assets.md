---
number: 0043
title: "@kaleem/tokens carries brand assets, not only CSS"
status: accepted
date: 2026-09-14
amends: ADR-0041 (extends the package's scope beyond CSS)
---

## Context

ADR-0041 made `@kaleem/tokens` CSS-only by design, "so components stay in `src/ui`" —
the package emits `tokens.css` and `theme.css` from DTCG JSON and ships nothing else.
That was the right boundary for design *values*. It says nothing about design
*assets*: the logo mark, the wordmark, the favicon. Those are binary/vector artefacts
consumed at build time by two frontends (`dashboard`, `marketing`) and, for social
previews and transactional email, the backend — not colour tokens a component resolves
at runtime.

There is no brand today. There is no logo and no wordmark asset, and the two frontends
do not even agree on a placeholder: `dashboard/public/favicon.svg` is a generic purple
(`#863bff`) glyph — off-palette since ADR-0040 replaced the palette — while
`marketing/public/favicon.svg` is an unrelated black/white theme-aware mark (the stock
Astro logo). Each is simply whatever its scaffolding tool shipped by default; neither is
kaleem's. That divergence, not duplication, is the concrete failure mode this ADR exists
to close: with no shared source, each consumer drifted to a different placeholder.

Once a real mark exists (ADR-0044, not this one), it needs a single home that both
frontends and the backend can consume without becoming a second, drifting copy of the
brand.

## Decision

**`@kaleem/tokens` carries brand assets under `brand/`, alongside the CSS it already
emits.** Two kinds of file, kept apart, bound by one manifest:

```
tokens/brand/
  brand.json         # manifest: every asset, its kind, and what it resolves to
  src/*.svg          # source marks — colourless (currentColor only)
  dist/*.svg *.png   # emitted derivatives — colour baked in, sized, committed
```

- **Source marks are colourless.** They contain no hex literal, only `currentColor`.
  Colour is baked in at emit time by resolving a token alias (e.g. `{primary-text}`)
  against the palette already in `tokens/src/*.tokens.json`. Theme aliases are flat: they
  name the key that `resolveTheme()` returns, with no `color.` prefix. This is what makes "no hex
  literal ships in a brand asset" a checkable property rather than a review convention.
- **Emitted derivatives are committed**, the same pattern ADR-0041 established for
  `tokens.css`/`theme.css`: a script produces them, `--check` proves the tree matches
  what the script would produce right now, and consumers never run a build step to get
  a usable file.
- **The manifest (`brand.json`) has three asset kinds, not two: source, emitted, and
  extras.** Source and emitted cover the mark itself. Extras is for hand-authored,
  non-mark collateral (a social preview PNG, an OG image) that is not derived from a
  source SVG and must not be forced through the SVG emitter or an SVG hygiene gate that
  makes no sense for a raster file.
- **The package's `exports` map gains wildcard subpaths**: `"./brand/src/*.svg"` and
  `"./brand/dist/*"`. Node and Vite refuse to resolve a subpath that isn't listed, and
  enumerating every future asset by exact path in `exports` would mean editing
  `package.json` for every new derivative. The wildcard is the same trade already made
  for `src/*.tokens.json` in spirit, generalised to a directory.
- **Consumers inline the emitted source SVG; they never use `<img src>`.** An `<img>`
  or CSS `background-image` reference does not evaluate `currentColor` — it renders
  black, defeating the entire colourless-source design. This is stated here because
  it is a rule about how the asset is consumed, not just how it is built, and it has no
  other home.

## Alternatives considered

- **A sixth submodule for brand assets.** Another git pointer to keep pinned and
  bumped on every release, for isolation nothing in this repo needs. `tokens` is
  already the shared, versioned, pinned dependency both frontends consume; a second
  one earns its cost only if brand assets needed an independent release cadence or
  independent access control from the palette they are derived from. Neither is
  true — the mark's colour *is* a token, so the two are coupled by construction, not
  by convenience. Rejected.
- **Per-consumer copies of the asset.** With no shared source, copies do not stay
  in sync — they simply diverge. That is not a hypothetical: today
  `dashboard/public/favicon.svg` is a generic purple (`#863bff`) placeholder glyph
  and `marketing/public/favicon.svg` is a completely unrelated black/white
  theme-aware mark (the stock Astro logo left over from scaffolding) — two different
  third-party defaults, neither of them kaleem's, because nothing ties the two
  together. A third copy in the backend (for email/OG assets) would add a third
  independent place to notice and fix the same kind of drift. Rejected.
- **Meta repo.** CLAUDE.md is explicit that the meta repo is docs, CI config, and
  submodule pointer bumps only — no feature or build-time code. Brand assets
  consumed at build time by three codebases are build-time assets, not
  documentation, so meta can hold the usage guide (how to reference a brand asset)
  but not the assets or the emitter that produces them. Rejected.

## Consequences

**Good**

- One versioned, pinned source of truth for the mark, consumed identically by
  `dashboard`, `marketing`, and the backend — the same trust model ADR-0041 already
  established for colour tokens, extended to the assets that colour is applied to.
- "No hex literal ships in a brand asset" becomes a property the `--check` contract can
  assert, not something a reviewer has to notice by eye.
- The favicon divergence this ADR opens with has a fix with a name: replace both
  placeholders with the emitted asset from `tokens/brand/dist/`.

**Bad / costs**

- The package gains its first dependency ever: `@resvg/resvg-js`, added as a
  **devDependency only**, used to rasterise SVG sources into the committed PNG
  derivatives (e.g. favicon sizes) at emit time. Because its output is committed and
  `--check`-verified the same way `tokens.css` is, consumers still install **zero**
  runtime dependencies — `package.json` today declares none, and that stays true for
  anyone pulling the package as a dependency.
- The tokens CI gains its first install step and a committed `pnpm-lock.yaml`. It installed
  nothing before ("No dependencies by design"), which cannot hold once `brand.mjs --check`
  and its tests need `@resvg/resvg-js`. The CI comment says so, and the install is
  `--frozen-lockfile`.
- `files` and `exports` grow again, as they did for ADR-0041's JSON sources — the
  package's public surface keeps widening past the three CSS files it shipped
  originally.
- The `--check` drift contract, until now scoped to CSS, must also cover emitted brand
  assets: a source SVG or a token alias changes, and `--check` must fail if `dist/`
  wasn't regenerated. This is more for the emitter to get right than a CSS diff was.
- Three asset kinds in one manifest is more structure than "just some SVGs in a
  folder" — justified by source/emitted needing different treatment (one is hand-edited
  and colourless, one is generated and coloured) and extras needing neither, but it is
  a manifest someone has to read before adding a file, not a folder they can just drop
  one into.
