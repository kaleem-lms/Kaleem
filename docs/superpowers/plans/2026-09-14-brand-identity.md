# kaleem Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce kaleem's Arabic-first calligraphic identity for **كليم** — master mark, lockups, derivatives, extended programme — with `@kaleem/tokens` as the single source of truth, and replace the duplicated text wordmark and the off-palette purple favicon in both consumers.

**Architecture:** `tokens` gains a `brand/` tree: hand-authored **source** SVGs that carry no colour (`currentColor` only) plus a `brand.json` manifest that declares every asset and binds each to a colour *token alias*. A new `brand.mjs` emitter resolves those aliases against the existing DTCG source and bakes them into standalone **emitted** assets (favicons, app icons, OG card, email rasters), which are committed so consumers never build. Gates live in `tokens/test/` beside the existing ones. Consumers then pin the new tag and swap their assets.

**Tech Stack:** Node 24 (`node --test`, zero runtime deps), DTCG JSON, `@resvg/resvg-js` as the only devDependency (rasterising; never installed by consumers), `fonttools` and `uharfbuzz` in a throwaway venv for the one-off, shaped glyph-outline extraction, Astro 6 (marketing), React 19 + Vitest + Playwright (dashboard).

**Spec:** `docs/superpowers/specs/2026-09-14-brand-identity-design.md`

## Errata (2026-10-18)

Amended by `inf-brand-docs-land` after checking this plan against the code at tokens
`68567a3`, dashboard `d3101e5`, marketing `7415349` and backend `d1c2be6`. The tasks below
are corrected in place; this list says what changed and why. The spec carries a shorter
list (`docs/superpowers/specs/2026-09-14-brand-identity-design.md`, Errata).

- **E1 flat theme aliases.** `resolveTheme()` returns flat keys (`primary-text`,
  `background`), so `{color.primary.text}` resolved to `undefined` and `markColor` threw.
  Aliases are `{primary-text}` and `{background}`. Task 9's reversed pair is `background`
  on `primary`, in the shape `contrast-pairs.json` uses.
- **E2 ADR-0043 example.** Its `color.brand.primary` alias named a token that does not
  exist. It now uses `{primary-text}` and says theme aliases have no `color.` prefix.
