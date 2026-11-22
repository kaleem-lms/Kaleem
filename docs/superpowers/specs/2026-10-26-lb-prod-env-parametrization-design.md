---
name: lb-prod-env-parametrization
phase: v1 programme (wave 1, ops stream)
modules: [settings (backend `config/settings`), dashboard runtime config, infra (compose, Traefik), meta CI]
status: draft
created: 2026-10-26
closed: null
---

## Goal

Make every value that differs between staging and production come from the environment, so
production can run the same images staging runs. Grounded in the trunks at backend 4fecfaf,
dashboard 80e4290, infra fa2eb53, meta f3b79fe. Four values are staging-only today:

1. **The dashboard's API base is baked into the image.** `ci.yml` builds the dashboard with
   `--build-arg VITE_API_URL=https://api-staging.kaleem.academy/api/v1/` (deploy and scan
   jobs), so the image cannot be promoted to production.
2. **The cookie names are Django's defaults on every environment.** Staging and production both
   scope cookies to `Domain=.kaleem.academy` (ADR-0019), so `sessionid` and `csrftoken` from one
   environment would overwrite the other's. `dashboard/src/lib/api.ts` hardcodes
   `xsrfCookieName: "csrftoken"`.
3. **The ACME contact is hardcoded in `infra/traefik/traefik.yml`.** Compose's `ACME_EMAIL` has
   no effect: Traefik reads exactly one static-configuration source, and a mounted file wins over
   flags and environment variables (verified 2026-10-26 on traefik v3.7.15: with the file
   mounted, both `--certificatesresolvers.letsencrypt.acme.email=…` and
   `TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL` were ignored).
4. **Production settings tolerate missing host values.** `CORS_ALLOWED_ORIGINS`,
   `CSRF_TRUSTED_ORIGINS` and `DJANGO_COOKIE_DOMAIN` default to empty, which starts a production
   API the dashboard cannot use, with nothing reporting why. Nothing runs `check --deploy`.

Decisions used: lb-dec-staging-cookie-isolation (environment-specific cookie names);
owner decision 2026-10-25 (production on the same server as staging, DNS already pointing there);
hg-vps-env; hg-shipsh-review (pre-approved).

## The change

**A. Cookie names per environment (backend).** `base.py` reads `DJANGO_SESSION_COOKIE_NAME` and
`DJANGO_CSRF_COOKIE_NAME`, defaulting to Django's `sessionid` / `csrftoken` (local, test, e2e).
`production.py` re-reads both with no default, so a production-settings process without them
refuses to start. **Staging keeps the names it has** (`sessionid`, `csrftoken`); production uses
`kaleem_sessionid` / `kaleem_csrftoken`. So no environment that has sessions today changes a
cookie name, and an open tab's old bundle (which reads `csrftoken`) keeps working through the
deploy. Renaming staging instead was rejected: it needs a two-name transition for old bundles and
logs every staging user out, for no isolation gain.

**B. Production hosts are required (backend).** `production.py` reads `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS` and `DJANGO_COOKIE_DOMAIN` with no default. Staging already sets all three
(the dashboard could not authenticate otherwise); the conductor confirms by name before merge.

**C. `check --deploy` (backend + infra).**
- A backend test runs `manage.py check --deploy --tag security --fail-level WARNING` under
  `config.settings.production` with a dummy but strong environment, in a subprocess. On trunk
  today it reports exactly one warning, `security.W021` (HSTS preload). `production.py` silences
  W021 with the reason: the preload list is read from the apex domain's header, never from the
  API host, so the API cannot be preloaded. Preload itself is not decided here.
- `ship.sh` gains step 6c: the same command, `docker exec` in the new colour after its health
  check, on the real environment. A failure rolls back exactly like a failed health check
  (step 6). This is the check that sees the real secret key and the real flags.

**D. Dashboard runtime configuration.** The dashboard image becomes environment-neutral.
- `index.html` loads `/env.js` (a classic script) before the bundle. It sets
  `window.__KALEEM_CONFIG__ = {"apiUrl": …, "csrfCookieName": …}`.
- `public/env.js` ships `{}` for dev, preview and tests, where `VITE_API_URL` and the
  `csrftoken` default still apply.
- The production image adds `/docker-entrypoint.d/40-kaleem-runtime-config.sh` (nginx:alpine's
  own entrypoint hook). It writes `env.js` from `KALEEM_API_URL` and `KALEEM_CSRF_COOKIE_NAME`,
  and exits non-zero, so the container does not start, when either is missing or malformed. The
  URL must match `^https?://[A-Za-z0-9.:-]+/api/v1/$` (ADR-0029), and the name
  `^[A-Za-z0-9_-]+$`. Strict patterns mean no value needs escaping.
- `api.ts` resolves the base as runtime `apiUrl`, then `VITE_API_URL`, then the localhost
  default in dev only; a production build with neither throws at load. `xsrfCookieName` is the
  runtime `csrfCookieName`, else `csrftoken`. Lookups go through `globalThis`, so the module stays
  importable under plain Node (the e2e import noted in `api.ts`).
- The Dockerfile drops `ARG`/`ENV VITE_API_URL`. An empty build arg would otherwise bake `""`,
  which `??` does not replace.
- `/env.js` is served by the existing `location /` (`try_files $uri`), with its security headers
  and `Cache-Control: no-cache`. No new nginx location.

**E. Compose and Traefik (infra).**
- `dashboard` gets `environment:` `KALEEM_API_URL=https://${API_DOMAIN:?…}/api/v1/` and
  `KALEEM_CSRF_COOKIE_NAME=${DJANGO_CSRF_COOKIE_NAME:?…}`. They derive from the variables the API
  and Traefik already use, so the dashboard and the API cannot disagree.
