---
name: lb-gdpr-retention-jobs
phase: v1 (wave 4, legal stream)
modules: [billing, identity]
status: approved
approved: 2026-11-22
created: 2026-11-22
closed: null
---

## Goal

lb-gdpr-erasure anonymizes an account in place and keeps its billing rows "for 12 months
after closure" (lb-dec-retention), with a note that this unit purges them on that clock.
Nothing does yet. Expired session rows also stay in the database, because nothing runs
Django's session cleanup. This unit adds two nightly jobs:

- **billing**: 12 months after an account's `erased_at`, delete its billing customer,
  subscription and incident rows, and delete the customer record at the payment provider.
- **identity**: delete expired session rows, and delete Django admin action-log entries
  older than 30 days ("logs 30 days", lb-dec-retention).

Decisions this follows: lb-dec-retention, lb-dec-erasure-semantics (anonymize in place),
dec-retention-new-domains (earnings: statutory period), dec-spec-approval,
dec-floor-ownership. The diagnostics purge (90 days), the event-log purge (90 days) and
the notification-log purge (90 days, task already shipped) already exist and do not
change here.

## User flow

There is no user-facing flow. A person who deleted their account 12 months ago has no
billing rows left in kaleem, and no customer record at the payment provider. The privacy
notice that says so is lb-privacy-notice-final.

## What each job does

| Job | Deletes | Skips, and retries the next night | Never touches |
| --- | --- | --- | --- |
| `billing.tasks.purge_erased_customers` | For each user whose `erased_at` is at least 365 days ago: the customer at the provider first, then `BillingCustomer`, every `Subscription` and every `BillingIncident` with that `user`. | A user with a subscription in `LIVE_STATUSES` (erasure refuses those, so this is a guard). A user with an unresolved incident, so staff still see an open money problem. A user whose provider call fails. Each skip is logged with the user id only. | `TeacherRate` and `TeacherEarning`: these are kept for the statutory period (dec-retention-new-domains) and are protected by foreign keys. `StripeEventLog`: it is an idempotency ledger with no personal data. Incidents with no `user`. |
| `identity.tasks.apply_retention` | Expired session rows (`SessionStore.clear_expired()`, what `clearsessions` runs). `django.contrib.admin` `LogEntry` rows whose `action_time` is more than 30 days old. | n/a | The anonymized `User` row and its profile rows (see below). |

**The provider call comes first.** The provider customer is deleted before the local
rows. If the local delete then fails, the next run asks the provider again, gets "no such
customer" (`resource_missing`), and treats that as done. If the steps ran the other way
round, a failure after the local delete would leave the provider customer orphaned, with
nothing left to find it by. Deleting a customer at the provider cannot charge anyone,
because the user has no live subscription.

**Idempotent under double dispatch.** Both blue-green colours run beat. Each user is
handled in its own transaction, with `select_for_update(skip_locked=True)` on that user's
billing rows, so a second worker skips a user the first one holds. A repeated provider
delete is answered with `resource_missing`. A run handles at most 100 users, so a backlog
is spread over several nights and never holds a long lock.

**What "accounts 12 months after closure" means here.** Erasure already removed every
personal field from the `User` and profile rows (lb-gdpr-erasure). Those rows stay as
empty anchors, because other people's records point at them: lessons, chats, reports,
and teacher earnings, which use `PROTECT`. Deleting them would cascade into other
people's history. So the account's 12-month clock deletes what kaleem kept about the
closed account, which is its billing records and the provider's customer. Owner rule 1
below confirms this.

## Data model delta

None. There are no migrations. The jobs read `identity.User.erased_at` (added by
`identity/0010`) through identity's public API.

ADR-0023's four points:

- **What:** nothing new is collected or written. The jobs delete rows. Logs record the
  user id and counts, never an address or a provider id.
