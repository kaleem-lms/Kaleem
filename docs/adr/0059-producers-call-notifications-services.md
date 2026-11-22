---
number: 0059
title: Six modules may call notifications.services
status: proposed
date: 2026-10-25
---

## Context

`notifications` was scaffolded with the narrowest boundary: it may import `kaleem.platform`
and call `kaleem.identity.services`, and every business module's "imports no business
modules" contract forbids `kaleem.notifications`. Its contract comment says an edge beyond
that opens in the unit that needs it, under that unit's ADR.

Nine v1 units send notices (bookings, reminders, matching, billing, reports, assignments,
messages, the teacher change, no-shows). Each one needs the same four things: a stored in-app
item, an email and push hand-off, the user's switches respected, and a retention purge with
the export and erase hooks. `ntf-core` builds them once in `kaleem.notifications`. What is
left to decide is who may call it. One ADR per producer would repeat this reasoning nine
times, and nine contract edits would land in `backend/pyproject.toml` (a file every stream
touches) in nine different PRs.

State of `backend` `origin/main` when this was decided: no module imports `notifications`.
The probes below were one-line imports added to a module and run through `lint-imports`
(import-linter 2.15) on the unit branch, each reverted afterwards.

| Probe | Result |
| --- | --- |
| `scheduling.services` imports `notifications.services` (after the change below) | all 32 contracts kept |
| `scheduling.services` imports `notifications.models` | **1 broken**: the new scheduling mirror, and no other |
| `identity.services` imports `notifications.services` | **1 broken**: identity's own contract, and no other |
| `notifications.dispatch` imports `scheduling.services` | **1 broken**: notifications' own contract, and no other |

## Decision

1. **Six modules are producers and may call `kaleem.notifications.services`:** scheduling,
   billing, assessment, curriculum, content and messaging. For each, `kaleem.notifications`
   leaves the forbidden list of its "imports no business modules" contract.
2. **Each producer gains a mirror contract** forbidding `kaleem.notifications.models` with
   `allow_indirect_imports = true`, the shape of ADR-0033's and ADR-0055's mirrors. "Except
   notifications" permits any notifications import, so without the mirror a direct model
   import would pass. The mirrors carry no `ignore_imports`: nothing imports notifications'
   models, and import-linter fails on an ignore that matches nothing. A producer whose tests
   need the models adds exactly `<producer>.tests.* -> kaleem.notifications.models`, and
   only that.
3. **Everything else stays forbidden:** identity, platform, engagement and analytics. Identity
   emails go through platform's layout (`ntf-email-foundation`), not this module.
   `notifications` keeps its own contract: it never imports a producer. Producers fill the
   kind registry from their own `AppConfig.ready()`, as they join the personal-data registry,
   so no arrow runs from notifications to them.
4. **A non-producer that gains an edge to a producer ignores exactly one edge.** A forbidden
   contract is transitive, so once `scheduling.services` calls `notifications.services`, a
   module that is allowed to import scheduling (analytics, through `ana-scheduling-read-api`)
   reaches notifications through it. The unit that adds such an edge adds
   `<producer>.** -> kaleem.notifications.services` to that module's `ignore_imports`, with
   `unmatched_ignore_imports_alerting = "warn"` until the first producer call exists. A
   direct import of notifications from that module still breaks its contract.
5. **The producer set is pinned by a test.** `tests/test_notifications_producer_edges.py`
   fails if the set read from `pyproject.toml` differs from this ADR's, so adding a
   producer is an amendment to this ADR and to that test, never a one-line contract edit.
6. **The channel set is email, in-app and push** (`D-ntf-channels`, owner, 2026-10-25), and
   security, payment and cancellation notices are mandatory (`D-ntf-mandatory-kinds`). A
   mandatory kind is locked on every channel it lists. Both are Python data, not schema: the
   kind registry is validated in Python, `Delivery.channel` and `NotificationPreference.channel`
   have no `choices`, and a producer sets `mandatory` on its own kind. Push is opt-in per
   kind. v1 push is web push for the PWA, which needs VAPID keys and a service worker, so
   `ntf-core` ships the push interface (a `Protocol` and two delivery services beside the
   email ones) and **no sender**. Until the adapter exists a push delivery is recorded
   `failed` with `channel_unconfigured` and an ERROR log: never silently dropped.

The contract change is in `backend/pyproject.toml`. The tables, services and the channel
interfaces are in `docs/architecture/notifications.md`.

## Alternatives considered

- **A signal or event bus** that producers emit to and notifications subscribes to. It
  removes the import arrow, but every notice becomes an untyped payload, delivery
  guarantees need a second mechanism, and the in-app row could no longer be written in the
  producer's own transaction, which is what makes "no row, no email on rollback" true.
- **A platform port** (ADR-0049's shape). The right tool when the caller must not import the
  provider at all. Here the roadmap arrow already runs producer to notifications, and the
  port would have to carry the same typed `notify()` signature for no boundary gain. It
  stays available if a seventh caller should not import the module.
- **One ADR per producer.** Nine near-identical records and nine edits to the contract
  list, each rediscovering the transitive-contract trap in item 4.
- **Allow all business modules.** It would remove the pinned set, but analytics and
  engagement have no reason to send a notice, and a wide list is a list nobody re-reads.
- **Add push later, behind a migration.** Rejected: with no `choices` on the channel
  columns, adding it now costs one set member, and a kind that lists it just works once an
  adapter exists.

## Consequences

Good:

- A producer unit adds a kind and a `notify()` call, and touches no contract and no
  notifications migration.
- A direct `notifications.models` import from a producer fails `lint-imports`, and so does
  any import from identity, platform, engagement or analytics.

Owed:

- import-linter cannot see attribute access, so "a producer never walks into a notification
  row" is a review rule; the services return ids and counts, never models.
- The push adapter (web push, VAPID keys, the subscription store and its erase hook) is a
  separate unit gated on `rch-pwa-service-worker` and an owner step on the VPS (`ISSUES.md`).
- The purge task name ships with no beat entry (expand/contract). The first producer unit
  that merges adds `notifications-purge-expired` to `CELERY_BEAT_SCHEDULE`.
- Notifications older than 90 days are deleted, read or not (`dec-retention-new-domains`),
  so an unread item can disappear. Accepted, and stated in the architecture doc.

Each contract was proved by breaking it on the unit branch: the four probes above, the
positive control first. The pinned-set test goes red when a non-producer is allowed in, when
a producer is forbidden again, and when a mirror contract loses `allow_indirect_imports` or
points at the wrong module.
