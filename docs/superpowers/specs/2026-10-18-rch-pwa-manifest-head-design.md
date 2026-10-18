---
name: rch-pwa-manifest-head
phase: v1 (wave 1, PWA stream)
modules: [dashboard index.html, dashboard public/]
status: approved
created: 2026-10-18
closed: null
---

## Goal

The dashboard's document head is still the Vite template's. At dashboard `origin/main`
e61e23e, `index.html` says `<title>kaleem-dash-tmp</title>` on every page, links only
`/favicon.svg`, which is Vite's purple placeholder (`#863bff`, not in the palette), and has no
web app manifest, no `apple-touch-icon`, no `theme-color` and no `meta description`.

This unit gives the dashboard a real head and a web app manifest. The manifest has interim
icons drawn from the tokens the app already ships. Browsers that install apps from a
manifest (Chromium on Android and desktop, Safari's Add to Home Screen) then get a named,
iconned app in place of a tab called `kaleem-dash-tmp`. The service worker and offline shell
belong to `rch-pwa-service-worker`, which depends on this unit. Proving the install on real
devices belongs to `rch-pwa-device-verification`.

**Who owns what.** This unit owns the manifest file, the `<head>` and the icon **file names**.
The brand stream later supplies the real artwork. Brand plan Task 8, as corrected by the
`inf-brand-docs-land` errata, emits icons only. `inf-brand-dashboard` copies them over the
interim files under the **same names**, so the manifest does not change when the mark
lands. The names below are the ones Task 8 already declares (`favicon-32.png`,
`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). `site.webmanifest` is the path Task
10's `<link rel="manifest">` already uses.

## What the code does today (read at e61e23e)

- `index.html` has a charset, a viewport, the SVG favicon link, the temporary title and an
  inline script that applies the theme class before first paint. Nothing else.
- `public/` holds `favicon.svg` (the purple Vite mark) and `icons.svg`, Vite's template
  sprite of social icons, which nothing references.
- `DirectionProvider` (`src/lib/direction.tsx`) sets `lang` and `dir` on `<html>` at
  runtime. The static `lang="en"` is only the pre-hydration value.
- `nginx.conf` serves anything outside `/assets/` through `location /` with `no-cache` and an
  SPA fallback to `index.html`. **A missing icon therefore comes back `200 text/html`.** A
  test that checks only the status cannot detect a missing file.
- nginx 1.31's `mime.types` has no `webmanifest` entry (checked in `nginx:alpine`), so
  without a change the manifest would be served as `application/octet-stream` with
  `nosniff`.
- `@kaleem/tokens/build.mjs` exports `light`, `dark` and `resolveTheme`. The dashboard does
  not override `--background` or `--primary`. The resolved light background is `#FBF5EB` and
  the dark one is `#191C1B`. The light `--primary` is `#146A51`, and `--primary-foreground`
  on it measures 6.54:1.
- The product name in copy is lowercase `kaleem` (en) and `كَلِيم` (ar). The in-app wordmark
  is `kaleem.` in the display face (Fraunces), with the accent on the full stop
  (`AppTopbar.tsx`, `auth-layout.tsx`).

## Decisions taken in this spec

- **Head.** The changes to `index.html`:
  - `<title>kaleem</title>`. One static title. It is the brand name, so it reads correctly
    in both locales. Per-route titles are out of scope.
  - `<meta name="description">` with one English sentence: *"Lessons, schedule and progress
    for kaleem students, parents and teachers."*
  - `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`, replacing
    the SVG favicon link.
  - `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180×180).
  - `<link rel="manifest" href="/site.webmanifest">`.
  - Two `<meta name="theme-color">` tags, one per `prefers-color-scheme`, set to the
    resolved light and dark `--background`.
  - No robots or indexing meta. That is `dec-indexing`, which belongs to `rch-mkt-seo-infra`.
- **Manifest** (`public/site.webmanifest`):
  - `id`, `start_url` and `scope` are all `/`.
  - `name` and `short_name` are both `kaleem`.
  - `description` is the same sentence as the meta description.
  - `display` is `standalone`. `lang` is `en` and `dir` is `ltr`.
  - `background_color` and `theme_color` are both the light `--background`.
  - `icons` holds two entries: `icon-192.png` (192×192) and `icon-512.png` (512×512), both
    `image/png` with purpose `any`.
- **Colours come from tokens, enforced by a test rather than by convention.** The hex values
  in `index.html` and the manifest are literals, because these formats cannot read CSS
  variables. A unit test asserts that each one equals `resolveTheme(light|dark).background`
  from the installed `@kaleem/tokens`. A palette change then turns the suite red instead of
  leaving a stale browser bar behind. G2 (`check-colors.mjs`) does not scan `.html` or
  `public/`, so this test is the gate for those files.
- **Interim icon art: a lowercase `k`** in the display face (Fraunces Variable, the face the
  wordmark renders in), coloured `--primary-foreground` on a full-bleed `--primary` square
  (light theme), centred inside the middle 80%. It repeats the one brand element users
  already see. It does not commit to the Arabic-first mark the brand stream is still
  choosing (`dec-brand-direction`), and the brand release replaces it file for file.
  - It is raster only, so no font has to be outlined into an SVG.
  - `scripts/render-interim-icons.mjs` produces it, using the Playwright Chromium the repo
    already depends on, so no new dependency. The script resolves the two colours from the
    tokens package and refuses to write anything unless the Fraunces face actually loaded.
    This guards against the Georgia fallback that `display-font.spec.ts` exists to catch.
  - It writes the four PNGs, and they are committed. CI never runs it.
- **The purple `public/favicon.svg` is deleted.** Nothing references it after the head
  change. Task 10 brings a real `favicon.svg` back from the tokens package. `icons.svg` is
  untouched (D10). It is dead, and that is recorded in `ISSUES.md`.
- **nginx serves the manifest with its media type.** `location = /site.webmanifest` sets
  `default_type application/manifest+json`. It repeats the `nosniff` header, because a
  location-level `add_header` replaces the inherited ones, and it sets `no-cache` and
  `try_files $uri =404`. A missing manifest is then a 404, not the SPA shell.

## User flow

1. Any visitor, signed in or not, sees `kaleem` in the browser tab and the interim `k` icon
   as the favicon. In history and bookmarks the app is no longer called `kaleem-dash-tmp`.
2. In Chromium the browser bar is tinted with the page background for the OS colour scheme.
3. On Android Chrome or desktop Chromium the browser may offer "Install". The installed app
   opens at `/` in its own window, named `kaleem`, with the `k` icon. `/` already redirects
   a signed-out user to `/login` (`requireAuth`). Whether Chromium requires a service worker
   before it offers install is measured in the e2e step and recorded here. Either way the
   manifest is correct, and the prompt behaviour is `rch-pwa-service-worker`'s concern.
4. On iOS, Add to Home Screen uses `apple-touch-icon.png` and the name `kaleem`.
5. Error case: an icon or manifest URL that does not exist must not render the SPA shell
   as a "successful" image or manifest. The e2e asserts media types and bytes, not only
   status codes.

## Data model delta / API delta

None. No backend change and no migration. **Personal data (ADR-0023): none.** The manifest
and icons are static public files. **Expand/contract:** static files only. A tab still on the
previous bundle is unaffected, and the head only takes effect on the next load.

## Frontend

- No route, component, state or API call changes. All of `src/` stays untouched, apart from
  one new test file under `src/test/`.
- RTL/i18n: the title is the brand name. The manifest has `lang: en` because the app's
  default locale is `en`. Arabic-locale users see the Latin brand name on the installed
  icon, and that is a stated limit, not an oversight. Manifest localisation is not
  supported across browsers today.
- a11y: the icon is decorative app chrome. Its 6.54:1 pair (`--primary-foreground` on
  `--primary`) is stated for the record, not gated.
- "Done" means built, deployed to staging, and both the manifest and the icons measured on
  `app-staging` (media types, bytes, dimensions).

## Module boundaries

Dashboard-only. It touches the shared files `dashboard/index.html` and `dashboard/public/`.
The next writers are `rch-pwa-service-worker`, which depends on this unit and shares
`nginx.conf`, and `inf-brand-dashboard`, which depends on it and swaps the PNGs. No backend
module and no import-linter contract is involved.

## Out of scope

- The service worker, the offline shell, install prompts and update UX
  (`rch-pwa-service-worker`).
- Real-device install checks (`rch-pwa-device-verification`, `hg-ios-device`).
- The real mark, the SVG favicon and a maskable icon (brand stream). The brand pipeline
  should add a safe-zone `maskable` 512 icon. Without one, Android draws the `any` icon on a
  plate. This is noted for `inf-brand-mark-assets`.
- Per-route document titles, and a `theme-color` that follows the in-app theme toggle
  rather than the OS scheme.
- Marketing's head (`rch-mkt-seo-infra`, `inf-brand-marketing`), `package.json`'s
  `kaleem-dash-tmp` name (not user-facing) and `icons.svg`.
- Lighthouse floors. The new meta description may raise `app-staging`'s SEO score. A
  measured rise is reported to the conductor, and this unit does not edit
  `.lighthouserc.json`.

## Test plan

- **Unit (`src/test/web-manifest.test.ts`, vitest, reads files with `node:fs`):**
  - The manifest parses and carries the fields above.
  - Every icon `src` exists under `public/`, starts with the PNG signature, and its IHDR
    width and height equal its `sizes`. The same holds for `apple-touch-icon.png` (180) and
    `favicon-32.png` (32).
  - `theme_color` and `background_color` equal the resolved light `--background`.
  - `index.html` has the title `kaleem`, never `kaleem-dash-tmp`, and a non-empty
    description.
  - Each `link` href (`icon`, `apple-touch-icon`, `manifest`) names a file that exists in
    `public/`.
  - The two `theme-color` metas equal the resolved light and dark `--background`, matched to
    their `media`.
  - No file under `public/` carries `#863bff`.
- **e2e (`e2e/manifest.spec.ts`, Chromium, no login, budget under 5 s):**
  - `/login` has the title `kaleem`.
  - The manifest `<link>` resolves with a 200, a JSON media type and the expected fields.
  - Every manifest icon, plus the `apple-touch-icon` and `icon` links, returns 200 with
    `image/png`, PNG bytes and the declared dimensions.
  - Chromium's `Page.getInstallabilityErrors` (CDP) reports no manifest or icon error. Any
    error about the service worker or the incognito-like context is listed in the spec,
    not silently filtered.
- **Mutation checks**, each red with the change and green without it:
  - A manifest icon's `sizes` changed (unit).
  - `icon-512.png` deleted from `dist/` before preview, which shows the SPA fallback is
    caught (e2e).
  - A `theme-color` hex changed (unit).
- **Staging (D9 substitute per `dec-d9-substitute`):** agent Playwright or `curl -I` on
  `app-staging` checks:
  - `/site.webmanifest` returns `application/manifest+json` with `nosniff`.
  - Each icon returns `image/png`.
  - A made-up `/icon-999.png` returns `text/html` through the fallback. That is expected,
    and it is why the tests assert bytes.

## Open questions

None blocking. Owner approval covers the new behaviour: the app becomes installable, with
the name, the description sentence and the interim `k` icon described above.