- **E3 tokens CI install.** The tokens CI installs nothing and says "No dependencies by
  design", and the repo has no lockfile. With `@resvg/resvg-js` as a devDependency, `brand.mjs
  --check` and the tests fail in CI. Task 8a adds a committed `pnpm-lock.yaml`, a frozen
  install step, and a rewritten comment. ADR-0043 lists the install as a cost.
- **E4 HarfBuzz shaping.** Reading each letter through `cmap` gives isolated forms, and
  laying them out by hand does not join. Task 5 shapes the word with `uharfbuzz` and draws
  the glyph IDs it returns.
- **E5 outlined lockup text.** Live `<text>` in a lockup is rasterised with whatever fonts
  the machine has, so the PNGs differ between machines and `--check` is not reproducible.
  Task 7 outlines the Latin text, and Task 6's `svgIssues` reports `<text>`.
- **E6 no web manifest.** `rch-pwa-manifest-head` owns the dashboard's manifest and keeps
  the icon file names, so the brand release only overwrites image files. Task 8 emits
  images only (the manifest emitter is removed) and Tasks 10 and 11 do not copy a manifest.
- **E7 Task 8 split.** 8a is the pipeline (`inf-brand-tokens-pipeline`): it merges into
  tokens `main` green, against `test/fixtures/brand/`. 8b is the mark
  (`inf-brand-mark-assets`): the real `emitted` entries and the committed `dist/`. Task 4
  no longer commits a red gate.
- **E8 two dashboard wordmarks.** `AppTopbar.tsx` and `src/ui/auth-layout.tsx` each hand-build
  the wordmark, with two G2 exemptions (`TEXT_ON_SURFACE_ALLOW`) and two tests. Task 10
  replaces both.
- **E9 marketing.** `<h1 role="img">` removes the heading role; `og:image` must be an
  absolute URL; marketing now has a vitest suite (100/100/100) and an e2e harness, and
  `tests/home.test.ts` matches `<h1[^>]*>kaleem`. Task 11 is corrected on all four.
- **E10 email header.** The backend sends text-only email, so there is no HTML header to
  modify. `ntf-email-foundation` builds the header slot; Task 12 (`inf-brand-email-header`)
  swaps the hosted raster into it.
- **E11 brief.** `docs/brand/brief.md` is being rewritten by owner decision
  (`inf-brand-brief-rewrite`). Task 1's output is marked accordingly.
- **E12 drift mutation check.** Task 8a Step 7 ran a bare `node brand.mjs --check`, which
  checks the shipped manifest. That is empty in 8a (E7), so it emits nothing and exits 0
  after the fixture byte is changed: it could not go red. `brand.mjs` now takes an optional
  manifest path (`node brand.mjs [manifest.json] [--check]`), Step 7 points it at the fixture
  and also runs the suite, and the same CLI produces the committed fixture `dist/`.
- **E13 `og:image` under the test container.** `new URL("/og.png", Astro.site)` throws under
  vitest: `AstroContainer` ignores `astro.config.mjs`, so `Astro.site` is undefined, and
  setting `site` does not change that. Task 11 builds the URL from `Astro.url`, adds
  `tests/layout.test.ts` to its files, and proves the production origin on the built
  `dist/index.html`, the one place `site` applies.

## Global Constraints

- **Mark form:** Arabic-first calligraphic **كليم**. Latin "kaleem" is secondary, never the primary mark.
- **Letterforms come from a real typeface's outlines**, never traced from a generated image. Open-licence only: **Reem Kufi** or **Amiri**, both OFL.
- **Generated images inform direction only** — composition, weight, mood, colour. Every generated artefact is labelled as having non-real Arabic.
- **No hex literals in source SVGs.** Source uses `currentColor`; emitted assets bake a value *resolved from a token alias* at build time.
- **The ADR-0040 palette is a constraint.** No palette value changes in this plan.
- **Source of truth is `@kaleem/tokens`, repo-only.** No Figma library.
- **`tokens` stays zero-runtime-dependency.** The rasteriser is a `devDependency` and its output is committed. Its CI therefore installs (frozen, from a committed lockfile) — Task 8a, E3.
- **Existing type pairing is not re-opened**: Fraunces / Inter / IBM Plex Sans Arabic stay.
- **Gates are ADR-0026 ratchets** and every one is mutation-checked before it is trusted.
- **Trunk-based**: `feat/…` → PR → trunk in every repo. No direct pushes. No `--no-verify`. A meta pointer bump is a staging deploy (ADR-0028).
- **Local pip is broken** by a dead proxy: prefix pip with `PIP_CONFIG_FILE=/dev/null`.

---

## File Structure

**meta** (docs only)
- Create `docs/adr/0043-tokens-carries-brand-assets.md` — why the package stops being CSS-only.
- Create `docs/adr/0044-the-kaleem-brand.md` — the mark, its production method, usage. Written *after* selection.
- Create `docs/brand/brief.md` — the brief the exploration answers.
- Create `docs/brand/usage.md` — the extended usage guide.
- Modify `STATE.md`, `docs/superpowers/journal/2026-W38.md` at close.

**tokens**
- Create `brand/brand.json` — the asset + colour manifest. One responsibility: declare what exists and what colour it takes.
- Create `brand/src/*.svg` — hand-authored, colourless source marks.
- Create `brand/dist/*` — emitted, committed derivatives. Images only: no web manifest (E6).
- Create `brand/tools/outline.py` — the one-off, reproducible glyph→path extraction.
- Create `brand.mjs` — emitter + validators. Every function takes the manifest as a parameter. Mirrors `build.mjs`'s `--check` contract.
- Create `test/brand.test.mjs` — the gates.
- Create `pnpm-lock.yaml` — the repo's first lockfile (E3).
- Create `test/fixtures/brand/` — fixture manifest, sources and `dist/`, so the pipeline's gates run before the real mark exists (E7).
- Modify `.github/workflows/ci.yml` — a frozen install step and a rewritten "No dependencies" comment (E3).
- Modify `package.json` — `files`, `exports`, `scripts.test`, `devDependencies`.
- Modify `src/contrast-pairs.json` — declare the mark-on-surface pairs.

**dashboard**
- Create `src/ui/Wordmark.tsx` — the single shared wordmark component (kills both hand-built copies, E8).
- Modify `src/features/shell/AppTopbar.tsx:43`, `src/features/shell/AppTopbar.test.tsx:42`, `src/ui/auth-layout.tsx:10`, `src/ui/auth-layout.test.tsx:23`, `scripts/check-colors.mjs` (delete both `TEXT_ON_SURFACE_ALLOW` entries), `index.html`, `public/`.

**marketing**
- Modify `src/pages/index.astro`, `src/layouts/Layout.astro` (icons + absolute OG meta), `tests/home.test.ts`, `astro.config.mjs` (`site`), `public/`.

**backend**
- Swap the hosted raster into the header slot that `ntf-email-foundation` builds (the backend sends text-only email today, E10).

---

## Phase 0 — Direction (contains the human gate)

### Task 1: Write the brand brief

**Files:**
- Create: `docs/brand/brief.md`

**Status (E11):** the brief this task produced is being rewritten by owner decision (2026-10-17) under `inf-brand-brief-rewrite`. `docs/brand/brief.md` carries a status line saying so; no direction work is judged against the original.

**Interfaces:**
- Consumes: the spec's decisions table.
- Produces: `docs/brand/brief.md` — the document Task 2's exploration is judged against, and the input ADR-0044 quotes.

- [ ] **Step 1: Write the brief**

Create `docs/brand/brief.md` containing exactly these sections, filled in:

```markdown
# kaleem brand brief

## Who this is for
Parents (who pay) and students (who attend) who do **not read Arabic**, studying
Quran, Tafsir and Arabic language with a live teacher. Teachers are the other side
of the market and see the same brand.

## What the mark must say
Trustworthy enough to hand a child and a monthly payment to. Rooted in Islamic
scholarly tradition without being austere or clerical. Modern enough to sit in a
software product next to a video call.

## What it must not say
Not a mosque logo. Not a government ministry. Not a generic edtech startup.
Not a novelty "Arabian" pastiche.

## Hard constraints
- The mark is كليم, Arabic-first, calligraphic.
- Colour comes from the ADR-0040 palette. The mark does not get new colours.
- Must read at 16px and crop to a square.
- Must have an RTL and an LTR lockup.
- Latin "kaleem" is lowercase, matching the existing product voice.

## How we will know it worked
An Arabic reader confirms كليم reads as كليم. A non-Arabic reader can tell the
brand apart from its neighbours at 16px. The owner judges it dignified, not generic.
```

- [ ] **Step 2: Commit**

```bash
git add docs/brand/brief.md
git commit -m "docs: the brand brief the exploration answers"
```

---

### Task 2: Produce direction options and select one

**Files:**
- Create: `docs/brand/directions/` (working artefacts; generated images live here and are labelled)

**Interfaces:**
- Consumes: `docs/brand/brief.md`.
- Produces: **one selected direction**, recorded as `docs/brand/directions/SELECTED.md` naming the direction, the source typeface (`Reem Kufi` or `Amiri`), and the composition notes the redraw must honour.

- [ ] **Step 1: Render real type specimens first**

Before any generation, produce a plain reference sheet of كليم set in Reem Kufi and in Amiri at several weights and sizes. This is the *correctness anchor* — every generated direction is shown beside it.

- [ ] **Step 2: Generate direction options**

Use the Claude Design canvas to lay out 4–6 directions on one artboard set, exploring composition, weight, mood and colour only, each paired with the Step 1 specimen.

Every artboard MUST carry this label, visibly:

> ⚠ The Arabic letterforms in this image are generated and are NOT real Arabic. Judge composition, weight, mood and colour only.

- [ ] **Step 3: HUMAN GATE — the owner selects**

Stop. The owner picks one direction and names the source typeface. **Do not proceed to Phase 2 without this.** No automated check can substitute for it.

- [ ] **Step 4: Record the selection**

Write `docs/brand/directions/SELECTED.md`: the chosen direction, the source typeface, the composition notes binding the redraw, and what was rejected and why.

- [ ] **Step 5: Commit**

```bash
git add docs/brand/directions
git commit -m "docs: selected brand direction and what it binds"
```

---

## Phase 1 — The package-scope ADR

### Task 3: ADR-0043 — tokens carries brand assets

**Files:**
- Create: `docs/adr/0043-tokens-carries-brand-assets.md`

**Interfaces:**
- Produces: the accepted decision every `tokens` change in Phase 2 rests on.

- [ ] **Step 1: Write the ADR**

Follow `docs/templates/` ADR shape. It must state:

- **Context:** `@kaleem/tokens` is CSS-only by design (memory of ADR-0041: "CSS-only so components stay in `src/ui`"). Brand assets are binary/vector artefacts consumed at build time by two frontends and one backend.
- **Decision:** `tokens` carries brand assets under `brand/`, with source (colourless SVG) and emitted (committed derivatives) separated, bound by `brand/brand.json`.
- **Why not a sixth submodule:** another pointer to keep in sync on every deploy, for isolation nothing needs.
- **Why not per-consumer copies:** two copies drift; the purple favicon shipping in both repos today is the existing proof.
- **Why not meta:** meta is docs + CI + pointer bumps (CLAUDE.md), so it holds the usage guide, not build-time assets.
- **Consequences:** the package gains a devDependency (`@resvg/resvg-js`) whose output is committed, so consumers still install zero runtime deps; `files`/`exports` grow; the `--check` contract now covers emitted assets as well as CSS.

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0043-tokens-carries-brand-assets.md
git commit -m "docs: ADR-0043 — @kaleem/tokens carries brand assets, not only CSS"
```

---

## Phase 2 — `tokens`: the mark, the emitter, the gates

All Phase 2 work happens in the `tokens` submodule on `feat/brand`.

### Task 4: The manifest and the asset-presence gate

*Owner: `inf-brand-tokens-pipeline`.*

**Files:**
- Create: `tokens/brand/brand.json`
- Create: `tokens/brand.mjs`
- Create: `tokens/test/brand.test.mjs`
- Create: `tokens/test/fixtures/brand/brand.json` and the fixture files it declares
- Modify: `tokens/package.json`

**Interfaces:**
- Produces: `brand.mjs` exporting `manifest` (the parsed default manifest, `brand/brand.json`), `loadManifest(path)`, `declared(m = manifest)` → `{id, file, kind}[]` over source, emitted and extras, and `missing(m = manifest)` → the subset whose file does not exist. **The manifest is a parameter**, so the gates run against `test/fixtures/brand/` while the shipped manifest is still empty (E7). Later tasks import all of these.

The shipped `brand/brand.json` starts with **empty** `source`, `emitted` and `extras` lists, so this task
merges into tokens `main` green. The real entries arrive in Task 8b with the real files.

- [ ] **Step 1: Write the failing test**

Create the fixtures first. `test/fixtures/brand/brand.json` declares one source mark
(`test/fixtures/brand/src/mark.svg`, a few lines of valid SVG) and nothing emitted yet.
`test/fixtures/brand/brand-missing.json` declares a file that does not exist.

Create `tokens/test/brand.test.mjs`:

```js
// Brand asset gates. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { declared, missing, loadManifest } from "../brand.mjs";

const FIXTURE = loadManifest("test/fixtures/brand/brand.json");
const FIXTURE_MISSING = loadManifest("test/fixtures/brand/brand-missing.json");

test("the fixture manifest declares its mark", () => {
	assert.ok(declared(FIXTURE).some((a) => a.id === "mark"));
});

test("every declared asset exists on disk", () => {
	assert.deepEqual(
		missing(FIXTURE).map((a) => a.file),
		[],
		"declared in the manifest but not present on disk",
	);
});

test("missing() reports a declared asset that is absent", () => {
	assert.deepEqual(
		missing(FIXTURE_MISSING).map((a) => a.id),
		["gone"],
		"the presence gate did not notice an absent file",
	);
});

test("the shipped manifest's declarations all exist (vacuous until Task 8b)", () => {
	assert.deepEqual(missing().map((a) => a.file), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL — `Cannot find module '../brand.mjs'`.

- [ ] **Step 3: Write the manifest**

Create `tokens/brand/brand.json`. Colour values are **flat theme aliases** (E1): `resolveTheme()`
returns keys such as `primary-text` and `background`, with no `color.` prefix.

```json
{
  "$description": "Brand asset manifest. Declares every mark asset and binds each to a COLOUR TOKEN ALIAS rather than a literal. Source SVGs carry no colour (currentColor only); emitted assets bake a value resolved from these aliases at build time. NOT a DTCG token file — deliberately not named *.tokens.json so a DTCG parser never reads it as tokens.",
  "color": {
    "mark": "{primary-text}",
    "reversed": "{background}"
  },
  "source": [],
  "emitted": [],
  "extras": []
}
```

- [ ] **Step 4: Write the minimal emitter**

Create `tokens/brand.mjs`:

```js
#!/usr/bin/env node
// brand.mjs — the brand asset manifest, its validators, and the derivative emitter.
//
// WHY THIS EXISTS (ADR-0043): brand assets are data too. The manifest owns WHAT
// exists and WHAT COLOUR it takes; the SVG files own SHAPE only. Keeping colour out
// of the source files is what lets the gate prove no hex literal ever ships, and
// what lets a palette change repaint every asset without touching a path.
//
// Mirrors build.mjs's contract:
//   node brand.mjs                    write brand/dist/*
//   node brand.mjs --check            rebuild in memory, diff against what is committed, exit 1
//   node brand.mjs <manifest> [--check]   the same, for another manifest (the fixtures)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = "brand/brand.json";

/** A manifest read from a path under the package root. */
export const loadManifest = (path = DEFAULT_MANIFEST) =>
	JSON.parse(readFileSync(join(ROOT, path), "utf8"));

