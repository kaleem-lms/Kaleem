# Kaleem LMS — Brand Asset Index

> Companion manifest to [`design.md`](./design.md). Every asset below is generated in the
> Stitch **web** project `projects/18007247280796336213` on the **Pro** model
> (`GEMINI_3_1_PRO`) and downloaded here as **both `.svg` (vector) and `.png` (raster)**.
>
> **Design systems:** Light `assets/1567467853611212833` · Dark `assets/143737358598788077`
> · design-md system `1b57c1762e1a4fa781db4c82cf564129`.
>
> **How to read this:** every row lists the on-disk **file stem** (so the files are
> `<stem>.svg` and `<stem>.png`), the variants it covers, its purpose/usage, and alt text.
> The `Screen ID` / `Status` columns are filled in by the generation run.
> Since each generation yields a clean SVG, the `.svg` is the editable production master;
> the `.png` is a ready preview/raster. Re-export at any target pixel size from the SVG.

**Brand colors (quick ref):** emerald `#0E5C4F` (dark `#4FB89F`) · gold `#C9A227`
(dark `#D9B43C`) · cream bg `#FAF7F0` · near-black bg `#0E1715` · ink `#16211D`.

---

## 1. Logos — `logos/`

| Asset | File stem | Theme · Lang · Treatment | Purpose / usage | Alt text |
| --- | --- | --- | --- | --- |
| Primary logo | `kaleem-logo-primary-en-light` | Light · EN · color | Signature logo (icon + wordmark). Default everywhere on light surfaces. | "Kaleem logo" |
| Primary logo | `kaleem-logo-primary-en-dark` | Dark · EN · color | Signature logo on dark surfaces. | "Kaleem logo" |
| Primary logo | `kaleem-logo-primary-ar-light` | Light · AR · color | Arabic signature logo (RTL). | "شعار كليم" |
| Primary logo | `kaleem-logo-primary-ar-dark` | Dark · AR · color | Arabic signature logo on dark. | "شعار كليم" |
| Primary mono (ink) | `kaleem-logo-primary-mono-ink` | — · EN · mono | One-color print, faxable, stamps, light photos. | "Kaleem logo" |
| Primary mono (reversed) | `kaleem-logo-primary-mono-reversed` | — · EN · mono | Reversed one-color on emerald / dark photos. | "Kaleem logo" |
| Horizontal logo | `kaleem-logo-horizontal-en-light` | Light · EN | Nav bars / app headers (wide, compact). | "Kaleem" |
| Horizontal logo | `kaleem-logo-horizontal-en-dark` | Dark · EN | Header on dark. | "Kaleem" |
| Horizontal logo | `kaleem-logo-horizontal-ar-light` | Light · AR | Arabic header (RTL). | "كليم" |
| Horizontal logo | `kaleem-logo-horizontal-ar-dark` | Dark · AR | Arabic header on dark. | "كليم" |
| Vertical logo | `kaleem-logo-vertical-en-light` | Light · EN | Stacked lockup for square/centered spots. | "Kaleem" |
| Vertical logo | `kaleem-logo-vertical-en-dark` | Dark · EN | Stacked, dark. | "Kaleem" |
| Vertical logo | `kaleem-logo-vertical-ar-light` | Light · AR | Stacked Arabic. | "كليم" |
| Vertical logo | `kaleem-logo-vertical-ar-dark` | Dark · AR | Stacked Arabic, dark. | "كليم" |
| Wordmark (secondary) | `kaleem-wordmark-en-light` | Light · EN | Wordmark-only, no icon. Tight footers, text contexts. | "kaleem" |
| Wordmark (secondary) | `kaleem-wordmark-en-dark` | Dark · EN | Wordmark-only, dark. | "kaleem" |
| Wordmark (secondary) | `kaleem-wordmark-ar-light` | Light · AR | Arabic wordmark-only. | "كليم" |
| Wordmark (secondary) | `kaleem-wordmark-ar-dark` | Dark · AR | Arabic wordmark-only, dark. | "كليم" |
| Icon-only | `kaleem-icon-color-light` | Light · color | The mark alone. Avatars, app launchers, tight spaces. | "Kaleem mark" |
| Icon-only | `kaleem-icon-color-dark` | Dark · color | The mark alone, dark. | "Kaleem mark" |
| Icon-only mono (ink) | `kaleem-icon-mono-ink` | — · mono | One-color mark on light. | "Kaleem mark" |
| Icon-only mono (reversed) | `kaleem-icon-mono-reversed` | — · mono | Reversed mark on emerald. | "Kaleem mark" |

## 2. Favicons & app icons — `favicons-app-icons/`

