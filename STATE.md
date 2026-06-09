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

## In progress

Phase A identity module — code complete and Definition-of-Done nearly closed. All 8
plan steps implemented with TDD (78 tests; models.py 93% / services.py 96% coverage;
ruff + mypy + import-linter green, re-verified 2026-06-09). Spec + plan marked
shipped/done.

Definition-of-Done — closed 2026-06-09:

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

Remaining — the only open DoD item:

- ⏳ **Staging deploy.** CI auto-deploys on merge to `master` via the `deploy-staging`
  job (SSH using `STAGING_HOST`/`STAGING_USER`/`STAGING_SSH_KEY` secrets). Blocked on
  confirming the staging VPS is provisioned and those secrets are set (see
  docs/runbook/deploy.md "First-time VPS setup").

## Next

Finish the staging deploy, then begin Phase B (per roadmap).