- Traefik's static configuration moves from `traefik/traefik.yml` into the service's `command:`
  as flags, with `--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL:?…}`. Every other
  setting is carried over unchanged, including `accesslog.fields.names.RequestPath=drop`
  (ADR-0053); the CLI-only form of that flag was verified to load as `"RequestPath":"drop"`.
  `traefik/traefik.yml` is deleted, and the dead `environment: ACME_EMAIL` line goes with it.
- `.env.production.example` gains the three new variables (`DJANGO_SESSION_COOKIE_NAME`,
  `DJANGO_CSRF_COOKIE_NAME`, `ACME_EMAIL` now required) and `DJANGO_FRONTEND_URL`. Each
  host-bearing variable gets its production value as a comment beside the staging one.

**F. Meta CI.** Both dashboard builds drop `--build-arg VITE_API_URL`. The deploy sync stops
sending `traefik/traefik.yml`. The e2e job runs the production path (below). A new check proves
the Traefik flags from the resolved compose file start a real Traefik with the expected effective
configuration.

## User flow

No user-visible change. The operator flow changes:
- **Before merge (hg-vps-env):** staging's `.env.production` gets
  `DJANGO_SESSION_COOKIE_NAME=sessionid`, `DJANGO_CSRF_COOKIE_NAME=csrftoken` and an
  `ACME_EMAIL` the owner chooses. A missing one stops the deploy at compose resolution (`:?`),
  before any container changes.
- **Deploy:** Traefik is recreated once, because its command changed: a few seconds without
  routing. If the configured ACME address differs from the stored account's, Traefik registers a
  new ACME account. Certificates are kept.
- **Error cases:** a missing or malformed dashboard value stops the deploy at compose (missing),
  or crash-loops the dashboard container (malformed). `ship.sh` does not health-gate static
  frontends, so the post-deploy check below is what catches the second case. A
  `check --deploy` failure rolls the new colour back.

## Data model delta

None. No migration.

## API delta

None. Only cookie names change, and only in production, which has no sessions yet.

## Frontend

No route, component or state changes. The change is how the existing app finds its API base and
CSRF cookie: runtime config through `/env.js` (D above). "Done" is the existing e2e suite passing
against the runtime path with production's cookie names. Then staging serves `/env.js` with
`api-staging` and `csrftoken`, and a click-through (login, one mutation, logout) works on
staging.

## Personal data (ADR-0023)

None new. Cookie names change, not contents, lifetime, or who can read them.

## Expand/contract and the blue-green window

- Both colours read the same `.env.production`, and staging's values equal today's defaults.
  Old and new Django colours issue and accept identical cookies.
- An old dashboard bundle in an open tab has `api-staging` and `csrftoken` baked in, the same
  values staging's `env.js` serves. A lazy chunk missing after the swap is handled by
  `chunk-reload.ts`, as today.
- The variables are added to staging before the merge that reads them (hg-vps-env).

## Module boundaries

Settings, deploy and dashboard bootstrap only. No module's `services.py` or models are touched.
No import-linter contract changes.

## Out of scope

- **Running production on the shared server:** a single gateway for both stacks, Traefik
  router-name namespacing (the docker provider sees every container on the socket), `ship.sh`'s
  `/opt/kaleem` paths and `kaleem-*` container names, coturn ports. Owned by
  lb-prod-host-dns-tls ("isolate prod from staging on one box").
- The production `.env` itself, its secrets, and the production deploy workflow
  (lb-prod-secrets-accounts, lb-prod-deploy-workflow).
- HSTS preload; `__Secure-` cookie prefixes (CI's e2e runs over http, where they cannot be set);
  a CSP; health-gating static frontends in `ship.sh`.
- The marketing site (it carries no environment-specific value).

## Test plan

- **Backend (pytest, in `tests/settings/`):** under production settings, both cookie names come
  from env. Production settings refuse to import without either name, without each of the three
  host variables, and with an empty value. Base settings default to `sessionid` / `csrftoken`.
  `check --deploy --tag security --fail-level WARNING` exits 0 under production settings. A
  negative control with a weak secret key exits non-zero, naming `security.W009`.
- **Dashboard (vitest):** `api.ts` prefers runtime `apiUrl` over `VITE_API_URL`, uses the
  runtime `csrfCookieName`, defaults to `csrftoken`, and throws in a production build with no
  base.
- **Dashboard (shell):** the entrypoint script writes the exact `env.js` for valid values,
  refuses a missing value, a URL without `/api/v1/`, a URL with a quote, and a cookie name with a
  space, and leaves the old file untouched on refusal. A real `nginx` container with the script
  and no variables exits non-zero.
- **Infra:** `deploy-lib` tests cover the step-6c helper. `check-shipsh-services` and
  `check-published-ports` still pass. A new Traefik check (with its own self-test) fails if the
  effective config loses `RequestPath: drop` or the env-derived ACME email, and fails if a flag
  is misspelled.
- **e2e (CI):** the dashboard is built with no `VITE_API_URL` and served by the production nginx
  image running the entrypoint script. The backend uses production's names
  (`kaleem_sessionid` / `kaleem_csrftoken`). Every existing flow that mutates proves the CSRF
  cookie name crosses ADR-0019's subdomain boundary through runtime config. No new flow. Time
  budget: +5 s at most (container start).
- **Staging (after deploy):** `curl -s https://app-staging.kaleem.academy/env.js` shows
  `api-staging` and `csrftoken`; `ship.sh`'s log shows step 6c passing; the click-through
  described under Frontend.

## Open questions

None blocking. The ACME contact address for each environment is the owner's value, set at
hg-vps-env, never committed.
