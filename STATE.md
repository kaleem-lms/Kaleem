---
current_phase: "B — Billing. B1 + B2 built, merged, live on staging, both specs CLOSED 2026-09-04, and the `past_due` → `unpaid` dunning gate is now CLOSED too — a real Stripe renewal failure drives it end to end via the nightly test-clock harness. Phase B is closed."
active_spec: "None."
active_branch: "None. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #146 → master, 2026-09-04 (CI run 33839684695, all green, deploy-staging success). Separately, the `Stripe test clock` nightly is green on master (run 33839689278: 5 passed, 4m01s) — its FIRST run failed on a wrong secret name and #146 fixed it. Staging is current with master."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/) — the June–August log that used
> to live here is archived at
> [`docs/superpowers/journal/session-log-2026-06-to-08.md`](docs/superpowers/journal/session-log-2026-06-to-08.md).
> Keep this file under ~60 lines. If you are adding a fourth section, you are writing a
> journal entry — put it in the journal.

## Where we are

**Phase B (billing) is closed.** Both specs closed 2026-09-04, and the last gate — the
`past_due` → `unpaid` renewal path — is now exercised nightly against real Stripe via test
clocks (`docs/superpowers/specs/2026-09-04-stripe-test-clock-harness-design.md`). It is not
in the merge path by design; a residual gap is tracked in `ISSUES.md` (the harness runs
against the account's `basil` default, not production's `dahlia` pin).

Phase A (identity) is closed via ADR-0024, with one residual human check outstanding.

## ▶ Next actions, in order

1. 🔴 **Rotate the credentials that the first gitleaks run found in git history** — an
   `sk_live_` Stripe key, an AWS access key + secret, the old Django `SECRET_KEY`, Postgres
   and Flower passwords, all committed by the old MVP in `588a1e35` (2026-04-12) and still
   in history on GitHub. This is the only item here that is an active exposure. Details and
   the rotation list are the top entry in `ISSUES.md`.
2. **Choose the next phase and write its spec** (D1) — this is the decision that unblocks
   everything else, and it is a scope call, not a code one. Or the Phase A residual
   identity click-through.
3. Optional small slices, all in `ISSUES.md`: e2e for change-password (needs its own
   throwaway account), `WebhookEvent.stripe_customer_id` (wire it or delete it), the
   `display_amount` validation the B1 spec claims and the code does not have.

## In flight

- **Nothing.** Everything is merged to `master` and deployed; working tree clean.
- ⚠ **A merge to `master` is now a deploy** (ADR-0028 removed the integration branch). The
  coverage and e2e gates are all that stand between a PR and staging.

## Recently verified (2026-09-03 / 04)

- **Two `ISSUES.md` gates closed, each verified by breaking it first** (backend #40,
  marketing #5). `scheduling` now forbids direct `kaleem.identity.models` imports — the
  hole was real, a probe import passed all five contracts before the fix. The marketing
  home page has a `<meta name="description">`; its `interface Props` turned out to enforce
  nothing (marketing has no type-check in CI, now logged), so the guard is a runtime throw
  the build surfaces.

- **The mobile drawer restores focus to the hamburger** (dashboard #33). `AppShell` names
  the destination in `onCloseAutoFocus`, because the drawer opens from shell state and
  Radix has no `Dialog.Trigger` to restore to. `e2e/shell.spec.ts` now *asserts* focus
  restore where it used to explain in a comment why it couldn't. Mutation-checked in a
  real browser — reverting the fix turns that assertion red; the full 20-flow suite passes
  locally against a real stack.

- **Security and performance scanning runs for the first time** (ADR-0030): `gitleaks` and
  `pip-audit` block merges in `ci.yml`'s `security` job; Lighthouse runs nightly against
  staging with ratchet floors in `.lighthouserc.json`. All three were validated locally
  before the PR — gitleaks green with `.gitleaksignore`, `pip-audit` clean on the
  production dependency set, `lhci autorun` green against real staging (3 runs × 2 URLs).
  The first run found live credentials in git history (see next actions), a stray
  `portal-snapshot.md` Playwright dump at the repo root carrying a Stripe test-mode portal
  secret (deleted), and four page-quality findings logged to `ISSUES.md`.

- **The `past_due` → `unpaid` dunning path is exercised nightly against real Stripe**
  (backend #39, meta #145 + #146). Verified three ways: locally twice (5 passed, 2m49s and
  4m19s), in CI on master (5 passed, 4m01s), and **mutation-checked** — breaking
  `_apply_invoice_payment_failed` to write `ACTIVE` turns the harness red. It found three
  real defects: the Stripe account was set to *cancel* rather than *mark unpaid* (so
  `unpaid` was unreachable in production too, leaving that branch of `_is_paid_through` and
  the `unique_live_subscription_per_user` unpaid clause dead); the probe tests leaked a
  Stripe customer per run; and a workflow env var that would have made the nightly
  permanently red. Two limitations are recorded rather than hidden — it runs at the
  account's `basil` default not production's `dahlia` pin (`ISSUES.md`, *Blocks launch*),
  and it seeds the local `Subscription` row so `_apply_checkout_completed` is not exercised.

- **e2e extended past identity, 6 flows → 20** (meta #140); every new flow is a *write*, so
  CSRF on mutations across the ADR-0019 boundary is now covered. Two defects logged, not
  fixed (D10). **Both billing specs closed** (meta #141). Detail in `journal/2026-W36.md`.
- **Billing verified end to end on staging** — subscribe → checkout → portal → cancel, twice;
  kaleem and Stripe agreed exactly. Webhook endpoint pinned to `2026-08-26.dahlia` with
  `DJANGO_STRIPE_API_VERSION` set explicitly — keep it that way in every new environment.
- **Trunk-based flow adopted** (ADR-0028) and **API versioning enforced in CI** (ADR-0029,
  backend #37) — a test walks the resolved URLconf and fails on any unversioned route.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
