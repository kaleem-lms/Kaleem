# Design system architecture

The visual layer shared by the React dashboard and the Astro marketing site. Brand
direction is **Serene Scholar** (deep emerald + warm gold on cream; scholarly, calm,
trustworthy). See the spec `docs/superpowers/specs/2026-06-13-design-system-visual-identity-design.md`
and the binding standard ADR-0020 (a11y WCAG 2.2 AA both themes, i18n, full RTL).

## The shared layer: `@kaleem/tokens`

A standalone repo (`kaleem-lms/tokens`), added here as the 5th submodule at `tokens/`.
It is the single source of truth for the brand.

**Since v0.2.0 the source of truth is DTCG JSON in `tokens/src/`, and the CSS files
below are GENERATED** (ADR-0041). Edit `src/*.tokens.json` and run `node build.mjs`;
`node build.mjs --check` fails CI if the committed CSS has drifted, so a hand-edit
of `tokens.css` is silently reverted. The package ships:

- `tokens.css` — semantic design tokens as CSS custom properties, defined for `:root`
  (light) and `.dark` (dark). Names follow **shadcn's CSS-variable contract**
  (`--background`, `--foreground`, `--primary`, `--ring`, `--destructive`, …) so
  shadcn primitives theme automatically, plus kaleem extras (`--success`/`--warning`/
  `--info`, `--font-*`, `--shadow-*`, `--duration-*`, `--ease-standard`).
- `theme.css` — a Tailwind v4 `@theme inline { … }` preset mapping `--color-*` →
  `var(--*)` so utilities (`bg-primary`, `text-muted-foreground`, `font-display`,
  `rounded-lg`) resolve to the tokens. `inline` means utilities read the live variable,
  so light/dark swapping just works.
- `index.css` — imports both, for single-import consumers.

### Consuming and bumping

Both surfaces install it from its git URL (no registry):

    pnpm add "@kaleem/tokens@git+ssh://git@github.com/kaleem-lms/tokens.git#vX.Y.Z"

and import in their Tailwind v4 entry CSS:

    @import "tailwindcss";
    @import "@kaleem/tokens/tokens.css";
    @import "@kaleem/tokens/theme.css";

To change the brand: edit the tokens repo, commit, tag `vX.Y.Z`, push the tag; then bump
the dependency ref in each consumer and reinstall. Current release: **v0.2.1**.

### Rule: tokens are shared, components are not

The token package is the *only* thing shared between surfaces. Components diverge: the
dashboard uses shadcn-based primitives in `src/ui/`; marketing uses bespoke Astro
sections. Layout density and composition differ per surface; the brand stays identical
because both pull the same tokens.

## Dashboard specifics

- **`src/ui/` is the owned primitive layer** over shadcn. Components are added via shadcn,
  constrained to kaleem `cva` variants, and re-exported through `src/ui/index.ts`.
  **Features import UI only from `@/ui`** — never raw shadcn or `@kaleem/tokens` internals.
  `cn()` (`@/lib/cn`) = clsx + tailwind-merge. Slot is from the unified `radix-ui` package
  (`Slot.Root`). Icons: `lucide-react`.
- **Theming**: `data-theme` is not used; dark mode is the `.dark` class on `<html>`,
  toggled by `ThemeProvider` (`@/lib/theme`), which honors `prefers-color-scheme`, persists
  to `localStorage["kaleem-theme"]`, and is mirrored by a no-flash inline script in
  `index.html`. `@custom-variant dark` in `src/index.css` binds Tailwind's `dark:` to it.
- **i18n + RTL**: `@/lib/i18n` (react-i18next, `en`+`ar`, no hardcoded UI strings).
  `DirectionProvider` (`@/lib/direction`) sets `<html dir>` + `lang` from the locale and
  persists `localStorage["kaleem-locale"]`. Full RTL UI is supported; layout relies on
  logical/`rtl:` classes, not physical left/right.
