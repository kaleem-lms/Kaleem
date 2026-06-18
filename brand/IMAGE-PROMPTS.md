# Kaleem LMS — Image-Generation Prompt Pack

Copy-paste prompts for dedicated image models. Each prompt is tagged with the **target
filename stem** from [`ASSET-INDEX.md`](./ASSET-INDEX.md) — save the result as
`<stem>.png` (and `<stem>.svg` if your tool exports vector) in the matching `brand/` folder.

---

## How to use this pack

**Best models for each job**
- **Logos, icons, wordmarks, app icons (flat vector + real text + SVG export):** **Recraft**
  (set a custom palette, "vector/flat" style, exports true SVG) or **Ideogram** (best Latin
  text rendering). These beat Midjourney for crisp logos.
- **Illustrations & marketing scenes:** **Midjourney** or **Imagen** (richest), or Recraft
  for a flat-vector look.
- **Layout-y graphics (OG, social cover, splash, landing, dashboard, presentation):**
  Ideogram/Recraft (they render headings legibly) or composite in a vector editor.

**Two rules that make everything consistent**
1. **Lock the icon first.** Generate the icon (`kaleem-icon-color-light`) until you love it,
   then **reuse that exact mark** everywhere — for composite assets, generate the
   background/scene and **place the locked logo on top** in Figma/Illustrator. Image models
   will *not* reproduce an identical mark across separate runs, so don't rely on them to.
2. **Text is unreliable, Arabic especially.** For wordmark/UI text, prefer Ideogram/Recraft
   and proofread spelling. For **Arabic ("كليم", taglines)**, expect garbled glyphs from most
   models — safest path: generate the **icon/background only**, then set the Arabic type
   yourself in **IBM Plex Sans Arabic / Amiri**. Prompts that contain text are marked ⚠️text.

**Reusable STYLE BLOCK** (prepend to any prompt if your model lost the thread):
```
Brand: Kaleem — a calm, scholarly Islamic-learning platform. Visual style: modern flat
vector, minimalist, geometric, clean, premium, education brand, generous negative space.
Palette: deep emerald green #0E5C4F, warm gold #C9A227, warm cream #FAF7F0, dark ink
#16211D. Strictly flat: no gradients, no 3D, no bevels, no drop shadows, no photorealism.
```

**Reusable NEGATIVE PROMPT** (for tools that support it):
```
gradients, 3D, bevel, glossy, drop shadow, photorealistic, neon, cluttered, busy patterns,
watermark, signature, low-res, jpeg artifacts, crescent-moon cliché, mosque clip-art,
stock-photo people, distorted or misspelled text, extra letters
```

**Recurring building blocks** (referenced below as ICON / WORDMARK-EN / WORDMARK-AR):
- **ICON** = "a single minimalist flat geometric logo mark that fuses an open book / turning
  page with a soft Arabic letter ‘ك’ (kaf) curve that also reads as a gentle lowercase ‘k’"
- **WORDMARK-EN** = "the lowercase wordmark ‘kaleem’ in an elegant old-style serif
  (Fraunces / Newsreader style) followed by a small round gold dot"
- **WORDMARK-AR** = "the Arabic wordmark ‘كليم’ in an elegant clean naskh style, with a small
  gold accent dot trailing on the left (RTL)"

**Theme delta** — to make any **Dark** variant: change the background to near-black green
`#0E1715`, emerald `#0E5C4F → #4FB89F`, gold `#C9A227 → #D9B43C`, text to near-white `#ECEFEC`.

**Aspect-ratio cheat sheet:** logos 3:1 · vertical/icon/favicon/app-icon/avatar 1:1 · social
cover 3:1 · OG 1.91:1 (1200×630) · email header 4:1 · splash/landing/dashboard/presentation
16:9 · illustrations 4:3.

---

## 1. Logos — `logos/`

### L1 · Primary logo  →  `kaleem-logo-primary-{en,ar}-{light,dark}`, `…-mono-ink`, `…-mono-reversed`
```
Horizontal logo lockup for "Kaleem", a calm scholarly Islamic-learning brand. On the left,
ICON in deep emerald #0E5C4F with one small gold #C9A227 accent. On the right, WORDMARK-EN.
Modern flat vector, minimalist, geometric, premium, generous clear space, warm cream #FAF7F0
background. Strictly flat — no gradients, no 3D, no shadows. Aspect ratio 3:1.
```
- ⚠️text. **Dark:** apply Theme delta. **Arabic** (`-ar-*`): swap to WORDMARK-AR, arrange RTL
  (icon on the right, wordmark to its left).
