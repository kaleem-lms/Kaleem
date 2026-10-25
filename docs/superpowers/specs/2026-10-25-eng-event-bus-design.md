---
name: eng-event-bus
phase: v1 (wave 3, eng stream)
modules: [platform, scheduling]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Engagement (points, streaks, badges) and later analytics must react to lessons, but their
import-linter contracts forbid importing `kaleem.scheduling`, and that is correct. Backend
`origin/main` has no signals and no bus. This unit adds a small **domain event bus** in
`kaleem.platform`, and scheduling publishes two events from it:

- **Typed events.** A producer declares a frozen dataclass and registers it under a name
  such as `scheduling.session_completed`. The type set is validated in Python, so the type
  column has no `choices` and a new type never needs a platform migration.
- **Outbox, dispatched on commit.** `publish()` writes the event row in the producer's own
  transaction. Only `transaction.on_commit` enqueues delivery. A rolled-back close-out
  therefore leaves no event and enqueues nothing.
- **Idempotent handlers.** A `HandledEvent` row, unique on `(event, handler)`, is written in
  the same transaction as the handler's own effects. A second delivery of a handled pair
  is a no-op, whether it is a retry, a double beat dispatch or two workers racing.
- **Replay.** A sweep re-enqueues unhandled pairs from the last 24 hours. `replay_events`
  delivers older pairs by hand, which is how a handler added later backfills.

