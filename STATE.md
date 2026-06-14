---
current_phase: "A"
active_spec: "2026-06-14-identity-frontend-design"
active_branch: "feat/identity-frontend-spec (meta docs); feat/verify-email-endpoint (backend); feat/identity-auth-core (dashboard)"
last_green_ci: "design-system deploy-staging green 2026-06-13 (run 27461511438; images built + pushed + VPS deploy)"
---

# kaleem Project State

## Current phase: Phase A — Identity

## Active spec

docs/superpowers/specs/2026-06-08-identity-module.md

## Phase A identity — DONE ✅ (DoD fully closed 2026-06-10)

All 8 plan steps implemented with TDD (78 tests; models.py 93% / services.py 96%
coverage; ruff + mypy + import-linter green). Spec + plan shipped/done. Backend is
live on staging and the previously-broken register flow now works.

**Staging is green and functional.** A live smoke test first found
`POST /api/identity/register/` → 500 (production had no email config: SMTP defaulted
to localhost:25). Fixed with env-driven SMTP + AWS SES (ADR-0016); deployed via #39.
Live re-test on `staging.kaleem.academy`: register → **201** (SES sends, out of
sandbox), login-before-verify → **400 not verified**, unauth mutation → **403**. The
full verified flow (verify→login→/me→child→invite→accept) is proven locally on the
identical code; on staging the verification link now lands in a real inbox via SES, so
the final click-through is a human check (register with a real address).

Note: two throwaway test users exist in the staging DB (`stg.smoke@example.com`,
`ses.smoke@example.com`) from smoke testing — clear them via admin or on the next DB
reset.

Definition-of-Done:

- ✅ Golden-path smoke test over real HTTP against the live dev stack (real CSRF,
  sessions, and allauth verification via the console email backend): register parent →
  confirm email → login → GET /me/ → add child → create invite, then register adult
  student → confirm → login → accept invite (`linked: true`).
- ✅ Edge cases: unverified login → 400; invalid invite code → typed 400; authenticated
  mutation without CSRF → 403. (Anonymous register without CSRF returns 201 — confirmed
  standard DRF SessionAuthentication behaviour, not a bug.)
- ✅ Admin teacher flow: superuser logs into Django admin → selects teacher → "Send
  password-set email" action → teacher receives a reset email. (`create_teacher_account`
  service also unit-tested.) Note: the eventual teacher-create UX lives in the React
  dashboard, not Django admin — see docs/adr/0013-custom-admin-dashboard.md.
- ✅ Architecture doc `docs/architecture/identity.md`.
- ✅ Weekly journal entry `docs/superpowers/journal/2026-W24.md`.

