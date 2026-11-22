---
number: 0019
title: Frontend delivery and same-site auth
status: accepted
date: 2026-06-13
---

## Context

The backend deployed as a GHCR image behind Traefik with blue-green via `ship.sh`. The
frontend had no equivalent: the React dashboard was only build-checked in CI; the Astro
marketing site had no CI at all. Neither was deployable.

We also chose separate subdomains — `app-` for the dashboard, `api-` for the API — which
makes the two cross-origin. The prior roadmap and `CLAUDE.md` stated "same-origin
frontend/backend", which is no longer accurate.

## Decision

1. **Hosts per environment.** Three one-label hosts (Cloudflare cert covers one wildcard
   level): `app[-staging].kaleem.academy` (dashboard), `api[-staging].kaleem.academy`
   (API), `kaleem.academy` + `www` / `staging.kaleem.academy` (marketing). The backend
   moves off `staging.kaleem.academy` to `api-staging.kaleem.academy`.

2. **Same-site session auth (not same-origin).** `app-` and `api-` share the registrable
   domain, so cookies scoped `Domain=.kaleem.academy; SameSite=Lax` flow on
   cross-subdomain XHR without requiring `SameSite=None`. Django is configured with a
   CORS allow-list (`CORS_ALLOWED_ORIGINS`) with credentials, and
   `CSRF_TRUSTED_ORIGINS` covers the dashboard origin. This supersedes the
   "same-origin frontend/backend" wording in `CLAUDE.md` and the roadmap.

3. **Serving — option A (chosen).** Each frontend (`dashboard`, `marketing`) is a
   multi-stage image: `pnpm build` → copy output into `nginx:alpine` → push to GHCR.
   Deployed as a Compose singleton behind Traefik (no blue-green: static, no
   migrations). Cloudflare edge-caches the immutable `/assets/*` hashed bundle.
   Option B (Cloudflare Pages / CDN-first) is reserved as escape hatch **E2** if
   measured app-shell latency demands it.

4. **Process.** Every feature now ships its frontend slice end-to-end. A feature is not
   "done" until the slice is deployed to staging and verified in the browser. The spec
   template gains a mandatory `## Frontend` section.

## Consequences

**Positive:**
- One deploy mental model for all three services (backend, dashboard, marketing).
- Frontend delivery is first-class: dashboard and marketing are deployable on every CI
  green.
- Near-CDN asset latency via Cloudflare for the immutable hashed bundles.

**Costs / risks:**
- Cross-subdomain cookie configuration is subtle; misconfiguring `Domain=` or `SameSite=`
  will silently break auth. Covered by the end-to-end staging gate.
- Static `docker compose up -d` recreates the container — a brief service blip (typically
  a few seconds), not zero-downtime. Acceptable for static assets already cached at the edge.
- Production `www` handling and a production environment are deferred; this ADR covers
  staging first.
- `CLAUDE.md`'s auth bullet is updated to reflect this decision.

## Amendment 2026-10-26: per-environment cookie names, runtime dashboard config

Part of the production-parametrization unit (`lb-prod-env-parametrization`). Nothing above
is reversed; three things it left implicit are now decided.

1. **Cookie names are per environment.** Staging and production both scope cookies to
   `Domain=.kaleem.academy`, so a `sessionid` or `csrftoken` set by one environment would
   overwrite the other's in a browser that visited both. `DJANGO_SESSION_COOKIE_NAME` and
   `DJANGO_CSRF_COOKIE_NAME` set the names. Base settings default to Django's own
   (`sessionid` / `csrftoken`: local, test and e2e). **Production settings require both and
   refuse to start without them.** Staging keeps `sessionid` / `csrftoken` and production
   uses `kaleem_sessionid` / `kaleem_csrftoken`, so no environment that has sessions today
   renames a cookie, nobody is logged out, and an open tab's older bundle (which reads
   `csrftoken`) keeps working through the deploy. Renaming staging instead was rejected: it
   needs a two-name transition for old bundles and logs every staging user out, for no
   isolation gain. This also supersedes the hardcoded `xsrfCookieName="csrftoken"` in ADR-0009.
2. **Production host values are required.** `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
   and `DJANGO_COOKIE_DOMAIN` have no default in production settings: an empty value
   started an API the dashboard could not use and reported nothing. `ship.sh` step 6c runs
   `manage.py check --deploy` in the new colour against the real environment and rolls it
   back on a finding; the only silenced check is `security.W021` (HSTS preload), which
   cannot apply to an API host.
3. **One dashboard image for every environment.** The image no longer takes a `VITE_API_URL`
   build argument. `index.html` loads `/env.js` before the bundle; the container's start-up
   hook (`dashboard/docker/40-kaleem-runtime-config.sh`) writes it from `KALEEM_API_URL` and
   `KALEEM_CSRF_COOKIE_NAME`, and refuses to start when either is missing or malformed.
   Compose derives both from the variables the API and the gateway already use, so the
   dashboard and the API cannot disagree. `api.ts` resolves the base as the runtime value,
   then `VITE_API_URL` (dev, preview, tests), and a production build with neither refuses to
   load. The same image can now be promoted from staging to production unchanged.

Traefik's static configuration also moved from a mounted `traefik.yml` into the `traefik`
service's `command:` flags: Traefik reads exactly one static source and a file wins over
flags and environment variables, so the ACME contact (`ACME_EMAIL`, an operator value) could
not come from the environment while a file was mounted. CI starts a real Traefik on the
resolved flags and checks the configuration it ends up with.

**Costs.** One extra same-origin, no-cache request before the bundle on the first page load
(`/env.js`). Recreating Traefik for this change is a few seconds without routing, and a
changed ACME address registers a new ACME account (certificates are kept).