export const manifest = loadManifest();

/**
 * Every declared asset in one flat list.
 *
 * Three kinds, and the kind decides which gates apply: `source` marks are
 * shape-only SVGs (hygiene-gated, emitted from); `emitted` artefacts are built and
 * drift-gated; `extras` are hand-authored non-mark collateral — stationery, an
 * email signature — which exist and are presence-gated but are neither SVG nor
 * emitted, so forcing them through either gate would make that gate lie.
 */
export const declared = (m = manifest) => [
	...m.source.map((a) => ({ ...a, kind: "source" })),
	...m.emitted.map((a) => ({ ...a, kind: "emitted" })),
	...(m.extras ?? []).map((a) => ({ ...a, kind: "extra" })),
];

/** Declared assets whose file is not on disk. */
export const missing = (m = manifest) =>
	declared(m).filter((a) => !existsSync(join(ROOT, a.file)));
```

- [ ] **Step 5: Run the tests**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS — all four. The third test is the mutation check for the presence gate: it
feeds the gate an absent file and requires it to be reported.

- [ ] **Step 6: Wire the gate into the package's test script**

In `tokens/package.json`, `scripts.test` already runs `node --test test/*.test.mjs`, so the new file is picked up automatically. Add `"brand"` and `"brand.mjs"` to `files` and these `exports`:

```json
    "./brand.mjs": "./brand.mjs",
    "./brand/brand.json": "./brand/brand.json",
    "./brand/src/*.svg": "./brand/src/*.svg",
    "./brand/dist/*": "./brand/dist/*"
```

**The two wildcard subpaths are load-bearing** (pre-flight Ruling 1). Node and Vite resolve a
package subpath ONLY if the `exports` map lists it; without these, `@kaleem/tokens/brand/src/mark.svg`
fails to resolve in Task 10 as a build error, not a test failure.

- [ ] **Step 7: Commit a green gate**

```bash
git add brand/brand.json brand.mjs test/brand.test.mjs test/fixtures/brand package.json
git commit -m "test: gate that every declared brand asset exists, on fixtures until the mark lands"
```

---

### Task 5: The master mark — redraw from real outlines

*Owner: `inf-brand-mark-assets`.*

**Files:**
- Create: `tokens/brand/tools/outline.py`
- Create: `tokens/brand/src/mark.svg`

**Interfaces:**
- Consumes: `docs/brand/directions/SELECTED.md` (direction + source typeface), `declared()`/`missing()` from Task 4.
- Produces: `brand/src/mark.svg` — a single-path, colourless (`currentColor`), tightly-viewBoxed master mark, and `brand/tools/outline.py` making its derivation reproducible. The same script outlines the Latin text in Task 7.

- [ ] **Step 1: Extract the shaped outlines reproducibly**

Create `tokens/brand/tools/outline.py`. It **shapes** the text with HarfBuzz (E4): Arabic joins are
contextual, so reading each letter through `cmap` yields isolated forms that do not connect.
HarfBuzz returns the joined glyph IDs, in visual order, with their advances and offsets. The
script draws exactly those glyphs at exactly those positions.

```python
"""Outline a shaped word from an OFL font as SVG paths.

WHY A SCRIPT AND NOT A ONE-OFF: the mark's correctness comes from the font's
outlines, not from anyone's hand or from a generated image. Recording the
extraction makes that claim checkable by someone who was not here.

WHY SHAPING: Arabic letters change form with their neighbours. Looking each
letter up in `cmap` gives the isolated form, and drawing those side by side does
not join. HarfBuzz applies the font's own substitution rules (init/medi/fina) and
returns the glyph IDs to draw and where. The raw output is already the joined
word; the later redraw only stylises it.

    PIP_CONFIG_FILE=/dev/null python -m venv .venv
    .venv/bin/pip install fonttools uharfbuzz
    .venv/bin/python brand/tools/outline.py <font.ttf> كليم > brand/src/_raw.svg
    .venv/bin/python brand/tools/outline.py <font.ttf> kaleem --dir ltr --script Latn --lang en

(The uharfbuzz calls below are written from its documented API; the pipeline run that
first executes this confirms the signatures. See the plan's Errata.)
"""
import argparse

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("text")
    ap.add_argument("--dir", default="rtl", choices=["rtl", "ltr"])
    ap.add_argument("--script", default="Arab")
    ap.add_argument("--lang", default="ar")
    args = ap.parse_args()

    tt = TTFont(args.font)
    glyph_set = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    upem = tt["head"].unitsPerEm

    face = hb.Face(hb.Blob.from_file_path(args.font))
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(args.text)
    buf.direction = args.dir
    buf.script = args.script
    buf.language = args.lang
    hb.shape(font, buf)

    # HarfBuzz returns glyphs in visual (left-to-right) order, even for RTL text,
    # so the pen simply advances rightwards. No reversing.
    x = 0
    parts = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyph_set)
        glyph_set[order[info.codepoint]].draw(pen)
        # Font space is y-up and SVG is y-down: flip y about the baseline.
        tx, ty = x + pos.x_offset, upem - pos.y_offset
        parts.append(f'<path transform="translate({tx},{ty}) scale(1,-1)" d="{pen.getCommands()}"/>')
        x += pos.x_advance
    print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x} {upem}">')
    print("\n".join(parts))
    print("</svg>")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it against the selected face**

```bash
cd tokens
PIP_CONFIG_FILE=/dev/null python3 -m venv /tmp/brandvenv
PIP_CONFIG_FILE=/dev/null /tmp/brandvenv/bin/pip install fonttools uharfbuzz
/tmp/brandvenv/bin/python brand/tools/outline.py <path-to-ReemKufi-or-Amiri.ttf> كليم > brand/src/_raw.svg
```

**Note:** the raw output is the font's own joined word, shaped by HarfBuzz. It is a starting
point for the stylised redraw, not the mark: the redraw changes weight, terminals and
proportion toward `SELECTED.md`, and must keep the joins the shaper produced. Do not ship
`_raw.svg`. If the word does not join in the render, the shaping inputs (direction, script,
language) are wrong; fix those rather than hand-joining.

- [ ] **Step 3: Redraw the master**

Produce `brand/src/mark.svg` from `_raw.svg`, stylised toward the direction in `SELECTED.md`, honouring these rules:

- Letter **joins and final forms preserved** — this is what the owner will check.
- `fill="currentColor"` only. **No hex, no `rgb()`, no embedded `<image>`.**
- One tight `viewBox`, origin at 0 0.
- A `<title>kaleem</title>` as the first child, so the mark has an accessible name wherever it is inlined.

Delete `_raw.svg`.

- [ ] **Step 4: Run the gate and watch it go green**

Add the mark to `brand/brand.json`'s `source` list (Task 8b completes the rest), then:

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS — the shipped-manifest presence test is no longer vacuous.

- [ ] **Step 5: Mutation-check the gate**

```bash
mv brand/src/mark.svg /tmp/mark.svg && node --test test/brand.test.mjs; mv /tmp/mark.svg brand/src/mark.svg
```

Expected: FAIL naming `brand/src/mark.svg`. A gate that has never failed proves nothing.

- [ ] **Step 6: HUMAN GATE — Arabic letterform sign-off**

Render `brand/src/mark.svg` and have the owner confirm كليم reads as كليم: joins correct, final forms correct, no invented glyph. **Nothing automated can do this.** Do not continue on a "looks fine".

- [ ] **Step 7: Commit**

```bash
git add brand/src/mark.svg brand/tools/outline.py brand/brand.json
git commit -m "feat: the كليم master mark, redrawn from OFL outlines"
```

---

### Task 6: The SVG hygiene gate

*Owner: `inf-brand-tokens-pipeline`.*

**Files:**
- Modify: `tokens/brand.mjs`
- Modify: `tokens/test/brand.test.mjs`

**Interfaces:**
- Produces: `brand.mjs` exporting `svgIssues(text)` → `string[]` (empty means clean). Task 7 reuses it for the lockups.

- [ ] **Step 1: Write the failing test**

Append to `tokens/test/brand.test.mjs`. The first test runs over the **fixture** manifest, so it is
meaningful before the mark exists; once Task 8b fills the shipped manifest, add the same loop over `declared()`.

```js
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { svgIssues } from "../brand.mjs";

const TOKENS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("source marks carry shape only — no colour, no raster, no live text", () => {
	for (const m of [FIXTURE, undefined]) {
		for (const a of declared(m).filter((a) => a.kind === "source")) {
			const text = readFileSync(join(TOKENS_ROOT, a.file), "utf8");
			assert.deepEqual(svgIssues(text), [], `${a.file} is not clean`);
		}
	}
});

test("the hygiene check actually catches a hex literal", () => {
	assert.ok(
		svgIssues('<svg viewBox="0 0 1 1"><path fill="#863bff" d="M0 0"/></svg>')
			.some((i) => i.includes("hex")),
		"a hex fill slipped past svgIssues",
	);
});

test("the hygiene check actually catches an embedded raster", () => {
	assert.ok(
		svgIssues('<svg viewBox="0 0 1 1"><image href="x.png"/></svg>')
			.some((i) => i.includes("raster")),
		"an embedded raster slipped past svgIssues",
	);
});

test("the hygiene check actually catches live text", () => {
	assert.ok(
		svgIssues('<svg viewBox="0 0 1 1"><title>t</title><text x="0" y="1">kaleem</text></svg>')
			.some((i) => i.includes("<text>")),
		"a live <text> slipped past svgIssues",
	);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL — `svgIssues` is not exported.

- [ ] **Step 3: Implement `svgIssues`**

Append to `tokens/brand.mjs`:

```js
/**
 * Hygiene problems in a SOURCE mark. Empty array means clean.
 *
 * Source marks are shape only. Colour arrives at emit time from a token alias,
 * which is the whole reason a palette change can repaint every asset without
 * anyone opening a path. A hex literal in here would silently opt an asset out
 * of that — exactly how the #863bff favicon outlived the palette it predates.
 *
 * Live text is banned for a second reason (E5): resvg rasterises <text> with
 * whatever fonts the machine has, so the PNGs would differ between machines and
 * `--check` would stop being reproducible; inlined in a page, the text would take
 * the PAGE's font. Letters ship as outlines.
 */
