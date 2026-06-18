# Kaleem LMS — Brand & Design Guidelines (`design.md`)

> Authoritative visual-identity brief for the **Kaleem LMS Branding** Stitch project
> (`projects/18007247280796336213`, a **web/desktop** project). Grounded in the live `@kaleem/tokens` package
> (v0.1.1) and the shipped design-system spec
> (`docs/superpowers/specs/2026-06-13-design-system-visual-identity-design.md`).
> This file is uploaded to Stitch as the project's design system and is the single
> source of truth for every generated asset.

---

## 1. Brand personality — "Serene Scholar"

Kaleem teaches Islamic sciences (Quran, Tafsir, Arabic) to non-Arabic speakers.
The brand must feel **scholarly, calm, and trustworthy** — rooted in Islamic
tradition without being literal or ornamental-kitsch.

| Trait | Means in design |
| --- | --- |
| **Scholarly** | Old-style serif wordmark, generous reading measure, restrained palette. Evokes a manuscript / study, not a flashy app. |
| **Serene** | Warm cream backgrounds, soft emerald, gold used sparingly as a single accent. No harsh pure-white/pure-black, no neon. |
| **Trustworthy** | High contrast (WCAG 2.2 AA both themes), consistent geometry, no gimmicks. A parent paying monthly must feel this is safe and durable. |
| **Education-focused** | Iconography and illustration center learning: books, recitation, mentorship, progress — never generic "tech". |
| **Bilingual & global** | Equal care for Arabic (RTL) and English (LTR). The mark works in both scripts and reads at favicon scale. |

**Tone words:** measured · warm · literate · grounded · modern-classic.
**Avoid:** crescents/mosques as clip-art, geometric "Islamic pattern" overload,
startup-purple gradients, drop-shadow heaviness, stocky 3D mascots.

---

## 2. Color palette

Colors follow the **shadcn CSS-variable contract** plus Kaleem extras. Both themes
ship at launch and are WCAG 2.2 AA verified (ADR-0020). Source: `tokens/tokens.css`.

### 2.1 Light theme (`:root`)

| Role | Hex | Notes |
| --- | --- | --- |
| **Primary** (deep emerald) | `#0E5C4F` | Brand core. Wordmark, primary buttons, links. |
| Primary foreground | `#FFFFFF` | Text/icon on primary. |
| **Accent** (warm gold) | `#C9A227` | The single accent. Wordmark dot, highlights, focus moments. Use sparingly. |
| Accent foreground | `#3A2F00` | Text on gold. |
| **Background** (cream) | `#FAF7F0` | Off-white, never pure `#FFF`. |
| **Foreground** (dark teal-green) | `#16211D` | Body text. |
| Card / Popover | `#FFFFFF` | Raised surfaces. |
| Secondary / Muted | `#EFE9DB` | Warm neutral fills. |
| Muted foreground | `#62736C` | Secondary text (AA 4.69:1 on bg). |
| Border / Input | `#E0D9C8` | Warm beige hairlines. |
| Ring (focus) | `#127D6B` | Focus outline. |
| Success | `#127D6B` | |
| Warning | `#C98A2B` (fg `#3A2600`) | |
| Destructive | `#C0432E` | |
| Info | `#2F6F8F` | |

### 2.2 Dark theme (`.dark`)

| Role | Hex | Notes |
| --- | --- | --- |
| **Primary** (lighter emerald) | `#4FB89F` | Brightened for dark surfaces. |
| Primary foreground | `#07302A` | |
| **Accent** (lighter gold) | `#D9B43C` | |
| Accent foreground | `#3A2F00` | |
| **Background** (near-black green) | `#0E1715` | Never pure `#000`. |
| **Foreground** (near-white) | `#ECEFEC` | |
| Card / Popover | `#16211D` | |
| Secondary / Muted | `#1E2B27` | |
| Muted foreground | `#9DB0A8` | |
| Border / Input | `#2A3A34` | |
| Ring (focus) | `#3AA08C` | |
| Success | `#3AA08C` · Warning `#D9B43C` · Destructive `#E0735B` · Info `#5AA9C9` | |

