# Staging account pool runbook

Spec: `docs/superpowers/specs/2026-10-25-ci-staging-pool-seed-design.md`. Architecture:
`docs/architecture/platform.md` (the staging account pool).

## What it is

Each programme unit is verified on staging with its own accounts (a teacher, a student and a
parent) and four lessons in time-bound states. `seed_staging_pool` creates them and, on every
later run, puts them back: it never deletes an account, it converges the declared state.

| Lesson | State after a run | For |
| --- | --- | --- |
| `held` | completed, one day ago | report and rating flows |
| `toClose` | scheduled, three hours ago | close-out flows (valid for a week) |
| `joinable` | scheduled, now | join and call flows |
| `upcoming` | scheduled, as generated | schedule and cancellation flows |

Addresses are `pool.<unit>.<teacher|student|parent>@pool.kaleem.test`. The reserved `.test`
domain cannot receive mail.

## When to run it

- Once a day for every active unit, in one batch.
- Again for one unit just before its click-through. The `joinable` lesson can be joined from
  10 minutes before it starts until 15 minutes after it ends, so it stays joinable for about
  75 minutes after a run; a later click-through needs a fresh run first.

## How to run it

Inside the live Django container on staging, the unit slugs as repeated `--unit` flags
(`[a-z0-9-]`, at most 40 characters) and the pool password on **standard input**:

```
python manage.py seed_staging_pool --unit <slug> --unit <slug> < <password-file>
```

The password comes from a mode-600 file in the private ops directory, never from an argument,
an environment variable, the output, a ticket or the repo. The exact commands are kept in the
private ops record for this unit. A terminal on standard input is refused.

## What it refuses

It stops with an error before writing anything for the failing unit when: the host of
`FRONTEND_URL` has no `staging` label (production and local development are refused); the
password is empty or under 16 characters; no `--unit`, a repeated or a malformed one; or the
fixture subscription stops yielding exactly four lessons. Earlier units in the same run stay
committed.

## Reading the output

Per unit: the three addresses and the four lesson start times (UTC), then one line with
counts, `Seeded N unit(s): A account(s), L lesson(s).` Run it twice and compare the counts
lines: they match. The password and its hash are never printed.

## What it does not do

No staff accounts (owner-issued), no pruning of a finished unit, no scheduled run (a
`ship.sh` flag is deferred), and no mail suppression for `.test` recipients (`ISSUES.md`).
