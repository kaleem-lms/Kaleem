---
spec: docs/superpowers/specs/2026-11-22-lb-allauth-surface-lockdown-design.md
status: draft
---

> **Publication hold (ADR-0045 §4).** Not pushed or merged to the public meta repo until the
> backend change has deployed.

**Starting point.** Backend worktree `kaleem-worktrees/backend-lb-allauth-surface-lockdown`,
branch `feat/lb-allauth-surface-lockdown`, already holds the first build: 07082cc
(`feat(identity): serve no allauth HTTP views`, TDD and mutation checks done on 2026-10-18)
plus a merge of `main` at f2b86d2. `origin/main` is now e543505 (PRs #65 to #100 since, allauth
65.22.1, fragment links from `lb-access-log-redaction`, mypy in CI). This plan brings that
branch up to the revised spec; it does not restart it. The meta branch already merged
`origin/master` (81ec72b) and holds the 2026-10-18 ADR edits, revised in step 6.

Every step: run the named test red, then green, with
`_tools/backend-gate.sh <WT> <test path>`, then mutation-check it (revert the code, see red,
restore). Commit per step with explicit paths, `PIP_CONFIG_FILE=/dev/null`, never
`--no-verify`.

## Steps

1. [x] **Freshness.** `git -C <WT> merge --no-edit origin/main` (a merge, never a rebase).
   Expected conflicts in `kaleem/identity/services.py` and its tests: keep `main`'s fragment
   links (`#uid=…&token=…`, `#key=…`, ADR-0053) and its comments, and keep the unit's
   `_send_set_password_link` rename, `send_password_set_link` and the `had_password` check.
   Then the full gate once, to see which of the unit's tests the new `main` broke.
2. [x] **Closed surface** (`tests/test_allauth_surface_closed.py`, exists). Must hold on the new
   `main`: no resolved route starts with `accounts/`; GET and POST to the nine former paths
   return 404 (`/accounts/` matters: allauth's `AccountMiddleware` turns a 404 there into a
   redirect only while `account_login` reverses); `account_signup`, `account_login`,
   `account_reset_password` raise `NoReverseMatch`; `LOGIN_URL` resolves to
   `{FRONTEND_URL}/login`. Mutation: restore `path("accounts/", include("allauth.urls"))` in
   `config/urls.py`, see red. Also `tests/settings/test_login_url.py` (production re-derives
   `LOGIN_URL`); mutation: drop the `production.py` line.
3. [x] **Allowlist back to `main`** (owner decision: `/accounts/` stays one of ADR-0029's three
   closed exceptions). `git -C <WT> checkout origin/main -- tests/test_api_versioning_is_enforced.py`;
   it must be green with `accounts/` allowed and the count at 5. Edit the docstring of
   `test_allauth_surface_closed.py` so it says the prefix stays reserved and mounts nothing,
   and drop the "2026-10-18" amendment date there.
4. [x] **Signup closed** (`kaleem/identity/tests/test_adapter.py::test_native_signup_is_closed`,
   exists). `is_open_for_signup` returns `False`; the `ACCOUNT_ALLOW_REGISTRATION` read is
   gone from `base.py`. Mutation: return `True`. No type hints were needed: CI's mypy
   passed on the adapter as it is.
5. [x] **Teacher set-password and alerts** (exist in `test_admin.py`,
   `test_password_management.py`, `test_api_auth.py`). Update every link assertion to the
   fragment form and parse uid/token from the fragment: the service mails the teacher's
   primary address one message whose `/reset-password#uid=…&token=…` link passes
   `confirm_password_reset`; the admin action over two profiles calls the service twice and
   reports "Sent 2 password-set email(s)."; no body contains `/accounts/`;
   `test_a_teacher_setting_their_first_password_is_not_alerted` stays next to
   `test_a_child_setting_their_first_password_is_not_alerted`, and
   `test_completing_a_reset_alerts_the_primary_address` stays green. The API-flow test
   (mandatory verification: register, link `{FRONTEND_URL}/verify-email#key=…`, verify 200,
   login 200). Mutations: drop `had_password` from the alert condition (teacher test red);
   restore allauth's default `get_email_confirmation_url` (API-flow test red with
   `NoReverseMatch`); put `ResetPasswordForm` back in the admin action (no-`/accounts/` test red).
