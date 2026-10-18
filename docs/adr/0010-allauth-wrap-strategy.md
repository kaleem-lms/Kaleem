---
number: "0010"
title: allauth wrapping strategy in the identity module
status: accepted
date: 2026-04-12
---

## Context
allauth is kept (ADR-0004) but needs to be isolated so the rest of the app doesn't depend on it.

## Decision
The identity module's services.py exposes functions like register_student(), verify_email(), request_password_reset(). These wrap allauth internally. No other module imports from allauth.

## Alternatives considered
- **Direct allauth usage everywhere**: rejected — coupling every module to allauth makes replacement impossible.

## Consequences
- allauth is a detail of the identity module, not a system-wide dependency.
- If allauth is replaced, only identity/services.py changes.
- Each auth flow has a typed, testable service function.

## Amendment 2026-10-18: allauth mounts no HTTP views

**Decision.** allauth remains the account library behind `identity/services.py`, but the
backend serves none of its views. `config/urls.py` does not include `allauth.urls`; every
authentication flow is served by identity's versioned API (`/api/v1/identity/…`, ADR-0017,
ADR-0029) and lands in the dashboard (ADR-0019). Concretely:

- Native sign-up is closed in `CeleryAccountAdapter.is_open_for_signup`, which returns
  `False` whatever the environment says. Account creation is `register/`'s job (account
  type, age rule, profile row). `ACCOUNT_ALLOW_REGISTRATION` is not set: allauth 65 does not
  read it.
- Operator emails go through services, never an allauth form. The Django admin's
  "Send password-set email" action for teachers calls
  `identity.services.send_password_set_link`, which sends the dashboard `/reset-password`
  link the child-activation flow already uses. That first password set sends no
  "password changed" alert, because the account had no usable password; an adult resetting
  an existing password is still alerted (ADR-0023).
- `LOGIN_URL` is the dashboard login (`{FRONTEND_URL}/login`), not an allauth route name.
- **This amends ADR-0029 clause 2:** the unversioned allowlist is two product exceptions
  (health probes, the Django admin), not three. `/accounts/…` is gone. The enforcement test
  no longer allows it, and `tests/test_allauth_surface_closed.py` fails if a route under
  `accounts/` is ever served again.

**Alternatives considered.** Keeping the mount and disabling views one by one: rejected, an
allow-by-default surface drifts with every allauth upgrade, whereas an unmounted one cannot.

**Consequences.** `allauth.mfa` and `allauth.socialaccount` stay in `INSTALLED_APPS`
(removing them drops tables, a separate contract step). Teacher set-password emails sent
before this change carried an allauth link that no longer resolves; the operator re-sends.
