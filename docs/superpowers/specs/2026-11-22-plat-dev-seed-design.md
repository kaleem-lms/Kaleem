---
name: plat-dev-seed
phase: v1 programme (wave 4, platform stream)
modules: [platform]
status: approved
created: 2026-11-22
closed: null
---

## Goal

`just seed` runs `python manage.py seed basic`, and that command does nothing. It prints
"Currently only platform module exists" and exits 0
(`backend/kaleem/platform/management/commands/seed.py`). A developer with a fresh database
has no accounts to sign in with. `docs/developer-guide/local-setup.md` lists test users
that have never existed. So a local session starts with minting a user in a Django shell.

The data a developer needs already has an owner. The e2e manifest (`config/e2e_seeds.txt`,
run by `seed_e2e_all`) converges 24 synthetic accounts and their state: every role,
parent links, assignments, upcoming lessons, a lesson joinable now, lessons closed as
`held` and `student_absent`, one still to close, a filed report, and the billing states.
Each later unit already extends that manifest in its own PR.

This unit makes `seed basic` run that manifest. It refuses to run anywhere that is not
local development. It also documents which account to sign in as for each role. Nothing
is duplicated: no second account list, no second manifest, no new business seed.

## User flow

The developer is the user. Nothing changes for end users.

1. `just seed`, or `python manage.py seed` (the dataset argument defaults to `basic`).
2. The command checks that this is local development (below), then calls `seed_e2e_all`
   by name. That runs every manifest seed in order and prints a line per seed.
3. It ends by naming the account table in `docs/developer-guide/local-setup.md`. It does not
   print a password. The fixture password is the one the e2e harness already publishes
   (`E2E_PASSWORD` in `kaleem/identity/management/commands/seed_e2e.py`). The table
   points to that constant and does not copy it.
4. Running it again converges on the same state. Every manifest seed is idempotent in the
   strong sense. A rerun also moves the time-relative lessons back into place, for example
   the lesson joinable now and the lesson to close.

Errors (`CommandError`, non-zero exit, nothing written):

- `DEBUG` is False. This also covers production and staging, which run with `DEBUG=False`.
- The host of `FRONTEND_URL` is not local, even with `DEBUG=True`. Local means
  `localhost`, a `*.localhost` name (RFC 6761 reserves it for loopback), `127.0.0.1` or
  `::1`. The host is compared label by label, so `localhost.example.com` and
  `app.kaleem.localhost.example` are refused. This allowlist uses the existing setting, as
  `staging_pool.is_staging()` does, and adds no new setting. The error names
  `DJANGO_FRONTEND_URL`, so a developer whose `.env` points elsewhere knows what to change.
- Any manifest failure (empty, duplicate, unknown command, a seed raising). These come up
  unchanged from `seed_e2e_all`.
- `seed rich` is no longer a choice. argparse refuses it. It used to print a warning and
  exit 0, which reported a no-op as a success. A future unit that builds a larger dataset
  adds the choice back.

No password is taken from argv, the environment or stdin. The command takes none.

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None. No dashboard change, because the seed only creates rows the existing screens
already show.

## Personal data (ADR-0023)

- **What:** synthetic accounts only. Names read "E2E Parent" and "E2E Assessment
  Student", and addresses are on the reserved `kaleem.test` domain, which cannot receive
  mail. No real-looking names, no real addresses, no free text about a person. Some
  synthetic student accounts are linked to synthetic parents. They are fixtures, not
  children's data.
- **Why:** so a local session can sign in as each role without a shell.
- **How long:** until the developer drops their local database.
- **Who sees it:** the developer, on their own machine. The guard refuses every
  non-local host.

## Module boundaries

`platform` owns the command. It imports no business module. It calls `seed_e2e_all`
through `call_command` by name, as `seed_e2e_all` and `seed_staging_pool` already do.
No new contract and no widened one. No events.

## Expand/contract

Not applicable. No schema, API or cookie change, and the command never runs in a
deployed colour.

## Out of scope

- **`teacher_absent`.** Nothing writes that outcome yet: staff adjudication belongs to
  `sched-teacher-no-show`. That unit adds a lesson in that state to the e2e manifest, and
  `seed basic` picks it up with no change here.
- **A standing cancelled lesson.** Cancelled is a status, not an outcome. The rebook flow
  produces one at runtime. A static one would be a new e2e fixture row that no e2e flow
  needs.
- **A dev-only manifest.** Not needed while the e2e manifest covers every role and
  outcome that exists. A second manifest is worth adding only when a unit needs dev data
  that the e2e suite must not see.
- **Resetting the database.** The roadmap and the justfile comment both say `just seed`
  resets the database. It does not, and the seeds do not need it to. They converge only
  their own accounts. This mismatch goes in `ISSUES.md`. Editing CLAUDE.md needs an ADR,
  and the justfile is not this unit's to tidy (D10).
- `seed rich`, and any larger or perf dataset. `rch-load-test-harness` owns load data.

## Test plan

Unit tests (`kaleem/platform/tests/test_seed.py`, with `call_command` patched):

- `basic` calls `seed_e2e_all` once, passing its stdout. The dataset argument defaults to
  `basic`.
- Refused with `DEBUG=False`, and nothing called.
- Refused with `DEBUG=True` on a staging host (`https://app-staging.kaleem.academy`), on
  the production host (`https://app.kaleem.academy`), and on the look-alikes
  `http://localhost.example.com` and `http://app.kaleem.localhost.example`. Nothing called.
- Accepted on `http://localhost:5173`, `http://app.kaleem.localhost`,
  `http://127.0.0.1:8000` and `http://[::1]:5173`.
- `seed rich` raises `CommandError`.

Dataset test (`backend/tests/test_dev_seed_dataset.py`). It lives outside `platform`, so it
may read business models, the same way `tests/test_curriculum_assignment_wiring.py` does.
It runs the real `seed basic` with nothing patched and asserts that the result contains:

- a user with each of the student, teacher and parent profiles, and an `is_staff` user;
- a parent linked to a student, and an active teacher assignment;
- at least one lesson that is scheduled in the future;
- lessons with outcome `held` and `student_absent`, and one in the past that is still
  scheduled with no outcome (to close);
- at least one filed `SessionReport`.

A second run converges: the counts of users, sessions and reports are unchanged.

e2e: none (D3). No user-facing behaviour changes, and the e2e job already runs the same
manifest through `seed_e2e_all` on every PR.

## Open questions

None. The owner answered the questions this unit raised (2026-11-22). Reuse
`seed_e2e_all` and `config/e2e_seeds.txt` rather than duplicating them. The seed is
local-development only, carries no real-looking personal data and takes no password on a
command line. `platform` calls commands by name.