- ✅ Staging deploy. `develop → master` (#33) deployed green via the `deploy-staging`
  job: backend image built + pushed to GHCR, SSH to VPS, blue-green via
  `infra/scripts/ship.sh`. First attempt failed at `migrate` on stale staging-DB
  migration history (`account.0001` before `identity.0001`); resolved by recreating the
  staging `kaleem` database (pre-launch, no data) and re-running the deploy on
  2026-06-10. VPS-internal readiness check passed; `Deploy complete: blue → green`.

  Getting here also required pushing previously-local-only backend/infra submodule
  commits to their remotes and fixing a ruff pre-commit/CI version skew — see git
  history (backend #1/#2, infra #1, meta #32–#35).
- ✅ Live staging smoke test (register 201 / login-before-verify 400 / unauth 403) after
  wiring production email (AWS SES SMTP, ADR-0016; backend #3, infra #2, meta #37/#39).

## Frontend delivery pipeline — SHIPPED to staging ✅ (2026-06-13)

The dashboard and marketing site now deploy end-to-end (ADR-0019). Both are nginx
images built + pushed to GHCR by CI and served as Compose singletons behind Traefik:

- Dashboard (the app): `app-staging.kaleem.academy`
- API (Django): `api-staging.kaleem.academy` (moved off `staging.`)
- Marketing: `staging.kaleem.academy`

Same-site session auth across `app-`/`api-` via `Domain=.kaleem.academy; SameSite=Lax`
cookies + CORS allow-list. Deploy verified green: all routes 200 over HTTPS (certs
issued), DB-backed `/health/ready/` ok, immutable asset caching, CORS preflight echoes
the dashboard origin with credentials and rejects others.

Process change: every feature now ships its frontend slice (spec template has a required
`## Frontend` section; D9 DoD includes browser-verified frontend).

**Cross-subdomain cookie gate is BLOCKED on the identity UI not existing yet.** The
dashboard is still the Phase-0 scaffold — only route is `/` (a placeholder); there is no
login/register/`/me` UI (`features/identity/` is an empty stub). So `/me` just hits the
SPA fallback and renders the placeholder. The Phase A identity *backend* shipped without
any frontend (it predates the every-feature-ships-its-frontend rule). The register→login
click-through can't happen until the identity frontend slice is built.

Gotchas hit + fixed: the blue-green readiness probe curls `/health/ready/` on localhost,
so `ALLOWED_HOSTS` must include localhost — now hardcoded in `production.py` so it can't
break on operator env. The VPS `.env.production` needed `APP_DOMAIN` renamed to
`API_DOMAIN` (not synced by CI — managed on the box).

## Design system + visual identity — SHIPPED (code), promotion pending (2026-06-13)

Brainstormed, specced (`docs/superpowers/specs/2026-06-13-design-system-visual-identity-design.md`),
planned, and built via subagent-driven execution. **Serene Scholar** brand (emerald + gold
on cream), Fraunces + Inter + IBM Plex Sans Arabic, light+dark, full RTL. See
`docs/architecture/design-system.md` and ADR-0020 (a11y/i18n/l10n baseline).

- **`@kaleem/tokens`** repo published, tagged **v0.1.1** (added here as the 5th submodule
  `tokens/`). CSS vars on shadcn's contract + Tailwind v4 `@theme` preset.
- **Dashboard** (merged to `main` @ `afce34d`): consumes tokens; `src/ui/` shadcn primitives
  (Button, Input, Label, Field/FormError, Card, Alert, Spinner) + theme/locale toggles +
  auth shell; ThemeProvider (light/dark, no-flash); i18n + DirectionProvider (full RTL);
  lucide icons; `/design-preview` route; a11y + AA-contrast (both themes) + RTL gate;
  **23 tests green**. Browser-verified light/dark/RTL.
- **Marketing** (merged to `main` @ `481fe91`): consumes the same tokens (cross-build-system
  proven). Branded hero only.
- **Fixed a latent bug:** `index.html` pointed at the dead vanilla `main.ts` (the React app
  was never built/deployed — staging was serving the Vite counter demo). Now `main.tsx`.
- **Animations** were considered and **dropped** (user decision) — keeps the calm brand.

**DEPLOYED to staging ✅ (2026-06-13).** Promoted `develop → master` (PR #69); `deploy-staging`
green (run 27461511438) — dashboard + marketing images built (BuildKit token secret + pnpm 10)
+ pushed to GHCR + deployed to the VPS. Verified live: `app-staging.kaleem.academy` now serves
the **real React app** (`<div id="root">` + React bundle, not the old vanilla scaffold);
`/design-preview` renders the Serene Scholar design system (light/dark/RTL); marketing brand
applied; API health 200.

CI plumbing that got us here (all merged): `TOKENS_REPO_TOKEN` (read `kaleem-lms/tokens`) on the
meta repo for runner `git insteadOf` + Docker BuildKit secret; tokens submodule uses an https URL
(SSH broke `actions/checkout`); **pnpm bumped 9 → 10** (pnpm 9 + Vite 8/rolldown choked on the
git-dep node_modules path); `GHCR_PAT` needs `write:packages`.

## Dockerized one-command dev environment — SHIPPED ✅ (2026-06-14)

Spec: `docs/superpowers/specs/2026-06-13-docker-dev-environment-design.md` | Plan: `docs/superpowers/plans/2026-06-13-docker-dev-environment.md`

`just dev` brings the full stack behind Traefik subdomains (`*.kaleem.localhost`) mirroring the ADR-0019 staging topology. Containers run as the host UID/GID — no root-owned files. HMR works through the proxy. 104 backend tests pass in-container. Developer guide: `docs/developer-guide/local-dev.md`.

## Identity frontend slice — spec + plan done; Phase 1 (auth core) BUILT, PRs open (2026-06-14)

Spec `docs/superpowers/specs/2026-06-14-identity-frontend-design.md` (D1) and plan
`docs/superpowers/plans/2026-06-14-identity-frontend-phase1-auth-core.md` (D2) written. Full
identity surface decided, delivered in 3 phases (auth core → parent → student); auth via
TanStack Query `useMe` + `_authed` guard; custom `/verify-email` landing; role-aware home;
weekly availability grid (Phase 3); react-hook-form + module-mocked tests.

**Phase 1 (auth core) is fully implemented (TDD, subagent-driven) and open as PRs — not yet merged/deployed:**

- **backend** `feat/verify-email-endpoint` → [PR #15](https://github.com/kaleem-lms/backend/pull/15):
  `POST /api/v1/identity/verify-email/` (confirm-by-key) + adapter override so verification
  links point at `{FRONTEND_URL}/verify-email?key=…`. New `FRONTEND_URL` setting. 99 tests,
  ruff/mypy/import-linter green.
- **dashboard** `feat/identity-auth-core` → [PR #6](https://github.com/kaleem-lms/dashboard/pull/6):
  register/login/verify-pending/verify-email/role-aware home/profile, `useMe`+guard, full
  i18n+RTL+a11y. 47 tests, tsc/biome green. Removed the Phase-0 placeholder `/` and
  `/design-preview`.
- **meta docs** `feat/identity-frontend-spec` → [PR #75](https://github.com/kaleem-lms/Kaleem/pull/75): spec + plan.

Verified end-to-end against the **local dockerized stack**: register → mailpit link →
verify-email → login → `/me` all succeed (proves B1+B2 live).

## Next (immediate) — M1: merge + close Phase A

1. **Merge the two submodule PRs to `main`** once CI is green (backend #15, dashboard #6).
   CI had not reported when the session handed off — check it first.
2. **Commit the uncommitted meta working-tree fix** (see in-flight note below) and bump the
   `backend`/`dashboard` submodule pointers; update this STATE — all via a meta `feat → develop` PR.
3. **On the VPS:** set `DJANGO_FRONTEND_URL=https://app-staging.kaleem.academy` in
   `.env.production` (not synced by CI — managed on the box, like `API_DOMAIN`).
4. **Promote meta `develop → master`** → triggers `deploy-staging`. Then do the **real
   browser click-through** on `app-staging` (register with a real email → click SES link →
   verify-email → login → `/me`) — this proves the cross-subdomain session cookie and
   **closes Phase A.**
5. Then **Phase 1 wrap** (journal/DoD) and start **Phase 2** (parent flows: children +
   invites) with its own plan, then **Phase 3** (student: invite-accept + availability grid).

### ⚠ In-flight, UNCOMMITTED (meta working tree) — do not lose

- `docker-compose.local.yml` + `.env.example`: `VITE_API_URL` changed to include the
  `/api/v1` prefix (`http://api.kaleem.localhost/api/v1`). **This is a needed fix** — without
  it the browser dashboard calls `api.kaleem.localhost/identity/...` (missing the version
  prefix) and every API call 404s. The local HTTP smoke missed it because curl used the full
  path. Commit these (meta feat→develop). After committing, **recreate the dashboard
  container** so vite picks up the new env: `docker compose -f docker-compose.local.yml up -d
  --force-recreate dashboard` (with `GH_TOKEN`/`HOST_UID`/`HOST_GID`).
- Submodule pointers (`backend`, `dashboard`) show modified — that's the Phase-1 work,
  pending the M1 pointer-bump (step 2 above); only bump after the submodule PRs merge.
