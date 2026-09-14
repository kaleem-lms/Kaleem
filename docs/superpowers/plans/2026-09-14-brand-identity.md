# kaleem Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce kaleem's Arabic-first calligraphic identity for **كليم** — master mark, lockups, derivatives, extended programme — with `@kaleem/tokens` as the single source of truth, and replace the duplicated text wordmark and the off-palette purple favicon in both consumers.

**Architecture:** `tokens` gains a `brand/` tree: hand-authored **source** SVGs that carry no colour (`currentColor` only) plus a `brand.json` manifest that declares every asset and binds each to a colour *token alias*. A new `brand.mjs` emitter resolves those aliases against the existing DTCG source and bakes them into standalone **emitted** assets (favicons, app icons, OG card, email rasters), which are committed so consumers never build. Gates live in `tokens/test/` beside the existing ones. Consumers then pin the new tag and swap their assets.

**Tech Stack:** Node 24 (`node --test`, zero runtime deps), DTCG JSON, `@resvg/resvg-js` as the only devDependency (rasterising; never installed by consumers), `fonttools` in a throwaway venv for the one-off glyph-outline extraction, Astro 6 (marketing), React 19 + Vitest + Playwright (dashboard).

**Spec:** `docs/superpowers/specs/2026-09-14-brand-identity-design.md`

## Global Constraints

- **Mark form:** Arabic-first calligraphic **كليم**. Latin "kaleem" is secondary, never the primary mark.
- **Letterforms come from a real typeface's outlines**, never traced from a generated image. Open-licence only: **Reem Kufi** or **Amiri**, both OFL.
- **Generated images inform direction only** — composition, weight, mood, colour. Every generated artefact is labelled as having non-real Arabic.
- **No hex literals in source SVGs.** Source uses `currentColor`; emitted assets bake a value *resolved from a token alias* at build time.
- **The ADR-0040 palette is a constraint.** No palette value changes in this plan.
- **Source of truth is `@kaleem/tokens`, repo-only.** No Figma library.
- **`tokens` stays zero-runtime-dependency.** The rasteriser is a `devDependency` and its output is committed.
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
- Create `brand/dist/*` — emitted, committed derivatives.
- Create `brand/tools/outline.py` — the one-off, reproducible glyph→path extraction.
- Create `brand.mjs` — emitter + validators. Mirrors `build.mjs`'s `--check` contract.
- Create `test/brand.test.mjs` — the gates.
- Modify `package.json` — `files`, `exports`, `scripts.test`, `devDependencies`.
- Modify `src/contrast-pairs.json` — declare the mark-on-surface pairs.

**dashboard**
- Create `src/ui/Wordmark.tsx` — the single shared wordmark component (kills one of the two hand-built copies).
- Modify `src/features/shell/AppTopbar.tsx:43`, `src/features/shell/AppTopbar.test.tsx:42`, `index.html`, `public/`.

**marketing**
- Modify `src/pages/index.astro`, `src/layouts/Layout.astro` (icons + OG meta), `public/`.

**backend**
- Modify the SES email template header to carry the raster.

---

## Phase 0 — Direction (contains the human gate)

### Task 1: Write the brand brief

**Files:**
- Create: `docs/brand/brief.md`

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

**Files:**
- Create: `tokens/brand/brand.json`
- Create: `tokens/brand.mjs`
- Create: `tokens/test/brand.test.mjs`
- Modify: `tokens/package.json`

**Interfaces:**
- Produces: `brand.mjs` exporting `manifest` (parsed `brand/brand.json`), `declared()` → `{id, file, kind}[]` over both source and emitted assets, and `missing()` → the subset whose file does not exist. Later tasks import all three.

- [ ] **Step 1: Write the failing test**

Create `tokens/test/brand.test.mjs`:

