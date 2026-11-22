---
spec: docs/superpowers/specs/2026-11-22-lb-gdpr-retention-jobs-design.md
status: approved
---

Worktree: `backend-lb-gdpr-retention-jobs` on `feat/lb-gdpr-retention-jobs` (runbook
section 1). This unit has no migration, no dependency change, no env var and no dashboard
change. Never edit a coverage floor. Run gates only through `_tools/backend-gate.sh`.
Merge `origin/main` (never rebase) right before each hand-back. The unit lands in two
parts, because a new task name must be deployed before its beat entry (blue-green rule).

## Steps

### Part 1: jobs, no beat entries

1. [ ] **`identity.services.erased_before`.** Write the tests first in
   `kaleem/identity/tests/test_services.py`. Given three users (erased 10 days ago,
   erased 400 days ago, never erased) and a cutoff of 365 days ago, it returns only the
   400-day id. An id that was not passed in is never returned, and an empty input returns
   `set()`. Then implement it as one `filter(pk__in=..., erased_at__lte=cutoff)`, and
   export it in `__all__` if the module has one.
2. [ ] **Provider `delete_customer`.** Write the tests first in
   `kaleem/billing/tests/test_stripe_provider.py`, using the module's existing
   `monkeypatch` style:
   - It calls `stripe.Customer.delete(<id>)` and returns `True`.
   - `InvalidRequestError(code="resource_missing")` returns `False`.
   - Any other `InvalidRequestError` raises the mapped `ValidationError`.
   - `stripe.APIConnectionError` raises `ExternalServiceError`.

   Then add the method to `PaymentProvider` in `kaleem/billing/providers/__init__.py`,
   and to `StripeProvider`, using the same `resource_missing` pattern as `get_price`. Add
   `delete_customer`, `deleted_customers: list[str]`, `missing_customers: set[str]` and
   `raise_on_delete_customer: dict` to `FakePaymentProvider` in `tests/fakes.py`, and
   clear them in `reset()`.
