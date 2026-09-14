---
name: brand-identity
phase: "n/a — cross-phase design-system track; does not claim the next roadmap phase"
modules: [design-system]
status: draft
created: 2026-09-14
closed: null
---

## Goal

kaleem has a complete, gate-enforced design system and no brand. `tokens` carries an
accessible palette (ADR-0040) built from DTCG source (ADR-0041); the dashboard's wordmark is
plain text; `marketing/public/` holds the Astro default favicon. This spec produces the
identity — an Arabic-first calligraphic mark for **كليم**, its lockups and derivatives, a
typography decision for both scripts, colour usage rules bound to the existing palette, and
the extended identity programme — and lands it in `@kaleem/tokens` so every surface consumes
one source.

It is the first of two specs. The second builds the marketing site on top of it and is not
started until this one closes.

## Decisions taken before writing (owner, 2026-09-14)

| Question | Answer |
| --- | --- |
| Mark form | **Calligraphic Arabic-first.** كليم is the logo; Latin "kaleem" is secondary. |
| Letterform production | **AI for direction, then redrawn** against a real typeface's outlines. |
| Scope | **Full identity programme**, not the launch-shaped subset. |
| Source of truth | **`@kaleem/tokens`**, repo-only. **No Figma library** — Claude Design is used for exploration only and owns nothing. |
| Name / domain | `kaleem` / `kaleem.academy`, settled. |
| Palette | ADR-0040's gated palette is a **constraint**, not a starting point. The mark works within it. |

Recorded deviation from the agent's recommendation: the owner chose the full programme over
the launch-shaped subset knowing that stationery, signatures and presentation templates have
no consumer in this codebase today and will sit unused until one appears. Cost is time, not
product risk.

## User flow

Not a user-facing feature; there is no flow. What changes for a user:

- A visitor to `kaleem.academy` sees the mark instead of a stub page and an Astro default favicon.
- A signed-in user sees the mark in the dashboard topbar where a text wordmark stands today.
- A transactional email (ADR-0016, SES) carries a raster header instead of none.
- A shared link renders a real OG card instead of nothing.

## Data model delta

None. No tables, no fields, no migrations.

## API delta

None.

## Frontend

**`dashboard`** — replaces the text wordmark in the topbar with the mark, honouring the
existing `display:none` below `sm` behaviour verified on staging 2026-09-13; replaces the
favicon and adds the app-icon set; picks up the mark's colour from tokens, never a literal.
No new routes. The RTL lockup is used when `dir="rtl"`.

**`marketing`** — currently consumes no shared styling at all (`src/styles/global.css` is six
lines). This spec wires it to `@kaleem/tokens` and lands the mark, favicon set and OG card.
Page structure, content, routes, i18n and SEO are **out of scope** and belong to the site spec;
what this delivers is a styled baseline for that spec to start from.

**`backend`** — email header raster only. SVG in email is unreliable across clients, so email
gets PNG at 1x/2x, not the vector.

"Done" for each = deployed to staging and seen in a real browser, in both themes and both
directions.

## Production pipeline

Six stages. Stage 4 is the only one load-bearing for correctness.

1. **Brief.** Positioning, audience (non-Arabic speakers studying Islamic sciences; parents
   pay, students attend), the attributes the mark must carry, and the hard constraints:
   bilingual, the gated palette, survives 16px, crops to a square.
2. **Direction exploration.** Claude Design canvas artboards plus logo generation, producing
   several directions for composition, weight, mood and colour. **Every generated artefact is
   labelled: the Arabic letterforms in it are not real.** Each direction is presented beside a
   specimen of كليم set in a real typeface, so the owner chooses a direction and never approves
   a generated glyph.
3. **Selection.** The owner picks one direction. AI involvement ends here.
4. **Redraw.** The mark is rebuilt from a correct source, not traced from the image: كليم set
   in an open-licence Arabic face — Reem Kufi for a geometric route, Amiri for a Naskh/Thuluth
   flavour, both OFL and therefore free of a licensing trap — converted to outlines, then
   stylised toward the chosen direction **without breaking letter joins or final forms**.
   Correctness comes from the font outlines; the generated image informs only proportion,
   spacing and treatment.
5. **Verification.** See "What no gate can prove" below.
6. **Derivatives.** Built from the approved master vector, never redrawn per surface.

## Deliverables

