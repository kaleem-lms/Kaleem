---
spec: docs/superpowers/specs/2026-11-22-rch-mkt-foundation-design.md
status: approved
---

Worktrees: `marketing-rch-mkt-foundation` (already created at `a10d38c`, deps installed) and
`meta-rch-mkt-foundation`, both on `feat/rch-mkt-foundation`. `WT` below is the marketing one.
Every marketing command runs with
`PUBLIC_SITE_URL=https://kaleem.test PUBLIC_APP_URL=https://app.kaleem.test` once step 1 lands.

## Steps

1. [ ] **URLs as required config.** First, a test in `tests/urls.test.ts` asserts that the
   sign-in href is `https://app.kaleem.test/login`. It fails, because nothing builds it yet.
   Then:
   - `astro.config.mjs` gets a local `requireUrl(name)` that throws, naming the variable, unless
     the value parses as an absolute `http:`/`https:` URL. It sets `site` from
     `PUBLIC_SITE_URL` and validates `PUBLIC_APP_URL`. It also sets
     `vite.build.assetsInlineLimit: 0`.
   - `src/lib/urls.ts` exports `appUrl(path)` from `import.meta.env.PUBLIC_APP_URL`.
   - The top of `vitest.config.ts` sets `process.env.PUBLIC_*` with `??=`, to the `.test`
     values.

   Verify: `pnpm check` with either variable unset exits non-zero and names it.
2. [ ] **Catalog.** Write `tests/i18n.test.ts` first: `LOCALES` is `["en","ar"]`,
   `dirFor("ar") === "rtl"`, `localePath("ar", "/") === "/ar/"`, `localePath("en", "/") === "/"`,
   the en and ar key sets are deeply equal, and no string is blank. Then add
   `src/i18n/{index,en,ar}.ts` with the strings from the spec table. `ar.ts` uses
   `satisfies Messages`, the type derived from `en.ts`.
3. [ ] **Cookie and redirect logic, pure.** Write `tests/locale.test.ts` first:
   - `localeCookie("ar", true)` is `kaleem_locale=ar; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
     and without `Secure` when the second argument is false.
   - `localeCookie("en", …)` is the `Max-Age=0` deletion.
   - `readLocaleCookie` finds `ar` among other cookies, and returns null for `kaleem_locale=xx`,
     for `xkaleem_locale=ar` and for `""`.
   - `redirectTarget({pathname:"/", search:"?u=1", hash:"#h"}, "kaleem_locale=ar")` is
     `/ar/?u=1#h`. It is null for `/ar/`, for `/pricing` and with no cookie.

   Then add `src/lib/locale.ts`.
4. [ ] **Browser wiring.** Write `tests/locale-client.test.ts` first, with fake
   `document`/`location` objects:
   - `initLocale` replaces the location when the redirect target is set, and does not otherwise.
   - A click whose `target.closest("a[data-locale]")` names `ar` writes the cookie, with
     `Secure` only when the protocol is `https:`.
   - A `data-locale` of an unknown value, and a click outside any switch, write nothing.
   - `src/scripts/locale.ts` (one line, `initLocale(document, location)`) is covered by
     `vi.stubGlobal` and a dynamic `import()`.

   Then add `src/lib/locale-client.ts` and `src/scripts/locale.ts`.
5. [ ] **Layout and header.** Extend `tests/layout.test.ts` first:
   - `locale: "ar"` renders `<html lang="ar" dir="rtl">`, and `en` renders `lang="en" dir="ltr"`.
   - The header holds the wordmark link to the locale home and the switch
     (`data-locale="ar" hreflang="ar" lang="ar"` with text `العربية` on en, and `English`
     pointing to `/` on ar).
   - The sign-in link goes to `https://app.kaleem.test/login`, with the catalog text.
   - The script tag is present.
   - The blank-description test stays.

   Then make `locale` a required prop, add the header (logical utilities, `focus-visible`
   ring, padding to at least 24px), and add `<script src="../scripts/locale.ts">`.
6. [ ] **Pages.** Update `tests/home.test.ts` first: `/` renders the English `h1`, tagline and
   description. Add a case for `src/pages/ar/index.astro`, which renders the Arabic tagline,
   title and description. Then move the body into `src/components/HomePage.astro`
   (`locale` prop, catalog strings) and make both page files thin wrappers.
7. [ ] **Arabic face.** Run `npx -y pnpm@10.28.0 add @fontsource/ibm-plex-sans-arabic@5.2.9`.
   `pnpm install --frozen-lockfile` must then pass. `global.css` imports `/400.css` and
   `/600.css` and adds the `:where([dir="rtl"]) body` rule. This is a dependency change,
   so the conductor must hold the marketing dependency slot.
