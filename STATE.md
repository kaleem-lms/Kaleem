---
current_phase: "B — Billing. B1 + B2 built, merged, live on staging, both specs CLOSED 2026-09-04, and the `past_due` → `unpaid` dunning gate is now CLOSED too — a real Stripe renewal failure drives it end to end via the nightly test-clock harness. Phase B is closed."
active_spec: "None."
active_branch: "None. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #141 → master, 2026-09-04 (run 33818840835) — all 7 jobs green, deploy-staging success. Staging is current with master. (#140 before it: e2e 2m40s, 20 specs.)"
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

1. **Wire `pip-audit` + `gitleaks` into CI, and Lighthouse against staging** — the oldest
   un-run gate in the project and the top `blocks launch` entry. Same shape as the coverage
   and e2e gates before ADR-0026/0027: documented, never executed.
2. **Drawer focus restore** (`ISSUES.md`) — small, self-contained WCAG 2.4.3 fix; a good
   slice if the appetite is for shipping rather than specs.
3. Then: the next phase's spec, or the Phase A residual identity click-through.

## In flight

- **Nothing.** Everything is merged to `master` and deployed; working tree clean.
- ⚠ **A merge to `master` is now a deploy** (ADR-0028 removed the integration branch). The
  coverage and e2e gates are all that stand between a PR and staging.

## Recently verified (2026-09-03 / 04)

- **e2e extended past identity, 6 flows → 20** (spec `2026-09-04-e2e-beyond-identity`,
  backend #38 + dashboard #32 + meta #140). Every new flow is a *write*, so the suite now
  exercises CSRF on a mutation across the ADR-0019 subdomain boundary — the original six
  were reads plus one login. Two defects found and logged rather than fixed (D10): the
  mobile drawer does not restore focus on close, and two "Add child" buttons share an
  accessible name.
- **Both billing specs closed** (meta #141). B1 was `draft` for eight weeks while its
  contents shipped and were amended; closing it surfaced that it stated `past_due ⇒ not
  entitled` in four places, which B2's R8 had reversed. Struck through, not deleted.
- **Billing verified end to end on staging** — subscribe → checkout → portal → cancel, twice
  (before and after the renewal-date fix); kaleem and Stripe agreed exactly each time.
  Declined card writes nothing; eligibility 403 enforced; webhook endpoint rotated to a
  pinned `2026-08-26.dahlia` with `DJANGO_STRIPE_API_VERSION` set explicitly. Detail in
  `journal/2026-W36.md`.
- **Trunk-based flow adopted** (ADR-0028): `develop` deleted after a final promotion, every
  repo now `feat/… → PR → trunk`. Closed two `ISSUES.md` entries that each said "needs an
  ADR". **API versioning is now enforced in CI** (ADR-0029, backend #37) — a test walks the
  resolved URLconf and fails on any route outside `/api/v<n>/` or a closed allowlist.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
