---
current_phase: "A"
active_spec: "2026-06-08-identity-module"
active_branch: "main"
last_green_ci: null
---

# kaleem Project State

## Current phase: Phase A — Identity

## Active spec

docs/superpowers/specs/2026-06-08-identity-module.md

## Phase A identity — DONE ✅ (DoD fully closed 2026-06-10)

All 8 plan steps implemented with TDD (78 tests; models.py 93% / services.py 96%
coverage; ruff + mypy + import-linter green, re-verified 2026-06-09). Spec + plan
marked shipped/done. Staging deploy is live and green.

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

## Next

Phase B (per roadmap). Re-read the roadmap spec to confirm the next module before
starting; write its spec (D1) before any code.
