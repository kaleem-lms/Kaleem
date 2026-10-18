---
name: lb-allauth-surface-lockdown
phase: v1 programme (wave 1, security stream)
modules: [identity]
status: done
created: 2026-10-18
closed: null
---

> **Publication hold (ADR-0045 §4, `rch-d-security-disclosure`).** This spec and its plan
> describe a security control. They are committed on `feat/lb-allauth-surface-lockdown` and
> are not pushed or merged to the public meta repo until the backend change has deployed.
> Specifics are in the owner-held private record (base-03c).

## Goal

The backend serves only the authentication routes the product uses. Every auth flow already
runs through identity's versioned API (`/api/v1/identity/…`) and lands in the dashboard
(ADR-0019, ADR-0029). allauth stays the account library behind `identity/services.py`
(ADR-0004, ADR-0010), but it mounts **no HTTP views**: `config/urls.py` stops including
`allauth.urls`, and allauth's native signup is closed by setting. The one product flow that
still used an allauth page, the operator's "Send password-set email" admin action for
teachers, now sends the same dashboard `/reset-password` link the child-activation flow
already uses. Recorded as an ADR-0010 amendment, which also shrinks ADR-0029's unversioned
allowlist from three product exceptions to two.

## User flow

1. **Teacher onboarding (changed).** An admin selects teacher profiles in the Django admin and
   runs "Send password-set email". Each teacher receives "Set your kaleem password" with a link
   to the dashboard's `/reset-password` page (the child-activation email and link, same
   builder). The teacher sets a password there and signs in at `/login`.
   - They receive **no** "your password was changed" alert for this first set: the account had
     no usable password before. Adults resetting an existing password are still alerted
     (ADR-0023), unchanged.
   - An expired or reused link gives the dashboard's existing "invalid or expired" error; the
     admin re-sends.
2. **Everyone else (unchanged).** Register, verify email, log in, log out, forgot/reset
   password, change password, email management, child activation and invites all keep going
   through the API and the dashboard. Their links already point at the dashboard (the
   verification link since `CeleryAccountAdapter.get_email_confirmation_url`, the reset and
   child links since `services.request_password_reset` / `_send_child_set_password_link`).
3. **`/accounts/…` (removed).** Any request under `/accounts/` returns 404. No product client
   links there: dashboard and marketing have no reference to it.

## Personal data (ADR-0023)

No new personal data. The teacher's existing primary email receives one link; the token is
Django's `default_token_generator` (lifetime `PASSWORD_RESET_TIMEOUT`, default 3 days,
invalidated by the password being set). Only the teacher and the sending admin see it. Nothing
new is stored.

## Data model delta

None. No migration. `allauth.mfa` and `allauth.socialaccount` stay in `INSTALLED_APPS` (their
tables stay); removing them would drop tables and is a separate contract step (out of scope).

## API delta

- Removed: every route under `/accounts/` (allauth's server-rendered views). Not part of the
  product API and not called by any client.
- `/api/v1/` unchanged.
- Native signup closed in `CeleryAccountAdapter.is_open_for_signup` (allauth 65 does not read
  `ACCOUNT_ALLOW_REGISTRATION`, so the env-driven setting is dropped); `LOGIN_URL` points at the dashboard login (`f"{FRONTEND_URL}/login"`) instead of an allauth
  route name that no longer resolves.

**Expand/contract and blue-green.** No schema change. The previous dashboard bundle never calls
`/accounts/`, so both colours serve it during the window. Teacher set-password emails sent by
the old colour before the switch carry an allauth link that stops working after it; the
operator re-sends (named in the plan's risks).

## Frontend

None. The dashboard's `/reset-password` and `/login` routes already exist and already serve the
child-activation set-password flow, which is the flow teachers now use. No route, component or
copy change.

## Module boundaries

`identity` only. `admin.py` calls a new public service in `identity/services.py` instead of an
allauth form, so `admin.py` no longer imports allauth (ADR-0010). No new events, no new
cross-module calls, no import-linter contract change.

## Out of scope

- Removing `allauth.mfa` / `allauth.socialaccount` from `INSTALLED_APPS` (a table drop).
- Rate limiting of the API's auth endpoints (`rch-ratelimit-drf`).
- Token transport in links and access-log redaction (`lb-access-log-redaction`, which merges
  first; this unit uses whatever link builder that unit leaves on `main`).
- Dashboard copy for the set-password page.

## Test plan

Backend (pytest), written first:

- **Closed surface.** No resolved route starts with `accounts/` (walks the resolver, like the
  ADR-0029 test). Representative former paths return 404 for GET and POST: signup, login,
  password reset, reset-from-key, confirm-email, `2fa/`, `3rdparty/`, `email/`.
  `reverse("account_signup")` raises `NoReverseMatch`.
- **Signup closed.** `CeleryAccountAdapter().is_open_for_signup(request)` is `False`.
- **Allowlist shrinks.** The ADR-0029 test no longer allows `accounts/`; its count drops 5 → 4.
- **API flows do not depend on allauth routes.** With `ACCOUNT_EMAIL_VERIFICATION="mandatory"`:
  register sends a verification email whose link is the dashboard URL; `verify-email` with that
  key returns 200; login then succeeds.
- **Teacher set-password.** The new service emails the teacher's primary address one message
  with a dashboard `/reset-password` link whose uid/token pass `confirm_password_reset`; the
  admin action calls it per selected profile and reports the count; no sent body contains
  `/accounts/`.
- **Alerts.** A teacher's first password set sends no security alert; an adult with an existing
  password completing a reset is still alerted (existing test); a child's first set is still not
  alerted (existing test).
- `LOGIN_URL` resolves (`resolve_url`) to the dashboard login.

e2e: no new Playwright flow. Teacher onboarding needs an inbox, which CI does not have
(`ISSUES.md`), and the closed routes have no UI. The existing identity flows (auth 6,
account/email 3, family 3) must stay green, which proves the product never depended on the
removed routes. e2e time budget: 0 s added.

## Open questions

None. Decisions cited: `rch-d-security-disclosure` (resolved), `dec-spec-approval`,
`dec-floor-ownership`.