```js
// Brand asset gates. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { declared, missing } from "../brand.mjs";

test("the manifest declares at least the core mark", () => {
	const ids = declared().map((a) => a.id);
	assert.ok(ids.includes("mark"), "no `mark` declared in brand/brand.json");
});

test("every declared asset exists on disk", () => {
	assert.deepEqual(
		missing().map((a) => a.file),
		[],
		"declared in brand/brand.json but not present on disk",
	);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL — `Cannot find module '../brand.mjs'`.

- [ ] **Step 3: Write the manifest**

Create `tokens/brand/brand.json`:

```json
{
  "$description": "Brand asset manifest. Declares every mark asset and binds each to a COLOUR TOKEN ALIAS rather than a literal. Source SVGs carry no colour (currentColor only); emitted assets bake a value resolved from these aliases at build time. NOT a DTCG token file — deliberately not named *.tokens.json so a DTCG parser never reads it as tokens.",
  "color": {
    "mark": "{color.primary.text}",
    "reversed": "{color.background}"
  },
  "source": [
    { "id": "mark", "file": "brand/src/mark.svg", "role": "master" }
  ],
  "emitted": []
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
//   node brand.mjs          write brand/dist/*
//   node brand.mjs --check  rebuild in memory, diff against what is committed, exit 1
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));

export const manifest = JSON.parse(
	readFileSync(join(ROOT, "brand", "brand.json"), "utf8"),
);

/** Every declared asset, source and emitted alike, in one flat list. */
export const declared = () => [
	...manifest.source.map((a) => ({ ...a, kind: "source" })),
	...manifest.emitted.map((a) => ({ ...a, kind: "emitted" })),
];

/** Declared assets whose file is not on disk. */
export const missing = () => declared().filter((a) => !existsSync(join(ROOT, a.file)));
```

- [ ] **Step 5: Run the test and watch the SECOND one fail for the right reason**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: the manifest test PASSES; the existence test FAILS listing `brand/src/mark.svg`. That is the correct red — the gate works and the asset is genuinely absent.

- [ ] **Step 6: Wire the gate into the package's test script**

In `tokens/package.json`, `scripts.test` already runs `node --test test/*.test.mjs`, so the new file is picked up automatically. Add `"brand"` to `files` and these `exports`:

```json
    "./brand.mjs": "./brand.mjs",
    "./brand/brand.json": "./brand/brand.json"
```

- [ ] **Step 7: Commit the red gate**

```bash
git add brand/brand.json brand.mjs test/brand.test.mjs package.json
git commit -m "test: gate that every declared brand asset exists (red until the mark lands)"
```

---

### Task 5: The master mark — redraw from real outlines

**Files:**
- Create: `tokens/brand/tools/outline.py`
- Create: `tokens/brand/src/mark.svg`

**Interfaces:**
- Consumes: `docs/brand/directions/SELECTED.md` (direction + source typeface), `declared()`/`missing()` from Task 4.
- Produces: `brand/src/mark.svg` — a single-path, colourless (`currentColor`), tightly-viewBoxed master mark, and `brand/tools/outline.py` making its derivation reproducible.

- [ ] **Step 1: Extract the glyph outlines reproducibly**

Create `tokens/brand/tools/outline.py`:

```python
"""Extract كليم as SVG paths from an OFL Arabic face.

WHY A SCRIPT AND NOT A ONE-OFF: the mark's correctness comes from the font's
outlines, not from anyone's hand or from a generated image. Recording the
extraction makes that claim checkable by someone who was not here.

    PIP_CONFIG_FILE=/dev/null python -m venv .venv
    .venv/bin/pip install fonttools
    .venv/bin/python brand/tools/outline.py <font.ttf> > brand/src/_raw.svg
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

WORD = "كليم"

def main(path: str) -> None:
    font = TTFont(path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = font["head"].unitsPerEm
    x = 0
    parts = []
    # Arabic is RTL: lay the glyphs out right-to-left so joins land correctly.
    for ch in reversed(WORD):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(pen)
        parts.append(f'<path transform="translate({x},0)" d="{pen.getCommands()}"/>')
        x += glyph_set[name].width
    print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x} {upem}">')
    print("\n".join(parts))
    print("</svg>")

if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 2: Run it against the selected face**

```bash
cd tokens
PIP_CONFIG_FILE=/dev/null python3 -m venv /tmp/brandvenv
PIP_CONFIG_FILE=/dev/null /tmp/brandvenv/bin/pip install fonttools
/tmp/brandvenv/bin/python brand/tools/outline.py <path-to-ReemKufi-or-Amiri.ttf> > brand/src/_raw.svg
```

**Note:** the raw output uses the font's *isolated* glyph forms. Arabic joins are contextual, so the raw file is a starting point for the redraw, not the mark. Do not ship `_raw.svg`.

- [ ] **Step 3: Redraw the master**

Produce `brand/src/mark.svg` from `_raw.svg`, stylised toward the direction in `SELECTED.md`, honouring these rules:

- Letter **joins and final forms preserved** — this is what the owner will check.
- `fill="currentColor"` only. **No hex, no `rgb()`, no embedded `<image>`.**
- One tight `viewBox`, origin at 0 0.
- A `<title>kaleem</title>` as the first child, so the mark has an accessible name wherever it is inlined.

Delete `_raw.svg`.

- [ ] **Step 4: Run the gate and watch it go green**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS — both tests.

- [ ] **Step 5: Mutation-check the gate**

```bash
mv brand/src/mark.svg /tmp/mark.svg && node --test test/brand.test.mjs; mv /tmp/mark.svg brand/src/mark.svg
```

Expected: FAIL naming `brand/src/mark.svg`. A gate that has never failed proves nothing.

- [ ] **Step 6: HUMAN GATE — Arabic letterform sign-off**

Render `brand/src/mark.svg` and have the owner confirm كليم reads as كليم: joins correct, final forms correct, no invented glyph. **Nothing automated can do this.** Do not continue on a "looks fine".

- [ ] **Step 7: Commit**

```bash
git add brand/src/mark.svg brand/tools/outline.py
git commit -m "feat: the كليم master mark, redrawn from OFL outlines"
```

---

### Task 6: The SVG hygiene gate

**Files:**
- Modify: `tokens/brand.mjs`
- Modify: `tokens/test/brand.test.mjs`

**Interfaces:**
- Produces: `brand.mjs` exporting `svgIssues(text)` → `string[]` (empty means clean). Task 7 reuses it for the lockups.

- [ ] **Step 1: Write the failing test**

Append to `tokens/test/brand.test.mjs`:

```js
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { svgIssues } from "../brand.mjs";

const TOKENS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("source marks carry shape only — no colour, no raster", () => {
	for (const a of declared().filter((a) => a.kind === "source")) {
		const text = readFileSync(join(TOKENS_ROOT, a.file), "utf8");
		assert.deepEqual(svgIssues(text), [], `${a.file} is not clean`);
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
 */
