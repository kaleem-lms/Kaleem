---
name: rch-mkt-foundation
phase: v1
modules: [marketing]
status: approved
created: 2026-11-22
closed: null
---

## Goal

Give the marketing site its shell and two locales: English at `/` and Arabic at `/ar/`, each
page declaring its own `lang` and `dir`. Add a header with a language switch and a sign-in link,
a string catalog so no page hardcodes UI text (ADR-0020), the Arabic UI font, a locale cookie
that remembers an explicit choice and nothing else, and the site and app URLs supplied at build
time rather than written into source. Every later `rch-mkt-*` page unit builds on this.

Decisions cited: `dec-marketing-site-start` (start now), `dec-cookies` (no non-essential
cookies). Human gate: `hg-arabic-review`. It holds spec closure, not the merge.

## State at marketing `origin/main` `a10d38c` (read, then measured in a throwaway spike)

- `src/layouts/Layout.astro` hardcodes `<html lang="en" dir="ltr">`. It takes `title` and
  `description` and throws at render time when `description` is blank. It has no header.
- `src/pages/index.astro` is the only page. Its title, description, `h1` and tagline are
  English literals.
- `global.css` imports tokens, Fraunces and Inter 400/600. It has no Arabic face. Tokens v0.2.4
  define `--font-arabic: "IBM Plex Sans Arabic", "Inter", sans-serif`. The dashboard loads the
  face from `@fontsource/ibm-plex-sans-arabic` 5.2.9 and switches `body` to it under
  `:where([dir="rtl"])`.
- `e2e/routes.ts` lists `/` only. `site.spec.ts` runs lang/dir, axe, reflow (320/360/430) and
  the same-origin link crawl on every listed route. The crawl lists external links and does not
  fetch them.
- The site has no URL of its own and no link to the app. `astro.config.mjs` sets no `site`.
- **Measured:** Astro inlines a small processed `<script>` into the page as
  `<script type="module">…</script>`. CI's `check-security-headers.sh` fails the build on any
  inline script, because ADR-0056 keeps the pages CSP-ready. Setting
  `vite.build.assetsInlineLimit: 0` makes Astro emit it as `<script type="module" src=…>`.
- **Measured:** `import.meta.env.PUBLIC_APP_URL` set in the environment reaches a page rendered
  through the Astro container under vitest, and it reaches `astro build` output.

## User flow

1. A visitor opens `/`. The page is English and LTR. The header shows the `kaleem` wordmark
   (a link to `/`), a link labelled `العربية`, and "Sign in". No cookie is set.
2. They follow `العربية`. The click stores `kaleem_locale=ar`, and the link goes to `/ar/`: the
   same page in Arabic, with `lang="ar" dir="rtl"`, the header mirrored, and body text in IBM
   Plex Sans Arabic. The switch now reads `English`.
3. Later they open `/` again. The page sends them to `/ar/`, keeping any query string and hash
   (campaign parameters survive).
4. On `/ar/` they follow `English`. The click deletes the cookie and goes to `/`, where they stay.
5. "Sign in" goes to the dashboard's `/login` on the configured app URL in both locales. The
   dashboard keeps its own language choice (`kaleem-locale` in its own storage). It does not
   receive this one.
6. Without JavaScript the switch is still a plain link and both locales work. Nothing is
   remembered.
7. A direct link to `/ar/` is never redirected, whatever the cookie says. Only the bare `/` is.

## The locale cookie

| | |
|---|---|
| Name and value | `kaleem_locale=ar`. It is written only while Arabic is the choice. Choosing English deletes it. |
| When it is written | Only by a click on the language switch. It is never written on page load, and no other cookie is written at all. |
| Attributes | `Path=/; Max-Age=31536000; SameSite=Lax`, plus `Secure` on https. No `Domain`, so it is host-only: it never reaches `app-`/`api-` or the other environment's host. |
| Personal data (ADR-0023) | None. A two-letter language code, with no identifier and no link to an account. |
| Why | To remember a language the visitor chose. This is the user-interface-customisation class that needs no consent, and so it is consistent with `dec-cookies` = None. |
| How long | One year, or until the visitor switches back to English or clears their cookies. |
| Who sees it | The visitor's browser, and the marketing host in the request's `Cookie` header. The nginx access log records paths only (ADR-0053). |

