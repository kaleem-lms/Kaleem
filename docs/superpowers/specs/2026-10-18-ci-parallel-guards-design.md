---
name: ci-parallel-guards
phase: v1
modules: [platform, scheduling, ci]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Three CI guards to have in place before many v1 units build in parallel. Each closes a gap
that ci.yml has today (meta `789400c`, backend `2401dc7`):

1. **Missing migrations fail CI.** `backend-test` runs `migrate` and nothing more. A
   conflicting leaf already fails `migrate`, but a model change that ships without its
   migration passes. Add `makemigrations --check --dry-run`.
2. **Feature units add e2e seeds without editing ci.yml.** The `Migrate and seed` step
   names `seed_e2e` and `seed_e2e_matching` directly (ci.yml:439-440), so every unit that
   needs fixture state would edit the same lines of a meta-only file. Replace those lines
   with one backend command that runs an ordered manifest kept in the backend repo.
3. **The e2e job runs a Celery worker.** Today `.delay()` puts tasks on Redis and nothing
   consumes them. The only producer is `send_email_message` (locmem, so nothing is
   observable), but v1 units will add tasks whose effects the e2e flows can see.

There is also a fixture fix that comes with (2). `seed_e2e_matching` calls the global
`booking.generate_sessions()`. When several seeds run in sequence, that sweep would
create sessions for any other seed's students that have active slots. It must pass
`student_id=` for its own booked student. `generate_sessions` already takes that keyword
(`booking.py:489`).

The seed's other sweep, `matching.sync_match_requests()`, takes no student filter, and
the matching API views also run it on every read (`scheduling/api/views.py:114,154`).
It stays as it is. The manifest header and the testing guide carry the rule instead: a
seed must not leave an account entitled, with a subject interest and availability but
no assignment, unless it wants that account matched, because the next matching read
opens a request for it.

## User flow

There is no end-user flow. Contributors see this:

- A backend PR that changes a model without a migration fails `backend-test` at
  "Check for missing migrations".
- A unit that needs e2e fixture state writes a DEBUG-guarded `seed_e2e_<x>` command in
  its own module and appends one line to `backend/config/e2e_seeds.txt`. ci.yml stays
  unchanged.
- `seed_e2e_all` stops with a `CommandError` on an empty manifest, a duplicate entry, a
  name that is not a command, or when run with `DEBUG=False`.
- If the worker does not come up or cannot execute a task, the e2e job fails at "Prove
  the worker executes a task", before the Playwright tests start.

## Data model delta

None. There are no migrations.

## API delta

None.

## Frontend

None. The dashboard is not touched.

## Module boundaries

- `seed_e2e_all` lives in `kaleem/platform/management/commands/`. It runs manifest
  entries with `call_command(name)` by string, so it imports no business module and the
  `platform imports no business modules` contract still holds.
- The manifest is `backend/config/e2e_seeds.txt`. It sits with the project wiring, as
  `config.api_router` does, and not inside one business module. The format is one
  command name per line, in run order; `#` comments and blank lines are allowed.
- `seed_e2e_matching` (scheduling) changes one call: it now passes
  `student_id=booked_student.id`.
- In ci.yml, `backend-test` gains one step. In the `e2e` job, `Migrate and seed` becomes
  `migrate` plus `seed_e2e_all`, and two steps are added: start the worker (the same
  `celery -A config.celery_app worker` command as `docker-compose.local.yml`, no beat)
  and a round-trip probe. `/tmp/celery.log` joins the failure artifact.

Personal data (ADR-0023): none. All fixture accounts use `@kaleem.test` addresses, exist
only in CI or local databases, and the existing DEBUG guards still apply.

Expand/contract: not applicable. Nothing here runs in staging or production: the manifest
runner refuses `DEBUG=False`, and ci.yml's deploy job does not change.

## Out of scope

- A mail-catcher, and any e2e flow that reads an inbox (ISSUES.md "Flows the harness
  structurally cannot reach").
- Running Celery beat in e2e.
- New e2e flows. The D3 table does not change.
- The conductor's local e2e-slot recipe in `_ops`. It is not in the repo, and the
  conductor updates it.
- The seed-age time bomb (ISSUES.md). The seeds' behaviour does not change.

## Test plan

Backend (pytest, written first):

- `seed_e2e_all` runs the manifest's entries in file order and skips comments and blank
  lines.
- It refuses an empty manifest, a duplicate entry, an unknown command name (before
  running anything) and `DEBUG=False` (running nothing). Each case raises `CommandError`.
- The shipped manifest is exactly `seed_e2e`, then `seed_e2e_matching`, and every entry
  resolves to a real command. This keeps CI's behaviour unchanged at landing.
- `seed_e2e_matching` leaves a bystander student with an active assignment, an active
  slot and a subscription, but no sessions, still at zero sessions. This test fails on
  today's global sweep.

CI (mutation checks, per the unit's e2e line):

- A model field with no migration turns `backend-test` red at the new step. Proved
  locally with `backend-gate.sh` against a throwaway field. The PR run's log must show
  the step ran and printed "No changes detected".
- With the worker step removed, the probe step fails red. With it restored, the probe
  passes. The probe stands in for the e2e line's "a task-dependent flow": no shipped
  flow observes a task's effect yet, so there is no flow to break. Proved locally in an e2e slot. The PR run must show the probe green and every
  existing e2e test passing.

e2e time budget: worker start plus the probe should add 15 s or less to the e2e job.

## Open questions

None. `needs_adr: none`. No owner decision applies.
