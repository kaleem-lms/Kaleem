---
name: lb-billing-state-gaps
phase: v1 (wave 1, billing stream)
modules: [billing, identity]
status: approved
created: 2026-10-19
closed: null
---

## Goal

Close five billing gaps that `ISSUES.md` lists as open:

1. **Paid-through reads as "no subscription".** A subscription that is `canceled` but
   still inside its paid period is entitled (`_is_paid_through`). But
   `get_current_subscription` only looks at `LIVE_STATUSES`, so it returns `None`. The
   page then shows the plan list, and `create_checkout` lets the customer buy a second,
   overlapping subscription. The fix follows **lb-dec-paid-through: "Active until, block
   checkout, resume"**.
2. **A linked child sees Billing.** The `/billing` nav entry shows for every student. A
   linked child who opens it gets a typed 403 at checkout. The entry should be hidden
   instead.
3. **There is no dunning notice outside `/billing`.** A `past_due` or `unpaid` payer is
   only told on the billing page. Under **dec-dunning: "kaleem only"**, kaleem's own
   in-app notice is the dunning channel, and nothing relies on Stripe's failed-payment
   emails.
4. **Price drift goes unnoticed.** `SubscriptionPlan.display_amount`/`currency` mirror
   the Stripe Price for display. If someone edits the Price in Stripe, the displayed price
   and the charged price differ, and nothing notices until the first
   `AMOUNT_MISMATCH` charge. This follows **lb-dec-price-drift** (open; the recommended
   answer is "Yes").
5. **The reconciler adopts dashboard-created subscriptions.** `_reconcile_one` creates a
   local row for *any* upstream subscription of a known customer, including one an
   operator made in the Stripe dashboard. That row grants entitlement no kaleem checkout
   sold. This follows **lb-dec-dashboard-created-subs** (open; the recommended answer is
   "Never").

Items 4 and 5 follow the owner's answers of 2026-10-19 (see Open questions, now resolved).

## User flow

**Paid-through (a payer whose subscription was cancelled immediately, e.g. in the portal,
but whose paid period has not ended):**
1. `/billing` shows the current-plan card with **"Active until {date}"** and the line
   "Your subscription won't renew. You can choose a plan again after {date}." It shows no
   plan list and no Cancel button.
2. `POST checkout/` is refused with the existing "You already have an active
   subscription." (400). This holds even from a stale tab.
3. After `current_period_end` passes, the row stops being current and the plan list
   returns. Entitlement is unchanged: it already ends at the same instant.

**Resume (a live subscription flagged `cancel_at_period_end`):**
1. The card shows "Cancels on {date}" (existing copy) and a **Resume subscription** button.
2. Pressing it calls `POST me/subscription/resume/`. The provider clears
   `cancel_at_period_end`, the card goes back to "Renews on {date}", and the Cancel button
   returns.
3. If the call fails, a destructive alert shows `billing.resumeError` and the state is
   unchanged.
4. A `canceled` row cannot be resumed: the provider cannot revive a cancelled
   subscription. For that state, "resume" means the plan list comes back at period end
   (above).

**Linked child:**
1. A student with a parent link (`/me.is_linked_child`) has no Billing nav entry, unless
   they hold their own current subscription. That edge case comes from a subscription
   made before the link existed, and they must still be able to manage or cancel it.
2. Opening `/billing` directly shows that subscription's card if they have one.
   Otherwise it shows "Your parent or guardian manages billing for your account." in
   place of the plan list.

**Dunning banner:**
1. A payer whose own current subscription is `past_due` or `unpaid` sees a destructive
   banner at the top of every authenticated page except `/billing`, which already shows
   the same alert in its card. The banner reuses `billing.recoveryPastDue` /
   `billing.recoveryUnpaid` and the existing **Update payment method** portal button.
2. A child covered by a parent's family plan does not see the parent's banner, because
   only the payer can fix it.

**Price drift (operator-facing, no UI):** in the nightly run, every active plan whose
Stripe Price disagrees on amount or currency, is archived, or is missing records one open
`price_drift` incident.

**Dashboard-created subscription (operator-facing):** the reconciler meets an upstream
subscription with no local row. If that subscription does not carry kaleem's own checkout
metadata naming this customer's user, no row is created and an
`unknown_subscription` incident is recorded with `source=reconcile`. A lost kaleem
checkout completion still carries that metadata, so it is still recovered as today.

## Data model delta

- `BillingIncident.Kind` gains `PRICE_DRIFT = "price_drift"`, with severity WARNING.
  `AMOUNT_MISMATCH` stays the CRITICAL signal at the first real charge. This is a
  choices-only `AlterField`, migration `billing/0007_*` (number per the conductor). It
  runs no SQL on Postgres.
- No other model change. "Paid-through" is derived from existing columns.

Provider seam (`billing/providers`), not models:
- `ProviderSubscription` gains `metadata_user_id: int | None`, parsed from
  `subscription.metadata["user_id"]`.
- New `ProviderPrice(price_id, unit_amount, currency, active)` and
  `PaymentProvider.get_price(price_id) -> ProviderPrice | None`.
