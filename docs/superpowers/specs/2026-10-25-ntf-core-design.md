---
name: ntf-core
phase: v1 (wave 3, notifications stream)
modules: [notifications]
status: approved
approved: 2026-10-25
created: 2026-10-25
closed: null
---

## Goal

Nine v1 units send notices: bookings, reminders, matching, billing, reports, assignments,
messages, the teacher change and no-shows. Each needs the same things: a stored in-app
item, an email hand-off, the user's switches respected, a retention purge and the export
and erase hooks. This unit builds them once in `kaleem.notifications`, which is a scaffold
on backend `origin/main` today (an empty `services.py`, no models).

It adds:

- a **kind registry** that is validated in Python;
- **`notify()`**, which writes the in-app row in the producer's transaction and hands email
  to **channel interfaces** (email and push) once that transaction commits;
- a **delivery log**;
- a **preference model** with its services;
- the **90-day purge** (`dec-retention-new-domains`);
- the **export and erase hooks** (ADR-0048);
- **every producer edge** into the module, opened in one PR under one ADR.

Kinds are not model choices, so a producer that adds a kind never adds a notifications
migration.

**Decisions it rests on.** `D-ntf-template-ownership` is answered: email copy lives in code
with gettext, and there is no `EmailTemplate` table (ADR-0046 §5). So is
`dec-retention-new-domains` (notification log 90 days). The two before-spec decisions are
**answered** (owner, 2026-10-25), and the owner approved this spec the same day:

- `D-ntf-channels`: **email, in-app and push.** This is not the recommended answer
  (email and in-app); the owner chose push as well. The channel set is therefore
  `CHANNELS = {"in_app", "email", "push"}`. v1 push is web push for the PWA. It needs VAPID
  keys (an owner step on the VPS) and `rch-pwa-service-worker`, so **this unit builds the
  push interface and no sender**. A follow-up unit adds the adapter (`ISSUES.md`). Until it
  exists, a push delivery is recorded as `failed` with `error_code="channel_unconfigured"`
  and an ERROR log, which is the same "no channel configured" path as email. It is never
  silently dropped.
- `D-ntf-mandatory-kinds`: security, payment and cancellation notices are mandatory; the
  rest can be switched off. A mandatory kind is locked on every channel, push included.

Channels are a Python set and `mandatory` is a flag that each producer sets on its own
kind, so the answers change no table and no function here. `Delivery.channel` and
`NotificationPreference.channel` have no `choices`, so adding `push` needs no migration now
or later.

## User flow

None in this unit. No endpoint, no UI and no producer. The first callers are
`ntf-booking-notifications` and the other producer units. The first reader is
`ntf-inapp-feed`, and `ntf-preferences` adds the settings card. Each producer:

1. registers its kinds from its own `AppConfig.ready()`, for example
   `register_kind("scheduling.session_cancelled", title=pgettext_lazy(...), mandatory=True, params={"starts_at": datetime})`;
2. calls `notify("scheduling.session_cancelled", recipient_ids=[...], link="/schedule", dedupe_key=f"session:{id}:cancelled", params={"starts_at": ...})` inside its own transaction.

Error cases. All of these are programming errors, raised to the producer and never sent to
a client:

- an unregistered kind raises `UnknownKindError`;
- a bad link, a blank dedupe key, an undeclared parameter or a parameter of the wrong type
  raises `InvalidNotificationError`;
- a registration that conflicts with an existing one raises `ImproperlyConfigured` at
  startup.

## Data model delta

There is one migration, `notifications/0001_initial`. It only creates tables.

```
User 1──* Notification 1──* Delivery
User 1──* NotificationPreference
```

- **`Notification`**: `recipient` (FK `AUTH_USER_MODEL`, CASCADE), `kind`
  (`CharField(64)`, no choices), `link` (`CharField(200)`), `params` (`JSONField`, default
  `{}`), `dedupe_key` (`CharField(128)`), `in_app` (bool), `created_at` (indexed) and
  `read_at` (nullable, written by `ntf-inapp-feed`).
  - `UniqueConstraint(recipient, kind, dedupe_key)`: this is the idempotency key.
  - Index `(recipient, -created_at)` for the feed.
