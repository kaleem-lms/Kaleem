---
name: ci-staging-pool-seed
phase: v1 programme (wave 1, platform stream)
modules: [platform, identity, scheduling, billing]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Replace the hand-built staging account pool (base-06, a Django shell session) with one
idempotent management command, `seed_staging_pool`. Programme step 11 verifies every unit on
staging with that unit's own pool accounts (dec-d9-substitute), and the lessons those accounts
need are time-bound: a lesson can be joined only from 10 minutes before it starts to 15 minutes
after it ends (`scheduling.rooms.join_window`), and closed out only in the 7 days after it
starts (`scheduling.services.CLOSE_OUT_WINDOW`). A shell session cannot keep those states
fresh. The command can, because each run puts a unit's accounts and lessons back into the
declared state.

Until a `ship.sh` flag exists (rejected for now, programme review P12) the command is run by
hand over `ssh kaleem`: once a day for every active unit, and again for one unit just before
that unit's click-through. Gate `hg-vps-access`; the conductor holds the delegation.

## User flow

No end-user behaviour changes. The operator flow:

1. The conductor runs, inside the live Django container on staging:
   `python manage.py seed_staging_pool --unit <slug> [--unit <slug> ...]`, with the pool
   password on **standard input** (from a mode-600 file in the private ops directory). The
   password never appears in argv, the environment, the output or the repo.
2. For each unit, in one transaction, the command converges three accounts and four lessons:

   | Address | Role | State |
   | --- | --- | --- |
   | `pool.<slug>.teacher@pool.kaleem.test` | teacher | verified, gender male, teaches `quran`, `is_in_pool=False`, available Thursday 15:00–18:00 UTC |
   | `pool.<slug>.student@pool.kaleem.test` | student | verified, interest `quran`, same availability, live fixture subscription, assigned to the teacher, slot Thursday 15:00 UTC |
   | `pool.<slug>.parent@pool.kaleem.test` | parent | verified, linked to the student |

   | Lesson | Starts | State | Serves |
   | --- | --- | --- | --- |
   | `held` | run time − 1 day | completed / held | report and rating flows |
   | `toClose` | run time − 3 hours | scheduled, no outcome | close-out flows (inside the 7-day window for a week) |
   | `joinable` | run time | scheduled | join and call flows (joinable for 75 minutes after the run) |
   | `upcoming` | as generated | scheduled | schedule and cancellation flows |

   Run time is truncated to the minute. Every account converges on: active, not staff, not
   superuser, the pool password, language `""`, time zone `UTC`, one verified primary address.
3. It prints, per unit, the three addresses and the four lesson start times in UTC, then one
   summary line with row counts. It never prints the password or its hash.

Error cases (each stops with a `CommandError` and a non-zero exit before anything is written
for the failing unit; earlier units in the same run stay committed):

- **Not staging.** The host of `settings.FRONTEND_URL` has no `staging` label
  (`app-staging.kaleem.academy` passes; `app.kaleem.academy` and `app.kaleem.localhost` do
  not). Production and local development are refused without a new setting or env var.
- **Password** empty or shorter than 16 characters.
- **Unit slug** missing, repeated, or not `^[a-z0-9-]{1,40}$`.
- **Lesson count.** The fixture subscription stops yielding exactly four lessons (its
  allowance changed): the run says so rather than seeding a partial unit.

## Personal data (ADR-0023)

- **What:** synthetic accounts only: an address on the reserved `.test` TLD, a display name
  `Pool <Role> <slug>`, and the scheduling and billing rows above. No real person's data.
- **Why:** the per-unit staging click-through (programme step 11).
- **How long:** until staging is reset. A run never deletes accounts; it resets a unit's
  lessons, so a report or diagnostic a click-through left on that unit's lessons goes with them
  (all `Session` foreign keys are `CASCADE` today).
- **Who sees it:** the owner, the conductor and agents working on staging. `.test` cannot
  receive mail, so nothing reaches a person.

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None. No route, component or string changes.

## Controls

