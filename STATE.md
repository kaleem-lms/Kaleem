---
current_phase: "C — Scheduling. C0 (matching inputs) SHIPPED 2026-09-05; C1 (matching) SHIPPED 2026-09-05. C2 (booking + quota) is IN REVIEW 2026-09-05 (backend#43, dashboard#36, meta PR open). Phase B (billing) is CLOSED as of 2026-09-04, dunning gate included. Phase C is decomposed into four specs — C0 matching inputs, C1 matching, C2 booking + quota, C3 video adapter — because matching, booking and video are three subsystems and the dependency order between them is strict. Note the roadmap calls scheduling 'B2'; that label is already taken by a closed billing spec, so scheduling is Phase C here."
active_spec: "docs/superpowers/specs/2026-09-05-phase-c2-booking-quota-design.md — C2. Spec + plan merged; all 15 plan tasks implemented and reviewed; three PRs open awaiting merge."
active_branch: "feat/phase-c2-booking-quota in backend, dashboard and meta. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #157 → master, 2026-09-05 (all 8 checks green, deploy-staging SUCCESS — not skipped). Staging is current with master at 76a8553; both new scheduling routes answer 403 rather than 404 there, so they are really deployed. The `Stripe test clock` nightly was last green on 2026-09-04 (run 33839689278: 5 passed, 4m01s)."
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

1. **Merge C2.** Three PRs in order: backend#43, dashboard#36, then the meta PR. ⚠ The meta merge
   IS a staging deploy.
2. **Click through C2 on staging** once deployed, and make a teacher there — still the outstanding
   manual gap from C0 and C1.
3. **Then C3 — the video adapter** (D1: no spec yet). C2's `Session` is the row a room attaches to.
4. From `ISSUES.md`, read the new C2 block's **Blocks launch** entry before touching billing: the
   quota cycle is keyed by an exact `current_period_end`, and a mid-cycle rewrite would hand out a
   second allowance.

## In flight

- **C2 (booking + quota), in review.** Both submodule branches pushed and green locally; three PRs
  open. Nothing merged yet.
- ⚠ **A merge to `master` is a deploy** (ADR-0028).

## Recently verified (2026-09-03 → 05)

- **Phase C2 (booking + quota) implemented, reviewed, awaiting merge** (backend#43, dashboard#36).
  Weekly slots, a daily idempotent generator bounded by `sessions_per_cycle`, and cancellation with
  a 24-hour refund rule. Backend 710 at 97.58% (floor 97.2 → 97.3); dashboard 512 at
  93.5/90.27/86.68/93.5 (floors → 93/89.5/86/93); **e2e 27 → 30**, mutation-checked. Full account:
  `journal/2026-W36.md`.

- ⚠ **C2 fixed a shipped C1 bug: account deletion was broken in production.** Deleting any matched
  student raised `ProtectedError` — `TeacherAssignment.source_request` was `PROTECT`, and Django's
  collector evaluates `PROTECT` per cascade branch without noticing the protecting row is itself
  being deleted. Both that field and the new `Session.slot` are now `RESTRICT`. **The GDPR erasure
  work under "Blocks launch" would have hit this wall.**


- **Phase C1 (matching) SHIPPED** (backend#42, dashboard#35, meta#157, ADR-0033). Backend 608 passed at 97.29% (floor 97 → 97.2); dashboard 427 at
  92.79/88.99/85.35/92.79 (floors → 92.5/88.5/85/92.5); **e2e 24 → 27**, mutation-checked;
  `lint-imports` 10 kept / 0 broken with both new contracts verified by breaking them.
  Verified in a real browser in English and Arabic. Full account: `journal/2026-W36.md`.

  ⚠ **`precision = 1` is load-bearing in `pyproject.toml`.** coverage.py rounds the total to
  `precision` decimals before comparing it to `fail_under`, so a fractional floor with the
  default precision of 0 compares 97.28% as `97` and fails. The floor raise alone would have
  turned CI red. Do not drop that line when next raising the floor.

- **The leaked credentials are ROTATED** (2026-09-05) — the `sk_live_` Stripe key, the AWS
  access key and secret, the Django `SECRET_KEY`, and the Postgres and Flower passwords from
  `588a1e35`. This was the only active exposure on the list and it is closed.

  Their `.gitleaksignore` fingerprints **stay**, and that is a deliberate reversal:
  ADR-0030 said to delete a line once rotated, but rotation makes a credential *dead*, not
  *absent* — the strings are still in history, so deleting the lines would make gitleaks
  report them again and turn CI permanently red. **ADR-0032** amends that clause; the file
  is a rotation record now.

- **Phase C0 shipped** (backend #41, dashboard #34, ADR-0031). A new `curriculum` module
  owns `Subject` plus the teacher/student links; `TeacherProfile.gender` closes a gap open
  since Phase A, where students could state a `teacher_gender_preference` that no teacher
  could satisfy. Backend 534 passed at 97.39% with `curriculum` at 100%; dashboard 391
  passed; e2e 20 → 24. Both new import-linter contracts were written before any code and
  the boundary one was verified by breaking it. Two plan defects were found by executing
  it — see the journal.

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
  The first run found live credentials in git history — **rotated 2026-09-05**, see the
  entry below — a stray
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
- ⚠ **C0's staging click-through is partial, and this is the reason.** Verified live:
  the routes are deployed, the data migration ran (`GET /api/v1/curriculum/subjects/`
  returns Quran/Tafsir/Arabic), role gating holds (the teacher endpoint 403s a parent),
  and a parent sees neither subject panel. **Not** verified live: the teacher and
  student panels rendering and saving. Staging has no teacher account, and a child
  created to get a student profile cannot log in because its email is unverified and
  CI/staging have no mail-catcher (`ISSUES.md`). Both panels are covered by unit tests
  and by 4 e2e flows against a real stack, so this is a gap in *manual* D9 coverage
  only — close it by making a teacher on staging via Django admin.

- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
