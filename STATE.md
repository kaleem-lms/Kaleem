---
current_phase: "B — Billing. B1 + B2 are built, merged, and live on staging (2026-08-17). Not closed: two Stripe-console configs and the human click-through."
active_spec: "docs/superpowers/specs/2026-08-13-billing-hardening-design.md (B2, status: implemented). B1's spec (2026-07-09-billing-subscriptions-design.md) is still status: draft — close both together once the click-through passes."
active_branch: "None. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #138 → master, 2026-09-04 (run 33809825565) — all 7 jobs green including e2e (3m19s, 6 specs), then deploy-staging green. Staging is current with master."
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

1. **Close both billing specs** (B1 `draft`, B2 `implemented`) — a decision, not a task.
   Everything they claim is verified on staging **except** the `past_due` renewal path,
   which needs Stripe **test clocks** rather than a click-through (`ISSUES.md`). Since
   `past_due` keeps full access by design, that is the transition which actually removes
   entitlement. Decide whether it blocks closing the specs or is tracked separately.
2. **Extend e2e past identity** (`ISSUES.md`) — scheduling availability, family/children,
   account+email, the app shell. The harness exists; each area is now a small conversion
   rather than a project. Keep the `CLAUDE.md` D3 table honest as you go.
3. **`past_due` via Stripe test clocks** — the one billing behaviour never exercised, and
   the one that actually removes entitlement. Cannot be clicked; needs a test-clock harness.
4. Then: Phase B's next slice, or the Phase A residual identity click-through.

## In flight

- **Nothing.** Everything is merged to `master` and deployed; working tree clean.
- ⚠ **A merge to `master` is now a deploy** (ADR-0028 removed the integration branch). The
  coverage and e2e gates are all that stand between a PR and staging.

## Recently verified (2026-09-03 / 04)

- **Billing verified end to end on staging** — subscribe → checkout → portal → cancel, twice
  (before and after the renewal-date fix); kaleem and Stripe agreed exactly each time.
  Declined card writes nothing; eligibility 403 enforced; webhook endpoint rotated to a
  pinned `2026-08-26.dahlia` with `DJANGO_STRIPE_API_VERSION` set explicitly. Detail in
  `journal/2026-W36.md`.
- **Trunk-based flow adopted** (ADR-0028): `develop` deleted after a final promotion, every
  repo now `feat/… → PR → trunk`. Closed two `ISSUES.md` entries that each said "needs an
  ADR". **API versioning is now enforced in CI** (ADR-0029, backend #37) — a test walks the
  resolved URLconf and fails on any route outside `/api/v<n>/` or a closed allowlist.
- **The e2e harness exists and blocks CI** (ADR-0027) — 6 identity flows, green in CI in
  2m6s, `deploy-staging` now depends on it. Scoped to identity and `CLAUDE.md` D3 says so
  in a table; billing is excluded by design (the hosted Stripe redirect cannot run in
  Playwright). Mutation-checked locally, not merely run.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