6. [x] **Docs (meta worktree, held).** Rewrite the ADR-0010 "Amendment" section: drop the
   "amends ADR-0029 clause 2" bullet and say instead that `/accounts/` stays ADR-0029's
   reserved allauth exception, mounts nothing, and `tests/test_allauth_surface_closed.py`
   fails if anything is served there; date it with the landing day. Restore
   `docs/adr/0029-api-versioning-everywhere.md` to `origin/master` (no amendment note).
   `docs/architecture/identity.md` already says the auth surface is the API only; check it
   names no allowlist change. CLAUDE.md is unchanged.
7. [x] **Full gate and hand-back.** `_tools/backend-gate.sh <WT>` (migrate,
   `makemigrations --check`, pytest with coverage at the existing floor, ruff, ruff format,
   lint-imports, mypy), then runbook §3's five checks, including `gitleaks-range.sh <WT>
   origin/main..HEAD` ending CLEAN and no floor line touched (`dec-floor-ownership`). Merge
   `origin/main` again if it moved, and re-run the gate.

**Files.** Backend: `config/urls.py`, `config/settings/{base,production}.py`,
`kaleem/identity/{adapter,admin,services}.py`, `kaleem/identity/tests/{test_adapter,test_admin,test_api_auth,test_password_management}.py`,
`tests/test_allauth_surface_closed.py` (new), `tests/settings/test_login_url.py` (new),
`tests/test_api_versioning_is_enforced.py` (back to `main`). Meta: ADR-0010, ADR-0029
(restored), `docs/architecture/identity.md`. No migration, dependency, endpoint, route,
env var or user-facing string.

**e2e.** No new flow (the spec says why). CI must keep green the inbox flows (register and
verify, reset, child activation) and the identity flows (auth, account/email, family,
change-password, account deletion). Time budget: 0 s added.

## Risks

- **A hidden reverse of an allauth URL name** in a path our API calls. Checked on 65.22.1:
  `AccountMiddleware` catches `NoReverseMatch`; the URL builders in allauth's
  email-verification and password-reset flows only reverse when the adapter does not supply a
  URL, and ours does (or the flow is not used); `ReauthenticationRequired` and the
  notification mails are raised only by allauth's own views. Steps 2 and 5 run the real flows
  with the routes gone, and the e2e inbox flows run them end to end. Fallback: override the
  adapter method in `adapter.py`, never re-mount.
- **Merge conflicts in `services.py`** (step 1) silently reverting the fragment links. Step 5's
  assertions are on the fragment form, and `lb-access-log-redaction`'s own tests on `main`
  stay in the suite.
- **Teacher links issued by the old colour die at the switch.** Low volume and
  operator-driven; the conductor tells the owner to re-send pending teacher invites after
  deploy.
- **A deploy env still sets `DJANGO_ACCOUNT_ALLOW_REGISTRATION`.** Harmless, nothing reads it;
  dropping it later is optional (`hg-vps-env`).
- **mypy** (new in CI since the first build) on the new and edited functions: step 4 and step 7.

## Verification

- Per step: red, green, mutation-checked as named; the reviewer repeats the step 2 and step 5
  mutations.
- CI on the meta proof PR: backend tests and coverage, import-linter, mypy, gitleaks, and the
  e2e flows above.
- Staging (conductor, step 11): the former `/accounts/` paths return 404 on the API host (the
  exact list is in the private record); the Playwright click-through of login,
  forgot-password and sign-out in both themes, Arabic RTL and 320px stays green; a teacher
  set-password mail from staging admin lands on the dashboard and sets a password (inbox:
  owner session, batched).