- **`Delivery`**, the log: `notification` (FK, CASCADE), `channel` (`CharField(16)`, no
  choices), `status` (`pending | sent | failed | suppressed`), `error_code`
  (`CharField(64)`, blank) and `updated_at`.
  - `UniqueConstraint(notification, channel)`.
  - v1 writes `email` and `push` rows. The in-app channel is the `Notification` row itself.
- **`NotificationPreference`**: `user` (FK, CASCADE), `kind`, `channel`, `enabled` and
  `updated_at`.
  - `UniqueConstraint(user, kind, channel)`.
  - No row means the channel is on.

The roadmap names `NotificationLog`. Here it is `Notification` plus `Delivery`.
`ReminderSchedule` stays with `ntf-reminders`.

**`params` is not a free-form blob.** Each kind declares its parameter names and types, and
only `int` and `datetime` are allowed. `notify()` refuses anything else, and datetimes are
stored as ISO-8601 UTC. No `str` type exists, so a name, an email address or any message
text cannot be stored here. Links are checked the same way. A link must be an app-relative
path that matches `^/[A-Za-z0-9/_-]*$`, with no `//`, no scheme and no query string. That
keeps tokens and identifiers other than numeric ids out of links.

**Personal data (ADR-0023):**

- **What:** who received which kind of notice and when, a link holding at most numeric ids,
  numeric or time parameters, whether it was read, and the email delivery outcome. Also the
  user's per-kind switches. No email address is copied: the channel resolves it at send
  time. Some recipients are students, and some students are children.
- **Why:** to show the in-app feed, to deliver and audit email, and to respect the user's
  choices.
- **How long:** `Notification` and `Delivery` rows are deleted 90 days after
  `created_at`, unread or not (`dec-retention-new-domains`). Preferences live as long as
  the account and are removed by the erase hook.
- **Who sees it:** the recipient, through `ntf-inapp-feed` (later). This unit adds no staff
  surface and no admin registration.

**Expand/contract.** The migration only creates three tables, and the previous colour never
reads them. The purge task name ships with **no beat entry**: a task name is deployed one
release before anything enqueues it, as with `purge_expired_ratings`. The first producer
unit to merge adds the `notifications-purge-expired` beat entry in a slot the conductor
assigns. Until then nothing writes a row, so there is nothing to purge.

## API delta

There is no HTTP API. The public Python API is `kaleem/notifications/services.py`. Other
modules import only this file.

- `register_kind(key, *, title, channels=DEFAULT_CHANNELS, mandatory=False, params=None)`.
  - `key` is `"<app_label>.<name>"`, and `app_label` must be an installed `kaleem.*` app.
  - `title` must be a lazy gettext object, so the in-app feed and the email render it in
    the reader's language.
  - `channels` must be a non-empty subset of `CHANNELS = {"in_app", "email", "push"}`.
    `DEFAULT_CHANNELS` is `{"in_app", "email"}`: push is opt-in per kind, so a kind that
    does not ask for it never produces a push delivery (and, before the adapter exists, never
    an unconfigured-channel ERROR).
  - Registering an equal definition again does nothing, because Django may call `ready()`
    twice. A different definition under the same key raises `ImproperlyConfigured`.