- New `PaymentProvider.resume(subscription_id) -> datetime | None`, which modifies with
  `cancel_at_period_end=False`.
- The cancel and resume idempotency keys include the local row's `updated_at`. A double
  click still collapses into one call. A cancel → resume → cancel within 24 h issues
  three distinct requests instead of replaying the first cancel's cached response.

## API delta

| Endpoint | Change |
| --- | --- |
| `GET /api/v1/identity/me/` | Adds `is_linked_child: bool` for every user. It is true when `get_parent_user_ids(user.id)` is non-empty. |
| `GET /api/v1/billing/me/subscription/` | `current` is now the live row, or failing that the paid-through `canceled` row. The shape is unchanged. |
| `POST /api/v1/billing/checkout/` | Also refused (400) while a paid-through row exists. |
| `POST /api/v1/billing/me/subscription/resume/` | **New.** 200 with the subscription. 404 when there is no live row. 400 when the live row is not flagged to cancel, or its status is not `active`/`past_due`. |
| `POST /api/v1/billing/me/subscription/cancel/` | Now resolves only a *live* row. A paid-through `canceled` row is 404, as it effectively was before. |

All routes stay under `config.api_router`. No new unversioned path.

## Frontend

- **Routes:** `/billing`, shown to parents, to students who are not linked children, and
  to linked children who hold their own current subscription. No new route.
- **`features/shell`:** `AppShell` filters the billing nav entry with
  `billingNavVisible(me, current)`. It renders `<DunningBanner>` above `children` when the
  path is not `/billing`. For a user with no parent or student profile, the shell makes
  no subscription request.
- **`features/billing`:**
  - `useMySubscription` takes an `enabled` option.
  - New `useResumeSubscription` mutation.
  - New `billingApi.resumeSubscription`.
  - `SubscriptionCard` gains the `canceled` (paid-through) and resume states.
  - New `DunningBanner` component.
  - New `billingNavVisible` helper.
- **`features/identity`:** `Me.is_linked_child?: boolean`. If the field is absent the
  user counts as not linked, which is safe because the server's 403 is the control.
- **`BillingPage`:** a linked child with no current subscription gets the notice instead
  of `PlanList`.
- **States:**
  - Loading: the banner renders nothing until the query settles, and the nav hides
    Billing for a linked child while the query is pending.
  - Error: the banner renders nothing. `/billing` keeps its existing error alert.
  - Resume: pending disables the button, and an error shows the alert.
- **New copy (en + ar, `hg-arabic-review`):** `billing.activeUntil`,
  `billing.paidThroughHint`, `billing.resume`, `billing.resumeError`,
  `billing.managedByParent`, `billing.dunningBannerLabel` (the banner's accessible region
  name).
- **One new server string:** resume's "Your subscription is not set to cancel."
  (`billing/locale/ar`), also for `hg-arabic-review`.
- **Tokens:** only existing `Alert`/`Button` variants. No new colours. RTL is logical
  properties only.

## Module boundaries

- **billing** owns everything except the `/me` field. It already calls
  `identity.services.get_parent_user_ids`.
- **identity** adds `is_linked_child` to `_me_payload` from its own `services`. It does
  not import billing.
- No new import-linter contract, no new events, no new Celery task name and no beat
  change. The drift check runs inside the existing nightly `reconcile_subscriptions`
  task: the task calls `services.reconcile_subscriptions()` and then
  `services.detect_price_drift()`.

## Personal data (ADR-0023)

- `is_linked_child`: derived and never stored, and returned only to the user it
  describes. Its purpose is to choose navigation.
- `price_drift` incidents name a plan and a price, never a user.
- The reconcile-refusal incident stores the customer's `user_id` and Stripe customer id,
  the same fields and retention as today's `unknown_subscription` incidents. Only staff
  read them, in the admin.
- No new personal-data field, so the billing `personal_data.py` export is unchanged.

## Expand/contract (blue-green window)

- Every change is additive: a choices-only migration, a new endpoint, and a new optional
  `/me` field. The old dashboard bundle ignores `is_linked_child`.
- In the old bundle, a paid-through `current` renders as "Canceled" with a Cancel button
  whose call now 404s into the existing error alert. This is acceptable for one window,
  and no money moves.
- No task names change. The beat schedule is untouched.

## Out of scope

- Reviving a `canceled` subscription, or a checkout that defers its first charge to the
  old period end. Both are a money behaviour; a later unit takes them on only if the
  owner wants them.
- Email or in-app *notifications* for payment failure (`ntf-billing-notifications`, which
  depends on this unit).
- Turning off Stripe's own customer emails (`hg-stripe-customer-emails`, owner access).
- A child seeing or acting on the parent's family plan.
- Programmatic plan/price sync. Drift is only flagged.
- A stale checkout session (opened before an immediate cancel) completing inside the
  paid-through window. Checkout sessions expire in 24 h, and the existing
  duplicate-subscription incident covers live overlaps.

## Test plan