**Core mark**
- Primary calligraphic mark, كليم, master SVG.
- LTR lockup (mark + Latin "kaleem") and RTL lockup, mirrored composition.
- Monochrome (single-colour) and reversed (on dark) variants.
- Clear-space and minimum-size rules.

**Application**
- Favicon set + app icons + `site.webmanifest`.
- OG/social card, exactly 1200×630.
- Email header raster, 1x and 2x PNG.
- Avatar/square crop.

**System**
- Typography decision: an Arabic face and a Latin face that pair, with the weights and the
  rationale. Covers both scripts in both the dashboard and marketing.
- Colour usage rules: which token each mark variant draws from, and which surfaces each
  variant is permitted on, expressed as declared pairs in `contrast-pairs.json` so the
  existing gate checks them.

**Extended programme** (owner-chosen; no consumer in the codebase yet)
- Stationery: letterhead, business card, invoice header.
- Email signature template.
- Presentation template.
- Extended usage guide: correct and incorrect usage, co-branding, misuse examples.

## Where it lives, and how it ships

Source of truth is the **`tokens` submodule**, which gains a `brand/` tree beside `src/`.
This changes what `@kaleem/tokens` is — it stops being CSS-only — and therefore needs an ADR.

Rejected alternatives: a sixth submodule (isolation not needed, another pointer to keep in
sync on every deploy); duplicating assets into each consumer (two copies that drift); the meta
repo (docs + CI + pointer bumps only — it can hold the usage guide, not build-time assets).

Three PR streams, in a forced order, because a consumer cannot pin a tag that does not exist:

1. **meta, docs-only** — this spec + two ADRs. `docs/brand-identity` → PR → `master`. Triage
   skips the gate jobs on docs-only changes.
2. **`tokens`** — the `brand/` tree, the build step emitting derivatives, the new gates, then
   a version tag.
3. **consumers** — `dashboard` and `marketing` re-pin the tag and land the assets; then
   pointer bumps in meta. **A pointer bump to `master` is a staging deploy** (ADR-0028), so it
   lands deliberately.

## ADRs required

- **`@kaleem/tokens` carries brand assets, not only CSS.** What the package is, why not a
  separate submodule, and what consumers may and may not reach into.
- **The kaleem brand.** The mark, its production method and why an Arabic-first calligraphic
  mark was chosen for a non-Arabic-reading audience; the type pairing; usage rules; and the
  explicit record that generative tooling informed direction only.

## Module boundaries

`design-system` only. No business module is touched. No new events. `import-linter` is not
engaged — nothing here crosses a Python module boundary.

## Out of scope

- Marketing site structure, routes, content, i18n/RTL copy, SEO — the second spec.
- Standing up `marketing`'s first test suite. It is ❌ in the D3 table today and stays ❌
  after this; the site spec owns it. Named here so it is not lost.
- Any change to the ADR-0040 palette. The mark works within it.
- A Figma library. Explicitly declined.
- Rebranding the product name or domain.

## Test plan

**Gated in CI, in the `tokens` repo** (it already has `test/*.test.mjs`, so the gates have a
home). ADR-0026 ratchets: once green, lowering one needs an ADR.

| Gate | Asserts |
| --- | --- |
| asset presence | every declared deliverable exists at its declared path |
| SVG validity | parses; no embedded raster (`<image>`); tight `viewBox` |
| token-derived colour | no hex literals in mark SVGs; colours resolve to tokens |
| icon manifest | favicon/app-icon set complete and referenced by `site.webmanifest` |
| OG dimensions | the social card is exactly 1200×630 |
| declared pairs | each permitted mark-on-surface pair is declared and passes the existing contrast check |

Each gate is **mutation-checked** before it is trusted — break the asset, see the gate go red
— per the repo's standing rule that a regression test which has never failed proves nothing.

**What no gate can prove, and is therefore the owner's, recorded as a D9 deviation rather
than skipped** (same shape as the C3e browser work):

- That the Arabic letterforms are correct — joins, final forms, that كليم reads as كليم.
  Nothing in this repo can check this; the owner is an Arabic reader and is the check.
- That the mark is legible at 16px and 32px. Renders are produced; eyes judge them.
- That the mark reads as dignified rather than generic.
- That the email header renders correctly in real mail clients.

## Open questions

None. All scoping decisions were taken with the owner on 2026-09-14 and are recorded in the
decisions table above.
