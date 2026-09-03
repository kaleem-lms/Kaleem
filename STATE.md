---
current_phase: "B — Billing. B1 + B2 built, merged, live on staging, and both specs CLOSED 2026-09-04. The phase itself is not closed: the `past_due` renewal path still needs a Stripe test-clock harness."
active_spec: "None. Pick the next slice. The open Phase-B gate is the `past_due` test-clock harness (`ISSUES.md`, blocks a phase close); it has no spec yet."
active_branch: "None. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #140 → master, 2026-09-04 (run 33817184626) — all 7 jobs green including e2e (2m40s, 20 specs), then deploy-staging green. Staging is current with master."
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

1. ~~**Close both billing specs**~~ — **done 2026-09-04.** Both now `implemented` /
   `closed`. The decision taken, and recorded in B2's closure note: **closing a spec
   asserts its scope was built and verified; it does not assert the phase is done.** The
   test-clock gap stays a `blocks a phase close` entry rather than holding a spec in
   `draft` — which is how B1 sat unclosed for eight weeks while its contents shipped and
   were then amended by B2. B1's `past_due ⇒ not entitled` lines are struck through, not
   deleted, so the mid-phase reversal stays visible.
2. ~~**Extend e2e past identity**~~ — **done 2026-09-04.** 6 flows → 20: availability,
   family, account+email, and the app shell (backend #38, dashboard #32). What is still
   uncovered and why is in the `CLAUDE.md` D3 table and `ISSUES.md`.
3. **`past_due` via Stripe test clocks** — now the top open item, and the only thing
   between here and a Phase B close. Never exercised, and the transition that actually
   removes entitlement. Cannot be clicked; needs a test-clock harness. **No spec yet — it
   needs one (D1).**
4. Then: Phase B's next slice, or the Phase A residual identity click-through.

## In flight

- **Nothing.** Everything is merged to `master` and deployed; working tree clean.
- ⚠ **A merge to `master` is now a deploy** (ADR-0028 removed the integration branch). The
  coverage and e2e gates are all that stand between a PR and staging.

## Recently verified (2026-09-03 / 04)

- **e2e extended past identity** (spec `2026-09-04-e2e-beyond-identity-design.md`). Every
  new flow is a *write*, so the suite now exercises CSRF on a mutation across the ADR-0019
  subdomain boundary — the six original flows were reads plus one login. Run locally
  20/20 against a real Django on `api.kaleem.localhost:8000` and a real production build
  on `app.kaleem.localhost:4173`. Two defects found and logged rather than fixed (D10): the
  mobile drawer does not restore focus on close, and two "Add child" buttons share an
  accessible name.

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