export const svgIssues = (text) => {
	const issues = [];
	if (/#[0-9a-fA-F]{3,8}\b/.test(text)) issues.push("contains a hex colour literal");
	if (/\brgba?\(/.test(text)) issues.push("contains an rgb() colour literal");
	if (/<image\b/.test(text)) issues.push("contains an embedded raster (<image>)");
	if (!/viewBox\s*=/.test(text)) issues.push("has no viewBox");
	if (!/<title>/.test(text)) issues.push("has no <title> (no accessible name)");
	return issues;
};
```

- [ ] **Step 4: Run the tests**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: PASS — all five.

- [ ] **Step 5: Commit**

```bash
git add brand.mjs test/brand.test.mjs
git commit -m "test: source marks carry shape only, gate mutation-checked both ways"
```

---

### Task 7: Lockups, monochrome and reversed variants

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
    { "id": "mark-square", "file": "brand/src/mark-square.svg", "role": "icon" }
```

- [ ] **Step 2: Run the gate and watch it fail**

```bash
cd tokens && node --test test/brand.test.mjs
```

Expected: FAIL listing the three absent files.

- [ ] **Step 3: Author the three assets**

- `lockup-ltr.svg` — the mark with Latin "kaleem" to its right, reading left-to-right.
- `lockup-rtl.svg` — the mirrored composition. **Mirror the layout, never the glyphs.**
- `mark-square.svg` — the mark composed on a 1:1 viewBox with the clear-space the favicon and avatar need.

Every one: `currentColor` only, tight `viewBox`, `<title>kaleem</title>` first child.

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

### Task 8: The derivative emitter and the dimension gate

**Files:**
- Modify: `tokens/brand.mjs`, `tokens/brand/brand.json`, `tokens/package.json`, `tokens/test/brand.test.mjs`
- Create: `tokens/brand/dist/*`

**Interfaces:**
- Consumes: `resolveTheme`/`resolve` and `light` from `build.mjs`; `manifest`.
- Produces: `brand.mjs` exporting `markColor(themeName)` → resolved hex string, `emit()` → `{path: Buffer|string}`, `pngSize(buffer)` → `{width, height}`, and a `--check` mode matching `build.mjs`'s contract.

- [ ] **Step 1: Write the failing dimension test**

Append to `tokens/test/brand.test.mjs`:

```js
import { pngSize, markColor } from "../brand.mjs";

test("every emitted raster is exactly the size it declares", () => {
	for (const a of declared().filter((a) => a.kind === "emitted" && a.format === "png")) {
		const size = pngSize(readFileSync(join(TOKENS_ROOT, a.file)));
		assert.deepEqual(size, { width: a.width, height: a.height }, `${a.file} is the wrong size`);
	}
});

test("the OG card is exactly 1200x630", () => {
	const og = declared().find((a) => a.id === "og-card");
	assert.ok(og, "no og-card declared");
	assert.deepEqual(pngSize(readFileSync(join(TOKENS_ROOT, og.file))), { width: 1200, height: 630 });
});

test("the mark colour resolves from a token, and is not the purple it replaces", () => {
	const c = markColor("light");
	assert.match(c, /^#[0-9a-fA-F]{6,8}$/, "mark colour did not resolve to a literal");
	assert.notEqual(c.toLowerCase(), "#863bff", "still shipping the off-palette favicon colour");
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

/** The mark's colour for a theme, resolved from the alias in brand.json. */
export const markColor = (themeName, key = "mark") => {
	const flat = resolveTheme(themeName === "dark" ? dark : light);
	const alias = manifest.color[key];
	const path = alias.replace(/^\{|\}$/g, "");
	const value = flat[path];
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

- [ ] **Step 4: Declare the emitted assets**

In `brand/brand.json`, fill `emitted`:

```json
  "emitted": [
    { "id": "favicon-svg", "file": "brand/dist/favicon.svg", "from": "mark-square", "format": "svg", "color": "mark" },
    { "id": "favicon-32", "file": "brand/dist/favicon-32.png", "from": "mark-square", "format": "png", "width": 32, "height": 32, "color": "mark" },
    { "id": "icon-192", "file": "brand/dist/icon-192.png", "from": "mark-square", "format": "png", "width": 192, "height": 192, "color": "mark" },
    { "id": "icon-512", "file": "brand/dist/icon-512.png", "from": "mark-square", "format": "png", "width": 512, "height": 512, "color": "mark" },
    { "id": "apple-touch-icon", "file": "brand/dist/apple-touch-icon.png", "from": "mark-square", "format": "png", "width": 180, "height": 180, "color": "mark" },
    { "id": "og-card", "file": "brand/dist/og.png", "from": "lockup-ltr", "format": "png", "width": 1200, "height": 630, "color": "mark" },
    { "id": "email-header", "file": "brand/dist/email-header.png", "from": "lockup-ltr", "format": "png", "width": 320, "height": 80, "color": "mark" },
    { "id": "email-header-2x", "file": "brand/dist/email-header@2x.png", "from": "lockup-ltr", "format": "png", "width": 640, "height": 160, "color": "mark" },
    { "id": "webmanifest", "file": "brand/dist/site.webmanifest", "format": "json" }
  ]
```

- [ ] **Step 5: Implement `emit()` and the `--check` contract**

Append to `tokens/brand.mjs`. Add `@resvg/resvg-js` as a **devDependency** (`pnpm add -D @resvg/resvg-js`) — never a dependency, because output is committed and consumers must keep installing zero runtime deps.

```js
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

const sourceById = (id) => {
	const a = manifest.source.find((s) => s.id === id);
	if (!a) throw new Error(`brand.json: no source asset '${id}'`);
	return readFileSync(join(ROOT, a.file), "utf8");
};

/** Every emitted artefact, in memory, keyed by its path. */
export const emit = () => {
	const out = {};
	for (const a of manifest.emitted) {
		if (a.format === "json") {
			out[a.file] = JSON.stringify(webmanifest(), null, "\t") + "\n";
			continue;
		}
		// Colour is baked HERE, resolved from the alias — never written into a source file.
		const coloured = sourceById(a.from).replace(
			/currentColor/g,
			markColor("light", a.color),
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

/** The web app manifest, derived from the declared icons so the two cannot drift. */
export const webmanifest = () => ({
	name: "kaleem",
	short_name: "kaleem",
	icons: manifest.emitted
		.filter((a) => a.format === "png" && a.id.startsWith("icon-"))
		.map((a) => ({
			src: `/${a.file.split("/").pop()}`,
			sizes: `${a.width}x${a.height}`,
			type: "image/png",
		})),
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const artefacts = emit();
	if (process.argv.includes("--check")) {
		let drifted = false;
		for (const [file, content] of Object.entries(artefacts)) {
			const onDisk = readFileSync(join(ROOT, file));
			const same = Buffer.isBuffer(content)
				? onDisk.equals(content)
				: onDisk.toString("utf8") === content;
			if (!same) { console.error(`${file} has drifted — run \`node brand.mjs\``); drifted = true; }
		}
		process.exit(drifted ? 1 : 0);
	}
	for (const [file, content] of Object.entries(artefacts)) writeFileSync(join(ROOT, file), content);
}
```

- [ ] **Step 6: Emit, then run the tests**

```bash
cd tokens && node brand.mjs && node --test test/brand.test.mjs
```

Expected: PASS — all eight.

- [ ] **Step 7: Add the drift check to the package's test script**

In `tokens/package.json`:

```json
    "test": "node build.mjs --check && node brand.mjs --check && node --test test/*.test.mjs",
    "brand": "node brand.mjs"
```

- [ ] **Step 8: Mutation-check the drift gate**

```bash
cd tokens && printf '\n' >> brand/dist/site.webmanifest && npm test; git checkout brand/dist/site.webmanifest
```

Expected: FAIL naming `brand/dist/site.webmanifest`.

- [ ] **Step 9: Commit**

```bash
git add brand.mjs brand/brand.json brand/dist package.json pnpm-lock.yaml
git commit -m "feat: emit brand derivatives with colour resolved from tokens, size-gated"
```

---

### Task 9: Declare the mark's contrast pairs

**Files:**
- Modify: `tokens/src/contrast-pairs.json`

**Interfaces:**
- Consumes: the existing `contrast.mjs` gate, unchanged.
- Produces: declared pairs so the mark's colour is checked on every surface it may sit on.

- [ ] **Step 1: Add the declarations**

The mark uses `color.primary.text`, which is already declared against background, card, popover, secondary and muted (the 2026-09-13 fix). Add any surface the mark lands on that is **not** already in that set — at minimum the reversed case: `color.background` on `color.primary`.

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

**Files:**
- Create: `dashboard/src/ui/Wordmark.tsx`
- Modify: `dashboard/src/features/shell/AppTopbar.tsx:43`, `dashboard/src/features/shell/AppTopbar.test.tsx:42`, `dashboard/index.html`, `dashboard/public/`, `dashboard/package.json`

**Interfaces:**
- Consumes: `@kaleem/tokens` at `v0.3.0`.
- Produces: `<Wordmark variant="mark" | "lockup" />`, accessible name **"kaleem"** in every variant.

**Why this matters:** `AppTopbar.test.tsx:42` asserts `getByText(/kaleem/i)`. Swapping text for an inline SVG breaks it **unless the mark keeps an accessible name** — so the test change is the point, not collateral.

- [ ] **Step 1: Write the failing test**

In `dashboard/src/features/shell/AppTopbar.test.tsx`, replace the line-42 assertion with:

```tsx
it("the wordmark keeps an accessible name after the text is replaced by the mark", () => {
	render(<AppTopbar />, { wrapper: Providers });
	expect(screen.getByRole("img", { name: /kaleem/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd dashboard && pnpm vitest run src/features/shell/AppTopbar.test.tsx
```

Expected: FAIL — no element with role `img` named kaleem.

- [ ] **Step 3: Bump the pin and copy the assets**

```bash
cd dashboard
pnpm add "@kaleem/tokens@github:kaleem-lms/tokens#v0.3.0"
cp node_modules/@kaleem/tokens/brand/dist/favicon.svg public/favicon.svg
cp node_modules/@kaleem/tokens/brand/dist/{favicon-32.png,icon-192.png,icon-512.png,apple-touch-icon.png,site.webmanifest} public/
```

- [ ] **Step 4: Write `Wordmark.tsx`**

```tsx
import markUrl from "@kaleem/tokens/brand/src/mark.svg?url";

/**
 * The wordmark, in one place.
 *
 * It lived as hand-built JSX in AppTopbar AND again in marketing's index.astro,
 * which is how the two drifted. `role="img"` plus an explicit name keeps the
 * accessible name the text version had.
 */
export function Wordmark({ className }: { className?: string }) {
	return <img src={markUrl} alt="kaleem" role="img" className={className} />;
}
```

- [ ] **Step 5: Use it in the topbar**

Replace `AppTopbar.tsx:43` (`kaleem<span className="text-accent">.</span>`) with `<Wordmark />`, keeping the existing `display:none` below `sm` behaviour verified on staging 2026-09-13.

- [ ] **Step 6: Point `index.html` at the new icons**

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
```

- [ ] **Step 7: Run the unit tests**

```bash
cd dashboard && pnpm vitest run
```

Expected: PASS. If coverage rises, **raise the floor in `vitest.config.ts`** — that is a normal part of the PR (ADR-0026).

- [ ] **Step 8: Run the e2e suite**

```bash
cd dashboard && pnpm exec playwright test
```

Expected: PASS. The app-shell flows exercise the topbar; if one asserted the wordmark's text, update it to the accessible name rather than deleting the assertion.

- [ ] **Step 9: Commit**

```bash
git add src/ui/Wordmark.tsx src/features/shell public index.html package.json pnpm-lock.yaml
git commit -m "feat: one shared wordmark and the real favicon, replacing the purple placeholder"
```

---

### Task 11: marketing — the same mark, icons and OG card

**Files:**
- Modify: `marketing/src/pages/index.astro`, `marketing/src/layouts/Layout.astro`, `marketing/public/`, `marketing/package.json`

**Interfaces:**
- Consumes: `@kaleem/tokens` at `v0.3.0` (already a dependency — this is a pin bump, not new wiring).
- Produces: marketing rendering the same mark and serving the OG card.

- [ ] **Step 1: Bump the pin and copy the assets**

```bash
cd marketing
pnpm add "@kaleem/tokens@github:kaleem-lms/tokens#v0.3.0"
cp node_modules/@kaleem/tokens/brand/dist/{favicon.svg,favicon-32.png,icon-192.png,icon-512.png,apple-touch-icon.png,site.webmanifest,og.png} public/
rm -f public/favicon.ico
```

- [ ] **Step 2: Replace the hand-built wordmark**

In `src/pages/index.astro`, replace the `<h1>kaleem<span class="text-accent">.</span></h1>` construction with the imported mark, keeping an `alt="kaleem"`. The `<h1>` stays an `<h1>` — the mark is its content, not a replacement for the heading.

- [ ] **Step 3: Add icons and OG meta to the layout**

In `src/layouts/Layout.astro`'s `<head>`:

```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content="/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 4: Build it**

```bash
cd marketing && pnpm build && pnpm check
```

Expected: both succeed. `marketing-build` is the CI gate here; there is no test suite (D3 table, ❌), and standing one up belongs to the site spec.

- [ ] **Step 5: Commit**

```bash
git add src public package.json pnpm-lock.yaml
git commit -m "feat: the real mark, icon set and OG card on the marketing site"
```

---

### Task 12: backend — the email header raster

**Files:**
- Modify: the SES email template header (ADR-0016)

**Interfaces:**
- Consumes: `brand/dist/email-header.png` and `@2x`.

- [ ] **Step 1: Write the failing test**

Add a backend test asserting the rendered transactional email HTML contains the header image with `alt="kaleem"` and an absolute URL. SVG is **not** acceptable here — mail clients render it inconsistently, which is why the rasters exist.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && pytest -k email_header -v
```

Expected: FAIL.

- [ ] **Step 3: Add the header to the template, then re-run**

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

**Spec coverage.** Core mark → Tasks 5, 7. Lockups/mono/reversed → Task 7 (mono and reversed collapse into `currentColor`, recorded in Task 15). Favicon/app icons/webmanifest → Task 8. OG card → Task 8. Email raster → Tasks 8, 12. Typography rationale → Task 15. Colour usage rules → Tasks 8, 9. Extended programme → Task 14. Usage guide → Task 15. Both ADRs → Tasks 3, 15. Gates → Tasks 4, 6, 8, 9. Human checks → Tasks 2, 5, 16. The duplicated wordmark → Tasks 10, 11. The purple favicon → Tasks 8, 10, 11.

**Known gap, deliberate:** `marketing` gets no test suite here. It is ❌ in the D3 table before and after, and the site spec owns it. Named so it is not mistaken for coverage.

**Type consistency.** `declared()`, `missing()`, `svgIssues()`, `markColor()`, `pngSize()`, `emit()`, `webmanifest()` are defined in Tasks 4/6/8 and used under those exact names afterwards. `Wordmark` is the component name in both Task 10 and Task 11's prose.