Scheduling publishes `SessionCompleted` and `SessionCancelled` at step 8 of `_close_out`
(`booking.py:508`, "RESERVED for `eng-event-bus`") and from `_apply_cancellation`.
`ana-session-outcomes` (backend #74) owns that close-out sequence and its matrix, and this
unit extends both.

This unit adds no subscriber. The first one is `eng-points-levels`.

## User flow

None. There is no endpoint, no UI and no user-visible change. The flow is internal:

1. A teacher closes a lesson out, or someone cancels one. Inside the existing atomic block,
   scheduling calls `events.publish(SessionCompleted(...))`, which writes a `DomainEvent`
   row and registers an `on_commit` callback.
2. The transaction commits. The callback enqueues `kaleem.platform.tasks.deliver_event(id)`
   with `robust=True`, so a broker failure is logged and the close-out still succeeds.
3. A worker runs each handler subscribed to that type. Each one runs in its own
   `atomic()`: it inserts `HandledEvent`, then calls the handler. If the handler raises,
   only that handler's work rolls back. The failure is logged at ERROR with the event id,
   the handler name and the exception class, the other handlers still run, and the task
   retries up to 3 times with backoff.
4. Every 10 minutes, `sweep_pending_events` re-enqueues every (event, subscribed handler)
   pair that is between 5 minutes and 24 hours old and has no `HandledEvent`. This covers
   a lost enqueue, a crashed worker, an old-colour worker that did not yet know a new
   handler (blue-green), and a handler deployed in the last day.
5. For anything older, an operator runs `manage.py replay_events [--handler H] [--type T]
   [--since ISO] [--dry-run]`. It runs the missing pairs in-process, and `--dry-run` only
   lists them.

Error cases are programming errors, raised as `kaleem.platform.events.InvalidEventError`
(a `ValueError`; never an API response, so it has no `error_code` and no gettext string):

- `publish()` outside an atomic block;
- an unregistered type, or an instance of a class other than the registered one;
- a field whose value does not match its annotation (`bool` is not accepted for `int`, and
  a naive datetime is refused);
- a conflicting re-registration of a type or a handler name.

## Data model delta

There are new `platform` app tables, created by migration `platform/0001_initial`, which is
purely additive (expand only).

```
DomainEvent                          HandledEvent
  id          bigint PK               id          bigint PK
  type        varchar(100), no choices event       FK DomainEvent CASCADE
  version     smallint                handler     varchar(100)
  payload     jsonb                   handled_at  timestamptz
  user_ids    bigint[]  (GIN index)   UNIQUE (event, handler)
  occurred_at timestamptz (index)
```

`user_ids` is filled at publish time from the type's declared `user_fields`. Platform holds
no user FK and knows no business module. Export, erase and purge use this column.

**Event types (scheduling, version 1).**

| Type | Payload | `user_fields` |
| --- | --- | --- |
| `scheduling.session_completed` | `session_id`, `student_id`, `teacher_id`, `starts_at`, `outcome` (`held` or `student_absent`) | student_id, teacher_id |
| `scheduling.session_cancelled` | `session_id`, `student_id`, `teacher_id`, `starts_at`, `cancelled_by_teacher`, `in_time` | student_id, teacher_id |

`occurred_at` is the close-out's or cancellation's `now`. The two booleans are what
`dec-eng-streak`'s recommended rule needs ("teacher cancellations and timely cancellations
freeze it"). Who cancelled, beyond teacher or not, is left out on purpose. A payload change
is a new `version`, and a handler must ignore versions it does not know.

**Personal data (ADR-0023).**

- *What:* a student's and a teacher's user ids, linked to a lesson id, its start time and
  its outcome or cancellation facts. A student is often a child.
- *Why:* so that other modules can react to lessons without importing scheduling.
- *How long:* **90 days** from `occurred_at`, then deleted by a daily batched purge
  (`purge_old_events`). This matches the notification log's decided window
  (`dec-retention-new-domains`). The event log is not a domain that decision named, so
  **the owner confirms the 90 days when approving this spec.** Every fact here also exists
  for longer on the scheduling `Session` row, so the log adds no new kind of data.
- *Who sees it:* no API and no admin. Server code reads it, operators with database access
  can read it, and the user sees their own rows through the export. Platform registers the
  `platform.events` export and erase hooks (ADR-0048). Export returns the user's events as
  `{type, version, occurred_at, payload}`, where the counterpart appears only as an id, as
  in `scheduling.lessons`. Erase deletes every event whose `user_ids` contains the user,
  and their `HandledEvent` rows cascade.

## API delta

No HTTP change. This is the Python interface in `kaleem/platform/events.py`:

```python
register_type(name, cls, *, version=1, user_fields=())   # from the producer's ready()
subscribe(type_name, handler_name, fn)                   # from the subscriber's ready()
publish(event, *, occurred_at=None) -> int               # inside the producer's atomic block
deliver(event_id) -> None                                # what the task and replay call
```

Handlers receive `Event(id, type, version, occurred_at, payload: Mapping)`. That is a plain
mapping, so a subscriber never imports the producer's dataclass. Handler names follow
`personal_data`'s `<app_label>.<topic>` rule.

There are new Celery tasks in `kaleem.platform.tasks`: `deliver_event`,
`sweep_pending_events` and `purge_old_events`. There are new commands: `replay_events`, and
`event_bus_probe`, which is the CI check below.

## Frontend

None. The bus has no user-facing surface. `eng-dashboard-ui` and the other consumers carry
their own frontend.

## Module boundaries

- **platform** owns the bus, the two models, the tasks, the commands and the hooks. It still
  imports no business module. Producers and subscribers join it from their own
  `AppConfig.ready()`, which is the existing registry pattern (`teaching`, `personal_data`).
- **scheduling** gets `kaleem/scheduling/events.py` (the two dataclasses plus `register()`)
  and calls `publish`. That is a platform import, which is already allowed.
- **No import-linter contract changes.** Engagement and analytics will subscribe through
  platform without ever importing scheduling.
- The ADR "domain event bus" records the choices: an outbox in Postgres rather than Django
  signals or a broker-only design, at-least-once delivery made exactly-once-in-effect by
  `HandledEvent`, no ordering guarantee between events, and the 24-hour sweep and 90-day
  log. The conductor allocates the ADR number.

**Blue-green (serialization rule: new task names deploy one release before anything
enqueues them).** The unit lands as **two backend PRs in sequence**:

- **Part 1** contains the models, migration, bus, tasks, commands, hooks, ADR and the CI
  probe. Nothing in the product publishes yet.
- **Part 2** contains scheduling's types and publish calls, plus the beat entries
  `platform-sweep-pending-events` (every 10 minutes) and `platform-purge-old-events`
  (daily, off-peak). The conductor allocates the beat slots. Part 2 merges only after
  part 1 has deployed to staging.

Every beat task is idempotent under the double dispatch that both colours' beats cause.
An old-colour worker that receives `deliver_event` runs only the handlers it knows. It
never fails on an unknown type, and the sweep later delivers the pairs it missed.

## Out of scope

- Every subscriber. Points, streaks and analytics belong to their own units.
- Publishing from billing, curriculum or anything other than the two scheduling events, and
  `teacher_absent` adjudication, which `sched-teacher-no-show` will publish.
- Ordering, fan-out to anything outside the process, and event sourcing. The log is a
  delivery buffer, not a source of truth.
- A dead-letter table or admin UI. Failures are ERROR logs, `replay_events --dry-run`
  lists the pending pairs, and `lb-error-tracking` surfaces the logs.

## Test plan

- **Registry:** the type and handler validation rules above, one test each, plus
  `test_every_subscription_names_a_registered_type` over the live registry.
- **Publish:** it writes the exact row (ISO UTC datetimes, `user_ids`). It enqueues nothing
  before commit (`django_capture_on_commit_callbacks`). A rollback leaves no row and no
  callback. An enqueue that raises does not fail the producer.
- **Deliver:** each handler runs once and records its pair. A second deliver is a no-op. A
  raising handler rolls back only its own writes and leaves its pair pending while the
  others record theirs. An unknown type or zero subscribers is a no-op. A
  `transaction=True` test races two deliveries of one event, and the handler runs once.
- **Sweep, purge and replay:** window edges (4m59s, 5m, 24h, 24h+1s), purge at
  90d±1s with the cascade and batching, and replay with `--handler`, `--since` and
  `--dry-run`.
- **Personal data:** `assert_hooks_honour_contract("platform.events", ...)`, and the
  coverage guard passes with both platform models named by the hooks.
- **Scheduling (part 2):** exact payloads for complete, no-show, teacher cancel, timely
  family cancel and late family cancel. `end_slot` publishes one event per future session
  it cancels. `test_close_out_matrix.py` gains an `events` column: one type per success
  and `()` per refusal, across all 216 cells.
- **Worker topology (the unit's "e2e"):** a ci.yml step after "Prove the worker executes a
  task" runs `manage.py event_bus_probe --timeout 60`. It publishes a
  `platform.bus_probe` event and waits until the real worker records the probe handler's
  `HandledEvent`, which proves on_commit, broker, worker, handler and record end to end.
  The time budget is under 5 s typical and 60 s worst. There is no Playwright flow,
  because nothing user-visible changes.

## Open questions

- **Owner:** confirm the 90-day retention for the event log (see Personal data). The unit
  needs no other decision.