- **Verification gate** — three checks, and they prove DIFFERENT things. Conflating
  them is how the previous gate rotted:

  | Check | Where | Proves | Cannot prove |
  | --- | --- | --- | --- |
  | Token contrast | `tokens` CI + `src/test/a11y.test.tsx` | every declared pair meets WCAG 2.2 AA / 1.4.11 / 2.4.11 in both themes, body text at AAA | rendered pixels; undeclared pairs |
  | jsdom axe | `src/routes/design-preview.test.tsx` | roles, names, labels, ARIA across every `@/ui` export in 4 modes | **colour contrast** — axe disables that rule without a renderer |
  | Real-browser axe | `e2e/design-preview.spec.ts` | contrast **as actually rendered**: composited alpha, gradients, real cascade | Safari/iOS — no Apple device exists in this project |

  The contrast checks hold **no colour values**. They read `tokens/src/*.tokens.json`
  and the pairing manifest `tokens/src/contrast-pairs.json`. Until 2026-09-12 the
  dashboard's gate hand-mirrored 26 hex literals and a drift had already made it pass
  while testing nothing — see ADR-0041.

  **A new colour pair must be declared in `contrast-pairs.json`, or nothing verifies
  it.** The gate proves declared pairs are sound; it cannot know about a pair nobody
  listed. That gap is what the real-browser run covers — it found a live AA failure in
  `Alert variant="destructive"` (an undeclared, alpha-composited pair) on its first run.

- **`/design-preview`** renders every `@/ui` export x variant x state in all four
  combinations of theme x direction **at once**. A palette change is atomic — `@theme
  inline` resolves at use site, and a scoped second palette cannot work because Radix
  portals to `document.body` — so seeing the whole surface together is the only way to
  review one. It is the target of both axe sweeps.

### Color-usage guardrails

- **`--accent` (gold) is a surface/decoration color, not a text color.** In v2 it measures
  **3.05:1 in light** (needs 4.5) and **7.28:1 in dark**. The ban is a light-mode constraint
  applied to BOTH themes, because one token cannot be conditionally usable per theme; if that
  ever becomes intolerable the fix is a separate `--accent-text` token, not relaxing the ban. Use `text-accent` only for decorative marks (e.g.
  the brand "." in the wordmark) or paired with `--accent-foreground` *on* an accent surface.
  Never use it for body copy, labels, links, or any meaningful text. For "highlight" text that
  must stay readable, use `--primary` (emerald) or `--foreground`.
- **Functional color is never the only signal.** Status meaning (error/success/info) must be
  backed by an icon or text, not color alone — e.g. toast variants carry a leading status icon,
  and form errors render text, not just a red border (WCAG color-not-only).
- **Interactive controls meet the 44px touch-target minimum** by default (`Button`/`Input` are
  `h-11`; icon buttons `h-11 w-11`). `sm` keeps a 40px ink height with the hit area expanded
  to 44x44 by a pseudo-element — SC 2.5.8 measures the target, not the ink, so dense tables
  keep their density without failing the guidance (ADR-0040 decision, 2026-09-12).

## CI: fetching the private token package

All CI is centralized in the meta repo's `.github/workflows/ci.yml` (the submodule repos
have no workflows). `@kaleem/tokens` is a private git dependency, so:

- **Runner install jobs** (`dashboard-lint`, `dashboard-build`, `marketing-build`)
  configure `git insteadOf` with `secrets.TOKENS_REPO_TOKEN` before `pnpm install`.
- **Image builds** (`deploy-staging`) pass the token to the Docker build as a **BuildKit
  secret** (`--secret id=tokens_token,env=TOKENS_REPO_TOKEN`); the Dockerfiles add `git`
  to the `node:22-alpine` build stage and use the secret for install only — the token is
  never persisted in a committed layer.

`TOKENS_REPO_TOKEN` (read access to `kaleem-lms/tokens`) must exist as a secret on the
**meta repo** (or org-level). CI runs on PRs to / pushes on `master`/`main`. A **merge to
the meta trunk is the staging deploy** — there is no `develop` branch and no promotion
step (ADR-0028).

**The `tokens` repo itself has no CI yet** (no `.github/` directory), so `smoke.test.mjs`
has never run automatically. ADR-0041 adds the package's first workflow as its first
step.
