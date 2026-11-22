---
name: lb-allauth-surface-lockdown
phase: v1 programme (wave 1, security stream)
modules: [identity]
status: draft
created: 2026-10-18
closed: null
---

> **Publication hold (ADR-0045 §4, `rch-d-security-disclosure`).** This spec and its plan
> describe a security control. They stay on `feat/lb-allauth-surface-lockdown` and are not
> pushed or merged to the public meta repo until the backend change has deployed. Specifics
> are in the owner-held private record (base-03c).
>
> **Revised 2026-11-22** against backend `origin/main` e543505 (django-allauth 65.22.1). Since
> the first draft, `lb-access-log-redaction` has landed (links carry their credential in the
> URL fragment, ADR-0053) and the e2e job reads a real inbox (ADR-0052). The `/accounts/`
> exception in ADR-0029 is now **kept** rather than removed (see API delta).

## Goal

The backend serves only the authentication routes the product uses. Every auth flow already
runs through identity's versioned API (`/api/v1/identity/…`) and lands in the dashboard
(ADR-0019, ADR-0029). allauth stays the account library behind `identity/services.py`
(ADR-0004, ADR-0010) but mounts **no HTTP views**: `config/urls.py` stops including
`allauth.urls`, and allauth's native signup is closed in the account adapter. The one product
flow that still sent people to an allauth page, the operator's "Send password-set email" admin
action for teachers, now sends the same dashboard `/reset-password` link the child-activation
flow already uses. Recorded as an ADR-0010 amendment.

## User flow

1. **Teacher onboarding (changed).** An admin selects teacher profiles in the Django admin and
   runs "Send password-set email". Each teacher receives "Set your kaleem password" with a
   dashboard `/reset-password#uid=…&token=…` link (the child-activation email and builder). The
   teacher sets a password there and signs in at `/login`.
   - No "your password was changed" alert for this first set: the account had no usable
     password. An adult resetting an existing password is still alerted (ADR-0023), unchanged.
   - An expired or reused link shows the dashboard's existing "invalid or expired" error; the
     admin re-sends.
2. **Everyone else (unchanged).** Register, verify email, log in, log out, forgot/reset and
   change password, email management, child activation and invites keep going through the API
   and the dashboard. Their links already point at the dashboard
   (`CeleryAccountAdapter.get_email_confirmation_url`, `services.request_password_reset`,
   `services._send_set_password_link`).
3. **`/accounts/…` (removed).** Any request under `/accounts/` returns 404. No client links
   there: dashboard, marketing and infra have no reference to it (checked on each `main`).

## Personal data (ADR-0023)

No new personal data. The teacher's existing primary email receives one link; the token is
Django's `default_token_generator` (lifetime `PASSWORD_RESET_TIMEOUT`, default 3 days, void
once the password is set). Only the teacher and the sending admin see it. Nothing new is
stored. Children's data is untouched: the child-activation builder is generalised, its output
unchanged.

## Data model delta

None. No migration. `allauth.mfa` and `allauth.socialaccount` stay in `INSTALLED_APPS` (their
tables are read by the data export and erasure hooks); removing them is a separate contract
step.

## API delta

- **Removed:** every route under `/accounts/` (allauth's server-rendered views). Not product
  API; no client calls it.
- `/api/v1/` unchanged. No new endpoint, error code or user-facing string.
- **ADR-0029 is not amended.** Per the owner's resolved decision, `/accounts/` remains one of
  the three closed unversioned exceptions. It is reserved for allauth and now mounts nothing;
  the allowlist test and its count stay as they are. A new test fails if any route under
  `accounts/` is served, so re-mounting anything there is a visible, reviewed change.
- Native signup: `CeleryAccountAdapter.is_open_for_signup` returns `False` (allauth 65 does
  not read `ACCOUNT_ALLOW_REGISTRATION`, so that env-driven setting is removed).
- `LOGIN_URL` becomes `f"{FRONTEND_URL}/login"` instead of the allauth route name
  `account_login`, which no longer reverses. Production re-derives it after re-reading
  `FRONTEND_URL`.

**Expand/contract and blue-green.** No schema change. The previous dashboard bundle never
calls `/accounts/`, so both colours are compatible. A teacher set-password email sent by the
old colour carries an allauth link that stops working once the new colour serves; the
operator re-sends.

## Frontend

None. The dashboard's `/reset-password` and `/login` routes already serve the
child-activation set-password flow, which teachers now use. No route, component or copy
change.

## Module boundaries

`identity` only. `admin.py` calls a new public `services.send_password_set_link(user_id)`
instead of allauth's `ResetPasswordForm`, so `admin.py` no longer imports allauth (ADR-0010).
No events, no cross-module calls, no import-linter change.

## Out of scope

- Removing `allauth.mfa` / `allauth.socialaccount` (a table drop).
- Rate limiting of the API's auth endpoints (`rch-ratelimit-drf`).
- The access-log masking of allauth's former credential paths
  (`kaleem/platform/access_log.py`): it stays as defence in depth, owned by
  `lb-access-log-redaction`.
- Moving teacher onboarding into the dashboard (`adm-teacher-onboarding`, ADR-0057, which
  depends on this unit) and email copy/layout (`ntf-identity-emails-relayout`).

## Test plan

Backend (pytest), each written first and mutation-checked:

- **Closed surface.** No resolved route starts with `accounts/` (resolver walk, like the
  ADR-0029 test). GET and POST to representative former paths return 404: `/accounts/`,
  signup, login, password reset, reset-from-key, confirm-email, `email/`, `2fa/`,
  `3rdparty/`. `reverse()` of `account_signup`, `account_login`, `account_reset_password`
  raises `NoReverseMatch`.
- **Signup closed.** `CeleryAccountAdapter().is_open_for_signup(request)` is `False`.
- **Allowlist unchanged.** `tests/test_api_versioning_is_enforced.py` stays as on `main`
  (`accounts/` allowed, count 5) and green.
- **API flows do not depend on allauth routes.** Under mandatory verification: register sends
  a mail whose link is `{FRONTEND_URL}/verify-email#key=…`; `verify-email/` with that key
  returns 200; login then succeeds.
- **Teacher set-password.** The service mails the teacher's primary address one message whose
  dashboard `/reset-password#uid=…&token=…` link passes `confirm_password_reset`; the admin
  action calls it per selected profile and reports the count; no body contains `/accounts/`.
- **Alerts.** A teacher's first password set sends no alert; an adult resetting an existing
  password is still alerted; a child's first set is still not alerted (existing tests).
- `LOGIN_URL` resolves to the dashboard login, in base and in production settings.

**e2e: no new Playwright flow; the existing ones are the proof.** The inbox flows (ADR-0052:
register and verify, password reset, child activation by the set-password mail) and the
identity flows (auth, account/email, family, change-password) must stay green; together they
show no product flow depended on the removed routes. The teacher path has no dashboard UI yet
(only the Django admin, which the harness does not drive); it shares the child-activation
builder and page, which the inbox flow covers, and `adm-teacher-onboarding` adds its own
flow. The closed routes have no UI, and pytest runs the real URLconf. Time budget: 0 s added.

## Open questions

None. Decisions cited: `rch-d-security-disclosure`, `dec-spec-approval`,
`dec-floor-ownership`, and the owner's resolved decision that `/accounts/` stays one of
ADR-0029's three closed exceptions.
