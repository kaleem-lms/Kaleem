---
spec: docs/superpowers/specs/2026-10-18-lb-allauth-surface-lockdown-design.md
status: done
---

> **Publication hold (ADR-0045 §4).** Not pushed or merged to the public meta repo until the
> backend change has deployed.

Base: backend `origin/main` 2401dc7 (django-allauth 65.20.0). Worktree
`kaleem-worktrees/backend-lb-allauth-surface-lockdown`, branch `feat/lb-allauth-surface-lockdown`.
`merge_after: lb-access-log-redaction`: at freshness, merge `main` and keep whatever link
builder that unit left (step 3 reuses it, it does not create a second one).

## Steps

Each step: write the test, run it red with `_tools/backend-gate.sh <WT> <test file>`, write the
code, run it green, then mutation-check (revert the code, see red, restore).

1. [x] **Closed surface, failing first.** New `backend/tests/test_allauth_surface_closed.py`:
   - `test_no_route_is_served_under_accounts`: walk `get_resolver()` (copy the `_routes` walker
     from `tests/test_api_versioning_is_enforced.py`); assert none starts with `accounts/`.
   - `test_former_allauth_paths_404` parametrized over GET and POST to `/accounts/signup/`,
     `/accounts/login/`, `/accounts/password/reset/`,
     `/accounts/password/reset/key/1-set-password/`, `/accounts/confirm-email/abc/`,
     `/accounts/email/`, `/accounts/2fa/`, `/accounts/3rdparty/`, `/accounts/`: status 404.
     (`/accounts/` matters: allauth's `AccountMiddleware` turns a 404 there into a redirect only
     while `account_login` reverses.)
   - `test_allauth_route_names_do_not_reverse`: `account_signup`, `account_login`,
     `account_reset_password` raise `NoReverseMatch`.
   - `test_login_url_is_the_dashboard`: `resolve_url(settings.LOGIN_URL) ==
     f"{settings.FRONTEND_URL}/login"`.
   Code: delete the `accounts/` include and its comment from `config/urls.py`;
   `LOGIN_URL = f"{FRONTEND_URL}/login"` in `config/settings/base.py` below `FRONTEND_URL`,
   **and again in `production.py`**, which re-reads `FRONTEND_URL` from the environment after
   base has derived the line from the dev default (`tests/settings/test_login_url.py`).
2. [x] **Signup closed + allowlist shrinks.**
   - `kaleem/identity/tests/test_adapter.py::test_native_signup_is_closed`:
     `CeleryAccountAdapter().is_open_for_signup(RequestFactory().get("/")) is False`.
   - `tests/test_api_versioning_is_enforced.py`: remove `"accounts/"` from
     `ALLOWED_UNVERSIONED`, count `5 → 4`, docstrings "three" → "two" product exceptions citing
     the ADR-0010 amendment.
   Code: **as built**, `CeleryAccountAdapter.is_open_for_signup` returns `False` and the
   `ACCOUNT_ALLOW_REGISTRATION` env read is dropped. The plan assumed allauth 65.20 read that
   setting; the test went red with it set, and the installed adapter returns `True`
   unconditionally, so the override is the control.