- **mono-ink:** render the entire lockup in a single ink color #16211D on cream #FAF7F0 — no
  emerald, no gold. **mono-reversed:** entire lockup in off-white #FAF7F0 on a solid deep
  emerald #0E5C4F background.

### L2 · Horizontal logo (wordmark-forward)  →  `kaleem-logo-horizontal-{en,ar}-{light,dark}`
```
Compact wide horizontal logo for "Kaleem" sized for an app header / navbar: a small ICON
followed by WORDMARK-EN. Flat vector, minimalist, emerald #0E5C4F + gold #C9A227 dot, warm
cream #FAF7F0 background, tight balanced spacing. No gradients, no 3D. Aspect ratio 4:1.
```
- ⚠️text. **Dark:** Theme delta. **Arabic:** WORDMARK-AR, RTL.

### L3 · Vertical logo (stacked)  →  `kaleem-logo-vertical-{en,ar}-{light,dark}`
```
Vertical stacked logo for "Kaleem": ICON centered on top in emerald #0E5C4F with a small gold
#C9A227 accent, and WORDMARK-EN centered beneath it. Flat vector, minimalist, symmetrical,
warm cream #FAF7F0 background, generous clear space. No gradients, no 3D. Aspect ratio 1:1.
```
- ⚠️text. **Dark:** Theme delta. **Arabic:** WORDMARK-AR centered beneath the icon.

### L4 · Wordmark / secondary  →  `kaleem-wordmark-{en,ar}-{light,dark}`
```
Wordmark-only logo: WORDMARK-EN, deep emerald #0E5C4F lettering with a small round gold
#C9A227 dot, no icon. Elegant old-style serif, flat vector, warm cream #FAF7F0 background,
balanced letter spacing. Aspect ratio 3:1.
```
- ⚠️text. **Dark:** Theme delta. **Arabic:** WORDMARK-AR, no icon, RTL.

### L5 · Icon-only mark  →  `kaleem-icon-color-{light,dark}`, `kaleem-icon-mono-ink`, `kaleem-icon-mono-reversed`
**Generate this one FIRST and lock it.**
```
App icon symbol: ICON, large and centered, solid deep emerald #0E5C4F with a single small
gold #C9A227 accent stroke. Minimalist flat vector logo mark, geometric, balanced, clearly
legible even at 16px, warm cream #FAF7F0 background, lots of negative space. No text, no
gradients, no 3D. Aspect ratio 1:1.
```
- **Dark:** emerald #4FB89F + gold #D9B43C on near-black #0E1715. **mono-ink:** single ink
  #16211D on cream. **mono-reversed:** off-white #FAF7F0 mark on solid emerald #0E5C4F.

---

## 2. Favicons & app icons — `favicons-app-icons/`  (all 1:1, no text)

### F1 · Favicon  →  `favicon-light`, `favicon-dark`
```
Favicon: the ICON only, bold and simplified for tiny sizes, deep emerald #0E5C4F on a warm
cream #FAF7F0 rounded-square tile (~18% corner radius). Flat vector, high contrast, perfectly
legible at 16px. No text. Aspect ratio 1:1.
```
- **Dark:** emerald #4FB89F mark on near-black #0E1715 tile.

### F2 · PWA icon 512  →  `pwa-icon-512`, `pwa-icon-512-dark`
```
App icon: the ICON in off-white #FAF7F0 with a small gold #C9A227 accent, centered on a solid
deep emerald #0E5C4F rounded-square tile (~22% corner radius). Flat vector, bold, balanced,
safe padding. No text. Aspect ratio 1:1.
```
- **Dark:** emerald #4FB89F mark + gold #D9B43C on near-black #0E1715 tile.

### F3 · Android adaptive icon  →  `android-adaptive-icon`
```
Android adaptive app icon: full-bleed solid deep emerald #0E5C4F background with the ICON in
off-white #FAF7F0 centered well inside the inner safe circle (about 66% of the tile). Flat
vector, simple, bold. No text. Aspect ratio 1:1.
```

### F4 · iOS app icon  →  `ios-app-icon`
```
iOS app icon: a solid deep emerald #0E5C4F rounded-square tile (no transparency) with the
ICON in off-white #FAF7F0 and a small gold #C9A227 accent dot, centered with generous safe
padding. Flat vector, premium, simple. No text. Aspect ratio 1:1.
```

### F5 · Apple touch icon  →  `apple-touch-icon`
```
Apple touch icon (180px): solid deep emerald #0E5C4F rounded-square tile, the ICON in
off-white #FAF7F0 centered, generous safe padding. Flat vector, bold, simple. No text. 1:1.
```