The cookie page that `rch-mkt-legal-pages` publishes must list it. This unit does not depend on
legal pages.

The redirect runs in the browser (a deferred module script), because the site is static and the
e2e suite runs on `astro preview`, not nginx. The cost: a returning Arabic visitor who opens the
bare `/` sees the English page briefly before `/ar/` loads. Crawlers and Lighthouse carry no
cookie, so neither is redirected.

## Data model delta

None.

## API delta

None. The site stays static and makes no API calls.

## Frontend (marketing, not the dashboard)

- **Routes:** `/` (en) and `/ar/` (ar). Both are public. Each page is a thin file under
  `src/pages/` that renders a shared component with a `locale` prop. Later units add pages
  the same way, one file per locale.
- **`src/i18n/`:** `en.ts`, `ar.ts` (typed `satisfies` the English shape, so a missing Arabic
  key fails `astro check`), and `index.ts` with `LOCALES`, `dirFor`, `localePath`, the endonyms
  (`English`, `العربية`, never translated) and `t`. The later pricing and about units extend
  these files.
- **`Layout.astro`:** a required `locale` prop drives `lang`/`dir`. It renders the header from
  catalog strings and loads the locale script. The blank-description throw stays.
- **Header:** logical properties only. The switch carries `lang`/`hreflang` of its target
  language (SC 3.1.2). Every link has a visible `:focus-visible` ring (`ring` token) and a
  target of at least 24×24 px (SC 2.5.8). Colours come from tokens only.
- **Arabic face:** `@fontsource/ibm-plex-sans-arabic` 5.2.9, weights 400 and 600, matching
  Inter's. `:where([dir="rtl"]) body { font-family: var(--font-arabic); }` as in the dashboard.
  The face is unicode-range subset and is used only under RTL, so the English home downloads
  no Arabic font file.
- **URLs:** `PUBLIC_SITE_URL` (Astro `site`, for `rch-mkt-seo-infra`) and `PUBLIC_APP_URL`
  (the sign-in link). `astro.config.mjs` refuses to load unless both are absolute http(s)
  URLs, so `dev`, `check`, `build` and the tests fail loudly when either is missing. There is
  no default anywhere. Tests set `.test` values in `vitest.config.ts`. CI and the local
  compose pass real values. The Dockerfile takes them as build `ARG`s. Unlike the dashboard,
  the image cannot be environment-neutral: a static site has no runtime. Production builds its
  own image with its own args (`rch-mkt-apex-hosting`).
- **Strings, drafted here for `hg-arabic-review`:**

  | Key | en | ar (draft) |
  |---|---|---|
  | `home.title` | kaleem — Learn Islamic Sciences | kaleem — تعلّم العلوم الإسلامية |
  | `home.description` | (unchanged) Live one-to-one and group classes in Quran, Tafsir and Arabic for non-Arabic speakers. Study the Islamic sciences with a real teacher, wherever you are. | دروس مباشرة فردية وجماعية في القرآن والتفسير واللغة العربية لغير الناطقين بالعربية. ادرس العلوم الإسلامية مع معلّم حقيقي أينما كنت. |
  | `home.tagline` | Learn the Islamic sciences, wherever you are. | تعلّم العلوم الإسلامية أينما كنت. |
  | `shell.signIn` | Sign in | تسجيل الدخول |

  The brand stays the Latin wordmark `kaleem` in both locales. That is why this unit does not
  need the open Arabic-name reading (كليم or كَلِيم).

"Done" means built, deployed to staging, and checked in a browser in both locales.

