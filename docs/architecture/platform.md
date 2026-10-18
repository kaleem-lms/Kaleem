# platform — architecture

The cross-cutting module. Every business module may import `kaleem.platform`; platform
imports none of them (the forbidden contract in `pyproject.toml`, which
`tests/test_import_contracts_cover_every_module.py` keeps in step with the installed
modules). It has no models and no migrations.

Spec for the personal-data registry: `docs/superpowers/specs/2026-10-18-plat-dsar-registry-design.md`.
Decision: `docs/adr/0048-export-erase-hook-contract.md`.

## What platform owns

| Piece | File | What it is |
| --- | --- | --- |
| Typed exceptions | `exceptions.py` | `KaleemError` and its subtypes (`NotFoundError`, `PermissionDeniedError`, `ConflictError`, `ValidationError`, `ExternalServiceError`) |
| DRF exception handler | `drf.py` | Maps those exceptions to HTTP statuses; an unmapped `KaleemError` falls back to 400. Adds a stable `error_code` to every dict body (below) |
| Pagination | `pagination.py` | `StandardPagination` |
| Permissions | `permissions.py` | `DocsPermission` for the API docs; `IsStaff`, the server control behind every staff endpoint (authenticated and `is_staff`; imports only DRF; ADR-0057) |
| Throttling | `throttling.py` | `EmailScopedThrottle` |
| Middleware | `middleware.py` | `RequestIDMiddleware` |
| Logging | `logging.py` | `JSONFormatter` for structured logs |
| Access-log policy | `access_log.py`, `gunicorn_logging.py` | paths only, credential paths masked; below |
| Health | `views.py` | `/health/live/` and `/health/ready/` (outside `/api/v1/`, on the closed allowlist) |
| Email task | `tasks.py` | `send_email_message`, the Celery send of one already-rendered email |
| Seed command | `management/commands/seed.py` | `manage.py seed basic|rich` |
| Personal-data registry | `personal_data.py`, `personal_data_contract.py` | below |
| Teaching-link port | `teaching.py` | below |

## Access-log policy

Decision: `docs/adr/0053-access-log-policy.md`.

No log records a credential. `access_log.py` holds the pure helpers (`redact_path`,
`redact_uri`) and `RedactCredentialPaths`, a `logging.Filter` attached to `django.request`
in `LOGGING`. `gunicorn_logging.py` holds `RedactingLogger`, which `backend/gunicorn.conf.py`
names as the `logger_class`: it builds the access-log atoms from an allowlist (time, method,
path, status, size, duration), so no format string can bring back a query string, `Referer`,
header or client address, and it redacts the error log's request URI. The production image
and both compose colours start gunicorn with `-c gunicorn.conf.py`. The nginx images log the
path only through their own `log_format`.

## The API text contract

Spec: `docs/superpowers/specs/2026-10-18-rch-i18n-server-strings-design.md`.
Decision: `docs/adr/0058-api-text-contract.md`.

| Piece | What it is |
| --- | --- |
| `error_code` | Stable, untranslated name of the failure, in every dict error body. `KaleemError.code` for our exceptions (`not_found`, `permission_denied`, `conflict`, `validation_error`, `external_service_error`), `default_code` for DRF's, with `invalid` renamed `validation_error`. A list body is left as it is. Reserved key: no serializer field may use the name |
| Message templates | `exceptions.py` builds each message from a gettext template with named placeholders. The noun, action or service fragment is passed in by the caller, translated with `pgettext_lazy` under the context `error resource`, `error action` or `error service`. `KaleemError.message` is resolved to a plain `str` when the error is built, in the language of that request |
| Language | `Accept-Language` through Django's `LocaleMiddleware` (`en`, `ar`; anything else is `en`). The dashboard sends its own locale |
| Catalogs | One per app, `kaleem/<app>/locale/ar/LC_MESSAGES/django.po`, compiled at image build. `platform`'s holds only the four templates |

Two identity bodies are written by hand and set their own code (`email_not_verified`,
`invalid_verification_key`); the handler never overwrites a code already present.

## The registry pattern

A module that needs a cross-module extension point without being imported by platform
gets a registry in platform, and **fills it from its own `AppConfig.ready()`**. Platform
holds only the interface and the runner; the modules supply the behaviour. This keeps the
dependency pointing one way. The personal-data registry is the first user; the teaching-link
port is the second.

## The teaching-link port

Decision: `docs/adr/0049-teaching-link-port-and-content-curriculum-edges.md`.

`content` and `curriculum` need "does this teacher teach this student?" but may not import
`scheduling`, which owns `TeacherAssignment`. `scheduling` registers a provider from
`SchedulingConfig.ready()` and the two callers use `kaleem.platform.teaching`:

- `teaches(teacher_id, student_id) -> bool`: an ACTIVE assignment in any subject. The caller
  authorizes.
- `student_ids_taught_by(teacher_id) -> frozenset[int]`: one read for pickers and bulk checks.
- No provider registered: both raise `ImproperlyConfigured`, never False.
- The same provider pair registered twice is a no-op; a different pair raises.

Parents are not part of it (`identity.services.is_parent_of`). import-linter cannot see this
runtime dependency, so `scheduling/tests/test_read_api.py` proves the real registration
against the database. No caller exists yet.

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
   module checks its own anonymization. A failure names the broken rule. A module that
   joins with an export hook only (its erase hook is a later unit's) calls
   `assert_export_honours_contract(name, seed=..., make_user=...)` instead: the export-side
   rules (`registered`, `export-json`, `export-deterministic`, `export-read-only`,
   `unseeded-user`) and nothing loosened. The pair helper runs it first.
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
are all covered fails until its entry is removed, so the lists only shrink. Today
`PENDING_EXPORT` is empty (every module has an export hook) and `PENDING_ERASE` holds
identity, billing, scheduling and curriculum, which join in lb-gdpr-erasure.
`NOT_PERSONAL` holds the reference models: `billing.SubscriptionPlan`,
`billing.StripeEventLog` and `curriculum.Subject`.

### Allauth

allauth's `EmailAddress` rows hold personal data, but allauth is a third-party app and the
guard only walks `kaleem.*`. **Identity's hooks own them.**

### Not covered

`erase_user` has no caller yet (lb-gdpr-erasure). Not part of the registry: the endpoints,
re-authentication, the dashboard, retention periods and purge jobs, erasure of linked
accounts, admin `LogEntry` rows, sessions, logs and backups. The export file's envelope
belongs to identity's endpoint, below.

### What the export hooks hold, and the file built from them

`identity.account`, `billing.subscriptions`, `scheduling.lessons` and `curriculum.subjects`
join assessment's `assessment.records` (lb-gdpr-data-export). Three rules every export hook
follows:

- **Other people appear by role and user id only**, never name, email or their own fields.
  Students are often children, and a teacher's file must not carry their identities out.
- **No secrets or provider handles**: no password hash, invite code, Stripe id or video-room
  id.
- **Staff-only fields are withheld** (`StudentProfile.notes`, `TeacherProfile.internal_notes`,
  a billing incident's detail, severity, occurrences and resolver, a call diagnostic's
  free-form `stats`). A person asks staff for these in writing.

`POST /api/v1/identity/me/export/` (identity owns it) returns
`{format: "kaleem.data-export", version: 1, generated_at, user_id, sections}` where
`sections` is `export_user(user)` verbatim. A module that joins later appears with no change
there; `version` changes only if the envelope does. Nothing is stored: the file is built per
request and returned `Cache-Control: no-store`.
