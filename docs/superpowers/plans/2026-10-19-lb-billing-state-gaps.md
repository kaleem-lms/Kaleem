---
spec: docs/superpowers/specs/2026-10-19-lb-billing-state-gaps-design.md
status: approved
---

Worktrees: `backend-lb-billing-state-gaps` and `dashboard-lb-billing-state-gaps` on
`feat/lb-billing-state-gaps`, per runbook section 1. Every step is TDD: write the named
test, see it red, write the code, see it green. Each regression test is mutation-checked:
revert the fix, see it red, restore the fix.

## Steps

### Backend (`kaleem/billing`, `kaleem/identity`)

1. [ ] **Paid-through is current.**
   - Tests first, in `billing/tests/test_live_invariant.py`:
     - `test_a_paid_through_cancellation_is_current`.
     - `test_an_expired_cancellation_is_not_current`.
     - `test_a_live_row_wins_over_a_paid_through_one`.
     - `test_a_paid_through_cancellation_blocks_a_second_checkout`. It asserts
       `fake_provider.checkout_requests == []`.
     - `test_an_expired_cancellation_allows_re_subscribing`.
   - In `billing/tests/test_api.py`: `test_my_subscription_reports_a_paid_through_row_as_current`.
   - Code: `get_current_subscription` returns `_live_subscription_for_user_id(...) or
     _paid_through_subscription_for_user_id(...)`. `create_checkout` already uses it.
   - The existing `TERMINAL` re-subscribe tests use `current_period_end=None` and must
     stay green unchanged.
2. [ ] **Cancel only touches a live row.**
   - Test first: `test_cancel_with_only_a_paid_through_row_is_not_found`, which also
     asserts that the provider was not called.
   - Code: `cancel_subscription` uses `_live_subscription_for_user_id`.
3. [ ] **Resume.**
   - Tests first, in a new `billing/tests/test_services_resume.py`:
     - Happy path: the local and upstream flag is cleared, and `current_period_end` is
       refreshed.
     - No live row: `NotFoundError`.
     - Not flagged: `ValidationError`.
     - `unpaid`/`incomplete`: `ValidationError`.
     - Provider raises `ExternalServiceError`: the row is unchanged.
   - In `test_api.py`: the view returns 200 with the serialised subscription, and is 403
     when unauthenticated.
   - In `test_stripe_provider.py`: `resume` calls `Subscription.modify(...,
     cancel_at_period_end=False, idempotency_key=...)`.
   - Code:
     - `PaymentProvider.resume`, `StripeProvider.resume` and `FakePaymentProvider.resume`
       (+ `resumed`, `raise_on_resume`, and reset).
     - `services.resume_subscription`.
     - `ResumeSubscriptionView`.
     - The `me/subscription/resume/` URL.
4. [ ] **Distinct idempotency keys per intent.**
   - Tests first, in `test_stripe_provider.py`: a cancel → resume → cancel sequence
     produces three distinct keys, and a repeated cancel with the same `updated_at`
     reuses one key.
   - Code: `cancel_at_period_end(subscription_id, *, intent_at)` and
     `resume(subscription_id, *, intent_at)`. The key is
     `f"cancel:{id}:{intent_at.timestamp()}"`. Services pass the row's `updated_at`.
   - Update the fake's signature to match. The existing cancel tests keep passing.
5. [ ] **`/me.is_linked_child`.**
   - Tests first, in `identity/tests/test_api_auth.py`: true for a linked student; false
     for an unlinked student, a parent, a teacher and a profile-less staff user.
   - Code: `_me_payload` adds `"is_linked_child": bool(services.get_parent_user_ids(user.id))`.
6. [ ] **Price drift.**
   - Tests first, in a new `billing/tests/test_price_drift.py`, one each:
     - Amount mismatch.
     - Currency mismatch.
     - Archived price (`active=False`).
     - Missing price (`None`).
     - Agreement records nothing.
     - A provider error on plan A still checks plan B.
     - A repeat run bumps `occurrences`.
     - An inactive plan is skipped.
     - Severity is WARNING.
   - In `test_reconciliation.py`: `test_the_tasks_delegate_to_the_services` asserts that
     both services are called.
   - Code:
     - `ProviderPrice` and `get_price` (Stripe: `stripe.Price.retrieve`, where
       `resource_missing` maps to `None`), plus the fake's `prices_by_id` and
       `raise_on_get_price`.
     - `BillingIncident.Kind.PRICE_DRIFT` and its `INCIDENT_SEVERITY` entry.
     - `services.detect_price_drift`.
     - `tasks.reconcile_subscriptions` calls both services.
   - **Migration:** `makemigrations billing`, a choices-only `AlterField`. Name it
     `0007_billingincident_price_drift` unless the conductor allocates another number.
     `makemigrations --check` must then be clean.