3. [ ] **Billing purge.** Write the tests first in a new
   `kaleem/billing/tests/test_retention.py`, using the conftest factories and a fixed
   `now`. Write every case in the spec's billing test plan, including:
   - The boundaries: 365 days plus 1 second is purged; 365 days minus 1 second is kept.
   - Idempotence: a second run makes no provider call.
   - `resource_missing`: the local rows are purged anyway.
   - A provider failure for user A leaves A intact, and B is still purged.
   - Parametrized over `LIVE_STATUSES`: the user is skipped and there is no provider call.
   - An open incident skips the user. A resolved incident does not block.
   - Earnings, rates and a user-less incident survive.
   - `limit=1` purges exactly one user.
   - **Provider first:** patch the local delete to raise after the provider call. The
     provider was called and the rows still exist, and the next run succeeds through
     `resource_missing`.
   - `skip_locked`: a `transaction=True` test holds the user's `BillingCustomer` row in a
     second connection, and the run skips it.

   Then write `kaleem/billing/retention.py`, holding `RETENTION = timedelta(days=365)`,
   `LIMIT = 100` and `purge_erased_customers(*, now=None, limit=LIMIT) -> int`:
   - Candidates are the distinct non-null `user_id`s across `BillingCustomer`,
     `Subscription` and `BillingIncident`. Exclude users with a live or an
     open-incident row **in the query, before the limit**, so permanently skipped users
     can never starve the batch.
   - Filter the candidates through `identity.services.erased_before`, then order by id
     and apply the limit.
   - For each user, run in its own `transaction.atomic()`: lock the user's
     `BillingCustomer` (or, when there is none, the user's `Subscription` rows) with
     `select_for_update(skip_locked=True)`. Skip the user if nothing locked. Re-check
     the live and open-incident guards. Call `delete_customer` when a customer row
     exists. Then delete the incidents, subscriptions and customer.
   - Catch `KaleemError` per user and log `billing.retention.skipped user_id=%s
     reason=%s`. Log `billing.retention.purged count=%s` once at the end.

   Re-export it from `billing/services.py` the way `notifications/services.py` re-exports
   its `purge_expired`.
4. [ ] **Identity retention.** Write the tests first in a new
   `kaleem/identity/tests/test_retention.py`:
   - An expired and a live `Session` row: only the expired one goes.
   - `LogEntry` rows at 30 days plus 1 second and 30 days minus 1 second: only the older
     one goes.
   - The returned counts are `{"sessions": 1, "admin_log": 1}`, and a second run returns
     zeros.

   Then write `kaleem/identity/retention.py`. It holds `ADMIN_LOG_RETENTION =
   timedelta(days=30)` and `apply_retention(*, now=None)`. Session cleanup goes through
   `import_module(settings.SESSION_ENGINE).SessionStore.clear_expired()`, counted
   before and after. The `LogEntry` delete runs in batches of 1000, like
   `notifications/retention.py`. Expose it from `identity/services.py`.
5. [ ] **Tasks.** Write the tests first: `kaleem/billing/tests/test_retention.py` and
   `kaleem/identity/tests/test_retention.py` each assert that the task name is in
   `config.celery_app.app.tasks` after `import_default_modules()`, and that calling it
   runs the service (eager). Then add `purge_erased_customers` to `billing/tasks.py`,
   and a new `identity/tasks.py` with `apply_retention`. Use thin `@shared_task`
   wrappers, and write the "Not in `CELERY_BEAT_SCHEDULE` yet" docstring that
   `notifications/tasks.py` uses.
6. [ ] **Mutation checks.** Revert each of these and see red, then restore it:
   - the provider-first order
   - the live guard
   - the open-incident guard
   - `>=` versus `>` on both boundaries
   - `resource_missing` returning `False`
   - the in-query exclusion before the limit

   Record each red test name in the hand-back.
7. [ ] **Full gate.** Run `backend-gate.sh <wt>`: migrate, `makemigrations --check`
   (it must show no changes), pytest with coverage, ruff, format and lint-imports. The
   CI backend job also runs mypy, so type-annotate the new functions. Merge `origin/main`
   and hand back part 1.

### Part 2: beat entries (after part 1 is deployed to staging)

8. [ ] **Beat schedule.** Write the tests first in a new
   `kaleem/platform/tests/test_retention_beat_schedule.py` (`test_beat_schedule.py`
   belongs to the event bus):
   - Both entries exist and name registered tasks.
   - `billing-purge-erased-customers` is `crontab(hour="3", minute="47")`, and
     `identity-apply-retention` is `crontab(hour="3", minute="29")`, or the conductor's
     slots if those are reassigned.
   - The existing no-shared-schedule test still passes.

   Then add the two entries to `CELERY_BEAT_SCHEDULE` in `config/settings/base.py`, each
   with a one-line comment naming the decision. This is a shared file, so take
   `origin/main`'s version at merge time and re-add only these two entries.
9. [ ] **Docs (meta worktree).** In `docs/architecture/billing.md`, under "Personal-data
   erasure", replace "lb-gdpr-retention-jobs purges them" with what the job does and its
   slot. In `docs/architecture/identity.md`, add a "Retention jobs" paragraph covering
   sessions, the admin log and the slot. Add a `STATE.md` line.
10. [ ] **Full gate, merge `origin/main`, hand back part 2.**

## Migrations

None. `makemigrations --check` must stay clean in both parts.

## e2e (D3)

None, by design. The jobs have no user-facing behaviour, so there is no flow to drive.
Their contract is held by the unit tests above.

## Gates

- `_tools/backend-gate.sh <wt> kaleem/billing/tests/test_retention.py` (and the others)
  in the TDD loop.
- The full `backend-gate.sh <wt>` before each hand-back.
- `_tools/gitleaks-range.sh` over `origin/main..feat/lb-gdpr-retention-jobs` (the reviewer
  runs it).

## Risks

- **A purge deletes something it should not.** The selection is the narrowest one
  possible: `erased_at` at least 365 days ago, no live subscription and no open incident.
  It is tested at both boundaries. Earnings are protected by foreign keys. If it goes
  wrong: the conductor removes the beat entry (part 2 revert), and the rows come back from
  the backup units' dumps.
- **The provider is down or rate-limited.** The run catches `KaleemError` per user,
  handles 100 users at most, and catches up the next night. No retry loop.
- **Double dispatch from both colours.** `skip_locked` per user, plus `resource_missing`
  treated as done.
- **A slot collision with a unit that lands in between.** The part 2 freshness merge
  re-runs the no-shared-schedule test, and the conductor owns the slots.
- **Staging has no erased account 12 months old.** The staging check backdates
  `erased_at` on a throwaway test-mode account. The conductor does this under the staging
  lock.

## Verification

- Part 1: the full gate is green, the mutation checks are recorded, and CI is green.
  Nothing is scheduled, so staging behaviour is unchanged.
- Part 2: CI is green. After deploy, the beat log shows both tasks running at their slots.
  The conductor's staging check (spec, Test plan) shows a backdated throwaway account
  purged locally and at the provider's test mode.