### 2.3 Usage rules

- **Emerald is the brand, gold is the spark.** A logo is mostly emerald (or mono);
  gold appears as the accent dot or a single highlight — never as a fill area.
- **Backgrounds are warm.** Cream `#FAF7F0` (light) / `#0E1715` (dark). Pure white
  is allowed only for cards/print where cream is impractical.
- **Monochrome rule:** mono-dark = `#16211D`, mono-light/reversed = `#FAF7F0` (or
  `#FFFFFF` on photos). Never mono in mid-gray.

---

## 3. Typography

| Use | Family | Fallback stack | Notes |
| --- | --- | --- | --- |
| **Display / wordmark / headings** | **Fraunces** (variable) | `Georgia, serif` | Warm old-style serif with optical sizing. The wordmark is set here. |
| **Body / UI** | **Inter** | `system-ui, sans-serif` | 400/500/600/700. |
| **Arabic UI** | **IBM Plex Sans Arabic** | `Inter, sans-serif` | Auto-applied under `[dir="rtl"]`. 400/500/600/700. |
| **Quranic text** | **Amiri Quran** | `Noto Naskh Arabic, serif` | Reserved for ayah rendering. |

**Type scale** (modular ~1.2): 12 · 14 · 16(base) · 18 · 20 · 24 · 30 · 36 · 48 px.
**Weights:** 400 regular · 500 medium · 600 semibold · 700 bold.
**Line height:** display 1.2–1.3 · body 1.6.

**Wordmark spec:** lowercase **`kaleem`** in Fraunces ~semibold (600), color = primary
emerald, followed by a **gold accent dot `.`** (`kaleem` + `.` in accent). Arabic
wordmark: **`كليم`** in IBM Plex Sans Arabic / Amiri, same emerald, with the gold
accent realized as a small gold dot or harakah-like mark trailing the word (RTL: dot on
the left). Both scripts share weight, color, and the gold-accent idea.

> Stitch font note: Fraunces and IBM Plex Sans Arabic may not be available as exact
> webfonts in Stitch. When unavailable, render with the closest warm old-style serif
> (e.g. Newsreader / Source Serif) for Latin and a clean naskh/sans-Arabic for Arabic,
> and keep the wordmark proportions and gold dot identical.

---

## 4. Spacing system

- **Base unit:** 4px (Tailwind v4 default scale, unmodified).
- **Steps:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px (1/2/3/4/6/8/12/16).
- **Border radius:** base `--radius: 8px`. Derived: sm 6 · md 8 · lg 12 · xl 16. Logo
  containers / app-icon squircles use 16–22% corner radius of the icon size.