### F6 · Maskable icon  →  `maskable-icon`
```
Maskable PWA icon: full-bleed solid deep emerald #0E5C4F, the off-white #FAF7F0 ICON centered
within the inner 80% safe zone so it survives circular and squircle masking. No tile border,
full bleed. Flat vector. No text. Aspect ratio 1:1.
```

---

## 3. Brand assets — `brand-assets/`

### B1 · Brand mark (hero)  →  `brand-mark-light`, `brand-mark-dark`
```
The ICON presented large and hero-like, solid deep emerald #0E5C4F with a single gold #C9A227
accent, centered with abundant clear space on a warm cream #FAF7F0 background. Minimalist flat
vector, premium. No text. Aspect ratio 1:1.
```
- **Dark:** Theme delta.

### B2 · Social avatar  →  `social-avatar-light`, `social-avatar-dark`
```
Square social-media profile picture: the ICON in off-white #FAF7F0 with a small gold #C9A227
accent, centered on a solid deep emerald #0E5C4F square. Flat vector, bold, instantly legible
at small sizes. No text. Aspect ratio 1:1.
```
- **Dark:** emerald #4FB89F mark on near-black #0E1715 square.

### B3 · Social cover  →  `social-cover-{en,ar}-{light,dark}`  ⚠️text
```
Wide social-media cover banner (3:1) for Kaleem. Left side: the horizontal Kaleem logo
(ICON + WORDMARK-EN). Right side: a small, calm flat-vector motif of an open book with a soft
speech curve. Tagline in clean sans-serif: "Learn the Quran & Arabic with a teacher". Warm
cream #FAF7F0 background, emerald #0E5C4F, one gold #C9A227 accent, lots of calm negative
space. Flat, no gradients. Aspect ratio 3:1.
```
- **Dark:** Theme delta. **Arabic:** WORDMARK-AR + tagline "تعلّم القرآن والعربية مع معلّم",
  mirror layout RTL (best to set Arabic text manually).

### B4 · Open Graph image  →  `og-image-{en,ar}-{light,dark}`  ⚠️text
```
Open Graph share card, 1200x630 (aspect 1.91:1), for Kaleem. Centered Kaleem logo (ICON +
WORDMARK-EN) above the headline "Islamic learning, guided" in an elegant serif, with a subtle
gold #C9A227 underline accent and a faint open-book motif. Warm cream #FAF7F0 background,
emerald #0E5C4F, balanced with safe margins for link-preview cropping. Flat vector, premium.
```
- **Dark:** Theme delta. **Arabic:** WORDMARK-AR + headline "تعليم العلوم الإسلامية بإتقان".

### B5 · Email header  →  `email-header-{en,ar}-{light,dark}`  ⚠️text
```
Email header band, wide 4:1, for Kaleem. The horizontal logo (ICON + WORDMARK-EN) centered on
a warm cream #FAF7F0 band with a thin gold #C9A227 rule beneath it. Minimal, clean,
transactional-email safe. Flat vector, emerald #0E5C4F. No other text. Aspect ratio 4:1.
```
- **Dark:** Theme delta. **Arabic:** WORDMARK-AR centered, RTL.

### B6 · Email logo (compact)  →  `email-logo-light`, `email-logo-dark`  ⚠️text
```
Small compact email-signature logo: horizontal ICON + WORDMARK-EN, optimized to read clearly
around 140px wide. Flat vector, emerald #0E5C4F + small gold #C9A227 dot, warm cream #FAF7F0
background, tight spacing. Aspect ratio 3:1.
```
- **Dark:** Theme delta.

### B7 · Splash screen  →  `splash-{en,ar}-{light,dark}`  ⚠️text
```
App launch splash screen, 16:9. The vertical Kaleem logo (ICON above WORDMARK-EN) perfectly
centered on a full warm cream #FAF7F0 background, with one tiny gold #C9A227 accent and lots
of calm negative space. Minimal, serene, static. Flat vector, emerald #0E5C4F. Aspect 16:9.
```
- **Dark:** full near-black #0E1715 background, emerald #4FB89F. **Arabic:** WORDMARK-AR.

### B8 · Loading screen  →  `loading-{en,ar}-{light,dark}`  ⚠️text
```
App loading screen, 16:9. Centered ICON + WORDMARK-EN with a slim circular arc loading
indicator in gold #C9A227 just beneath the logo, on a warm cream #FAF7F0 background. Calm,
minimal, lots of space. Flat vector, emerald #0E5C4F. Aspect ratio 16:9.
```
- **Dark:** near-black #0E1715 background, emerald #4FB89F, gold #D9B43C arc. **Arabic:**
  WORDMARK-AR.

