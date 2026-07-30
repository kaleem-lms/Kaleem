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

Both default to `""` in `config/settings/base.py` (local/dev convenience) but are
**required** (`env(...)`, no default) in `config/settings/production.py` — a missing
value fails startup rather than silently accepting unsigned webhooks.

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