Backend (pytest, `FakePaymentProvider`):
- `get_current_subscription` returns the paid-through `canceled` row. It returns `None`
  once `current_period_end` has passed. It prefers a live row over a paid-through one.
- `create_checkout` raises `ValidationError` for a paid-through user. The fake provider
  records no checkout request.
- `GET me/subscription/` serialises the paid-through row as `current`.
- `cancel_subscription` with only a paid-through row raises `NotFoundError`, and the
  provider is not called.
- `resume_subscription` covers these cases:
  - Happy path: the flag is cleared locally and upstream.
  - No live row: 404.
  - Live row not flagged: 400.
  - `unpaid` row: 400.
  - Provider failure: the row is unchanged.
  - The API view is wired and requires authentication.
- Idempotency keys: cancel → resume → cancel yields three distinct keys, and two
  identical cancels with no save in between share one key.
- `/me` `is_linked_child` is true for a linked student, and false for an unlinked
  student, a parent and a teacher.
- `detect_price_drift` covers these cases:
  - An amount mismatch produces one incident.
  - So does a currency mismatch, an archived price, and a missing price.
  - When everything agrees, no incident is recorded.
  - A provider error on one plan does not stop the others.
  - A repeat run increments `occurrences` and does not add a row.
  - Inactive plans are skipped.
- The reconciler covers these cases:
  - An upstream subscription without metadata is not created, and an incident is
    recorded.
  - Metadata naming a different user is treated the same way.
  - Metadata naming this customer's user is created, as today.
  - The existing `test_a_subscription_we_never_recorded_at_all_is_created` is updated to
    carry metadata.
- The task wrapper calls both services.
- The existing `stripe_clock` harness stays green. It asserts `is_entitled_to` only,
  which is unchanged.

Dashboard (vitest + RTL):
- `billingNavVisible` returns these results:
  - Parent: true.
  - Unlinked student: true.
  - Linked child with no current subscription: false.
  - Linked child holding a current subscription: true.
  - Teacher only: false.
  - Linked child while the query is pending: false.
- `DunningBanner` renders for `past_due` and `unpaid`. It is absent for `active`,
  `canceled` and `null`, absent on `/billing`, absent on error, and absent with no
  subscription query (teacher).
- `SubscriptionCard` covers these states:
  - Paid-through: "Active until", the hint, no Cancel and no Resume.
  - Cancel-flagged live row: Resume shown, it calls the mutation, and an error shows
    the alert.
  - Unflagged: no Resume.
- `BillingPage` shows the linked-child notice without `PlanList`.
- Locale parity and terminology tests pass with the new keys.

e2e (Playwright, new `e2e/billing-state.spec.ts`, budget ≤ 20 s, read-only, no Stripe
redirect). The seeds are new: `seed_e2e` adds three accounts, and a DEBUG-guarded
`seed_e2e_billing` gives them their billing state. `e2e.booked@` cannot serve as the
child, because it holds its own dev subscription, so it is exactly the edge case that
keeps Billing visible.
1. A linked child (new `e2e.billingchild@`, child of `e2e.pastdue@`, with no subscription
   of its own) has no Billing entry in the sidebar or the mobile drawer. `/billing` shows
   the guardian notice. The parent's dunning banner is absent.
2. A paid-through student (new `e2e.paidthrough@`, individual plan, `canceled`, period
   end in 10 days) sees "Active until" on `/billing` and no Subscribe button.
3. A `past_due` parent (new `e2e.pastdue@`, family plan) sees the dunning banner on Home
   with an **Update payment method** button. The button is not clicked, because the
   hosted portal cannot run in CI.

None of the three accounts has a subject interest or availability, so the global
matching sync never opens a request for them (`config/e2e_seeds.txt` rule 2).

The e2e does not cover resume, which calls Stripe (unit and API tests only), the price
drift check (no UI) or the reconciler.

## Open questions

All resolved by the owner on 2026-10-19, when the spec was approved.

- **lb-dec-price-drift: Yes.** Price drift is flagged nightly as a WARNING incident, inside
  the existing `reconcile_subscriptions` task (plan step 6 stays).
- **lb-dec-dashboard-created-subs: Never.** The reconciler does not adopt subscriptions
  created in the Stripe dashboard, enforced by checkout metadata (plan step 7 stays).
- **"Resume" in lb-dec-paid-through: confirmed** as an in-app undo of a period-end
  cancellation only. An immediately-cancelled subscription shows "Active until {date}" and
  blocks checkout until then.
- **Scope confirmed:** the app-wide dunning banner and Billing hidden for linked children.
- **Dashboard bundle budget (owner decision 2026-10-19):** the bundle budget is 580 KB and
  nearly full, so copy is split into per-feature lazily loaded text catalogues
  (`FEATURE_CATALOGUES` in `src/lib/i18n.ts` plus a route loader). The banner is not
  route-gated, so its copy stays minimal in the common catalogue. Copy used only on
  `/billing` moves to a lazily loaded `billing` catalogue if the budget check fails.
- **Server strings:** every new error message goes through gettext with an Arabic catalog
  entry, and every error carries `error_code`.
