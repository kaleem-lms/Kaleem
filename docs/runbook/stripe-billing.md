# Stripe billing runbook

Operational steps for the `billing` module (`docs/architecture/billing.md`). Stripe
**test mode** only — no live keys exist yet (go-live is a separate launch task).

## 1. Stripe test-mode Price setup

1. In the Stripe dashboard (test mode), create two recurring Prices, monthly billing
   period:
   - **Individual** — one adult student, 4 sessions/month.
   - **Family** — one parent, 4 sessions/child/month.
2. Copy each Price's id (`price_…`).
3. In Django admin, create the matching `SubscriptionPlan` rows with the **same**
   amount/currency as the Stripe Price:
   - `plan_type`: `individual` or `family`.
   - `sessions_per_cycle`: 4 (or whatever the product spec currently says).
   - `stripe_price_id`: the `price_…` id copied above.
   - `display_amount`: the Price's amount in minor units (e.g. cents).
   - `currency`: the Price's currency, lowercase ISO-4217 (Stripe convention).
   - `is_active`: true.

Plan/Price creation is manual — there is no programmatic sync in B1 (see `ISSUES.md`).
Keep `display_amount`/`currency` in lockstep with the Stripe Price by hand; a mismatch
only affects what the pricing page *shows*, not what Stripe actually charges.

## 2. Environment variables

| Var | Where | Notes |
| --- | --- | --- |
| `DJANGO_STRIPE_SECRET_KEY` | local `.env`, staging `.env.production` | Stripe **test** secret key (`sk_test_…`). Never commit. |
| `DJANGO_STRIPE_WEBHOOK_SECRET` | local `.env`, staging `.env.production` | The signing secret for the registered webhook endpoint (`whsec_…`). Never commit. |
| `DJANGO_STRIPE_API_VERSION` | optional, anywhere | Overrides the pinned Stripe API version. Leave unset: the default is read off the installed `stripe` SDK's own outbound pin, so it moves with the dependency. Only set it to deliberately hold an older version. |

Both secrets default to `""` in `config/settings/base.py` (local/dev convenience) but are
**required** (`env(...)`, no default) in `config/settings/production.py` — a missing
value fails startup rather than silently accepting unsigned webhooks.

> **Migrating an older `.env`.** These variables were renamed to carry the `DJANGO_`
> prefix used by every other setting in this project. An `.env.production` still holding
> the un-prefixed `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` will fail startup with
> `ImproperlyConfigured: Set the DJANGO_STRIPE_SECRET_KEY environment variable` — that is
> the rename, not a lost secret. Rename the keys in place (values unchanged) and restart.

On the staging VPS these live in `.env.production`, managed directly on the box — same
as `DJANGO_FRONTEND_URL`. CI does not sync or know about them; update them over SSH and
restart the stack if either value changes.

## 3. Register the webhook endpoint

In the Stripe dashboard (test mode), add a webhook endpoint:

```text
https://api-staging.kaleem.academy/api/v1/billing/webhook/
```

Subscribe it to exactly these five event types (this is the full set `handle_webhook`
understands — anything else is logged and acked with no effect):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Pin the endpoint's API version.** Before registering, check the account's current
default API version (Stripe dashboard → Developers → API versions / Overview). Then set
this endpoint's version explicitly to the value the backend pins — print it with:

```bash
python -c "import stripe; print(stripe.api_version)"
```

(or whatever `DJANGO_STRIPE_API_VERSION` is set to, if you have overridden it). An
endpoint registered with *no* version inherits the account default, and Stripe changes
that default over time. Payload shapes are versioned: `2025-03-31.basil`, for example,
moved a subscription's `current_period_end` onto `items.data[].current_period_end` and an
invoice's `subscription` to `parent.subscription_details.subscription`. The parser
tolerates both shapes, but pinning is what makes the payload predictable rather than a
function of Stripe's release calendar. When you upgrade the `stripe` dependency, re-check
this endpoint's version against the new SDK pin.

