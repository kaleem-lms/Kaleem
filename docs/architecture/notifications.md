# notifications — architecture

One place that decides who is told what, on which channel, and records that it happened.
Producers call `notify()`; this module stores the in-app item, hands email and push to
channel adapters after the producer's transaction commits, respects the person's switches,
and forgets after 90 days.

**Describes backend `feat/ntf-core`** (unit `ntf-core`, written 2026-10-25). A change to the
module updates the section it touches in the same PR.

Spec: `2026-10-25-ntf-core-design.md` · ADRs: 0023 (personal data), 0046 §5 (email copy lives
in code), 0048 (export and erase hooks), 0059 (who may call this module). Product decisions
applied: `D-ntf-channels` (email, in-app and push), `D-ntf-mandatory-kinds`,
`dec-retention-new-domains`.

## The four fixed fields

### Owns

Three tables in `kaleem/notifications/models.py`, migration `0001_initial`, which only
creates them. No other module reads or writes them. None is registered in the Django admin.

- **Notification**: `recipient`, `kind`, `link`, `params`, `dedupe_key`, `in_app`,
  `created_at`, `read_at`. Unique on `(recipient, kind, dedupe_key)`: that is the idempotency
  key. Index `(recipient, -created_at)` for the feed. `read_at` is written by the in-app feed
  unit, not here.
- **Delivery**: `notification`, `channel`, `status` (`pending`, `sent`, `failed`,
  `suppressed`), `error_code`, `updated_at`. Unique on `(notification, channel)`. The in-app
  channel is the `Notification` row itself and has no delivery row.
- **NotificationPreference**: `user`, `kind`, `channel`, `enabled`. Unique on `(user, kind,
  channel)`. No row means the channel is on.

`kind` and `channel` have **no `choices`**. Kinds live in a Python registry (`kinds.py`) and
the channel set is `CHANNELS = {"in_app", "email", "push"}`, so a producer that adds a kind, or
a unit that adds a channel, adds no migration here.

### Public API

`kaleem.notifications.services`. Frozen dataclasses and ids, never models.

| Function | Does |
| --- | --- |
| `register_kind(key, *, title, channels=DEFAULT_CHANNELS, mandatory=False, params=None)` | adds a kind. Called from the producer's `AppConfig.ready()`. An equal re-registration is a no-op; a conflicting one raises `ImproperlyConfigured` at startup |
| `list_kinds()`, `get_kind(key)` | the registry, as frozen `Kind` values |
| `notify(kind, *, recipient_ids, link, dedupe_key, params=None) -> int` | the one call a producer makes; returns how many new notifications were written |
| `get_preferences(user_id)` | one `Preference` per registered kind and per channel the kind lists |
| `set_preference(user_id, kind, channel, *, enabled)` | `ValidationError` on `kind`, `channel`, or (for a mandatory kind) `enabled` |
| `get_pending_email_delivery(id)`, `record_delivery_result(id, *, sent, error_code="")` | what an email adapter builds on |
| `get_pending_push_delivery(id)`, `record_push_delivery_result(id, *, sent, error_code="")` | the same for push |
| `purge_expired(*, now=None)` | the 90-day retention, in batches |

`UnknownKindError` and `InvalidNotificationError` are programming errors raised to the
producer; no client ever sees them.

### Depends on

- `identity.services.get_recipient_locale`: the recipient's language and time zone, read at
  send time so a change made after `notify()` is honoured.
- `platform`: `exceptions`, `personal_data`.

It imports no producer. Producers fill the registry from their own `ready()`.

### Depended on by

Six producers, by ADR-0059: scheduling, billing, assessment, curriculum, content and
messaging. None calls it yet. identity, platform, engagement and analytics may not. A
mirror contract per producer forbids `kaleem.notifications.models`.

## How `notify()` works

1. The kind is looked up (`UnknownKindError`), the link and dedupe key are checked, and the
   params are encoded against the kind's declared names and types (`InvalidNotificationError`).
