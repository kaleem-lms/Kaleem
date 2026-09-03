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

1. **Do the two Stripe-console configurations** — runbook
   [`docs/runbook/stripe-billing.md`](docs/runbook/stripe-billing.md) §3 and §3b.
   **This is the critical path and has been open since 2026-08-17.** Both are ~20 minutes
   of clicking, neither is checkable by CI, and **both fail silently**:
   - §3 — the webhook endpoint must subscribe to **eight** event types, not five. Without
     `checkout.session.async_payment_succeeded`, anyone paying by SEPA/ACH/boleto is
     charged and never gets access.
   - §3b — the customer portal must be configured. Misconfigured, the "Manage billing"
     button opens a page that cannot change plan.

   *Nothing else about billing on staging can be trusted until these are done.* Do not
   start new feature work in front of this.
2. **Manual staging click-through** (runbook §5): subscribe → cancel → portal → failed-card
   recovery, with test card `4242 4242 4242 4242`.
3. **Close both billing specs** (B1 `draft`, B2 `implemented`) once that passes.
4. Then: Phase B's next slice, **or** the Phase A residual (`ISSUES.md` → "Blocks phase
   close"), **or** the Playwright harness slice.

## In flight

- **Coverage gates (this session, 2026-09-03).** D3 was aspirational in all three repos —
  the dashboard had no coverage tooling installed at all and CI never ran its tests.
  Replaced with an enforced ratchet floor: **ADR-0026**, backend PR #33 (`fail_under = 97`),
  dashboard PR #29 (thresholds 92/87/84), both merged to `main`. This meta branch bumps the
  pointers, wires `pnpm lint` + `pnpm test:coverage` into `ci.yml`, and rewrites D3/D9 in
  `CLAUDE.md` to say what is actually enforced. **The meta PR's CI run is the real
  verification** — submodule repos have no CI of their own.
- **OQ-B2-3 open** (does not block): when the reconciler finds a genuine double
  subscription, is auto-cancel-plus-refund acceptable, or does every case stay manual?
  Manual by design today; the incident queue exists to make that tolerable.
