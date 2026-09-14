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

There is no brand today. There is no logo, no wordmark asset, and the favicon that
ships identically in both `dashboard/public/favicon.svg` and `marketing/public/` is a
generic purple (`#863bff`) glyph — off-palette since ADR-0040 replaced the palette, and
never fixed in either place because there is no single place to fix it. Two copies of
the same asset already exist, and they already agree with each other and disagree with
the token package: the concrete failure mode this ADR exists to close.

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
  Colour is baked in at emit time by resolving a token alias (e.g. `color.brand.primary`)
  against the palette already in `tokens/src/*.tokens.json`. This is what makes "no hex
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

## Why not a sixth submodule

A `brand` submodule is another git pointer to keep pinned and bumped on every release,
for isolation nothing in this repo needs. `tokens` is already the shared, versioned,
pinned dependency both frontends consume; a second one earns its cost only if brand
assets needed an independent release cadence or independent access control from the
palette they are derived from. Neither is true — the mark's colour *is* a token, so the
two are coupled by construction, not by convenience.

## Why not per-consumer copies

Two copies drift. This is not a hypothetical: the purple favicon shipping identically
in `dashboard/public/favicon.svg` and `marketing/public/favicon.svg` today is the
existing proof, and it is already off-palette because nothing recomputes it when the
palette changes. A third copy in the backend (for email/OG assets) would make it three
independent places to notice and fix the same drift.

## Why not meta

CLAUDE.md is explicit that the meta repo is docs, CI config, and submodule pointer
bumps only — no feature or build-time code. Brand assets consumed at build time by
three codebases are build-time assets, not documentation, so meta can hold the usage
guide (how to reference a brand asset) but not the assets or the emitter that produces
them.

## Consequences

**Good**

- One versioned, pinned source of truth for the mark, consumed identically by
  `dashboard`, `marketing`, and the backend — the same trust model ADR-0041 already
  established for colour tokens, extended to the assets that colour is applied to.
- "No hex literal ships in a brand asset" becomes a property the `--check` contract can
  assert, not something a reviewer has to notice by eye.
- The favicon duplication-and-drift this ADR opens with has a fix with a name: replace
  both copies with the emitted asset from `tokens/brand/dist/`.

**Bad / costs**

- The package gains its first dependency ever: `@resvg/resvg-js`, added as a
  **devDependency only**, used to rasterise SVG sources into the committed PNG
  derivatives (e.g. favicon sizes) at emit time. Because its output is committed and
  `--check`-verified the same way `tokens.css` is, consumers still install **zero**
  runtime dependencies — `package.json` today declares none, and that stays true for
  anyone pulling the package as a dependency.
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