- **Why:** storage limitation, GDPR Art. 5(1)(e), and lb-dec-retention.
- **How long:** billing rows and the provider customer are kept 365 days after
  `erased_at`. Admin action-log entries are kept 30 days. Session rows are kept until they
  expire (Django's default cookie age, two weeks).
- **Who sees it:** nobody new. Staff stop seeing the purged rows in Django admin.

## API delta

There are no HTTP endpoints and no user-facing strings, so there is no gettext and no
`error_code`. Python:

- `identity.services.erased_before(user_ids, cutoff) -> set[int]` returns the given ids
  whose `erased_at <= cutoff`. Billing calls it, because billing may not read identity's
  models.
- `identity.services.apply_retention(*, now=None) -> dict[str, int]` returns
  `{"sessions": n, "admin_log": n}`.
- `billing.services.purge_erased_customers(*, now=None, limit=100) -> int` returns how
  many users were purged.
- `PaymentProvider.delete_customer(customer_id) -> bool`: `True` when the provider
  deleted the customer, `False` when it had no such customer. Any other failure is
  mapped by `_mapped_stripe_errors` to a `KaleemError`. The purge catches
  `KaleemError` only, never a bare `Exception`.
- Celery tasks `kaleem.billing.tasks.purge_erased_customers` and
  `kaleem.identity.tasks.apply_retention` are thin wrappers. identity has no `tasks.py`
  yet; `app.autodiscover_tasks()` finds it.

**Beat entries, and the two-part landing.** The blue-green rule says a new task name must
be deployed one release before anything enqueues it. So part 1 ships the code and the
tasks with no beat entry. Part 2, after part 1 is on staging, adds the two entries to
`CELERY_BEAT_SCHEDULE` in `config/settings/base.py` (a shared file). The proposed slots
are `billing-purge-erased-customers` at **03:47** and `identity-apply-retention` at
**03:29**. Neither collides with 02:43, 03:17, 04:11, 04:41, the 6-hourly :07 or the
`*/10` sweep. The conductor confirms or reassigns them. The billing purge running after
the 03:17 reconcile is a preference, not a requirement. If the reconcile meets a customer
the purge just deleted, it logs a per-customer failure and carries on, and that customer
is gone from the next run.

## Frontend

None. No route, component or string changes. The jobs have no UI. Staff see the effect
in Django admin.

## Module boundaries

- billing owns its purge and its provider method. It calls `identity.services.erased_before`,
  an edge the "billing imports no business modules except identity" contract already
  allows.
- identity owns sessions and the admin log. ADR-0048 already gives identity the admin
  log's rows for erasure.
- identity never imports billing. No import-linter contract changes, and no events.

## Expand/contract

The change is additive only. It adds no schema change. The new provider method is only
called by the new task, so the previous release never calls it. The task names land one
release before their beat entries (part 1, then part 2). Both jobs are idempotent.

## Out of scope

- **The 30-day bound on application and container logs** (gunicorn, nginx, the
  monitoring stack). That is an infra control, set where the logs are kept, and is not in
  this unit's repos. The conductor routes it (see the hand-back).
- Retention purges owned by other units: ratings (asm), messages (msg-retention), uploads
  (cur-content-retention), and the notification-log beat entry (the first notifications
  producer).
- The end of the earnings statutory period. An accountant has not yet confirmed its
  length, and it belongs to the payouts units.
- Accounts that were never erased, including sign-ups that never verified their email.
  lb-dec-retention starts the clock at closure.
- The provider's own payment records, which it keeps under its own legal obligations.
  lb-privacy-notice-final states this.

## Test plan

Backend only. The tests use the `FakePaymentProvider` and the `now=` override, with no
network calls.

- Billing purge: a user erased 365 days and 1 second ago has every billing row deleted
  and one `delete_customer` call. A user erased 365 days minus 1 second ago keeps
  everything. A user who was never erased keeps everything. A second run does nothing and
  makes no provider call.
- The provider answering "no such customer" still purges the local rows.
- A provider failure skips that user and leaves the rows. The next user is still purged.
- A live subscription in each of the four `LIVE_STATUSES`, and an unresolved incident,
  each skip the user with no provider call. A resolved incident does not block.
- `TeacherRate` and `TeacherEarning` rows survive. An incident with no user survives.
- `limit` caps one run. A row held by another transaction is skipped
  (`skip_locked`, `transaction=True` test).
- Stripe provider: `delete_customer` calls `stripe.Customer.delete`. `resource_missing`
  returns `False`. Any other invalid request, and a connection error, raise the mapped
  `KaleemError`s.
- `erased_before` returns only the ids at or past the cutoff, and only from the ids it
  was given.
- Identity: an expired session row is deleted and a live one is kept. A `LogEntry` at
  30 days and 1 second is deleted, and one at 30 days minus 1 second is kept. The counts
  are returned. A second run deletes nothing.
- The tasks are registered (`app.tasks`) and call the services. In part 2,
  `tests/test_beat_schedule.py`-style tests check that both entries exist, name registered
  tasks, use the agreed crontabs, and that no two entries share a schedule.
- Every regression test is mutation-checked: revert the guard and see red. That covers
  the provider-first order, the live and open-incident skips, the 365-day and 30-day
  boundaries, and `resource_missing` treated as done.

**e2e: none, by design.** These jobs have no user-facing behaviour. The D3 table records
signaling (C3b) the same way.

**Staging (dec-d9-substitute, the conductor's step 11):** after part 2 deploys, the beat
log shows both tasks running once at their slots. A throwaway test-mode account that was
erased and backdated more than 365 days has its rows gone, and its test-mode customer is
gone at the provider, after one run.

## Open questions

None. The owner approved the spec on 2026-11-22 and answered the four rules as follows.

1. **The account's 12-month clock deletes its billing rows and the provider customer.**
   Approved. 365 days after `erased_at` the billing job deletes the provider customer
   first, then `BillingCustomer`, `Subscription` and `BillingIncident` rows. The
   anonymized user and profile rows stay as anchors. Teacher rates, teacher earnings and
   `StripeEventLog` are untouched.
2. **"Logs 30 days" covers Django admin's action log and expired sessions.** Approved:
   `LogEntry` rows are deleted after 30 days, and expired session rows are deleted.
3. **A billing purge waits while an incident about the user is unresolved.** Approved.
4. **Application and container logs are handled by a separate infra unit,**
   `lb-server-log-retention`, not by this one.

**Beat slots accepted:** `identity.tasks.apply_retention` at 03:29 and
`billing.tasks.purge_erased_customers` at 03:47.

**Two-part landing (owner decision).** Part 1 (services, tasks, provider method, no beat
entries) is branch `feat/lb-gdpr-retention-jobs`. Part 2 (the two beat entries in
`config/settings/base.py` plus a beat-schedule test) is a second backend branch,
`feat/lb-gdpr-retention-jobs-beat`, stacked on part 1. The meta branch pins part 1 only;
the conductor lands part 2 after part 1 deploys. As a billing unit, the conductor
dispatches stripe-clock on the meta branch before merging.

**Test provider.** `PaymentProvider.delete_customer` is implemented on the existing
`FakePaymentProvider`; no test calls live Stripe.
