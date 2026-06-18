# Kaleem — Recraft step-by-step guide

Companion to [`IMAGE-PROMPTS.md`](./IMAGE-PROMPTS.md) (the prompts) and
[`ASSET-INDEX.md`](./ASSET-INDEX.md) (filenames). Work top-to-bottom.

---

## 0. Which tier

- **Free tier** is fine to *trial* quality/style — BUT it has no SVG/vector download,
  generations are public, and no commercial license.
- For real deliverables you need the **entry paid plan** (Recraft "Basic", roughly
  **$10–12/mo**). It unlocks: **SVG/vector export**, **private** generations, **commercial
  use**, and enough monthly credits for this whole set. You can **cancel after one month**.
- Higher tiers (Advanced/Pro) only add more credits/seats — not needed for a one-off brand.
- ⚠️ Verify current pricing/credit numbers on recraft.ai — they change.

**Credit budget:** plan to generate ~3–6 candidates per asset and keep the best, so expect
~200–400 generations total across ~21 base prompts + variants. The entry tier's monthly
credits cover this; watch the meter and prioritize the icon + logos first.

---

## 1. One-time setup (do this before generating anything)

1. Sign up at **recraft.ai**, open the entry paid plan.
2. Create a **Project** named **"Kaleem Brand"** (keeps everything in one canvas/folder).
3. Note the brand palette so you can paste it into the **Colors** control every time:
   `#0E5C4F` emerald · `#C9A227` gold · `#FAF7F0` cream · `#16211D` ink
   (dark theme: `#4FB89F` · `#D9B43C` · `#0E1715` · `#ECEFEC`).

---

## 2. The golden order (dependencies matter)

Generate in THIS order — later assets reuse earlier ones.

### Step A — Lock the ICON first  → `kaleem-icon-color-light`
1. New generation. **Image type: Vector** (this is what gives you SVG).
2. **Style:** pick a flat / minimalist **Icon** or **Logo** vector style.
3. **Colors:** add `#0E5C4F` and `#C9A227`. Background: cream `#FAF7F0` or transparent.
4. **Size/aspect:** **1:1**.
5. **Prompt:** paste **L5** from `IMAGE-PROMPTS.md`.
6. Generate 4–6 variants. Pick the strongest. Iterate the prompt until you love it.
7. **Export as SVG** → save as `brand/logos/kaleem-icon-color-light.svg` (+ PNG).
   *(There's already a hand-drawn placeholder there — overwrite it.)*

### Step B — Capture it as a reusable Style (consistency engine)
- In Recraft, use **"Create style"** (a.k.a. style from reference): feed it your chosen icon
  (and 1–2 of its variants). Name it **"Kaleem Flat"**.
- From now on, **apply the "Kaleem Flat" style** to every generation so the whole set
  shares one visual language. This is the single biggest consistency lever.

### Step C — Logos  → `logos/`
For each: **Vector** type, **Kaleem Flat** style, brand **Colors**, aspect per table below,
prompt from the pack, export **SVG**.
- `kaleem-logo-primary-en-light` (L1, 3:1) — then make **dark / mono-ink / mono-reversed**
  using the deltas in L1.
- `kaleem-logo-horizontal-*` (L2, 4:1), `kaleem-logo-vertical-*` (L3, 1:1),
  `kaleem-wordmark-*` (L4, 3:1), `kaleem-icon-color-dark` + mono (L5 deltas).
- **Text tip:** Recraft renders Latin text well but still **proofread "kaleem"** every time.
  If a generation misspells it, regenerate or fix the text in Figma. **Easier + sharper:**
  reuse your locked icon and just set the wordmark as real type in Figma (see Step F).

### Step D — Favicons & app icons  → `favicons-app-icons/`
Two options — option 2 is cleaner:
1. **Generate** each (F1–F6) as **Vector**, 1:1, tile background colors from the prompt.
2. **(Recommended)** Skip generating these — take your **locked icon SVG** and run it through
   **realfavicongenerator.net**: it outputs `favicon.ico` (all sizes), `apple-touch-icon`,
   PWA/Android/maskable PNGs **and** the `manifest.webmanifest` automatically. Drop the tile
   background (emerald) in its UI. Far more reliable than AI for exact icon sizing.

### Step E — Brand & layout assets  → `brand-assets/`
OG, social cover/avatar, email header/logo, splash, loading (B1–B8).
- For pieces with a headline (OG, covers, presentation): **Recraft V3 is good at text**, so
  generate directly (use the right aspect from the table), then proofread.
- Or generate the **background/art only** and place the locked logo + type on top in Figma.

### Step F — Marketing illustrations  → `marketing/`
Hero, 3 feature illustrations, dashboard preview, landing hero, presentation cover (M1–M7).
- **Image type: Raster** (or "Digital/Vector Illustration") for richer scenes.
- Apply **Kaleem Flat** style + brand **Colors**, aspect from the table, prompts M1–M7.
- Generate several; these benefit most from picking the best of a batch.

---

## 3. Per-asset settings cheat

| Asset group | Recraft type | Style | Aspect | Export |
| --- | --- | --- | --- | --- |
| Icon, logos, wordmark | **Vector** | Kaleem Flat (Logo/Icon) | 1:1 / 3:1 / 4:1 | **SVG** + PNG |
| Favicon, app icons | **Vector** *(or RealFaviconGenerator)* | Kaleem Flat | 1:1 | SVG/PNG |
| OG, social, email, splash, loading | Vector or Raster | Kaleem Flat | 1.91:1 / 3:1 / 4:1 / 16:9 | PNG (+SVG if vector) |
| Hero & feature illustrations, dashboard, landing | **Raster** / Illustration | Kaleem Flat | 4:3 / 16:9 | PNG |

---

## 4. Arabic (do NOT trust the AI here)

No image model reliably renders connected Arabic. For every `-ar-` asset:
1. Generate the **art/background only** (skip the Arabic text in the prompt), **or** reuse the
   matching EN layout.
2. Set the Arabic wordmark **"كليم"** / taglines as **real type** in Figma/Inkscape using
   **IBM Plex Sans Arabic** (or **Amiri**), emerald, with the gold dot on the left (RTL).
3. Export. (I can also hand-author the Arabic wordmark SVG for you on request.)

---

## 5. Saving & handoff

- Save every result into the matching folder using the **exact filename stem** from
  `ASSET-INDEX.md`: `brand/<category>/<stem>.svg` and `.png`.
- Keep the **SVG as the master** wherever Recraft gives you one.
- When done (or in batches), tell me and I'll: clean/normalize the SVGs, assemble the
  `favicon.ico` + `apple-touch-icon` + `manifest.webmanifest`, fill in the generation status
  in `ASSET-INDEX.md`, and stage everything for the `dashboard/` and `marketing/` submodules.

---

## 6. Fast path (if you're short on time)

1. Icon (Step A) → lock it.
2. Create **Kaleem Flat** style (Step B).
3. Primary + horizontal + vertical + icon logos, light & dark (Step C).
4. Run icon through **RealFaviconGenerator** for the entire favicon/PWA set (Step D.2).
5. OG image + social avatar + cover (Step E).
6. Hero + 3 feature illustrations (Step F).
That covers ~90% of what a launch actually needs; do the rest later.