| Asset | File stem | Notes | Purpose / usage | Alt text |
| --- | --- | --- | --- | --- |
| Favicon | `favicon-light` | emerald mark on cream tile | Browser tab (light). Export 16/32/48 from SVG; build `favicon.ico`. | "Kaleem" |
| Favicon (dark) | `favicon-dark` | emerald `#4FB89F` on near-black | Browser tab where a dark glyph is preferred. | "Kaleem" |
| PWA icon 512 | `pwa-icon-512` | mark on emerald tile | `icon-512.png` in `manifest.webmanifest`. | "Kaleem" |
| PWA icon 512 (dark) | `pwa-icon-512-dark` | mark on near-black tile | Dark PWA icon variant. | "Kaleem" |
| Android adaptive | `android-adaptive-icon` | full-bleed emerald, safe circle | Android adaptive foreground/background. | "Kaleem" |
| iOS app icon | `ios-app-icon` | emerald tile, no transparency | iOS home-screen icon (1024 master). | "Kaleem" |
| Apple touch icon | `apple-touch-icon` | emerald tile | `apple-touch-icon.png` (180×180). | "Kaleem" |
| Maskable icon | `maskable-icon` | full-bleed, 80% safe zone | `purpose:"maskable"` PWA icon. | "Kaleem" |

## 3. Brand assets — `brand-assets/`

| Asset | File stem | Variants | Purpose / usage | Alt text |
| --- | --- | --- | --- | --- |
| Brand mark (hero) | `brand-mark-light` / `brand-mark-dark` | light/dark | Large standalone mark for brand moments. | "Kaleem mark" |
| Social avatar | `social-avatar-light` / `social-avatar-dark` | light/dark | Square profile image (X, IG, LinkedIn, YouTube). | "Kaleem" |
| Social cover | `social-cover-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | Profile cover/banner (~3:1) with tagline. | "Kaleem — learn the Quran & Arabic with a teacher" |
| Open Graph image | `og-image-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | `og:image` / `twitter:image` (1200×630) link previews. | "Kaleem — Islamic learning, guided" |
| Email header | `email-header-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | Transactional/marketing email masthead. | "Kaleem" |
| Email logo | `email-logo-light` / `email-logo-dark` | light/dark | Compact logo for signatures (~140px). | "Kaleem" |
| Splash screen | `splash-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | App/PWA launch splash (static, reduced-motion safe). | "Kaleem" |
| Loading screen | `loading-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | In-app loading state (logo + gold arc loader). | "Loading Kaleem" |

## 4. Marketing — `marketing/`

| Asset | File stem | Variants | Purpose / usage | Alt text |
| --- | --- | --- | --- | --- |
| Hero illustration | `hero-illustration-light` / `-dark` | light/dark | Landing hero scene (guided learning). | "A student and teacher learning the Quran together" |
| Feature — live sessions | `feature-sessions-light` / `-dark` | light/dark | Feature section: 1-on-1 & group sessions. | "Live one-on-one video lesson" |
| Feature — progress | `feature-progress-light` / `-dark` | light/dark | Feature section: progress tracking. | "Learning-progress chart" |
| Feature — curriculum | `feature-curriculum-light` / `-dark` | light/dark | Feature section: Quran & curriculum. | "Open Quran with a learning path" |
| Dashboard preview | `dashboard-preview-light` / `-dark` | light/dark | Product screenshot graphic for landing/press. | "Kaleem student dashboard" |
| Landing hero section | `landing-hero-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | Full branded hero block (headline + CTA + art). | "Kaleem landing hero" |
| Presentation cover | `presentation-cover-en-light` · `-en-dark` · `-ar-light` · `-ar-dark` | EN/AR × light/dark | Pitch-deck / slide cover. | "Kaleem" |

---

## Generation status

_Filled in after the generation run completes (Stitch screen IDs + per-asset status)._

**Target:** 74 assets × (SVG + PNG) = 148 files.

| Category | Planned | Generated (ok) | Notes |
| --- | --- | --- | --- |
| logos | 22 | _pending_ | |
| favicons-app-icons | 8 | _pending_ | |
| brand-assets | 26 | _pending_ | |
| marketing | 18 | _pending_ | |
| **Total** | **74** | _pending_ | |

## Export / handoff notes

- The **`.svg` is the master.** It contains the actual brand hex values and is editable in
  any vector tool; rasterize to any size needed.
- **Favicon:** from `favicon-light.svg` export 16/32/48 px PNGs and assemble `favicon.ico`;
  keep `favicon.svg` for modern browsers.
- **PWA manifest:** use `pwa-icon-512` (any/maskable via `maskable-icon`), `apple-touch-icon`.
- **Where these live in the product:** the dashboard consumes assets from
  `dashboard/public/`, marketing from `marketing/public/`. Per repo rules (meta = docs +
  pointer bumps only), place finalized assets into those **submodules** via their own
  git-flow — not the meta repo.
