---
number: 0063
title: A domain event bus in platform, as an outbox with idempotent handlers
status: proposed
date: 2026-10-25
---

## Context

Engagement (points, streaks, badges) and later analytics must react to lessons, but their
import-linter contracts forbid importing `kaleem.scheduling`, and that is correct. Backend
`origin/main` had no signals and no bus. ADR-0059 considered "a signal or event bus" for
notifications and rejected it for that case, because a notice must be written in the
producer's own transaction; it left the idea open for the case this ADR covers, where the
subscriber has no business importing the producer at all.

What a subscriber needs is narrow: to learn that a lesson was completed or cancelled, once,
reliably, without the producer knowing who listens.

## Decision

1. **A typed bus in `kaleem.platform.events`.** A producer declares a frozen dataclass whose
   fields are `int`, `str`, `bool` or an aware `datetime`, and registers it under
   `<app_label>.<name>` from its own `AppConfig.ready()`. A subscriber joins with
   `subscribe(type, handler_name, fn)` from its own `ready()`. Platform imports no business
   module (the existing registry pattern). Handlers receive a plain mapping, never the
   producer's dataclass.
2. **The type set is validated in Python.** `DomainEvent.type` has no `choices`, so a new
   type never needs a platform migration. A payload change is a new `version`, and a handler
   ignores versions it does not know.
3. **Outbox, dispatched on commit.** `publish()` must run inside the producer's `atomic()`
   block and writes the `DomainEvent` row there. Only `transaction.on_commit(robust=True)`
   enqueues delivery, so a rollback leaves no event and sends nothing, and a broker outage
   after the commit is logged without failing the producer.
4. **At-least-once delivery, exactly-once in effect.** A `HandledEvent` row, unique on
   `(event, handler)`, is inserted in the same transaction as the handler's own writes. A
   retry, a double beat dispatch or two racing workers find the pair and do nothing. A
   handler that raises rolls back only its own work; the others still run, the failure is
   logged at ERROR with the event id, the handler name and the exception class, and the task
   retries three times with backoff.
5. **Replay.** A sweep runs every 10 minutes and re-enqueues events that have an unhandled
   subscribed pair and are between 5 minutes and 24 hours old. That covers a lost enqueue, a
   crashed worker, an old-colour worker that did not yet know a handler (blue-green), and a
   handler deployed in the last day. For anything older, `manage.py replay_events` runs the
   missing pairs in-process (`--handler`, `--type`, `--since`, `--dry-run`).
6. **Retention is 90 days** from `occurred_at`, deleted by a daily batched purge. This matches
   the notification log (`dec-retention-new-domains`) and was confirmed by the owner when the
   spec was approved. The log is a delivery buffer, not a source of truth: every fact in it
   also lives, for longer, in its owning module.
7. **No ordering guarantee** between events, and no fan-out outside the process.
8. **Personal data.** `user_ids` is filled at publish time from the type's declared
   `user_fields`, so platform holds no user foreign key and learns no business model. The
   `platform.events` export and erase hooks (ADR-0048) read it.
9. **No import-linter contract changes.** Scheduling already may import platform;
   engagement and analytics will subscribe through platform and never import scheduling.
10. **Two releases.** New task names deploy one release before anything enqueues them. Part 1
    ships the bus, tasks, commands, hooks and a CI probe, with nothing publishing and no beat
    entry. Part 2 ships scheduling's two event types, its publish calls and the two beat
    entries, and merges only after part 1 has deployed.
11. **A CI probe** (`manage.py event_bus_probe`) publishes a `platform.bus_probe` event and
    waits until the real worker records its handler, in the e2e job's worker topology. It is
    the unit's end-to-end proof, since no user-visible flow changes.

## Alternatives considered

- **Django signals.** In-process and synchronous: a slow or failing receiver slows or fails
  the producer's request, nothing survives a crash between the commit and the receiver, and
  there is no replay. Signals also tempt the producer to import the receiver's package.
- **A broker-only design** (publish to Redis or Celery directly). The message is lost if the
  process dies between the commit and the publish, or if the transaction rolls back after it,
  and there is nothing to replay from. The outbox row makes both cases impossible.
- **Subscribers calling scheduling's services on a schedule** (polling). Needs an import
  arrow from engagement and analytics to scheduling, which the contracts forbid, and every
  subscriber would reinvent its own cursor.
- **Exactly-once delivery from the broker.** Not available. Idempotent handlers make
  at-least-once safe, and the unique pair is cheaper to reason about than a broker feature.
- **A dead-letter table and admin UI.** Deferred: failures are ERROR logs, and
  `replay_events --dry-run` lists what is pending.

## Consequences

Good:

- A subscriber unit adds a `subscribe()` call and a handler, and touches no contract and no
  platform migration.
- A close-out that rolls back publishes nothing, and one that commits cannot lose its event
  to a broker outage.
- A handler added later can backfill by `replay_events`.

Bad:

- Handlers must be short and idempotent in their own effects; a heavy handler enqueues its
  own task. A handler that always fails is retried by the sweep every 10 minutes for 24
  hours, logging at ERROR each time: bounded noise, never a lost event.
- Ordering is not guaranteed, so a subscriber that needs order must carry the time in the
  payload and decide for itself.
- `ArrayField` and its GIN index tie platform to Postgres, which every environment already
  runs. `django.contrib.postgres` joins `INSTALLED_APPS`.
- One more table pair to retain, export and erase. The retention is one constant,
  `events.RETENTION`.