- `list_kinds() -> list[Kind]` and `get_kind(key) -> Kind`. `Kind` is a frozen dataclass.
- `notify(kind, *, recipient_ids, link, dedupe_key, params=None) -> int` returns the
  number of new notifications.
  - For each recipient, it works out `in_app`, `email` and `push` from the kind's channels
    and the preferences. A mandatory kind ignores preferences on every channel. Preferences
    come from one query.
  - It creates each notification with `get_or_create` on the idempotency key. A key that
    exists already is skipped: no new row and no second email.
  - A new row gets one `Delivery` for each of `email` and `push` that the kind lists:
    - `pending` when the channel is on;
    - `suppressed` when the recipient switched that channel off;
    - `failed` with `error_code="channel_unconfigured"` when no channel adapter is
      configured. This case also logs at ERROR, so it is never silent.
    - If every channel is off, the row is still written, with `in_app=False`, so the log
      shows why nothing arrived.
  - The pending ids go to each channel through
    `transaction.on_commit(..., robust=True)`. Nothing is sent if the producer rolls
    back. If the dispatch itself raises, the exception is logged, the producer's request is
    not failed after its commit, and the delivery stays `pending`.
- **Email channel interface.** `EmailChannel` is a `Protocol` with
  `dispatch(delivery_ids: Sequence[int]) -> None`. It is loaded with `import_string` from
  `settings.NOTIFICATIONS_EMAIL_CHANNEL`, which defaults to `None`. `ntf-email-foundation`
  implements it inside `kaleem.notifications`, because it needs the two services below. The
  implementation may call platform's renderer.
  - `get_pending_email_delivery(delivery_id) -> EmailDelivery | None` returns the delivery
    id, recipient id, kind, link, decoded params, and the recipient's language and time
    zone from `identity.services.get_recipient_locale`. It reads the language and time zone
    at send time, so a change the user made after `notify()` is honoured. It returns `None`
    once the delivery is no longer pending, or is gone because it was purged or erased.
  - `record_delivery_result(delivery_id, *, sent, error_code="") -> bool` moves an
    **email** delivery from `pending` to `sent` or `failed`. A second call changes nothing
    and returns `False`, and so does a call with a push delivery's id.
- **Push channel interface.** The same shape, fixed now so the adapter unit builds against
  it. `PushChannel` is a `Protocol` with `dispatch(delivery_ids: Sequence[int]) -> None`,
  loaded with `import_string` from `settings.NOTIFICATIONS_PUSH_CHANNEL` (default `None`).
  **No sender ships in this unit.**
  - `get_pending_push_delivery(delivery_id) -> PushDelivery | None` returns the same fields
    as `EmailDelivery` for a `push` delivery, and `None` once it is no longer pending, is
    gone, or is not a push delivery.
  - `record_push_delivery_result(delivery_id, *, sent, error_code="") -> bool` moves a
    **push** delivery from `pending` to `sent` or `failed`, once.
  - A push subscription (a browser endpoint) is not stored here. The adapter unit owns that
    table, its personal-data hooks and its erase.
- **Preferences.**
  - `get_preferences(user_id) -> list[Preference]` returns one entry per registered kind
    and per channel that kind lists: `kind`, `channel`, `enabled` and `mandatory`.
  - `set_preference(user_id, kind, channel, enabled)`. It raises `ValidationError` with
    `field="kind"` for an unknown kind and `field="channel"` for an unknown channel. For a
    mandatory kind it raises `ValidationError(_("This notification cannot be switched off."), field="enabled")`.
- `purge_expired(now=None) -> int`. The task `kaleem.notifications.tasks.purge_expired_notifications`
  is a thin wrapper around it. It deletes in batches and is idempotent.

## Frontend

None. `ntf-inapp-feed` and `ntf-preferences` own the dashboard slices.

## Module boundaries

`notifications` owns this. It calls only `identity.services` (`get_recipient_locale`), an
edge it already has. It never imports a producer. Producers fill the kind registry from
their own `ready()`, just as they fill the personal-data registry.

**Producer edges, opened once (ADR, number from the conductor).** Six modules may call
`kaleem.notifications.services`:

| Producer | Units that will call `notify()` |
| --- | --- |
| scheduling | booking, reminders, matching, no-show, teacher change |
| billing | billing notifications |
| assessment | report notices |
| curriculum | lesson assignment |
| content | resource assignment |
| messaging | message notices |