7. [ ] **Never adopt dashboard-created subscriptions.**
   - Tests first, in `test_reconciliation.py`:
     - `test_an_upstream_subscription_without_kaleem_metadata_is_not_adopted`. It asserts
       no row is created and an `UNKNOWN_SUBSCRIPTION` incident with `source=reconcile`.
     - `test_metadata_naming_another_user_is_not_adopted`.
     - `test_a_subscription_we_never_recorded_at_all_is_created` gains
       `metadata_user_id=customer.user_id`.
   - In `test_stripe_provider.py`: `metadata_user_id` is parsed from
     `subscription.metadata`, and absent or non-numeric metadata gives `None`.
   - Code:
     - `ProviderSubscription.metadata_user_id`, defaulting to `None`. Every existing
       constructor in tests and the fake still works.
     - `_to_provider_subscription` parses it.
     - The `subscription is None` branch of `_reconcile_one` refuses when
       `upstream.metadata_user_id != customer.user_id`.
8. [ ] **e2e seeds.**
   - Tests first:
     - `identity/tests/test_seed_e2e.py` asserts the three new accounts, the
       `billingchild` → `pastdue` link, and the updated count.
     - A new `billing/tests/test_seed_e2e_billing.py` asserts:
       - The states: `paidthrough` is `canceled` with a future period end, and `pastdue`
         is a `past_due` family plan.
       - `billingchild` has no subscription of its own.
       - Re-running converges on the same state.
       - The seed refuses to run with `DEBUG=False`.
     - `platform/tests/test_seed_e2e_all.py` already validates the manifest.
   - Code:
     - `seed_e2e` gains `PAID_THROUGH_EMAIL`, `PAST_DUE_EMAIL` and `BILLING_CHILD_EMAIL`,
       plus the link.
     - `grant_dev_subscription` gains keyword-only `plan_type`, `status` and
       `current_period_end`. The defaults keep today's behaviour, and the family plan
       gets its own real-shaped dev price id.
     - A new `billing/management/commands/seed_e2e_billing.py`.
     - Append `seed_e2e_billing` to `config/e2e_seeds.txt`.
9. [ ] **Server strings.**
   - Checkout reuses "You already have an active subscription.", and resume's 404 reuses
     the existing `pgettext_lazy("error resource", "Subscription")`.
   - The one new string is resume's `ValidationError` ("Your subscription is not set to
     cancel."). Add its `ar` entry to `billing/locale/ar/LC_MESSAGES/django.po` and
     compile it the way the module already does. It joins the `hg-arabic-review` batch.

### Dashboard (`src/features/billing`, `src/features/shell`, `src/features/identity`)

10. [ ] **`billingNavVisible`.**
    - Test first, in `features/billing/nav.test.ts`, with the six cases from the spec's
      test plan.
    - Code: a pure function in `features/billing/nav.ts`, exported from the index.
11. [ ] **Resume.**
    - Tests first:
      - `api.test.ts`: `resumeSubscription` POSTs `billing/me/subscription/resume/`.
      - `SubscriptionCard.test.tsx`: the cancel-flagged row shows Resume and calls the
        mutation, the pending state disables it, an error shows `billing.resumeError`,
        and an unflagged row has no Resume.
    - Code: `billingApi.resumeSubscription`, the `useResumeSubscription` mutation (which
      invalidates `mySubscriptionQueryKey`), and the card.
12. [ ] **Paid-through card.**
    - Test first, in `SubscriptionCard.test.tsx`: a `canceled` current row shows
      `billing.activeUntil` and `billing.paidThroughHint`, with no Cancel and no Resume.
    - Code: the card.
13. [ ] **Linked-child page.**
    - Test first, in `routes/_authed/billing.test.tsx`: with `is_linked_child: true` and
      `current: null`, the page shows `billing.managedByParent` and no Subscribe. With a
      current row, it shows the card.
    - Code: `BillingPage`. Add `is_linked_child?: boolean` to `Me`.
14. [ ] **`DunningBanner` + shell.**
    - Tests first:
      - `DunningBanner.test.tsx`: it renders for `past_due` and `unpaid`, and not for
        `active`, `canceled`, `null` or an error. It is a labelled region, and the
        button opens the portal mutation.
      - `AppShell.test.tsx`:
        - The banner is absent on `/billing`.
        - The Billing nav is hidden for a linked child with no subscription and shown
          for a parent.
        - A teacher-only user triggers no `billing/me/subscription/` request.
    - Code:
      - `useMySubscription({ enabled })`.
      - The `DunningBanner` component.
      - `AppShell` wiring, which reads the path with `useRouterState`.
