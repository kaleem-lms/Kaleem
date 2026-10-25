---
spec: docs/superpowers/specs/2026-10-25-eng-event-bus-design.md
status: in-progress
---

Worktrees (runbook section 1):

- `kaleem-worktrees/backend-eng-event-bus` on `feat/eng-event-bus` for part 1;
- `kaleem-worktrees/backend-eng-event-bus-publish` on `feat/eng-event-bus-publish` for
  part 2, created from backend `origin/main` **after** part 1 has merged and deployed;
- `kaleem-worktrees/meta-eng-event-bus` for this plan, the ADR text, the architecture
  docs and the ci.yml step.

Gates run only through `_tools/backend-gate.sh`. Use the file argument in the TDD loop and
the full gate (migrate, makemigrations --check, pytest with coverage, ruff, format,
lint-imports, mypy) before each hand-back. Every step starts with a failing test (D3), and
every regression test is mutation-checked. Floors are not touched (dec-floor-ownership).
Commits use explicit paths with `PIP_CONFIG_FILE=/dev/null`. Merge `origin/main` (never
rebase) right before each hand-back.

Paths are under `backend/kaleem/platform/` unless they say otherwise, and tests go in
`tests/`. A `fresh_bus` fixture in `tests/conftest.py` monkeypatches an empty registry, so
no test pollutes the global one. It mirrors notifications' `fresh_kinds`.

## Part 1: the bus (backend PR 1, release N)

1. [x] **Type and handler registry.** Write `tests/test_events_registry.py` first:
   - `test_register_type_and_lookup`
   - `test_equal_reregistration_is_a_noop`
   - `test_conflicting_type_raises`
   - `test_rejects_non_frozen_or_non_dataclass`
   - `test_rejects_unsupported_field_type`, parametrised over `float`, `list` and `dict`
     (allowed: `int`, `str`, `bool`, aware `datetime`)
   - `test_user_fields_must_be_int_fields`
   - `test_rejects_bad_name`, over `"nodot"` and `".x"`
   - `test_subscribe_conflicting_handler_raises`

   Then write `events.py`: the `EventType` and `Event` frozen dataclasses, `Registry`,
   `InvalidEventError(ValueError)` and the module-level aliases. The shape follows
   `personal_data.py`.

2. [x] **Models and migration.** Write `tests/test_events_models.py` first:
   - `test_handled_pair_is_unique` (an `IntegrityError` on the duplicate)
   - `test_deleting_event_cascades_handled`
   - `test_type_has_no_choices` (`_meta.get_field("type").choices is None`)

   Then write `models.py` with `DomainEvent` and `HandledEvent` (spec Data model), the
   `migrations/__init__.py`, and `makemigrations platform` to produce `0001_initial`, which
   is additive only. Add the GIN index on `user_ids` and a btree index on `occurred_at`.

3. [x] **`publish`.** Write `tests/test_events_publish.py` first:
   - `test_outside_atomic_raises`
   - `test_unregistered_type_raises`
   - `test_wrong_class_raises`
   - `test_bool_for_int_raises`
   - `test_naive_datetime_raises`
   - `test_writes_row` (exact `type`, `version`, `payload` with ISO UTC strings,
     `user_ids`, `occurred_at`)
   - `test_enqueues_only_on_commit`: inside
     `django_capture_on_commit_callbacks(execute=False)`, one callback and zero
     `deliver_event.delay` calls before execution
   - `test_rollback_leaves_nothing`
   - `test_enqueue_failure_does_not_fail_producer`: `delay` patched to raise, the producer's
     commit stands, and an ERROR is logged by `robust=True`

   Mutation-check this step: call `delay` directly instead of `on_commit`, and
   `test_enqueues_only_on_commit` must go red.