- **Logo clear space:** minimum padding around any lockup = the cap-height of the
  wordmark (or, for the icon, 25% of the icon's width) on all sides.
- **Minimum sizes:** icon-only mark legible at 16px; full wordmark not below 80px wide
  (Latin) / 64px (Arabic).

---

## 5. Iconography style

- **System icons:** `lucide-react` — 1.5px stroke, rounded caps/joins, 24px grid.
  Outlined, not filled. Match this stroke weight in any custom UI/feature icon.
- **Brand mark / logo icon:** a single, calm geometric glyph derived from the idea of
  **"kaleem = speech / the spoken word"** + learning. Acceptable directions: an open
  book whose pages form a speech/recitation motion; an Arabic-letter-inspired ك
  ligature; a soft "k" that doubles as a page/leaf. One concept, executed consistently
  across all sizes. Solid emerald or two-tone emerald+gold; flat, no gradients, no 3D.
- **Illustration:** flat, warm, limited palette (emerald/gold/cream + one or two muted
  supports). Soft geometric shapes, generous negative space, subtle paper texture
  allowed. People depicted respectfully and modestly; diverse, non-caricatured.

---

## 6. Accessibility (binding — ADR-0020, WCAG 2.2 AA)

- **Contrast:** all text and meaningful glyphs ≥ 4.5:1 (≥ 3:1 large). Both themes
  verified. Logo must remain legible mono on any brand background.
- **Never color-only:** state/meaning never conveyed by color alone.
- **Focus:** visible focus ring (`ring` token), never removed.
- **Icon legibility:** the icon mark must read at 16px and in 1-bit monochrome.
- **Motion:** splash/loading animation must respect `prefers-reduced-motion` (provide a
  static fallback frame).
- **Alt text:** every exported asset ships with documented alt text (see Asset Index).

---

## 7. Arabic & English language support

- **Locales:** `en` (LTR), `ar` (RTL). i18n via `react-i18next`; zero hardcoded strings.
- **Direction:** `<html dir>` + `lang` bound to locale; layouts use **logical CSS
  properties** (`padding-inline`, `ps/pe`), never physical `left/right`.
- **Bilingual parity:** every brand-text asset has an **AR** and an **EN** variant.
  Arabic is a first-class citizen, not a translation afterthought — the Arabic wordmark
  is designed, not auto-transliterated.
- **Mirroring:** directional elements (arrows, lockup alignment, the accent-dot side)
  mirror in RTL. The icon mark itself is direction-neutral where possible.

---

## 8. Light & dark theme specifications

- **Strategy:** `.dark` class on `<html>`; CSS variables resolve live (no reload).
  Persisted to `localStorage["kaleem-theme"]`; honors `prefers-color-scheme`; no-flash
  inline script.
- **Every visual asset ships two theme variants:**
  - **Light:** brand colors on cream `#FAF7F0` / white card.
  - **Dark:** brightened brand colors on near-black `#0E1715` / `#16211D` card.
- **Logos:** light-theme logo uses emerald `#0E5C4F`; dark-theme logo uses emerald
  `#4FB89F` (so it stays vivid on dark). Gold shifts `#C9A227` → `#D9B43C`.
- **Reversed/mono:** provide a white/cream mono mark for dark photos and an ink mono
  mark for light photos.

---

## 9. Asset taxonomy & folder structure

All generated assets are organized under `brand/`:

```text
brand/
  design.md                 ← this file (uploaded to Stitch)
  ASSET-INDEX.md            ← generated manifest: every screen, id, variants, usage
  logos/                    ← primary/secondary/icon/horizontal/vertical, color+mono, light+dark, AR+EN
  favicons-app-icons/       ← favicon, PWA, Android, iOS, touch, maskable
  brand-assets/             ← brand mark, app icon, social profile/cover, OG, email header/logos, splash, loading
  marketing/                ← hero & feature illustrations, dashboard preview, landing graphics, presentation cover
```

Each subfolder carries a `README.md` listing intended export filenames and the Stitch
screen each maps to. (Stitch renders design boards in the cloud; export the bitmap/code
from the Stitch UI into these folders using the documented filenames.)

---

## 10. Asset Index

> Populated during generation. Each row: **purpose · intended filename(s) · variants ·
> Stitch screen id · usage guidance · alt text.** See `brand/ASSET-INDEX.md` for the
> live, complete table.

_(see ASSET-INDEX.md)_

---

## 11. Generation directives for Stitch (consistency contract)

Every screen generated in this project MUST:

1. Use the project design system (Light or Dark) for color/type/radius consistency.
2. Use brand colors **exactly** as specified in §2 (quote the hex in the prompt).
3. Set the wordmark per §3 (lowercase Fraunces-style serif `kaleem` + gold dot; Arabic
   `كليم`).
4. Use warm cream / near-black backgrounds per §8 — never pure white/black.
5. Keep the icon mark identical across every asset it appears in (one concept).
6. Respect clear space and minimum sizes (§4).
7. For text assets, produce the AR and EN variant with equal care.
8. Be flat (no gradients/3D/heavy shadow) unless an illustration explicitly calls for
   soft depth.