Copy the endpoint's signing secret into `DJANGO_STRIPE_WEBHOOK_SECRET` on staging.

## 4. Local development

Use the Stripe CLI to forward events to your local backend:

```bash
stripe listen --forward-to http://api.kaleem.localhost/api/v1/billing/webhook/
```

`stripe listen` prints a `whsec_…` signing secret for this session — put it in your
local `.env` as `DJANGO_STRIPE_WEBHOOK_SECRET`, and restart the backend so it picks up
the new value. Trigger test events (e.g. `stripe trigger checkout.session.completed`) or
drive the flow through the real `/billing` UI with a test card.

## 5. Manual staging test (D9)

The hosted-Stripe redirect can't run in Playwright (`ISSUES.md`), so this is the
required manual verification before calling B1 done:

1. Log in as a parent (or an adult student not linked as a child) on staging.
2. Go to `/billing`. Click **Subscribe** on a plan.
3. On Stripe's hosted checkout, pay with test card `4242 4242 4242 4242`, any future
   expiry date, any CVC, any postal code.
4. Confirm — Stripe redirects back to `/billing?checkout=success`. The page shows a
   "finishing up…" state while it polls `GET me/subscription/`.
5. Once the webhook lands, the page flips to the active subscription card (status,
   renewal date).
6. Click **Cancel** → confirm in the dialog. The card should now read
   "cancels on `{period_end}`".
7. In the Stripe dashboard, open the subscription and verify `cancel_at_period_end` is
   set to `true`.

If step 4 times out, refresh — the fallback message tells the user webhook delivery may
take a moment; check `stripe listen` (local) or the endpoint's delivery log (staging) for
a failed delivery before assuming a bug.

## 6. Incident: duplicate live subscription

**Symptom.** A `CRITICAL` log line:

```text
billing.webhook.duplicate_live_subscription reason=… user_id=… existing_subscription=sub_… incoming_subscription=sub_… event_id=…
```

**What it means.** Stripe reported a second live subscription for a user who already has
one — most often the user opened checkout in two tabs and completed both. `reason` says
which defence caught it: `pre_write_check` (the service read the existing row first) or
`db_constraint` (the read lost a race and the
`unique_live_subscription_per_user` constraint caught the insert).

**What kaleem did.** Nothing beyond refusing to record the second subscription. It did
**not** cancel or refund anything in Stripe, and it acked the webhook 200 on purpose (a
non-2xx would make Stripe retry a request that can never succeed, for three days). The
customer's account still shows exactly one subscription.

**What you must do.** The customer is very likely being billed twice by Stripe right now,
and only Stripe knows it. This needs a human — which subscription to void and whether to
refund is a money decision the webhook handler must not make silently.

1. Open the Stripe dashboard → Customers → the user (`user_id` in the log line maps to
   `BillingCustomer.user`; the customer id is on that row, read-only in Django admin).
2. Confirm both `existing_subscription` and `incoming_subscription` are live in Stripe.
3. Decide which to keep — normally the one kaleem has recorded (`existing_subscription`),
   so the app and Stripe agree without any local edit.
4. Cancel the other **immediately** (not at period end) in Stripe, and refund the charge
   it has already taken if the customer paid for it.
5. If you instead keep `incoming_subscription`, you must also fix the local row: cancel
   `existing_subscription` in Stripe, then update the `Subscription` row in Django admin
   to the surviving `stripe_subscription_id`. Do this only if there is a reason to; the
   simple path is step 3.
6. Note the incident in the journal. Repeat occurrences mean the frontend is letting
   users open two checkouts, which is a bug to fix there, not here.

Related: the `unique_live_subscription_per_user` constraint is added by migration
`billing/0003`. If that migration ever fails to apply, it is because a user already has
two live rows — reconcile them in Stripe (above) and fix the rows before deploying.
