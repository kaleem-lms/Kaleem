# Testing Guide

## Running tests

```bash
just test           # all tests (backend + frontend + boundaries)
just test-backend   # backend only
just test-frontend  # frontend only (type check in Phase 0)
```

## TDD workflow (D3)

1. Write the failing test
2. Run it — verify it fails with the expected error
3. Write the minimal code to make it pass
4. Run it — verify it passes
5. Refactor if needed, tests still passing
6. Commit

## Coverage gate

100% coverage (line + branch), machine-enforced in CI in every repo (`backend`, `dashboard`,
`marketing`). This is a hard gate, not a target — CI fails below 100% and the change does not
merge or deploy. See ADR-0021.

- **All code** — services, models, views, serializers, frontend: 100% line + branch.
- **Exclusions are per-line and justified**, never blanket file/directory exclusions for
  business logic (`# pragma: no cover  # <why>`, `/* v8 ignore next -- <why> */`). Migrations,
  settings, and generated files are excluded at the config level.
- **End-to-end tests (Playwright)** ship with every user-facing feature, covering the primary
  happy path and key failure paths, run in CI against a real built app.

## e2e fixtures

The e2e job (`ci.yml`) migrates, runs `python manage.py seed_e2e_all`, then starts the API,
the signaling service and a Celery worker. `seed_e2e_all` runs the management commands listed
in `backend/config/e2e_seeds.txt`, in file order. The job also runs the worker (no beat), so a
task queued with `.delay()` is executed during the suite; a probe step fails the job before the
Playwright tests if the worker cannot run a task, or if its mail does not reach the job's
mailpit.

## e2e inbox

A flow that ends in an email reads it from the job's mailpit (`axllent/mailpit:v1.30.1`, ADR-0051)
through `dashboard/e2e/support/inbox.ts`: `clearInbox` before the triggering action,
`waitForMail` for an exact recipient and subject, and `linkIn` for a link whose origin must be the
app's. End the flow by signing in as the account the link was for, because a page can say
"verified" for a key that did nothing. Use a fresh `uniqueEmail(...)` address, or clear the
inbox first when the address is a fixed one. Mailpit proves the app sends the right mail with a
working link; it proves nothing about delivery by the real provider.

Locally, point `E2E_MAILPIT_URL` at the mailpit your Django sends to (default
`http://localhost:8025`, the compose port) and set `DJANGO_FRONTEND_URL` to the app's origin. The
email-scoped throttle allows five password-reset requests an hour per address, so a sixth local
run of the reset flow in an hour gets a 429 until that Redis database is flushed.

Adding fixture state for a new area:

1. Write a `seed_e2e_<x>` command in your own module. Guard it on `settings.DEBUG`, use
   `@kaleem.test` addresses only, and make it converge on the declared state when run twice.
2. Append **one line** to `backend/config/e2e_seeds.txt`. Do not edit `ci.yml`. The runner
   refuses an empty manifest, a repeated name, a name that is not a command, and `DEBUG=False`,
   before it runs anything.
3. Scope your sweeps. Seeds share one database, and run order is file order. Pass a student
   or teacher filter wherever a service takes one (for example
   `booking.generate_sessions(student_id=...)`), so your seed never creates rows for an
   account another seed owns.
4. Do not leave an account entitled, with a subject interest and availability but no
   assignment, unless you want it matched. `matching.sync_match_requests()` is global and runs
   on every matching read, so the next read opens a request for that account, which can become a
   second offer and break flows that assert exactly one.

Locally, the same command seeds a dev database: `python manage.py seed_e2e_all`.