15. [ ] **Copy.** Add the six new keys to `locales/en/common.json` and
    `locales/ar/common.json`. Arabic is a draft for `hg-arabic-review`. The parity and
    terminology tests must pass.
16. [ ] **e2e.**
    - New `e2e/billing-state.spec.ts` with the three flows from the spec. It runs at
      1280 px and one 360 px case for the drawer. The parent and child flows include an
      RTL check that the banner and notice sit inside the viewport (no sideways scroll).
    - Add `e2e/accounts/billing.ts` with the three emails, which must match the seed
      constants.
    - Add `{ path: "/billing", as: "paidThrough" }` to `e2e/routes/billing.ts` only if the
      route-sweep harness supports per-account entries. Otherwise leave it.

### Close-out (meta, conductor)

17. [ ] `docs/architecture/billing.md`: paid-through, resume, the drift check and the
    adoption rule.
18. [ ] `ISSUES.md`: strike these entries and note the fix:
    - The canceled-but-paid-through entry.
    - The `/billing` nav entry.
    - "Dunning UX beyond mirroring past_due".
    - The `display_amount` Stripe cross-check.
    - The dashboard-created-subscriptions decision.
19. [ ] The CLAUDE.md D3 table gets a `billing` — state row (3 flows). The Stripe
    redirect exclusion stays.

## Gates

- TDD loop: `_tools/backend-gate.sh <wt> kaleem/billing/tests/<file>` and
  `_tools/dashboard-gate.sh <wt> src/<file>.test.tsx`.
- Before hand-back, the full `backend-gate.sh <wt>` must pass all of: `migrate`,
  `makemigrations --check`, `pytest --cov`, ruff, format and `lint-imports`. The full
  `dashboard-gate.sh <wt>` must pass tsc, lint, `test:coverage`, build and the
  built-colours check.
- `gitleaks-range.sh <wt> origin/main..HEAD` must report CLEAN in both repos.
- The runbook section 3 floor-grep must be empty. Floors are never edited
  (dec-floor-ownership).
- e2e is optional locally (port slot). CI is the authority.
- The conductor runs a **green `stripe-clock` dispatch on the meta branch before merge**,
  and the merge waits for `inf-stripe-clock-harness-red` (`merge_after`).

## Risks

- **`ProviderSubscription` constructor churn.** Adding a field could break the many
  test constructors. The new field defaults to `None`, so the only intended behaviour
  change is in the reconciler's create branch.
- **Real Stripe metadata shape.** The adoption rule depends on kaleem's checkout
  metadata reaching the subscription (`subscription_data.metadata`, already set). If a
  lost-completion subscription somehow lacked it, the reconciler would refuse it, and the
  customer would be paid but unrecorded. Mitigations: the refusal is an incident (not
  silent), `settle_checkout_session` still records it on redirect, and the stripe-clock
  harness's subscriptions carry the same metadata. Check on the next staging checkout
  that a reconciled row still appears.
- **Idempotency-key change.** If `updated_at` failed to move between intents, a re-cancel
  would replay. Both services save the row (`updated_at` is `auto_now`), and step 4's
  test pins it.
- **Shared files.**
  - `billing/services.py` is shared with `ntf-billing-notifications`, which merges after
    this unit.
  - `identity/.../seed_e2e.py` and `config/e2e_seeds.txt` are appended by several units.
    Freshness merges keep both lines.
  - `AppShell.tsx`/`nav.ts` may conflict with shell units. The conductor's freshness step
    resolves these.
- **Migration number.** Billing has no other in-flight migration known. The conductor
  renumbers at freshness if one appears.
- **Extra request in the shell.** Students and parents now fetch `me/subscription` on
  every authed page. It is cached by React Query, and `/billing` already uses the same
  key. Teachers and staff do not fetch it.
- **Fallback.** If owner answers differ (price drift "No", or adopt dashboard-created
  subscriptions), drop step 6 or step 7. Each is independent of the others.

## Verification

- Each step: its named tests are red first and green after, with the mutation check
  recorded in the hand-back block.
- Whole unit: both full gates green, CI green including the three new e2e flows (read
  the e2e log for `billing-state.spec.ts`), and a green `stripe-clock` dispatch.
- Staging (protocol step 11): an agent click-through in both themes, in Arabic RTL and
  at 320 px, covering the paid-through card, resume, the banner and a linked child's nav.
  Creating `past_due` and immediate-cancel states on staging needs Stripe test-mode
  access. That is an owner-access step, which the conductor schedules; this unit cannot
  do it.
- Spec closure waits on `hg-arabic-review` for the six new keys. Merging does not.
