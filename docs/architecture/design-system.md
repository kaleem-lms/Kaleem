# Design system architecture

The visual layer shared by the React dashboard and the Astro marketing site. Brand
direction is **Serene Scholar** (deep emerald + warm gold on cream; scholarly, calm,
trustworthy). See the spec `docs/superpowers/specs/2026-06-13-design-system-visual-identity-design.md`
and the binding standard ADR-0020 (a11y WCAG 2.2 AA both themes, i18n, full RTL).

## The shared layer: `@kaleem/tokens`

A standalone repo (`kaleem-lms/tokens`), added here as the 5th submodule at `tokens/`.
It is the single source of truth for the brand and ships three CSS files:

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
the dependency ref in each consumer and reinstall. Current release: **v0.1.1**.

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
- **Verification gate**: `src/test/a11y.test.tsx` runs axe (LTR + RTL) and asserts WCAG AA
  contrast (≥ 4.5:1) on key token pairings in **both** themes. The `/design-preview` route
  renders the 3-mode login (light/dark/RTL) for manual + automated checks.

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
**meta repo** (or org-level). CI runs on PRs to / pushes on `master`/`main`; the
develop→master promotion is what exercises the build + staging deploy.