8. [ ] **e2e.** Add `{ path: "/ar/", lang: "ar", dir: "rtl" }` to `e2e/routes.ts`. Write
   `e2e/locale.spec.ts` with flows 1–7 from the spec. The cookie assertions read
   `context.cookies()`: domain `127.0.0.1` with no leading dot, `sameSite: "Lax"`, and
   `expires` about one year ahead. The font flow waits for `document.fonts.ready`. It then
   asserts that a `FontFace` with family `IBM Plex Sans Arabic` has status `loaded`, and that
   the tagline's computed `font-family` starts with it. On `/` it records requests and asserts
   that none matches `ibm-plex-sans-arabic`. The no-JS flow uses
   `browser.newContext({ javaScriptEnabled: false })`. The `playwright.config` `webServer`
   inherits the env, so the `.test` URLs reach `astro preview`.
9. [ ] **Mutation checks.** Each one must go red, and is then restored:
   - Drop the click's cookie write: flow 2.
   - Write the cookie on load: flow 1.
   - Do not delete on English: flow 3.
   - Redirect any path: flow 4.
   - Remove the font import: flow 6.
   - Hardcode `dir="ltr"`: basics for `/ar/`.
   - Remove `assetsInlineLimit`: the security-headers check (inline script).
   - Drop the `ar` key from `ar.ts`: `astro check` and the parity test.

   Record each red in the hand-back.
10. [ ] **Config and docs.**
    - Marketing `Dockerfile`: `ARG PUBLIC_SITE_URL` and `ARG PUBLIC_APP_URL` in the build stage,
      before `RUN pnpm build`.
    - Marketing `CLAUDE.md`: one file per locale per page, strings in `src/i18n`, both locales
      in `e2e/routes.ts`, and the two required variables.
    - Meta `ci.yml`, three places, with no other change:
      - `marketing-build` job-level `env:` gets the two `.test` values.
      - The image-scan "Build marketing image" step gets
        `--build-arg PUBLIC_SITE_URL=https://staging.kaleem.academy` and
        `--build-arg PUBLIC_APP_URL=https://app-staging.kaleem.academy`.
      - The deploy "Build and push marketing image" step gets the same two args.
    - Meta `docker-compose.local.yml` marketing service: `environment:` with
      `http://kaleem.localhost` and `http://app.kaleem.localhost`.
    - New `docs/architecture/marketing.md` (short: locales, cookie, URLs, the inline-script
      rule).
    - A `marketing — locale` row in the CLAUDE.md D3 e2e table.
11. [ ] **Hand-back.** Merge `origin/main` into the branch (never rebase) and re-run the gates.
    Commit with explicit paths, `PIP_CONFIG_FILE=/dev/null`, and Conventional Commits.

## Gates (local; CI is the authority)

- In `WT`: `pnpm install --frozen-lockfile && pnpm check && pnpm test:coverage && pnpm build && pnpm e2e`.
  Coverage must stay at the 100% floor. The floor is not edited (`dec-floor-ownership`).
- From the meta worktree, over the marketing worktree's build:
  `.github/scripts/check-security-headers.sh "${WT}/nginx.conf" "${WT}/dist" "${WT}/security-headers.expected"`
  and `.github/scripts/check-nginx-access-log.sh "${WT}/nginx.conf" "${WT}/dist"`.
- `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/gitleaks-range.sh` over both worktrees.
- `docker build --target production` of the marketing image with and without the two args.
  The build without them must fail.

## e2e required by D3

Yes. The flows are listed in step 8. They add about 20 s to the marketing job. No backend and
no secrets are needed. Dark theme stays unscanned, as `site.spec.ts` already states.

## Migrations

None.

## Risks

- **Inline script slips back.** Astro inlines small scripts by default. The CI security-headers
  step catches it, and step 9 proves that it does.
- **Config throw breaks a path nobody ran.** Every caller of the astro config (dev, check,
  vitest, build, preview, docker) needs the variables. Step 10 covers the four known callers.
  Lighthouse fetches staging and does not build. If another caller turns up red, add the env
  there. Never add a default.
- **Flash on bare `/` for returning Arabic visitors.** Accepted in the spec. The nginx redirect
  is the named later fix.
- **The Lighthouse home score.** One deferred module script of about 0.5 KB plus a header. If
  the nightly run dips, any floor change needs an ADR. Escalate instead.
- **A dependency change on a shared lockfile.** It needs the conductor's marketing dependency
  slot. If `pnpm@10.28.0` cannot fetch the private tokens git dependency, escalate.
- **`ci.yml` is conductor-serialized.** The three edits are additive args and env. Land them
  in the unit's queue slot.

## Verification

- Each step's tests go red before the code and green after.
- Step 9's mutation list is all red.
- The full gate list above is green.
- After deploy, on staging: `/` and `/ar/` in a browser. The switch persists across a reload of
  `/`. DevTools shows the one host-only cookie, created only after the click. "Sign in" opens
  `app-staging…/login`. The Arabic text renders in Plex.
