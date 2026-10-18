---
name: inf-fraunces-display-font
phase: v1 (wave 1, brand stream)
modules: [design-system]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Headings in the dashboard and on the marketing site render Georgia, not Fraunces, in
production today (`ISSUES.md`, "Blocks launch"). `@kaleem/tokens` v0.2.2 sets
`--font-display: "Fraunces", Georgia, serif`. The only face either consumer imports is
`@fontsource-variable/fraunces` 5.2.9, and its `@font-face` rules declare the family
`'Fraunces Variable'`. The names never match, so the browser falls through to Georgia.

`--font-quran: "Amiri Quran", …` has the same defect. No Amiri package is installed
anywhere, and no consumer uses the token yet, so the defect is latent.

This unit releases `@kaleem/tokens` **v0.2.3**, which fixes both. Dashboard and marketing
re-pin to it, and the meta PR moves all three pointers together. It also adds the first
check that compares the families the tokens name with the `@font-face` rules a consumer
actually ships. Nothing does that today, which is how this defect reached production.

## Decisions taken in this spec

- **`font.display` becomes `"Fraunces Variable", "Fraunces", Georgia, serif`.** This is
  the fix the programme entry names. We keep `"Fraunces"` as the second entry so a consumer
  that installs the static `@fontsource/fraunces` package still matches. The fix stays in
  the token. Switching consumers to the static package would have meant one dependency
  change per consumer and one file per weight.
- **`--font-quran` is removed, not shipped.** Shipping it would add a font dependency to
  both consumers for a token nothing renders. The Quran-text feature it was reserved for
  is not scheduled: `dec-quran-reference-source` recommends ayah numbers without text. The
  unit that first renders Quranic script adds the face and the token in one release, and
  the new check below makes it name the family correctly. A grep of both consumers at
  `origin/main` finds no `font-quran` use, so nothing breaks.

## User flow

There is no new behaviour. A user who opens any dashboard page with a `font-display`
heading sees it in Fraunces: page H1s (`PageHeader`), card and dialog titles, the topbar
and auth wordmark, and plan, quota and session figures. A user who opens the marketing
home sees the H1 in Fraunces. If the font file fails to load, the heading still falls
back to Georgia, as before.

## Data model delta

None. No backend change, no migration.

## API delta

None.

## Frontend

- **tokens:**
  - `src/scale.tokens.json`: `font.display` gets the new value and `font.quran` is deleted.
  - `build.mjs` builds the font lists in `tokens.css` and `theme.css` from the keys in
    `scale.font`. Today it hardcodes `["sans", "display", "arabic", "quran"]` twice, and
    `emitThemeBlock` reads `scale.font[k].$description`, so deleting `font.quran` without
    this change throws at build time.
  - `tokens.css` and `theme.css` are regenerated.
  - `package.json` goes to `0.2.3`.
  - Tag `v0.2.3` on the merge commit.
- **dashboard:**
  - `package.json` pins `github:kaleem-lms/tokens#v0.2.3`, with the lockfile updated by
    pnpm 10.28.0.
  - New unit test `src/test/font-faces.test.ts`.
  - New e2e spec `e2e/display-font.spec.ts`.
  - No component changes.
- **marketing:** `package.json` and the lockfile re-pin to v0.2.3. No source change.
- **Out of reach:** routes, roles, API calls and states do not change.
- **"Done" means:** an agent Playwright pass on staging (`dec-d9-substitute`) shows a
  loaded `Fraunces Variable` face behind the dashboard H1 and the marketing home H1, in
  light and dark, and no sideways scroll at 320px. In Arabic RTL the pass checks layout
  only: Fraunces has no Arabic glyphs, so its `unicode-range` subsets never load for an
  Arabic heading. That is unchanged by this unit (see Out of scope).

## Module boundaries

The unit stays inside `design-system`. There is no backend module, contract or event.

`tokens` stays dependency-free (ADR-0041). It cannot read the fontsource packages, so
the check that names and faces agree lives in the dashboard, which has both. Marketing has
no test suite until `rch-mkt-test-harness`, so its side is checked at build time and on
staging (see the plan).

## Personal data (ADR-0023)

None is collected, stored, shown or retained.

## Expand/contract

This change is safe in the blue-green window. It is CSS only. An old bundle keeps
v0.2.2's variables, and a new bundle carries v0.2.3's. Removing `--font-quran` contracts
nothing that is live.

## Out of scope

- Adding an Arabic face to marketing. That belongs to `rch-mkt-foundation`.
- Preloading fonts or tuning `font-display`.
- Secondary-button contrast, which is v0.2.4 under `lb-known-wcag-gaps`.
- Brand tokens, which are v0.3.0.
- The owed C5/C6 visual checks (`hg-visual-owed`), which happen after this deploy.
- Arabic `font-display` headings. In RTL, `body` switches to `--font-arabic`, but
  `font-display` does not, so Arabic heading glyphs fall past Fraunces and Georgia to the
  platform's generic serif. That is true before and after this unit. The conductor logs it
  in `ISSUES.md` (D10); fixing it is a design choice for the brand work.

## Test plan

1. **tokens (`node --test`):**
   - `font.display` starts with `"Fraunces Variable"` and ends with `Georgia, serif`.
   - No `font.quran` exists, and no `--font-quran` appears in either emitted file.
   - The emitted `--font-*` set equals the keys in `scale.font`.
   - The existing `--check` test still holds.
2. **dashboard unit test (`src/test/font-faces.test.ts`), red on `origin/main`:**
   - It reads every `--font-*` in the installed `@kaleem/tokens/tokens.css`.
   - It collects the `font-family` of every `@font-face` reachable from the
     `@fontsource*` imports in `src/index.css`.
   - It asserts that each token's first family is in that set.
   - It also asserts it checked at least the three known tokens and found at least one
     face per import, so a parsing slip cannot pass with nothing checked.
3. **dashboard e2e (`e2e/display-font.spec.ts`), one flow, about 5 s:**
   - Pages: `/design-preview` with no login, and `/account` as the teacher.
   - On each, the H1's computed first family is `Fraunces Variable`, after
     `document.fonts.ready`. The page runs in English (LTR), which is the only locale
     whose H1 text falls inside a Fraunces `unicode-range`.
   - A `FontFace` with that family has `status === "loaded"`.
   - It does not use `document.fonts.check()`, which returns true when no face matches at
     all.
   - Mutation-checked: removing the fontsource import turns it red, and so does the v0.2.2
     pin.
4. **Existing specs stay green:** the font metrics change, so the risk is at 320px.
   - `reflow.spec.ts`
   - `touch-targets.spec.ts`
   - `design-preview.spec.ts`
   - `session-ui.spec.ts`
5. **G3** (`scripts/check-token-pin.mjs`) passes on the meta PR: both pins, the tag and
   the gitlink all agree.

## Open questions

None. The `--font-quran` choice ("ship or remove") is settled above, inside the latitude
the programme entry gives.