4. [x] **`deliver` and `deliver_event`.** Write `tests/test_events_deliver.py` first:
   - `test_runs_each_handler_once_and_records`
   - `test_second_deliver_is_noop`
   - `test_raising_handler_rolls_back_only_itself`: its write is gone, its pair is pending,
     a sibling handler's pair is recorded, and an ERROR log names the event id, the handler
     and the exception class
   - `test_task_retries_when_a_handler_failed`
   - `test_unknown_type_and_no_subscribers_are_noops`
   - `test_concurrent_delivery_runs_handler_once` (`transaction=True`, two threads)

   Then write `deliver()` in `events.py`. Each handler gets its own `atomic()`: insert the
   `HandledEvent` first, and treat an `IntegrityError` as "already handled". Add
   `deliver_event` to `tasks.py` with `autoretry_for=(HandlerFailedError,)`, backoff and 3
   retries. Mutation-check it by dropping the per-handler atomic:
   `test_raising_handler_rolls_back_only_itself` must go red.

5. [x] **Sweep, purge and replay.** Write `tests/test_events_jobs.py` and
   `tests/test_replay_events_command.py` first:
   - the sweep window edges (4m59s and 24h+1s skipped; 5m and 24h enqueued), and a handled
     pair skipped
   - a sweep run twice enqueues the same set, so double dispatch is harmless
   - purge at 90d+1s deletes and at 90d−1s keeps, it batches (assert the per-batch query
     count with a batch size of 2), and the cascade holds
   - replay `--handler`, `--type`, `--since` and `--dry-run` (lists the pairs, runs
     nothing)

   Then write `sweep_pending_events` and `purge_old_events` in `tasks.py` and
   `management/commands/replay_events.py`. **No beat entries yet** (part 2).

6. [x] **Probe.** Write `tests/test_event_bus_probe_command.py` first. Under eager Celery the
   probe exits 0. With `delay` patched to a no-op and `--timeout 1`, it exits non-zero.

   Then register `platform.bus_probe` (type and no-op handler) in `apps.py` `ready()` and
   write `management/commands/event_bus_probe.py`.

7. [x] **Personal-data hooks.** Write `tests/test_events_personal_data.py` first, using
   `assert_hooks_honour_contract("platform.events", seed=..., make_user=...)`. `seed`
   publishes one probe-shaped event with that user in `user_fields`. Then write
   `events_personal_data.py` (export and erase by `user_ids__contains`) and register it in
   `PlatformConfig.ready()`. Run `tests/test_personal_data_hooks_cover_every_model.py`; it
   must pass with no edit, because both models are named by the hooks.

8. [x] **Docs (meta).**
   - ADR text "domain event bus" (spec Module boundaries). It goes to the conductor for a
     number.
   - A "The domain event bus" section in `docs/architecture/platform.md`, with how to
     publish, how to subscribe, idempotency, replay, retention and the two-release rule.
   - In `.github/workflows/ci.yml`, after "Prove the worker executes a task", add a step
     that runs `python manage.py event_bus_probe --timeout 60` in `backend` and prints
     `/tmp/celery.log` on failure.

   This meta change lands with part 1's pin bump.

9. [x] **Full gate, merge `origin/main`, hand back part 1.**

## Part 2: scheduling publishes (backend PR 2, release N+1, after part 1 deploys)

10. [x] **Event types.** Write `kaleem/scheduling/tests/test_events.py::test_types_registered`
    first. Then write `kaleem/scheduling/events.py`, holding `SessionCompleted`,
    `SessionCancelled` and `register()`, and call `register()` from `SchedulingConfig.ready()`.