3. [x] **Teacher set-password through the dashboard.**
   Tests in `kaleem/identity/tests/test_admin.py` (new class `TestTeacherPasswordSetLink`):
   - `services.send_password_set_link(user_id)` on a `create_teacher_account` user enqueues one
     `send_email_message` (patch `.delay`, as `test_async_email.py` does) to the teacher's
     primary email (Celery runs eagerly in tests, so `mailoutbox` works too); the body holds a link starting `f"{FRONTEND_URL}/reset-password"`; parse
     uid/token from it and `confirm_password_reset(uid, token, "new-strong-pw-1")` succeeds;
     `has_usable_password()` is then True.
   - no sent body contains `/accounts/`.
   - the admin action `TeacherProfileAdmin.send_password_set_email` over a two-profile queryset
     calls the service twice and messages "Sent 2 password-set email(s)." (RequestFactory +
     `MessageMiddleware`/`SessionMiddleware`, or patch `message_user`).
   Code (`services.py`): rename `_send_child_set_password_link` →
   `_send_set_password_link(user)` (its copy, "An account was created for you on kaleem. Set
   your password", fits both), keep the child caller; add public
   `send_password_set_link(user_id: int) -> None` (gets the user, calls it). `admin.py`: the
   action loops `queryset.values_list("user_id", flat=True)` and calls the service; drop the
   `ResetPasswordForm` import.
4. [x] **No alert on a first password.**
   Test in `test_password_management.py`, next to
   `test_a_child_setting_their_first_password_is_not_alerted`:
   `test_a_teacher_setting_their_first_password_is_not_alerted` (verified email, unusable
   password, complete via the API confirm endpoint, `mailoutbox` has no alert). Existing
   `test_completing_a_reset_alerts_the_primary_address` must stay green.
   Code (`confirm_password_reset`): read `had_password = user.has_usable_password()` before
   `set_password`; alert only when `was_already_verified and had_password`. Update the comment.
5. [x] **API flows do not lean on allauth routes.** `kaleem/identity/tests/test_api_auth.py`,
   new test under `override_settings(ACCOUNT_EMAIL_VERIFICATION="mandatory",
   FRONTEND_URL="https://app.example.com")`: register → the verification mail's link starts
   `https://app.example.com/verify-email?key=`; POST that key to `verify-email/` → 200; login →
   200. (Expected green on arrival; mutation-check it by temporarily restoring the default
   `get_email_confirmation_url` — it must go red with `NoReverseMatch`.)
6. [x] **Full gate + hand-back.** `_tools/backend-gate.sh <WT>` (migrate, `makemigrations
   --check`, pytest with coverage at the existing floor, ruff, ruff format, lint-imports);
   runbook §3's five hand-back checks incl. `gitleaks-range.sh`. Never edit `fail_under`
   (`dec-floor-ownership`).
7. [x] **Docs (meta, same branch, held).** Amend `docs/adr/0010-allauth-wrap-strategy.md` with a
   dated section: allauth mounts no HTTP views; operator emails go through services; this
   amends ADR-0029 clause 2 to two product exceptions. Add a one-line pointer in ADR-0029.
   `docs/architecture/identity.md`: auth surface = API only. Conductor-only at close-out:
   CLAUDE.md's API-versioning bullet ("exactly three" → two), the two ISSUES.md access-log
   entries (the allauth paths no longer exist), `STATE.md`, journal.

Files: `backend/config/urls.py`, `backend/config/settings/base.py`,
`backend/kaleem/identity/{services.py,admin.py}`, tests named above, `backend/tests/` (one new,
one edited). No migration. No new dependency, endpoint, route or env var.

## Risks

- **A hidden reverse of an allauth URL name** (e.g. an allauth helper our API calls). Steps 1
  and 5 run the real flows with the routes gone; the full suite covers the rest. Fallback:
  override the offending adapter method in `adapter.py` (a listed shared file), never re-mount.
- **Teacher links issued by the old colour die at the switch.** Low volume, operator-driven;
  the conductor tells the owner to re-send any pending teacher invites after deploy.
- **`lb-access-log-redaction` changes the link format** (query → fragment). This unit merges
  after it and reuses its builder; the step-3 test parses whatever format `main` has.
- **A deploy env still sets `DJANGO_ACCOUNT_ALLOW_REGISTRATION`.** Harmless: the setting no longer
  reads it. The conductor may drop the variable later (`hg-vps-env`); not required.
- **infra comment drift.** `infra/docker-compose.production.yml` comments name the allauth
  paths; they become stale but stay correct about the past. Owned by `lb-access-log-redaction`;
  not edited here (infra is not in this unit's repos).

## Verification

- Per step: red → green → mutation-checked, as above; the reviewer repeats steps 1, 3 and 4's
  mutation checks.
- CI on the meta proof PR: backend tests and coverage, import-linter, gitleaks, and the e2e
  identity flows (auth 6, account/email 3, family 3) green. No new e2e flow (the spec says why).
- Staging (conductor, step 11): `/accounts/` paths return 404 on the API host (exact list in the
  private record); the existing Playwright click-through of login, forgot-password and sign-out
  in both themes, Arabic RTL and 320px stays green; a teacher set-password email from staging
  admin lands on the dashboard (needs an inbox: owner device session, batched).