---

## 4. Marketing — `marketing/`

### M1 · Hero illustration  →  `hero-illustration-light`, `hero-illustration-dark`
```
Flat vector hero illustration for an Islamic-learning website, warm and calm. A student and a
teacher connected over an open Quran / book with a soft speech-and-recitation motif between
them; gentle geometric shapes, subtle paper texture. Limited palette: deep emerald #0E5C4F,
warm gold #C9A227, warm cream #FAF7F0 background, one muted support color. People shown
modestly and respectfully, diverse, non-caricatured. Wide composition with empty space on one
side for a headline. No text. Aspect ratio 4:3.
```
- **Dark:** emerald #4FB89F + gold #D9B43C on near-black #0E1715.

### M2 · Feature — live sessions  →  `feature-sessions-light`, `feature-sessions-dark`
```
Flat vector spot illustration: a one-on-one online video lesson — a soft device/call frame
with a teacher and a student and a gentle speech motif, conveying live tutoring. Limited
palette emerald #0E5C4F / gold #C9A227 / cream #FAF7F0, soft geometric shapes, generous
space. People modest and respectful. No text. Aspect ratio 4:3.
```
- **Dark:** Theme delta.

### M3 · Feature — progress  →  `feature-progress-light`, `feature-progress-dark`
```
Flat vector spot illustration: learning progress — a gentle rising path/arc with small
milestone markers and a subtle simple chart, abstract and calm. Limited palette emerald
#0E5C4F / gold #C9A227 / cream #FAF7F0, soft geometric shapes. No real UI, no text. Aspect 4:3.
```
- **Dark:** Theme delta.

### M4 · Feature — curriculum  →  `feature-curriculum-light`, `feature-curriculum-dark`
```
Flat vector spot illustration: an open mushaf / Quran with a soft branching learning-path
motif and a small star or lantern accent, evoking a structured curriculum. Limited palette
emerald #0E5C4F / gold #C9A227 / cream #FAF7F0, soft geometric shapes, generous space. No
text. Aspect ratio 4:3.
```
- **Dark:** Theme delta.

### M5 · Dashboard preview  →  `dashboard-preview-light`, `dashboard-preview-dark`  ⚠️text
```
A clean, modern flat UI mockup of a student learning-dashboard for "Kaleem". Top bar with the
small Kaleem logo, a left sidebar, an "upcoming session" card, a progress widget with a simple
chart, and a curriculum list. Color scheme: emerald #0E5C4F primary, gold #C9A227 accents,
warm cream #FAF7F0 surfaces, dark ink #16211D text, 8px rounded cards. Tasteful, realistic but
flat, no gradients. Aspect ratio 16:9.
```
- **Dark:** near-black #0E1715 background, #16211D cards, emerald #4FB89F, gold #D9B43C.

### M6 · Landing hero section  →  `landing-hero-{en,ar}-{light,dark}`  ⚠️text
```
A branded landing-page hero section for "Kaleem". Left: the Kaleem logo, a strong serif
headline "Learn the Quran & Arabic, one-on-one", a short supporting subline, and an emerald
#0E5C4F primary button "Start free trial". Right: a calm flat-vector illustration of guided
learning (open book + teacher/student motif). Warm cream #FAF7F0 background, gold #C9A227
accents, 8px rounded corners. Flat, premium. Aspect ratio 16:9.
```
- **Dark:** Theme delta. **Arabic:** RTL mirror — headline "تعلّم القرآن والعربية بشكل فردي",
  button "ابدأ التجربة المجانية", illustration on the left (set Arabic text manually).

### M7 · Presentation cover  →  `presentation-cover-{en,ar}-{light,dark}`  ⚠️text
```
A pitch-deck / presentation cover slide, 16:9, for "Kaleem". Centered Kaleem logo, the title
"Kaleem" in an elegant serif, the subtitle "Islamic sciences, taught with care", a thin gold
#C9A227 rule and a subtle open-book motif. Warm cream #FAF7F0 background, deep emerald #0E5C4F,
lots of calm negative space. Flat, premium. Aspect ratio 16:9.
```
- **Dark:** Theme delta. **Arabic:** title "كليم", subtitle "العلوم الإسلامية، تُدرَّس بإتقان".

---

## Coverage

74 asset targets (matching `ASSET-INDEX.md`), grouped into **21 base prompts** (L1–L5, F1–F6,
B1–B8, M1–M7) with explicit Dark / Arabic / mono deltas. Save each result under its filename
stem in the matching `brand/` folder, then we'll finalize SVGs, the favicon set, and the
`.webmanifest`. Bring the images back and I'll help assemble the production package.