11. [x] **Publish on close-out and cancellation.** Write the payload tests in
    `kaleem/scheduling/tests/test_events.py` first:
    - `complete_session` publishes `outcome="held"`, and `mark_student_absent` publishes
      `"student_absent"`
    - `cancel_session` by the teacher 1h before start publishes `cancelled_by_teacher=True,
      in_time=False` (the unit is refunded, yet the cancellation was not timely)
    - a family cancellation at exactly 24h before the start publishes `in_time=True`, and
      one at 24h−1s publishes `False`
    - `end_slot` publishes one event per future session it cancels and none for past
      sessions

    Then extend `test_close_out_matrix.py`. `_observed()` gains
    `"events": tuple(DomainEvent types whose payload session_id is this session, in id
    order)`. The test reads `kaleem.platform.models.DomainEvent` directly, because
    scheduling may import platform and no contract forbids it. `_before()` gains `()`.
    `_expect()` gets `("scheduling.session_completed",)` or
    `("scheduling.session_cancelled",)`.

    Then edit `booking.py`: step 8 of `_close_out` calls `publish(SessionCompleted(...),
    occurred_at=now)`, `_apply_cancellation` publishes `SessionCancelled`, and the step-8
    docstring line is updated.

    Mutation-check both edits. Removing either publish must turn the matrix red, and so
    must deriving `in_time` from `not consumes_quota`, through the late-teacher payload
    test. A refusal publishes nothing because the atomic block rolls the row
    back. That is pinned by the refusal cells, and it holds by construction, so it has no
    separate mutation.

12. [x] **Beat entries.** Write `tests/test_beat_schedule.py` (or extend the existing beat
    test) first: both entries exist and name registered tasks. Then add
    `platform-sweep-pending-events` (`*/10`) and `platform-purge-old-events` (daily, at the
    conductor's slot) to `CELERY_BEAT_SCHEDULE` in `config/settings/base.py`.

13. [x] **Docs (meta).** Under `docs/architecture/scheduling.md`, in "Jobs" or "Public API",
    list the two published events and their payloads, and point to platform.md.

14. [x] **Full gate, merge `origin/main`, hand back part 2.**

## Migrations

There is one: `platform/0001_initial`. It creates two new tables and is expand-only, so
it is safe while both colours run. Scheduling gets no migration. Parts 1 and 2 add no
column to any existing table.

## e2e (D3)

There is no Playwright flow, because nothing changes for a user. The worker-topology proof
is the ci.yml `event_bus_probe` step (step 8). It runs in the e2e job against the real
Redis and Celery worker, and the budget is 60 s at worst. That scheduling's events fire is
proven by the matrix and the payload tests, with on_commit callbacks executed under eager
Celery.

## Risks

- **A new task is enqueued before any worker knows it** (blue-green). Mitigation: the
  two-PR split, with nothing publishing until part 2.
- **A handler that is slow or always fails** hits `CELERY_TASK_SOFT_TIME_LIMIT=60`, then
  retries, then the sweep retries it every 10 minutes for 24 hours, logged at ERROR each
  time. That is bounded noise, never a lost event. Handlers must be short, and a heavy
  handler enqueues its own task.
- **An `on_commit` enqueue lost on a broker outage.** Mitigation: the outbox row survives
  and the sweep re-enqueues it within 10 minutes.
- **`ArrayField` and the GIN index are Postgres-only.** That is fine, because every
  environment and the gate run Postgres 18.
- **A contract change turns out to be needed.** None is expected, because scheduling to
  platform is already allowed. If `lint-imports` disagrees, stop and escalate rather than
  widening a contract.
- **The owner changes the 90-day retention.** It is one constant, `RETENTION` in
  `events.py`, so the change is small.

## Verification

- After each step, the step's tests run red before the code and green after it, through
  `backend-gate.sh <worktree> <test file>`.
- Each part passes the full `backend-gate.sh`, including `makemigrations --check`, mypy and
  `lint-imports` (11+ contracts kept, none edited).
- The listed mutation checks go red with the change reverted.
- In meta CI, the `event_bus_probe` step prints its success line in the e2e job log, and the
  reviewer reads that line.
- On staging after part 2 deploys, under the conductor's staging lock: close out one seeded
  lesson and read the `platform_domainevent` row and the beat log in one query, as the
  staging diagnostics reference describes.
