# platform — architecture

The cross-cutting module. Every business module may import `kaleem.platform`; platform
imports none of them (the forbidden contract in `pyproject.toml`, which
`tests/test_import_contracts_cover_every_module.py` keeps in step with the installed
modules). Its only tables are the event bus's (`DomainEvent`, `HandledEvent`, below).

Spec for the personal-data registry: `docs/superpowers/specs/2026-10-18-plat-dsar-registry-design.md`.
Decision: `docs/adr/0048-export-erase-hook-contract.md`.

Spec for the event bus: `docs/superpowers/specs/2026-10-25-eng-event-bus-design.md`.
Decision: `docs/adr/0063-domain-event-bus.md`.

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
| Domain event bus | `events.py`, `models.py`, `tasks.py`, `event_probe.py`, `events_personal_data.py`, `management/commands/replay_events.py`, `event_bus_probe.py` | below |

## The domain event bus

Typed events, written in the producer's transaction and delivered after it commits, so a
module can react to another's facts without importing it (ADR-0063). The engagement and
analytics modules subscribe through platform; scheduling is the first producer.

### Publishing

1. Declare a frozen dataclass of `int`, `str`, `bool` and aware `datetime` fields (nothing
   else is accepted) and register it from your `AppConfig.ready()`:
   `events.register_type("scheduling.session_completed", SessionCompleted, version=1,
   user_fields=("student_id", "teacher_id"))`. `user_fields` names the `int` fields that
   hold user ids; they fill `DomainEvent.user_ids`, which export, erase and purge read.
2. Call `events.publish(SessionCompleted(...), occurred_at=now)` inside your own
   `transaction.atomic()` block, next to the writes it describes. It returns the row id. It
   raises `InvalidEventError` (a `ValueError`: a programming error, never an API response)
   outside an atomic block, for an unregistered class, for a value that does not match its
   annotation (`bool` is not an `int`, a naive datetime is refused) and for a conflicting
   re-registration.
3. Delivery is enqueued with `transaction.on_commit(robust=True)`. A rolled-back
   transaction leaves no row and no task. A broker failure after the commit is logged and
   the producer still succeeds; the sweep re-enqueues the row.

A payload change is a new `version`. Never edit a registered class in place.

### Subscribing

`events.subscribe("scheduling.session_completed", "engagement.points", fn)` from your own
`ready()`. The handler name is `<app_label>.<topic>`, unique per type. `fn(event)` receives
an `Event(id, type, version, occurred_at, payload)` whose `payload` is a read-only mapping
of JSON values (datetimes as ISO UTC strings), so the subscriber never imports the
producer's dataclass. Ignore a `version` you do not know.

- **Idempotency.** For each handler, `deliver()` opens its own `atomic()`, inserts the
  `HandledEvent` pair (unique on `(event, handler)`) and then calls `fn`. The pair and the
  handler's writes commit together, so the handler runs once in effect however many times
  the event is delivered (a retry, a double beat dispatch, two workers racing).
- **A raising handler** rolls back only its own writes and leaves its pair pending. The
  other handlers still run, an ERROR is logged with the event id, the handler name and the
  exception class, and `deliver_event` retries up to three times with backoff.
- **Keep handlers short.** The task has `CELERY_TASK_SOFT_TIME_LIMIT=60`; a heavy handler
  enqueues its own task.
- **No ordering** between events.

### Replay, retention and the two-release rule

| Job | What it does |
| --- | --- |
| `deliver_event(id)` | Runs the unhandled pairs of one event. An unknown type, no subscriber or a purged event is a no-op |
| `sweep_pending_events` | Every 10 minutes: re-enqueues events with an unhandled subscribed pair aged 5 minutes to 24 hours. Covers a lost enqueue, a crashed worker, an old-colour worker that did not know a handler, and a handler deployed in the last day |
| `purge_old_events` | Daily: deletes events older than `events.RETENTION` (90 days) in batches of 1000; `HandledEvent` rows cascade |
| `manage.py replay_events [--handler H] [--type T] [--since ISO] [--dry-run]` | Runs the missing pairs in-process, for anything the sweep's window no longer covers (a handler added later backfills this way). `--dry-run` only lists them |
| `manage.py event_bus_probe [--timeout N]` | Publishes `platform.bus_probe` and waits until a real worker records its handler. Runs in the CI e2e job after "Prove the worker executes a task", and works on any host |