The command creates password-bearing accounts and an unpaid subscription on a public host, so
its limits are the point of the spec:

- **Staging only**, by the `FRONTEND_URL` host check above. Checked by the orchestrator and
  again by each module command, so running a module command directly is refused too.
- **Pool addresses only.** Every row it writes or resets belongs to an address that matches
  `^pool\.[a-z0-9-]{1,40}\.(teacher|student|parent)@pool\.kaleem\.test$`, and a run touches only
  the units it names. Other users, including other units' pool accounts, are untouched (the
  global `sync_match_requests` it calls is the same call every matching read already makes).
- **Never staff.** Pool accounts converge to `is_staff=False`, `is_superuser=False`. A staff
  account for an admin unit stays owner-issued.
- **Billing guard widened by exactly one case.** `billing.services.grant_dev_subscription`
  refuses unless `DEBUG` is true. It gains one more allowed case: staging (same host check)
  **and** the user's address is a pool address. Production stays refused for every address, and
  staging stays refused for every non-pool address. The fixture row has no `BillingCustomer`,
  so the nightly Stripe reconciler never sees it.
- **The password** reaches the command on stdin only; module commands receive a Django hash
  through a stealth option that has no command-line flag.

## Module boundaries

`platform` imports no business module (import-linter), so the work splits by owner, following
the `seed_e2e_all` precedent of dispatching by command name:

- **platform**: `kaleem/platform/staging_pool.py` (the address scheme, slug validation,
  `is_staging()`, `is_pool_email()`) and the orchestrator
  `kaleem/platform/management/commands/seed_staging_pool.py` (checks, password, per-unit
  transaction, `call_command` by name).
- **identity**: `seed_staging_pool_accounts` (users, addresses, profiles, the parent link,
  teacher gender and `is_in_pool`).
- **scheduling**: `seed_staging_pool_lessons` (subjects through `curriculum.services`,
  availability, the fixture subscription through `billing.services`, match, slot, the four
  lessons, closed out through `booking.complete_session` so the window guard is exercised).
- **billing**: the one-case guard change above, importing `kaleem.platform.staging_pool`.

No contract changes. No new events.

## Expand/contract and deploy window

Additive only: new commands, a new platform helper, one widened guard. The previous release
is unaffected during the blue-green window. No beat task, no env var, no `ship.sh` change.

## Out of scope

- Running from `ship.sh` or a timer (P12, deferred to after `lb-deploy-pipeline-hardening`).
- Staff accounts, and the DST spike's lessons (base-06 keeps those by hand).
- Pruning: retiring a finished unit's accounts, or children and aliases a click-through adds.
- Isolating pool teachers from real staging students' match requests (`prv-preview-mode`).
- Suppressing mail to `.test` recipients once staging sends notification mail (the
  notification units own the mailer).

## Test plan

- **Checks:** refused off staging (production-like and local `FRONTEND_URL`), with an empty or
  short password, with no, a repeated or a malformed slug; nothing is written in each case.
- **Password:** the stored hash verifies against the stdin password; the plaintext appears in
  no `call_command` argument and nowhere in the output.
- **Module commands:** each refuses off staging; the accounts command refuses without a hash.
- **Billing guard:** allowed for DEBUG (unchanged) and for staging + pool address; refused for
  staging + non-pool address and for production-like + pool address.
- **States:** after a run, `joinable`'s join window contains now, `toClose` is scheduled and
  inside the close-out window, `held` is completed, one lesson is upcoming, the student is
  entitled and assigned.
- **Idempotency (the unit's e2e substitute):** a second run leaves identical row counts and
  states; a run after drift (password changed, made staff, language `ar`, `joinable` cancelled,
  `toClose` closed out) restores the declared state.
- **Scope:** a run naming one unit leaves another unit's pool rows and a non-pool student's
  account, subscription and lessons unchanged.
- **e2e:** none. No user-facing behaviour; the D3 table gains no row. Verified on staging
  instead (plan, step 7).

## Open questions

None. Owner approval is requested for the billing guard change (dec-spec-approval: money).