export const svgIssues = (text) => {
	const issues = [];
	if (/#[0-9a-fA-F]{3,8}\b/.test(text)) issues.push("contains a hex colour literal");
	if (/\brgba?\(/.test(text)) issues.push("contains an rgb() colour literal");
	if (/<image\b/.test(text)) issues.push("contains an embedded raster (<image>)");
	if (/<text\b/.test(text)) issues.push("contains live text (<text>); outline it");
	if (!/viewBox\s*=/.test(text)) issues.push("has no viewBox");
	if (!/<title>/.test(text)) issues.push("has no <title> (no accessible name)");
	return issues;
};
```

- [ ] **Step 4: Run the tests**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS — all eight (four from Task 4, four here).

- [ ] **Step 5: Commit**

```bash
git add brand.mjs test/brand.test.mjs
git commit -m "test: source marks carry shape only, gate mutation-checked three ways"
```

---

### Task 7: Lockups, monochrome and reversed variants

*Owner: `inf-brand-mark-assets`.*

**Files:**
- Create: `tokens/brand/src/lockup-ltr.svg`, `tokens/brand/src/lockup-rtl.svg`, `tokens/brand/src/mark-square.svg`
- Modify: `tokens/brand/brand.json`

**Interfaces:**
- Consumes: `brand/src/mark.svg`, `svgIssues`.
- Produces: three further source assets, each declared in `manifest.source`, each passing the Task 6 gate unchanged.

Monochrome and reversed need **no separate files** — a source mark that uses only `currentColor` is already both. Producing files for them would be three copies to keep in sync. That is the YAGNI call; the usage guide records it.

- [ ] **Step 1: Add the declarations first (red)**

In `brand/brand.json`, extend `source`:

```json
    { "id": "mark", "file": "brand/src/mark.svg", "role": "master" },
    { "id": "lockup-ltr", "file": "brand/src/lockup-ltr.svg", "role": "lockup" },
    { "id": "lockup-rtl", "file": "brand/src/lockup-rtl.svg", "role": "lockup" },
    { "id": "mark-square", "file": "brand/src/mark-square.svg", "role": "icon" },
    { "id": "og-card", "file": "brand/src/og-card.svg", "role": "composition" },
    { "id": "email-header", "file": "brand/src/email-header.svg", "role": "composition" }
```

**`og-card.svg` and `email-header.svg` are their own compositions** (pre-flight Ruling 2), authored
at **exactly 1200:630 and 4:1** respectively. They are NOT the lockup rescaled: the emitter fits to
width, so pointing the 1200x630 card at `lockup-ltr` would either distort the mark or emit the wrong
height — and the dimension gate would pass a distorted mark happily.

- [ ] **Step 2: Run the gate and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL listing the three absent files.

- [ ] **Step 3: Author the three assets**

- `lockup-ltr.svg` — the mark with Latin "kaleem" to its right, reading left-to-right.
- `lockup-rtl.svg` — the mirrored composition. **Mirror the layout, never the glyphs.**
- `mark-square.svg` — the mark composed on a 1:1 viewBox with the clear-space the favicon and avatar need.
- `og-card.svg` — a 1200:630 composition: the lockup on a token-coloured field, with the clear space a link preview needs.
- `email-header.svg` — a 4:1 composition sized for an email header band.

Every one: `currentColor` only, tight `viewBox`, `<title>kaleem</title>` first child.

**The Latin "kaleem" in each lockup is outlined, never live `<text>`** (E5). Extract it with the same
tool as the mark, from the Inter or Fraunces files the consumers already ship:
`.venv/bin/python brand/tools/outline.py <Inter-or-Fraunces.ttf> kaleem --dir ltr --script Latn --lang en`,
and place the resulting paths in the lockup. Live text would be rasterised by resvg with whatever fonts
the machine has, so the PNGs would differ between machines and `--check` would stop being reproducible;
inlined in a page it would take the page's font. `svgIssues` (Task 6) now fails on a `<text>`.

- [ ] **Step 4: Run the gate**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brand/src brand/brand.json
git commit -m "feat: LTR and RTL lockups and the square icon composition"
```

---

### Task 8a: The derivative emitter and its gates (pipeline)

*Owner: `inf-brand-tokens-pipeline`. Merges into tokens `main` green, before any real asset exists.*

**Files:**
- Modify: `tokens/brand.mjs`, `tokens/package.json`, `tokens/test/brand.test.mjs`, `tokens/.github/workflows/ci.yml`
- Create: `tokens/pnpm-lock.yaml`, `tokens/test/fixtures/brand/` (the fixture manifest, its sources, and a committed `dist/`)

**Interfaces:**
- Consumes: `resolveTheme` and `light`/`dark` from `build.mjs`; `manifest`, `loadManifest`.
- Produces: `brand.mjs` exporting `markColor(themeName, key)` → resolved hex string, `emit(m)` → `{path: Buffer|string}`, `drift(m)` → the paths whose committed bytes differ from `emit(m)`, `pngSize(buffer)` → `{width, height}`, `iconSetIssues(m)` → `string[]`, and a `--check` mode matching `build.mjs`'s contract. **Every function takes the manifest as a parameter** (E7), so the gates run on `test/fixtures/brand/` until Task 8b. The emitter writes **images only**: no web manifest (E6).

- [ ] **Step 1: Write the failing tests**

Add to the fixture manifest an `emitted` list: `favicon-svg` (svg), `icon-192` (png 192x192), `og-card` (png 1200x630, from a fixture `og-card` source authored at 1200:630). Append to `tokens/test/brand.test.mjs`:

```js
import { pngSize, markColor, emit, drift, iconSetIssues } from "../brand.mjs";

test("every emitted raster is exactly the size it declares", () => {
	const out = emit(FIXTURE);
	for (const a of declared(FIXTURE).filter((a) => a.kind === "emitted" && a.format === "png")) {
		assert.deepEqual(pngSize(out[a.file]), { width: a.width, height: a.height }, `${a.file} is the wrong size`);
	}
});

test("a declared icon with the wrong size is reported", () => {
	const bad = structuredClone(FIXTURE);
	bad.emitted.find((a) => a.id === "icon-192").width = 100;
	assert.ok(iconSetIssues(bad).some((i) => i.includes("icon-192")), "a mis-declared icon slipped through");
});

test("the OG card is exactly 1200x630, declared and emitted", () => {
	for (const m of [FIXTURE, undefined]) {
		const og = declared(m).find((a) => a.id === "og-card" && a.kind === "emitted");
		if (!og) continue; // the shipped manifest is empty until Task 8b
		assert.deepEqual([og.width, og.height], [1200, 630]);
		assert.deepEqual(pngSize(emit(m)[og.file]), { width: 1200, height: 630 });
	}
});

test("the mark colour resolves from a token, and is not the purple it replaces", () => {
	for (const theme of ["light", "dark"]) {
		const c = markColor(theme);
		assert.match(c, /^#[0-9a-fA-F]{6,8}$/, `${theme}: mark colour did not resolve to a literal`);
		assert.notEqual(c.toLowerCase(), "#863bff", "still shipping the off-palette favicon colour");
	}
});

test("an unresolvable alias throws rather than emitting undefined", () => {
	assert.throws(() => markColor("light", "nope"));
});

test("committed fixture output matches what the emitter produces now", () => {
	assert.deepEqual(drift(FIXTURE), []);
});

test("the drift gate notices a changed byte", () => {
	const out = emit(FIXTURE);
	const svg = Object.keys(out).find((f) => f.endsWith(".svg"));
	out[svg] += "\n";
	assert.ok(drift(FIXTURE, out).includes(svg), "the drift gate did not notice a changed file");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL — `pngSize` is not exported.

- [ ] **Step 3: Implement colour resolution and PNG sizing**

Append to `tokens/brand.mjs`:

```js
import { resolveTheme, light, dark } from "./build.mjs";

/**
 * The mark's colour for a theme, resolved from the alias in brand.json.
 *
 * Aliases are FLAT theme keys (`{primary-text}`, `{background}`): resolveTheme()
 * returns `primary-text`, not `color.primary.text` (E1). A `color.`-prefixed alias
 * resolves to undefined, which is why this throws instead of passing it on.
 */
export const markColor = (themeName, key = "mark", m = manifest) => {
	const flat = resolveTheme(themeName === "dark" ? dark : light);
	const alias = m.color[key];
	if (!alias) throw new Error(`brand.json has no colour '${key}'`);
	const value = flat[alias.replace(/^\{|\}$/g, "")];
	if (!value) throw new Error(`brand.json colour.${key} → unresolved token ${alias}`);
	return value;
};

/**
 * A PNG's real dimensions, read from its IHDR header.
 *
 * Deliberately dependency-free: the declared size of an emitted asset is exactly
 * the kind of thing that drifts silently, and a gate that needs an install to run
 * is a gate that eventually stops running.
 */
export const pngSize = (buffer) => {
	const sig = buffer.subarray(0, 8).toString("hex");
	if (sig !== "89504e470d0a1a0a") throw new Error("not a PNG");
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};
```

- [ ] **Step 4: Implement `emit()`, `drift()`, `iconSetIssues()` and `--check`**

Add `@resvg/resvg-js` as a **devDependency** (`pnpm add -D @resvg/resvg-js`) — never a dependency, because output is committed and consumers must keep installing zero runtime deps. This writes `pnpm-lock.yaml`, the repo's first lockfile (E3); commit it.

Append to `tokens/brand.mjs`:

```js
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";

const sourceById = (m, id) => {
	const a = m.source.find((s) => s.id === id);
	if (!a) throw new Error(`brand.json: no source asset '${id}'`);
	return readFileSync(join(ROOT, a.file), "utf8");
};

/**
 * Every emitted IMAGE, in memory, keyed by its path.
 *
 * Images only (E6): the web manifest that references the icons belongs to each
 * consumer, which keeps the icon file names and overwrites only the images.
 * `extras` never reach here — they are hand-authored, not emitted.
 */
export const emit = (m = manifest) => {
	const out = {};
	for (const a of m.emitted) {
		// Colour is baked HERE, resolved from the alias — never written into a source file.
		const coloured = sourceById(m, a.from).replace(
			/currentColor/g,
			markColor("light", a.color, m),
		);
		out[a.file] =
			a.format === "svg"
				? coloured
				: new Resvg(coloured, { fitTo: { mode: "width", value: a.width } })
						.render()
						.asPng();
	}
	return out;
};

/** Paths whose committed bytes differ from what the emitter produces now. */
export const drift = (m = manifest, artefacts = emit(m)) =>
	Object.entries(artefacts)
		.filter(([file, content]) => {
			const path = join(ROOT, file);
			if (!existsSync(path)) return true;
			const onDisk = readFileSync(path);
			return Buffer.isBuffer(content)
				? !onDisk.equals(content)
				: onDisk.toString("utf8") !== content;
		})
		.map(([file]) => file);

/** Every declared PNG must be emitted at exactly its declared size. */
export const iconSetIssues = (m = manifest) => {
	const out = emit(m);
	return m.emitted
		.filter((a) => a.format === "png")
		.flatMap((a) => {
			const got = pngSize(out[a.file]);
			return got.width === a.width && got.height === a.height
				? []
				: [`${a.id}: declared ${a.width}x${a.height}, emitted ${got.width}x${got.height}`];
		});
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	// `node brand.mjs [manifest.json] [--check]`: the manifest path is optional and
	// defaults to the shipped one, so the same CLI can drive the fixtures (E12).
	const path = process.argv.slice(2).find((a) => !a.startsWith("--"));
	const m = path ? loadManifest(path) : manifest;
	const artefacts = emit(m);
	if (process.argv.includes("--check")) {
		const drifted = drift(m, artefacts);
		for (const f of drifted) console.error(`${f} has drifted — run \`node brand.mjs\``);
		process.exit(drifted.length ? 1 : 0);
	}
	for (const [file, content] of Object.entries(artefacts)) {
		mkdirSync(dirname(join(ROOT, file)), { recursive: true });
		writeFileSync(join(ROOT, file), content);
	}
}
```

The fixture's committed `dist/` is produced once, with the same CLI, and committed with the fixtures:

```bash
cd tokens && node brand.mjs test/fixtures/brand/brand.json
```

The fixture's mutation check is Step 7 below plus the "notices a changed byte" test above; neither
touches real assets.

- [ ] **Step 5: Run the tests**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Wire the check into the package's test script and the tokens CI**

In `tokens/package.json`:

```json
    "test": "node build.mjs --check && node brand.mjs --check && node --test test/*.test.mjs",
    "brand": "node brand.mjs"
```

In `tokens/.github/workflows/ci.yml`, add a frozen install before the first check, and rewrite the
comment above it — it says "No dependencies by design" and "nothing to install", which stops being
true once the rasteriser exists (E3). Use the same pnpm setup the meta dashboard job uses
(`pnpm/action-setup@v6`, `version: 10`, node 22):

```yaml
      - uses: pnpm/action-setup@v6
        with:
          version: 10

      # No RUNTIME dependencies (ADR-0041, ADR-0043): consumers install nothing. CI does
      # install one devDependency, the SVG rasteriser `brand.mjs` needs to rebuild the
      # committed brand PNGs, so --check can prove they are current. The lockfile is
      # committed and the install is frozen.
      - run: pnpm install --frozen-lockfile
```

The CI's existing `node build.mjs --check` and `node --test` steps stay as they are; add
`node brand.mjs --check` beside them. ADR-0043 already lists the install as a cost.

- [ ] **Step 7: Mutation-check the drift gate**

Two commands, because the shipped manifest is empty in 8a (E7): a bare `node brand.mjs --check` emits
nothing, finds no drift and exits 0 whatever the fixture holds, so it proves nothing here (E12). Point
the CLI at the fixture, and run the suite, which holds the drift test:

```bash
cd tokens
printf '\n' >> test/fixtures/brand/dist/favicon.svg
node brand.mjs test/fixtures/brand/brand.json --check; echo "cli rc=$?"
node --test test/brand.test.mjs; echo "suite rc=$?"
git checkout test/fixtures/brand/dist/favicon.svg
node brand.mjs test/fixtures/brand/brand.json --check; echo "restored cli rc=$?"
node --test test/brand.test.mjs; echo "restored suite rc=$?"
```

Expected: while the byte is changed, the CLI prints `test/fixtures/brand/dist/favicon.svg has drifted`
and `cli rc=1`, and the suite fails in "committed fixture output matches what the emitter produces now"
(`suite rc=1`). After the restore both are rc=0. A bare `node brand.mjs --check` is run only as the
CI step, not as this check.
Run the same check against the real tree in Task 8b, targeting `brand/dist/favicon.svg`; there the
default manifest is the real one, so the bare `node brand.mjs --check` is meaningful.

- [ ] **Step 8: Commit**

```bash
git add brand.mjs package.json pnpm-lock.yaml test .github/workflows/ci.yml
git commit -m "feat: brand emitter with colour resolved from tokens, size- and drift-gated on fixtures"
```

---

### Task 8b: The real emitted assets (mark)

*Owner: `inf-brand-mark-assets`. Depends on Tasks 5 and 7 and on 8a being on tokens `main`.*

**Files:**
- Modify: `tokens/brand/brand.json`
- Create: `tokens/brand/dist/*`
- Modify: `tokens/test/brand.test.mjs`

- [ ] **Step 1: Move the "declares the mark" test onto the shipped manifest (red)**

Append to `tokens/test/brand.test.mjs`:

```js
test("the shipped manifest declares the core mark and the OG card", () => {
	const ids = declared().map((a) => a.id);
	assert.ok(ids.includes("mark"), "no `mark` declared in brand/brand.json");
	assert.ok(declared().some((a) => a.id === "og-card" && a.kind === "emitted"));
});
```

Expected: FAIL until Step 2 fills the `emitted` list.

- [ ] **Step 2: Declare the emitted assets**

In `brand/brand.json`, fill `emitted`. **There is no `webmanifest` entry** (E6):

```json
  "emitted": [
    { "id": "favicon-svg", "file": "brand/dist/favicon.svg", "from": "mark-square", "format": "svg", "color": "mark" },
    { "id": "favicon-32", "file": "brand/dist/favicon-32.png", "from": "mark-square", "format": "png", "width": 32, "height": 32, "color": "mark" },
    { "id": "icon-192", "file": "brand/dist/icon-192.png", "from": "mark-square", "format": "png", "width": 192, "height": 192, "color": "mark" },
    { "id": "icon-512", "file": "brand/dist/icon-512.png", "from": "mark-square", "format": "png", "width": 512, "height": 512, "color": "mark" },
    { "id": "apple-touch-icon", "file": "brand/dist/apple-touch-icon.png", "from": "mark-square", "format": "png", "width": 180, "height": 180, "color": "mark" },
    { "id": "og-card", "file": "brand/dist/og.png", "from": "og-card", "format": "png", "width": 1200, "height": 630, "color": "mark" },
    { "id": "email-header", "file": "brand/dist/email-header.png", "from": "email-header", "format": "png", "width": 320, "height": 80, "color": "mark" },
    { "id": "email-header-2x", "file": "brand/dist/email-header@2x.png", "from": "email-header", "format": "png", "width": 640, "height": 160, "color": "mark" }
  ]
```

The file names are the ones `rch-pwa-manifest-head` already references, so the consumer's manifest
needs no edit when the brand release overwrites the images.

- [ ] **Step 3: Emit, then run the tests**

```bash
cd tokens && node brand.mjs && npm test
```

Expected: PASS. The size, OG and drift gates now run over the real assets as well as the fixtures.

- [ ] **Step 4: Mutation-check the drift gate on the real tree**

```bash
cd tokens && printf '\n' >> brand/dist/favicon.svg && npm test; git checkout brand/dist/favicon.svg
```

Expected: FAIL naming `brand/dist/favicon.svg`, then green after the restore.

- [ ] **Step 5: Commit**

```bash
git add brand/brand.json brand/dist test/brand.test.mjs
git commit -m "feat: emit the real brand icon set, OG card and email rasters"
```

---

### Task 9: Declare the mark's contrast pairs

*Owner: `inf-brand-mark-assets`.*

**Files:**
- Modify: `tokens/src/contrast-pairs.json`

**Interfaces:**
- Consumes: the existing `contrast.mjs` gate, unchanged.
- Produces: declared pairs so the mark's colour is checked on every surface it may sit on.

- [ ] **Step 1: Add the declarations**

The mark uses `primary-text`, which is already declared against background, card, popover, secondary and muted (the 2026-09-13 fix). Add any surface the mark lands on that is **not** already in that set — at minimum the reversed case. Pairs are flat token keys, in the shape the file already uses (E1). Add to `nonText`, because the mark is a graphic:

```json
{
  "foreground": "background",
  "surfaces": ["primary"],
  "min": 3.0,
  "sc": "1.4.11",
  "label": "reversed mark on a primary field"
}
```

- [ ] **Step 2: Run the contrast gate**

```bash
cd tokens && node contrast.mjs && node --test test/contrast.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Mutation-check it**

Point the reversed alias at a deliberately failing token, re-run, see red, revert.

- [ ] **Step 4: Commit and tag**

```bash
git add src/contrast-pairs.json
git commit -m "feat: declare the mark's surfaces so the contrast gate covers them"
```

Then open the PR into `main`, get it green, merge, and tag:

```bash
git tag v0.3.0 && git push origin v0.3.0
```

---

## Phase 3 — Consumers

### Task 10: dashboard — one shared wordmark, correct favicon

*Owner: `inf-brand-dashboard`.*

**Files:**
- Create: `dashboard/src/ui/Wordmark.tsx`
- Modify: `dashboard/src/features/shell/AppTopbar.tsx` (the wordmark at line 43), `dashboard/src/features/shell/AppTopbar.test.tsx` (line 42), `dashboard/src/ui/auth-layout.tsx` (line 10), `dashboard/src/ui/auth-layout.test.tsx` (line 23), `dashboard/scripts/check-colors.mjs` (the two `TEXT_ON_SURFACE_ALLOW` entries), `dashboard/index.html`, `dashboard/public/`, `dashboard/package.json`

**Interfaces:**
- Consumes: `@kaleem/tokens` at the brand release tag.
- Produces: `<Wordmark variant="mark" | "lockup" />`, accessible name **"kaleem"** in every variant.

**Why this matters (E8):** the dashboard has **two** hand-built wordmarks, not one: `AppTopbar.tsx:43` and
`src/ui/auth-layout.tsx:10`. Each carries a `<span className="text-accent">.</span>` dot, and each dot has
a G2 exemption in `scripts/check-colors.mjs` (`TEXT_ON_SURFACE_ALLOW`). Two tests assert the text:
`AppTopbar.test.tsx:42` and `auth-layout.test.tsx:23` both use `getByText(/kaleem/i)`. Swapping text for
an inline SVG breaks both **unless the mark keeps an accessible name**, so the test change is the point,
not collateral. `rch-pwa-manifest-head` already owns `index.html` and the PNG names: this task adds to
what it built and does not rebuild it.

- [ ] **Step 1: Write the failing tests**

In `AppTopbar.test.tsx`, replace the line-42 assertion, and in `auth-layout.test.tsx` replace the line-23 one, with:

```tsx
it("the wordmark keeps an accessible name after the text is replaced by the mark", () => {
	render(<AppTopbar />, { wrapper: Providers });
	expect(screen.getByRole("img", { name: /kaleem/i })).toBeInTheDocument();
});
```

(The auth-layout test renders `AuthLayout` with a child and asserts the same `getByRole("img", { name: /kaleem/i })`.)

- [ ] **Step 2: Run them and watch them fail**

```bash
cd dashboard && pnpm vitest run src/features/shell/AppTopbar.test.tsx src/ui/auth-layout.test.tsx
```

Expected: FAIL — no element with role `img` named kaleem, in both.

- [ ] **Step 3: Bump the pin and copy the assets**

```bash
cd dashboard
pnpm add "@kaleem/tokens@github:kaleem-lms/tokens#v0.3.0"
cp node_modules/@kaleem/tokens/brand/dist/{favicon.svg,favicon-32.png,icon-192.png,icon-512.png,apple-touch-icon.png} public/
```

**Five image files only.** The manifest is not copied (E6): `rch-pwa-manifest-head` owns the dashboard's
`site.webmanifest`, and it references the same icon file names, so overwriting the images is the whole
change.

- [ ] **Step 4: Write `Wordmark.tsx`**

```tsx
import markSvg from "@kaleem/tokens/brand/src/mark.svg?raw";

/**
 * The wordmark, in one place.
 *
 * It lived as hand-built JSX in AppTopbar AND again in auth-layout (and a third time in
 * marketing's index.astro), which is how they drifted.
 *
 * WHY INLINE AND NOT <img src> (pre-flight Ruling 4): the source mark is colourless
 * by design — it paints with `currentColor` so a token change repaints it. An external
 * SVG loaded through <img> does NOT inherit currentColor; it would render BLACK in both
 * themes and silently defeat the whole colour design while looking like it worked.
 * Inlining is what makes the token colour reach the mark.
 */
export function Wordmark({ className }: { className?: string }) {
	return (
		<span
			role="img"
			aria-label="kaleem"
			className={className}
			// The SVG is our own build-time asset, not user input.
			dangerouslySetInnerHTML={{ __html: markSvg }}
		/>
	);
}
```

**Verify the colour actually lands** before moving on: render the topbar in dark mode and
confirm the mark is the emerald token, not black. A black mark means the inline path broke
and an `<img>` crept back in.

- [ ] **Step 5: Use it in both places and delete both exemptions**

Replace `AppTopbar.tsx:43` (`kaleem<span className="text-accent">.</span>`) with `<Wordmark />`, keeping the existing `display:none` below `sm` behaviour verified on staging 2026-09-13. Replace the same construction at `auth-layout.tsx:10` with `<Wordmark />`.

Delete **both** `TEXT_ON_SURFACE_ALLOW` entries in `scripts/check-colors.mjs` (they existed only to
permit those two dots). Then show the G2 gate red once: restore a `text-accent` on a surface in
either file, run `node scripts/check-colors.mjs`, see it fail, and remove it again. A deleted exemption
that was never seen to matter proves nothing.

- [ ] **Step 6: Point `index.html` at the new SVG icon**

Add the SVG icon link next to the head that `rch-pwa-manifest-head` built:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

Do not touch the `rel="manifest"` link or the `apple-touch-icon` link it already owns; the new
PNGs arrive under the same names.

- [ ] **Step 7: Run the unit tests**

```bash
cd dashboard && pnpm vitest run
```

Expected: PASS. If coverage rises, **raise the floor in `vitest.config.ts`** — that is a normal part of the PR (ADR-0026) — unless the programme's floor rule (`dec-floor-ownership`) says the conductor sets it.

- [ ] **Step 8: Run the e2e suite**

```bash
cd dashboard && pnpm exec playwright test
```

Expected: PASS. The app-shell flows exercise the topbar; if one asserted the wordmark's text, update it to the accessible name rather than deleting the assertion.

- [ ] **Step 9: Commit**

```bash
git add src/ui/Wordmark.tsx src/features/shell src/ui/auth-layout.tsx src/ui/auth-layout.test.tsx scripts/check-colors.mjs public index.html package.json pnpm-lock.yaml
git commit -m "feat: one shared wordmark and the real favicon, replacing the purple placeholder"
```

---

### Task 11: marketing — the same mark, icons and OG card

*Owner: `inf-brand-marketing`.*

**Files:**
- Modify: `marketing/src/pages/index.astro`, `marketing/src/layouts/Layout.astro`, `marketing/tests/home.test.ts`, `marketing/tests/layout.test.ts`, `marketing/astro.config.mjs` (`site`), `marketing/public/`, `marketing/package.json`

**Interfaces:**
- Consumes: `@kaleem/tokens` at the brand release tag (already a dependency — this is a pin bump, not new wiring).
- Produces: marketing rendering the same mark and serving the OG card and the email-header rasters.

Marketing is not untested any more (E9c): it has a vitest suite with a 100/100/100 floor and an e2e
harness (`rch-mkt-test-harness`). `tests/home.test.ts` currently matches `<h1[^>]*>kaleem`, which the swap
below breaks, so the test changes with it.

- [ ] **Step 1: Bump the pin and copy the assets**

```bash
cd marketing
pnpm add "@kaleem/tokens@github:kaleem-lms/tokens#v0.3.0"
cp node_modules/@kaleem/tokens/brand/dist/{favicon.svg,favicon-32.png,icon-192.png,icon-512.png,apple-touch-icon.png,og.png,email-header.png,email-header@2x.png} public/
rm -f public/favicon.ico
```

The web manifest is not copied (E6). The `email-header*.png` files are copied because marketing hosts
the raster that Task 12 points the email at.

- [ ] **Step 2: Write the failing test, then replace the hand-built wordmark**

In `tests/home.test.ts`, change the h1 assertion to say that the `<h1>` holds the named mark:

```ts
expect(html).toMatch(/<h1[^>]*>\s*<span[^>]*role="img"[^>]*aria-label="kaleem"/);
```

Run `pnpm test` and watch it fail, then in `src/pages/index.astro` replace the
`<h1>kaleem<span class="text-accent">.</span></h1>` construction with the **inlined** mark **inside** the
heading (E9a). The `<h1>` keeps its heading role; putting `role="img"` on the `<h1>` itself would remove it.

```astro
---
import markSvg from "@kaleem/tokens/brand/src/mark.svg?raw";
---
<h1><span role="img" aria-label="kaleem" class="text-primary-text" set:html={markSvg} /></h1>
```

**Inline, not `<img src>` (pre-flight Ruling 4)** — same reason as the dashboard: an external SVG
does not inherit `currentColor` and the mark would render black. Astro's `set:html` is the inline
path here. Confirm in the built output that the mark takes the token colour in both themes.

- [ ] **Step 3: Add icons and OG meta to the layout**

`og:image` must be an **absolute** URL (E9b): link previews ignore a relative one. `astro.config.mjs` sets
no `site` today, so `inf-brand-marketing` sets it (the production marketing origin). The layout builds the
URL from `Astro.url`, **not** `Astro.site` (E13):

⚠ `AstroContainer`, which both `tests/home.test.ts` and `tests/layout.test.ts` render through, validates
`ASTRO_CONFIG_DEFAULTS` and ignores `astro.config.mjs` (astro 6.1.5, `dist/container/index.js:116`), and the
pipeline takes `Astro.site` from `manifest.site`, which the container never sets
(`core/base-pipeline.js:55`). So under vitest `Astro.site` is `undefined`, and
`new URL("/og.png", Astro.site)` throws `TypeError: Invalid URL`, breaking every Layout render in the
suite. Setting `site` in the config does not help. `Astro.url` always exists, so it cannot throw, and its
origin is `site` in a static build.

In `src/layouts/Layout.astro`'s `<head>`:

```astro
---
const ogImage = new URL("/og.png", Astro.url).href;
---
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />
  <meta name="twitter:card" content="summary_large_image" />
```

There is no fallback branch, so the 100/100/100 floor needs no extra test for one. Prove it in two
places, because each sees something the other cannot:

- **`tests/layout.test.ts`** (write it first and watch it fail): render the Layout and assert
  `og:image` is absolute and ends in `/og.png`, e.g. `toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/og\.png"/)`.
  It cannot name the production origin, because the container has no `site`; it proves the call does not
  throw and the URL is absolute.
- **The built output** (`pnpm build`): assert `dist/index.html` has `og:image` starting with the
  configured `site` origin. This is the only place `site` is applied. Do it with a command in this step
  (`grep -o 'property="og:image" content="[^"]*"' dist/index.html`) and, if the e2e harness can read the
  built page, an assertion there too. Verify here that `Astro.url`'s origin really is `site` in the static
  build; if it is not, stop and escalate rather than hardcoding the origin.

No `rel="manifest"` link is added here: marketing has no web manifest of its own, and the brand
release does not supply one.

- [ ] **Step 4: Run the checks**

```bash
cd marketing && pnpm test && pnpm check && pnpm build
```

Then run marketing's e2e. Expected: all pass. The suite has a floor; do not lower it.

- [ ] **Step 5: Commit**

```bash
git add src tests astro.config.mjs public package.json pnpm-lock.yaml
git commit -m "feat: the real mark, icon set and OG card on the marketing site"
```

---

### Task 12: backend — the email header raster

*Owner: `inf-brand-email-header`. Depends on `ntf-email-foundation`.*

**Files:**
- Modify: the header slot that `ntf-email-foundation` builds in the transactional email templates

**Interfaces:**
- Consumes: `brand/dist/email-header.png` and `@2x`, hosted by marketing (Task 11 copies them), and an environment variable holding their base URL.

**Why this is not "modify the SES email template" (E10):** the backend sends text-only email today
(`kaleem/templates/account/email/*.txt`), so there is no HTML header to modify. The owner decided
that `ntf-email-foundation` builds the header slot and the brand raster is swapped in later. This task
is that swap. The URL comes from an environment variable, so `hg-vps-env` applies: the variable must
exist on the VPS before this ships.

- [ ] **Step 1: Write the failing test**

Add a backend test asserting the rendered transactional email HTML contains the header image with `alt="kaleem"` and an **absolute** URL built from the environment variable, with a `srcset` for the `@2x` file. SVG is **not** acceptable here — mail clients render it inconsistently, which is why the rasters exist.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && pytest -k email_header -v
```

Expected: FAIL.

- [ ] **Step 3: Put the raster in the header slot, then re-run**

```bash
cd backend && pytest -k email_header -v
```

Expected: PASS.

- [ ] **Step 4: Run the full suite with the project's coverage invocation**

```bash
cd backend && pytest --cov=kaleem --cov=signaling
```

**Never a bare `pytest --cov`** — it omits unimported files and reads ~0.55 high, which has already set a false floor and turned CI red. Note also that `backend/.env` sets `DJANGO_VIDEO_PROVIDER`, so one unrelated test always fails locally and local coverage ≠ CI's. Do not set a floor from a local run.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: transactional email carries the brand header"
```

---

### Task 13: Meta pointer bumps — the deploy

**Files:**
- Modify: `backend`, `dashboard`, `marketing`, `tokens` pointers in meta

**⚠ A merge to meta `master` IS a staging deploy, and a deploy drops every call in progress.** Land this deliberately, between lessons.

- [ ] **Step 1: Merge each submodule PR into its trunk first**

The pointers must reference merged commits on `main`, not branch tips.

- [ ] **Step 2: Stage the pointers EXPLICITLY**

```bash
cd /home/abdulkhalek/Projects/kaleem
git checkout -b feat/brand-pointers
git add tokens dashboard marketing backend
git status
```

**Never `git add -A` in meta** — it stages dirty submodule pointers, which has already moved `master` onto an unmerged branch and pushed it to trunk. Confirm `git branch --show-current` is not `master` before committing.

- [ ] **Step 3: Commit, PR, merge**

```bash
git commit -m "chore: bump submodules for the brand identity (DEPLOY)"
```

Open the PR, wait for all gates green, merge with a **merge commit, not a squash** — squashing is what used to drop pointer bumps silently.

- [ ] **Step 4: Verify on staging**

Confirm the mark renders in both themes and both directions, the favicon is no longer purple, and the OG card resolves. Measure, don't eyeball.

---

## Phase 4 — The extended programme

### Task 14: Stationery, signature, presentation template

**Files:**
- Create: `tokens/brand/dist/stationery/*`, `tokens/brand/dist/email-signature.html`, `tokens/brand/dist/presentation-template.html`
- Modify: `tokens/brand/brand.json`

**Interfaces:**
- Consumes: `emit()`, `markColor()`, the lockups.

The owner chose the full programme knowing these have **no consumer in this codebase**. They are produced, declared in the manifest so the presence and drift gates cover them, and otherwise unused until something needs them.

- [ ] **Step 1: Declare them in `brand.json` (red)**
- [ ] **Step 2: Run `node --test test/brand.test.mjs`** — expect FAIL, files absent
- [ ] **Step 3: Author letterhead, business card, invoice header, email signature, presentation template** — each drawing colour from `markColor()`, never a literal
- [ ] **Step 4: `node brand.mjs && npm test`** — expect PASS
- [ ] **Step 5: Commit**

```bash
git add brand/ && git commit -m "feat: the extended identity programme"
```

---

### Task 15: The usage guide and ADR-0044

**Files:**
- Create: `docs/brand/usage.md`, `docs/adr/0044-the-kaleem-brand.md`

- [ ] **Step 1: Write the usage guide**

`docs/brand/usage.md` — correct and incorrect usage, clear space, minimum size, the permitted surfaces, co-branding, and misuse examples. It must record two decisions made along the way: that monochrome and reversed are the *same file* (a `currentColor` source is already both), and that the RTL lockup mirrors the **layout, never the glyphs**.

- [ ] **Step 2: Write ADR-0044**

The mark, the type pairing's rationale (written down for the first time), usage rules, and — stated plainly — that generative tooling informed direction only and every letterform came from OFL outlines.

- [ ] **Step 3: Commit**

```bash
git add docs/brand/usage.md docs/adr/0044-the-kaleem-brand.md
git commit -m "docs: the brand usage guide and ADR-0044"
```

---

## Phase 5 — D9 close

### Task 16: Walk the Definition of Done

- [ ] Spec closed — set `status: shipped`, `closed: 2026-09-XX`, add an outcome section saying what the work actually found
- [ ] All gates green in CI, each **mutation-checked**
- [ ] Coverage floors raised where coverage rose (`vitest.config.ts`, `pyproject.toml`) — ADR-0026 ratchets
- [ ] e2e green
- [ ] **Manual browser click-through** in both themes and both directions
- [ ] Staging deploy verified
- [ ] `docs/architecture/` updated if it describes the design system
- [ ] Journal entry in `docs/superpowers/journal/2026-W38.md`
- [ ] `STATE.md` updated
- [ ] **The human checks, recorded as results and not as intentions:** Arabic letterforms correct; legible at 16px and 32px; reads as dignified; email header correct in a real mail client. If any could not be done, say which and why — the C3e precedent is to record the deviation in the journal, never to skip it silently.

---

## Self-Review

**Spec coverage.** Core mark → Tasks 5, 7. Lockups/mono/reversed → Task 7 (mono and reversed collapse into `currentColor`, recorded in Task 15). Favicon/app icons → Tasks 8a, 8b (the web manifest is the consumer's, E6). OG card → Tasks 7, 8b. Email raster → Tasks 8b, 12. Typography rationale → Task 15. Colour usage rules → Tasks 8a, 9. Extended programme → Task 14. Usage guide → Task 15. Both ADRs → Tasks 3, 15. Gates → Tasks 4, 6, 8a, 9. Human checks → Tasks 2, 5, 16. The duplicated wordmark → Tasks 10, 11. The purple favicon → Tasks 8b, 10, 11.

**Known gap, deliberate:** this plan adds no new marketing coverage beyond the swap in Task 11. Marketing has had a vitest suite and an e2e harness since `rch-mkt-test-harness` (E9); Task 11 keeps them green and updates `tests/home.test.ts`. Extending them belongs to the site spec. Named so it is not mistaken for coverage.

**Type consistency.** `declared()`, `missing()`, `svgIssues()`, `markColor()`, `pngSize()`, `emit()`, `drift()`, `iconSetIssues()` are defined in Tasks 4/6/8a and used under those exact names afterwards. `Wordmark` is the component name in both Task 10 and Task 11's prose.