All jobs are idempotent, so both blue-green colours' beats can dispatch them. **New task
names deploy one release before anything enqueues them**: the bus ships first with no
producer and no beat entry, and the first producer and the beat entries ship in the next
release.

### What the log holds

A student's and a teacher's user ids, linked to a lesson id, its start time and its outcome
or cancellation facts, for 90 days (`dec-retention-new-domains`, confirmed by the owner for
the event log on 2026-10-25). It is a delivery buffer, not a source of truth. No API and no
admin: server code reads it, and the user sees their own rows through the export. The
`platform.events` hooks (ADR-0048) export every event whose `user_ids` contains the user
(`{type, version, occurred_at, payload}`, any counterpart as an id only) and erase them,
cascading the `HandledEvent` rows.

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
  (lb-gdpr-erasure): the caller leaves a child's account alone and unlinks it, and no hook
  touches another person's account. A hook may also **refuse** an erasure by raising a
  `KaleemError`: the transaction rolls back and the error reaches the client through the
  usual handler (billing refuses while a subscription is live).
- `name` is `"<app_label>.<topic>"`. `models` lists model labels as strings
  (`"curriculum.TeacherSubject"`), so platform imports no model.
- `export_user(user)` runs the export hooks in name order and returns a dict keyed by hook
  name. `erase_user(user)` runs the erase hooks in ascending `order` (ties by name) inside
  one `transaction.atomic()`: if any hook raises, every database change rolls back. Work
  on outside systems (storage, Stripe) is deferred with `transaction.on_commit`.
- Identity's hooks use `order=900`, so they run last and other modules can still resolve
  relationships through identity's services while they erase. Billing's uses `order=100`,
  so a refusal happens before any other hook has changed anything.
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
are all covered fails until its entry is removed, so the lists only shrink. Today both
`PENDING_EXPORT` and `PENDING_ERASE` are empty: every module that stores personal data has
an export hook and an erase hook (identity, billing, scheduling and curriculum joined the
erase side in lb-gdpr-erasure). A new module's models fail the guard until it joins.
`NOT_PERSONAL` holds the reference models: `billing.SubscriptionPlan`,
`billing.StripeEventLog` and `curriculum.Subject`.

### Allauth

allauth's `EmailAddress` rows hold personal data, but allauth is a third-party app and the
guard only walks `kaleem.*`. **Identity's hooks own them.**

### Not covered

`erase_user`'s one caller is identity's `delete_account` (`POST /api/v1/identity/me/delete/`,
below). Not part of the registry: the endpoints, re-authentication, the dashboard, retention
periods and purge jobs (lb-gdpr-retention-jobs), a parent or staff erasing someone else,
sessions, logs and backups. Admin `LogEntry` rows are scrubbed by identity's erase hook.
The export file's envelope belongs to identity's endpoint, below.

### What the erase hooks do (lb-gdpr-erasure)

Anonymize in place (lb-dec-erasure-semantics): the `User` row and its profiles stay as empty
anchors for records other people keep, and everything that identifies the person goes.

- `billing.subscriptions` (order 100): refuses with `subscription_active` (409) while a
  subscription is `active`, `past_due`, `unpaid` or `incomplete`; otherwise blanks incident
  `detail`. Subscription and customer rows stay for 12 months (lb-dec-retention).
- `curriculum.subjects`: deletes the person's taught subjects and subject interests.
- `scheduling.lessons`: deletes availability, declines and call diagnostics, cancels open
  requests, ends every active assignment the person is in (either side) with its weekly
  times, and cancels their upcoming sessions with the quota unit returned. Past sessions
  stay. Video rooms of cancelled sessions end after commit.
- `identity.account` (order 900): see `identity.md`.

Records the other person also holds are kept: sessions, chats (messaging blanks the
messages) and ended assignments.

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
