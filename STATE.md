---
current_phase: "B — Billing. B1 + B2 are built, merged, and live on staging (2026-08-17). Not closed: two Stripe-console configs and the human click-through."
active_spec: "docs/superpowers/specs/2026-08-13-billing-hardening-design.md (B2, status: implemented). B1's spec (2026-07-09-billing-subscriptions-design.md) is still status: draft — close both together once the click-through passes."
active_branch: "meta docs/state-issues-gates (this work). Submodule mains: backend fa68c0a, dashboard f23d18d — both AHEAD of the pointers recorded on develop; this branch bumps them."
last_green_ci: "meta develop→master #126, 2026-08-17 (run 32009357958). deploy-staging succeeded in 3m10s. First green CI for any Phase B code."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/) — the June–August log that used
> to live here is archived at
> [`docs/superpowers/journal/session-log-2026-06-to-08.md`](docs/superpowers/journal/session-log-2026-06-to-08.md).
> Keep this file under ~60 lines. If you are adding a fourth section, you are writing a
> journal entry — put it in the journal.

## Where we are

**Phase B (billing) is on staging and works.** B1 (subscriptions) and B2 (hardening — 13
audit findings) are merged and deployed. Verified over HTTP on `api-staging`: the two new
B2 endpoints return 403 rather than 404 (proving new code is serving, not a stale image),
and the webhook returns 400 on an unsigned body (signature verification is live).

Phase A (identity) is closed via ADR-0024, with one residual human check outstanding.

## ▶ Next actions, in order

1. **Decide what to do about the missing renewal date** (`ISSUES.md` → "Blocks a phase
   close", first entry). Found by the 2026-09-03 click-through: `invoice.paid` can arrive
   *before* `checkout.session.completed`, and it is the only event carrying the period end,
   so a fresh subscription shows "Active" with no renewal date until the nightly reconciler
   runs. Needs a D1 slice, not a drive-by fix (D10).
2. **Optional remaining click-through leg: failed-card recovery** (card
   `4000 0000 0000 0341`) — proves `past_due` mirroring and that the portal is a real way out.
   Not yet run; needs a user without a live subscription.
3. **Close both billing specs** (B1 `draft`, B2 `implemented`). Everything they claim is now
   verified on staging except the failed-card leg.
4. Then: Phase B's next slice, the Phase A residual, or the Playwright harness slice.

## In flight

- Nothing on a branch. `develop` is 5 ahead of `master`; a `develop → master` promotion would
  deploy the coverage-gate + docs work (test config and docs only — no runtime change).

## Recently verified (2026-09-03)

- **Billing click-through PASSED on staging.** Subscribe → hosted checkout (`4242…`) →
  subscription card → portal → cancel. kaleem and Stripe agree exactly afterwards: `active`,
  `cancel_at_period_end=True`, period end `2026-10-03 04:18:39` on both sides. Idempotency
  held — the webhook and the `settle:` path both ran and produced one row. **Webhooks are
  being delivered again** (first since 2026-08-13; the `webhook_silence` critical incident,
  `occurrences=80`, is now stale and can be resolved in Django admin).
- **Stripe console configs verified against the API, not the console UI.** All 8 event types
  subscribed; portal offers both plans (Individual €20 / Family €35), cancel-at-period-end,
  card update, invoice history. Note: `billing_portal.Configuration` reports
  `subscription_update.products = null` at every API version even when switching demonstrably
  works — do not trust that field, test the portal.
- **One defect found**, logged in `ISSUES.md`: the missing renewal date (see Next actions).
- Test account on staging: `billing.clickthrough@example.com` (user id 7, verified parent).
  Throwaway — clear it with the other smoke-test users on the next staging DB reset.
- **D3 coverage gates are live and enforced** in CI (backend 97, dashboard 92/87/84;
  ADR-0026), and meta CI now runs on `develop` PRs rather than only at promotion time.