2. In one `transaction.atomic()` (the producer's, when it has one), for each distinct
   recipient: switches are read in **one** query, the `Notification` is `get_or_create`d on
   the idempotency key, and a key that exists already is skipped (no new row, no second
   message). A new row gets one `Delivery` for each of `email` and `push` that the kind lists.
3. A delivery is `pending` when its channel is on, `suppressed` when the person switched it
   off, and `failed` with `error_code="channel_unconfigured"` when no adapter is configured.
   If every channel is off the row is still written, with `in_app=False`, so the log shows
   why nothing arrived. A **mandatory** kind ignores switches on every channel.
4. The pending ids go to each channel through `transaction.on_commit(..., robust=True)`:
   nothing is sent if the producer rolls back, and a raising adapter is logged without
   failing the producer's request after its commit; those deliveries stay `pending`.
5. A channel with no adapter logs at ERROR on commit. A configured-nowhere channel is never
   silent.

**`params` is not a free-form blob.** A kind declares each parameter's name and type, and
only `int` and `datetime` exist, so a name, an address or message text cannot be stored.
Datetimes are stored as ISO-8601 UTC and decoded back when an adapter reads them. A link
is an app-relative path matching `^/[A-Za-z0-9/_-]*$`, with no `//`, scheme or query string.

## Channels

| Channel | State in `ntf-core` |
| --- | --- |
| `in_app` | the `Notification` row. The feed API and the bell are `ntf-inapp-feed` |
| `email` | a `Protocol` and two services, implemented by `EmailChannelAdapter` (`ntf-email-foundation`, below). `settings.NOTIFICATIONS_EMAIL_CHANNEL` names it, and is `None` in production until the SMTP variables are set |
| `push` | the same shape, fixed now. `settings.NOTIFICATIONS_PUSH_CHANNEL` is `None` and **no sender ships**. v1 push is web push for the PWA, which needs VAPID keys (an owner step on the VPS) and `rch-pwa-service-worker`; a follow-up unit builds the adapter and owns the subscription table, its personal-data hooks and its erase |

`DEFAULT_CHANNELS` is `{"in_app", "email"}`. Push is opt-in per kind, so a kind that does not
list it produces no push delivery and, before the adapter exists, no unconfigured-channel
ERROR. A channel setting names an object with `dispatch(delivery_ids)`; a class is
instantiated with no arguments for each dispatch.

An adapter reads a delivery with `get_pending_*_delivery`, which returns `None` once the
delivery is no longer pending, is gone (purged or erased), or belongs to the other channel.
It reports with `record_*_delivery_result`, a conditional update: of two racing callers one
gets `True`, and a second call changes nothing.

## The email adapter

Spec: `docs/superpowers/specs/2026-11-22-ntf-email-foundation-design.md`. Platform's layout
and guarded send are in `docs/architecture/platform.md`.

`kaleem.notifications.email.EmailChannelAdapter.dispatch(ids)` enqueues
`send_email_delivery(delivery_id)` once per id; the only argument through the broker is the id.
`send_delivery` runs in the worker:

1. takes a per-delivery cache lock (`cache.add`, 10 minutes, released on every ending), so a
   sweep and a slow worker never send together;
2. reads the pending delivery, which carries the recipient's CURRENT language and zone, and
   the address through `identity.services.get_user`;
3. renders `notifications/email/notice` (subject and heading are the kind's lazy `title`; the
   link is `FRONTEND_URL` plus the stored path). A producer adds
   `notifications/email/kinds/<app>.<name>.{txt,html}` in its own app for the body, and a
   generic line is used when it does not;
4. sends, and records the result.

Every ending is a terminal row with an `error_code`:

| `error_code` | When |
| --- | --- |
| `channel_unconfigured` | no adapter set (`notify()`'s own path) |
| `email_not_configured` | the adapter ran but delivery is not configured |
| `recipient_inactive` | the account is inactive or gone (erased) |
| `recipient_suppressed` | the address's domain is on `EMAIL_SUPPRESSED_DOMAINS` |
| `recipient_refused` | the provider refused the recipient |
| `send_failed` | a transient error survived three retries |
| `delivery_expired` | still pending after 24 hours; a day-old notice is never sent |
| `unknown_kind` | the kind was retired after `notify()` wrote the delivery |

`sweep_pending_email_deliveries()` re-enqueues email deliveries pending for more than 15
minutes (500 per run, oldest first) and expires those older than 24 hours. Idempotent. **It has
no beat entry**, like the purge: the first producer unit adds
`notifications-sweep-pending-email` in a slot the conductor assigns. Delivery is
at-least-once: a worker killed after the provider accepted a message but before the result
was recorded can send one duplicate after the lock expires. No log line, task argument or
error carries an address.

## Personal data (ADR-0023)

- **What:** who received which kind of notice and when, a link holding at most numeric ids,
  numeric or time parameters, whether it was read, the email and push outcome, and the person's
  per-kind switches. No address is copied. Some recipients are students, and some are children.
- **Why:** to show the feed, to deliver and audit messages, and to respect the person's choices.
- **How long:** notifications and their deliveries are deleted 90 days after `created_at`,
  read or not. **An unread item can disappear.** Preferences live as long as the account.
- **Export and erase** (`notifications.records`, `personal_data.py`): export is the person's
  notifications with their deliveries, and their switches. Erase deletes all of it.
- **Who sees it:** the recipient, through the feed (later). No staff surface.

## Retention

`purge_expired(now=None)` deletes notifications older than 90 days in batches of 1,000
(deliveries cascade) and returns how many it deleted. Idempotent. The Celery task
`kaleem.notifications.tasks.purge_expired_notifications` wraps it. **It has no beat entry**:
a task name is deployed one release before anything enqueues it. **The first producer unit to
merge adds `notifications-purge-expired` to `CELERY_BEAT_SCHEDULE`** in a slot the conductor
assigns. Until then nothing writes a row.

## Tests

`kaleem/notifications/tests/`: the registry, models, `notify()`, preferences, the delivery
services, personal data and retention, and `test_email_adapter.py` and `test_email_tasks.py` for the email adapter, its tasks and the sweep, each in both locales where language matters. `test_notify_concurrency.py` runs two real threads on a
barrier through `notify()` with one key and asserts one row, one delivery and one dispatch; it
goes red with the unique constraint removed. The root `tests/test_notifications_producer_edges.py`
pins the producer set. e2e: none, because this unit has no user-facing behaviour.

## Not here

- The push sender (a follow-up unit; `ISSUES.md`). The email adapter is above, and the
  layout it renders through is platform's.
- The feed API and bell (`ntf-inapp-feed`), the preferences UI and unsubscribe
  (`ntf-preferences`), reminder scheduling (`ntf-reminders`).
- Every concrete kind and its `notify()` call: the producer units.
- WhatsApp and SMS (`D-ntf-channels`: not in v1).
