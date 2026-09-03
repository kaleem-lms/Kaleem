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

1. **Quieten the `unknown_subscription` incident** (`ISSUES.md`): it fires on **every**
   checkout — 4 of 4 measured — and is pure noise since the period-end fix, which devalues a
   queue whose point is that `critical` means money is wrong.
2. **Fix the 403 checkout copy** (`ISSUES.md`): an eligibility rejection renders "Please try
   again", advice that can never work.
3. **Close both billing specs** (B1 `draft`, B2 `implemented`). Everything they claim is now
   verified on staging except the `past_due` renewal path, which needs Stripe test clocks
   (`ISSUES.md`) rather than a click-through.
4. Then: Phase B's next slice, the Phase A residual, or the Playwright harness slice.

## In flight

- Nothing on a branch. `develop` and `master` are level; staging is running the current code.

## Recently verified (2026-09-03)

- **Billing click-through PASSED twice on staging, before and after a fix.** Subscribe →
  hosted checkout → subscription card → portal (both plans switchable) → cancel. kaleem and
  Stripe agreed exactly afterwards. Webhooks are flowing again (first since 2026-08-13); the
  stale `webhook_silence` critical incident is resolved.
- **The renewal-date race is fixed and the fix is verified in production conditions.**
  Backend #34, spec `2026-09-03-billing-period-end-race-design.md`. On the post-deploy
  re-test the race *reproduced exactly* — `invoice.paid` arrived first at 16:08:25.348 and
  was dropped — and the card still showed "Renews on October 3, 2026" immediately, because
  the backfill now supplies it.
- **Declined card verified:** `4000 0000 0000 0341` → 0 subscriptions, not entitled, no
  incidents. Stripe confirms the first payment inline, so a bad card writes nothing at all.
- **Webhook endpoint rotated to a pinned API version.** Old basil endpoint deleted; new
  `we_1UBdRwCavwnriKDQ2ygx6z2V` created at `2026-08-26.dahlia`, with
  `DJANGO_STRIPE_API_VERSION` now set explicitly on the VPS so a `pip` upgrade cannot move
  it. Verified by a live subscription afterwards: events delivered, signature verified
  against the new secret, renewal date rendered immediately.
- **Eligibility enforcement verified:** a parent clicking Individual gets a server-side 403
  and no subscription. (The *copy* shown is wrong — see Next actions.)
- **D3 coverage gates are live** (backend 97, dashboard 92/87/84; ADR-0026) and meta CI now
  runs on `develop` PRs. The floor already earned itself: the first pass at #34 dropped the
  repo to 96.96% and CI went red.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
