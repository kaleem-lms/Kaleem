# platform — architecture

The cross-cutting module. Every business module may import `kaleem.platform`; platform
imports none of them (the forbidden contract in `pyproject.toml`, which
`tests/test_import_contracts_cover_every_module.py` keeps in step with the installed
modules). It has no models and no migrations.

Spec for the personal-data registry: `docs/superpowers/specs/2026-10-18-plat-dsar-registry-design.md`.
Decision: `docs/adr/NNNN-export-erase-hook-contract.md`.

## What platform owns

| Piece | File | What it is |
| --- | --- | --- |
| Typed exceptions | `exceptions.py` | `KaleemError` and its subtypes (`NotFoundError`, `PermissionDeniedError`, `ConflictError`, `ValidationError`, `ExternalServiceError`) |
| DRF exception handler | `drf.py` | Maps those exceptions to HTTP statuses; an unmapped `KaleemError` falls back to 400 |
| Pagination | `pagination.py` | `StandardPagination` |
| Permissions | `permissions.py` | `DocsPermission` for the API docs |
| Throttling | `throttling.py` | `EmailScopedThrottle` |
| Middleware | `middleware.py` | `RequestIDMiddleware` |
| Logging | `logging.py` | `JSONFormatter` for structured logs |
| Health | `views.py` | `/health/live/` and `/health/ready/` (outside `/api/v1/`, on the closed allowlist) |
| Email task | `tasks.py` | `send_email_message`, the Celery send of one already-rendered email |
| Seed command | `management/commands/seed.py` | `manage.py seed basic|rich` |
| Personal-data registry | `personal_data.py`, `personal_data_contract.py` | below |

## The registry pattern

A module that needs a cross-module extension point without being imported by platform
gets a registry in platform, and **fills it from its own `AppConfig.ready()`**. Platform
holds only the interface and the runner; the modules supply the behaviour. This keeps the
dependency pointing one way. The personal-data registry is the first user.

## The personal-data registry

Every module that stores personal data joins it, in that module's own PR. Contract:

- `register_export(name, fn, *, models)`: `fn(user) -> JSON value`. Read-only,
  deterministic, serializable by `json.dumps` with no `default=` (dates go out as ISO
  strings). A user with no data in the module yields an empty value, never an error.
- `register_erase(name, fn, *, models, order=500)`: `fn(user) -> None`. Removes or
  anonymizes this one user's data, following lb-dec-erasure-semantics ("anonymize in
  place"). Idempotent. Whether erasing a parent touches a child account is caller policy
  (lb-gdpr-erasure), not hook policy.
- `name` is `"<app_label>.<topic>"`. `models` lists model labels as strings
  (`"curriculum.TeacherSubject"`), so platform imports no model.
- `export_user(user)` runs the export hooks in name order and returns a dict keyed by hook
  name. `erase_user(user)` runs the erase hooks in ascending `order` (ties by name) inside
  one `transaction.atomic()`: if any hook raises, every database change rolls back. Work
  on outside systems (storage, Stripe) is deferred with `transaction.on_commit`.
- Identity's hooks use `order=900`, so they run last and other modules can still resolve
  relationships through identity's services while they erase.
- Retention periods are not part of the interface.

### Joining a module: four steps

1. Write `kaleem/<m>/personal_data.py` with the module's export and erase functions. It
   reads the module's own models only.
2. Add `ready()` to `kaleem/<m>/apps.py`. It imports that file and calls
   `register_export` / `register_erase`.
3. In the module's tests, call `assert_hooks_honour_contract(name, seed=..., make_user=...,
   assert_erased=...)` from `kaleem.platform.personal_data_contract`. `seed(user)` creates
   the module's data for one user with no links to anyone else (a row that always involves
   two people seeds its own counterpart inside `seed`). `assert_erased(user)` is where the
   module checks its own anonymization. A failure names the broken rule.
4. In `tests/test_personal_data_hooks_cover_every_model.py`, delete the module's entry from
   `PENDING_EXPORT` / `PENDING_ERASE`, or add a model that holds no personal data to
   `NOT_PERSONAL` with a one-line reason. A new model in a module that has not joined fails
   this guard.

### The coverage guard

`tests/test_personal_data_hooks_cover_every_model.py` walks every concrete model in every
installed `kaleem.*` app. Each must be named by at least one export hook and one erase
hook, be listed in `NOT_PERSONAL`, or sit in an app on a pending list. It also checks that
a hook declares only models of the app its name starts with, that every `NOT_PERSONAL`
label names a real model, and that no pending entry is stale: a pending app whose models
are all covered fails until its entry is removed, so the lists only shrink. Today the
pending lists hold identity, billing, scheduling and curriculum, which join in
lb-gdpr-data-export and lb-gdpr-erasure.

### Allauth

allauth's `EmailAddress` rows hold personal data, but allauth is a third-party app and the
guard only walks `kaleem.*`. **Identity's hooks own them.**

### Not covered

Nothing calls the runners yet, and no module has joined. Not part of the registry:
endpoints, the export file format, re-authentication, the dashboard, retention periods and
purge jobs, erasure of linked accounts, admin `LogEntry` rows, sessions, logs and backups.