## Module boundaries

Marketing only. Meta gets config and docs: `ci.yml`, which passes the URLs to the
`marketing-build` job, the image-scan build and the deploy build; `docker-compose.local.yml`,
which gives the dev server its two variables; and the docs. No backend or dashboard change. No
events.

## Out of scope

- Canonical, hreflang alternates, sitemap and OG (`rch-mkt-seo-infra`). Home content and CTA
  (`rch-mkt-home`). Footer and legal links (`rch-mkt-legal-pages`). The brand mark
  (`inf-brand-marketing`).
- Accept-Language detection. The site never guesses a language.
- A server-side (nginx) redirect, which would remove the brief English view. It is a later
  option, because this cookie is readable by nginx.
- Passing the language choice to the dashboard.
- Dark theme on marketing. The Arabic `font-display` fallback (`ISSUES.md`). It does not bite
  here, because the only heading is the Latin wordmark.

## Test plan

**Unit (vitest, Astro container, 100% floor unchanged):** catalog key parity and no empty
strings; `dirFor`, `localePath`; cookie string building (ar with and without `Secure`, en as a
deletion); cookie parsing (ignores other cookies and other values); the redirect target (only
`/` with `ar`, keeps search and hash); the click wiring and the load redirect, with stubbed
`document`/`location`; Layout `lang`/`dir` for both locales, the header strings and the sign-in
href built from the app URL; both pages render their locale.

**e2e (Playwright on `astro preview`, budget +20 s):** `/ar/` joins `e2e/routes.ts`, so basics,
axe (WCAG 2.2 A/AA, contrast must run), reflow and the link crawl cover both locales. A new
`locale.spec.ts`:
1. No cookie exists after loading `/` and `/ar/` without a click.
2. The switch to Arabic lands on `/ar/` and writes a host-only, Lax, one-year cookie. A later
   `/?utm=x#h` then ends on `/ar/?utm=x#h`.
3. The switch back to English deletes the cookie, and `/` stays `/`.
4. A direct `/ar/` with no cookie is not redirected.
5. With JavaScript disabled, the switch still navigates.
6. On `/ar/` the body uses a loaded `IBM Plex Sans Arabic` FontFace. `/` requests no Arabic
   font file.
7. In both locales the header links are at least 24×24, and the header mirrors: the wordmark
   sits at the inline start.

Every regression test is mutation-checked: revert its fix and see it fail.

## Open questions

None for the conductor. Owner approval is needed (new public pages, a cookie, new copy), and
the Arabic strings above go to `hg-arabic-review`.

## Approval

The owner approved this spec as written on 2026-11-22 (dec-spec-approval: new public pages, a
cookie, new copy). The answers recorded with the approval:

- English at `/`, Arabic at `/ar/` (RTL), IBM Plex Sans Arabic 400/600 from `@fontsource`
  5.2.9, never downloaded by the English home.
- The language switch and "Sign in" (app URL plus `/login`) live in the header.
- The `kaleem_locale=ar` cookie is as tabled above: host-only, `SameSite=Lax`, `Secure` on
  https, one year, written only on a tap and deleted on switching back. It is a
  user-interface-customisation cookie, an exemption consistent with `dec-cookies` = None.
- The brief English view for a returning Arabic visitor is accepted. A server-side (nginx)
  redirect is the named later fix, recorded in `ISSUES.md`.
- The Arabic strings are drafts that wait on `hg-arabic-review`.
- The Latin wordmark stays. The Arabic name reading is not decided here.
- `vite.build.assetsInlineLimit: 0`, so no inline script reaches CI's no-inline-script check.
- The conductor grants the marketing dependency slot. The `ci.yml` edits (the `marketing-build`
  env, the image-scan build, the deploy build) are allowed. `PUBLIC_SITE_URL` and
  `PUBLIC_APP_URL` have no default anywhere. The Lighthouse ratchet floors on the marketing
  home must not drop.
