---
current_phase: "B — Billing. B1 + B2 are built, merged, and live on staging (2026-08-17). Not closed: two Stripe-console configs and the human click-through."
active_spec: "docs/superpowers/specs/2026-08-13-billing-hardening-design.md (B2, status: implemented). B1's spec (2026-07-09-billing-subscriptions-design.md) is still status: draft — close both together once the click-through passes."
active_branch: "None. develop is 5 ahead of master (the e2e harness + the two fixes); staging runs the previous promotion."
last_green_ci: "meta #135 on develop, 2026-09-03 (run 33805080649) — all 7 jobs green including the NEW e2e job (2m6s, 6 specs). Last deploy: #131 → master, deploy-staging green."
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

1. **Promote `develop → master`** to put the e2e harness and the two fixes on staging.
   Nothing here changes runtime behaviour beyond the two small fixes, both verified.
2. **Close both billing specs** (B1 `draft`, B2 `implemented`) — a decision, not a task.
   Everything they claim is verified on staging **except** the `past_due` renewal path,
   which needs Stripe **test clocks** rather than a click-through (`ISSUES.md`). Since
   `past_due` keeps full access by design, that is the transition which actually removes
   entitlement. Decide whether it blocks closing the specs or is tracked separately.
3. **Extend e2e past identity** (`ISSUES.md`) — scheduling availability, family/children,
   account+email, the app shell. The harness exists; each area is now a small conversion
   rather than a project. Keep the `CLAUDE.md` D3 table honest as you go.
4. Then: Phase B's next slice, or the Phase A residual identity click-through.

## In flight

- Nothing on a branch. `develop` is **5 ahead of `master`** — the e2e harness and the two
  small fixes are merged to develop but not yet deployed (see Next actions #1).

## Recently verified (2026-09-03)

- **Billing verified end to end on staging.** Subscribe → hosted checkout → subscription
  card → portal (both plans switchable) → cancel, twice: before and after the renewal-date
  fix. kaleem and Stripe agreed exactly each time. Webhooks flowing again; the stale
  `webhook_silence` critical incident resolved. Declined card writes nothing. Eligibility
  403 enforced. Webhook endpoint rotated to a pinned `2026-08-26.dahlia` with
  `DJANGO_STRIPE_API_VERSION` set explicitly, so a `pip` upgrade cannot move it.
  Detail in `journal/2026-W36.md`.
- **D3 coverage gates are live** (backend 97, dashboard 92/87/84; ADR-0026) and meta CI now
  runs on `develop` PRs. The floor already earned itself: the first pass at #34 dropped the
  repo to 96.96% and CI went red.
- **The e2e harness exists and blocks CI** (ADR-0027) — 6 identity flows, green in CI in
  2m6s, `deploy-staging` now depends on it. Scoped to identity and `CLAUDE.md` D3 says so
  in a table; billing is excluded by design (the hosted Stripe redirect cannot run in
  Playwright). Mutation-checked locally, not merely run.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
