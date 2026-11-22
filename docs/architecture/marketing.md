# Marketing site architecture

The public site (`marketing/`, Astro, static). It makes no API calls and holds no state of its
own. Spec: `docs/superpowers/specs/2026-11-22-rch-mkt-foundation-design.md`.

## Locales

- English at `/`, Arabic at `/ar/` (RTL). One page file per locale per page, each a thin wrapper
  around a shared component that takes a `locale` prop. The page's locale-free `path` goes to
  `Layout`, which builds the language switch from it.
- `Layout.astro` takes a required `locale` and writes `<html lang dir>` from it, plus a header:
  the `kaleem` wordmark, the language switch (it names the other language in itself, and carries
  that language's `lang`/`hreflang`) and a Sign in link to `PUBLIC_APP_URL` + `/login`.
- Strings live in `src/i18n/en.ts` and `ar.ts`; `ar.ts` is typed `satisfies` the English shape, so
  a missing key fails `astro check`. The brand is the Latin wordmark in both locales.
- Arabic text uses IBM Plex Sans Arabic (`@fontsource`, 400 and 600), applied only under
  `[dir="rtl"]`. The faces are unicode-range subset, so the English home downloads none.

## The locale cookie

`kaleem_locale=ar`, the only cookie the site writes. A tap on the language switch writes it
(`Path=/; Max-Age=31536000; SameSite=Lax`, `Secure` on https, no `Domain`, so it is host-only and
never reaches the app or API hosts). Switching back to English deletes it. It is never written on
page load. It holds a two-letter language code: no identifier, no personal data (ADR-0023). It is
a user-interface-customisation cookie, consistent with `dec-cookies` = None. The cookie page
(`rch-mkt-legal-pages`) must list it.

On load, a deferred module script sends a returning Arabic visitor from the bare `/` to `/ar/`,
keeping the query string and hash. No other path is ever redirected. The redirect runs in the
browser, so such a visitor sees the English page briefly first; a server-side redirect is a later
option (`ISSUES.md`). Without JavaScript the switch is a plain link and both locales work.

## Build-time URLs

`PUBLIC_SITE_URL` (Astro `site`) and `PUBLIC_APP_URL` (the Sign in link) are required, absolute
http(s) URLs with **no default**; `astro.config.mjs` throws, naming the variable, when either is
missing. A static site has no runtime, so each image is built for one environment: the Dockerfile
takes both as build `ARG`s, CI passes `.test` values to the `marketing-build` job and the staging
URLs to the image builds, and local compose sets `*.localhost` values.

## Content-Security-Policy readiness

No page may carry an inline script (ADR-0056; `check-security-headers.sh` fails the build on one).
Astro inlines a small processed script by default, so `vite.build.assetsInlineLimit: 0` is set in
`astro.config.mjs` to emit it as an external file. Do not remove it.