For each producer, `kaleem.notifications` leaves the forbidden list of its "imports no
business modules" contract. Each producer also gains a mirror contract that forbids
`kaleem.notifications.models` with `allow_indirect_imports = true`, so only `services`
is reachable.

identity, engagement, analytics and platform stay forbidden. Identity emails go through
platform's layout (`ntf-email-foundation`), not this module.

A root test fixes the producer set from `pyproject.toml`, so adding a producer takes an
ADR amendment rather than a one-line edit.

## Out of scope

- The email layout, the rendering, the worker task and the retries for deliveries left
  `pending` (`ntf-email-foundation`).
- The in-app feed API and the bell (`ntf-inapp-feed`), the preferences UI and unsubscribe
  (`ntf-preferences`), and every concrete kind with its producer call (the producer units).
- Reminder scheduling (`ntf-reminders`) and the beat entry for the purge (first producer).
- The push sender: VAPID keys, the subscription store and the service worker. That is a
  follow-up unit (`ISSUES.md`), gated on `rch-pwa-service-worker` and an owner VPS step.
- WhatsApp and SMS (`D-ntf-channels`: not in v1).
- Who receives a child's notices (`D-ntf-parent-recipients`, decided per producer).

## Test plan

- **Registry:** a valid registration is listed; an equal re-registration is a no-op; each
  invalid case raises `ImproperlyConfigured`. The invalid cases are a bad key, an unknown
  app, a non-lazy title, an empty or unknown channel, an unsupported param type, and a
  conflicting redefinition.
- **notify():**
  - The row and its delivery are written. Email is dispatched only after commit
    (`django_capture_on_commit_callbacks`). A rollback writes and dispatches nothing.
  - The same dedupe key twice gives one row and one dispatch.
  - Preferences are honoured per channel, and a mandatory kind ignores them.
  - Every channel off gives `in_app=False` and `suppressed` deliveries.
  - A kind that lists `push` gets a push delivery, dispatched to the push channel on commit;
    one that does not gets none.
  - With no channel configured (email or push), the delivery is
    `failed`/`channel_unconfigured` and an ERROR is logged. A raising channel leaves the delivery `pending`, logs, and does not
    raise into the producer.
  - Bad links, params and dedupe keys are refused. Datetimes round-trip as UTC.
  - The query count is bounded per recipient.
- **Concurrency (the e2e substitute):** `transaction=True` with two threads on a
  `threading.Barrier`, both calling `notify()` with the same key for one recipient, gives
  exactly one `Notification`, one `Delivery` and one dispatch. It must go red with the
  unique constraint removed.
- **Delivery services (email and push):** pending gives the dataclass with the current
  locale; a terminal status gives `None`; a call with the other channel's id is refused;
  a second `record_delivery_result` gives `False` and leaves the row
  unchanged.
- **Preferences:** defaults are on; a switch round-trips; unknown kinds and channels are
  refused and mandatory kinds are refused, each with the correct `field`.
- **Personal data:** `assert_hooks_honour_contract("notifications.records", ...)` passes,
  and the root coverage guard passes with no pending entry for `notifications`.
- **Retention:** rows older than 90 days go, newer rows stay, and the deliveries of a
  purged row go with it. The task calls the service. The task is not in
  `CELERY_BEAT_SCHEDULE`.
- **Boundaries:** the producer-set test passes. `lint-imports` goes red with a direct
  `kaleem.notifications.models` import in a producer, and red with
  `identity → notifications.services`.
- **Catalogs:** `tests/test_translation_catalogs.py` passes with a new
  `notifications/locale/ar` catalog.

e2e: none, because this unit adds no user-facing behaviour. Time budget: 0 s. The
concurrency test above stands in for it, as the programme entry says.

## Open questions

None. `D-ntf-channels` (email, in-app and push) and `D-ntf-mandatory-kinds` were answered
and the spec approved by the owner on 2026-10-25. Still open elsewhere, and not blocking
this unit: who sends push (the follow-up adapter unit), and when the first producer adds
the purge beat entry.
