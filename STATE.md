---
current_phase: "C — Scheduling. CLOSED 2026-09-07: C0-C3e (matching, booking+quota, video) all shipped and live. Phase B (billing) CLOSED 2026-09-04. Phase A (identity) closed via ADR-0024, one residual human check outstanding. Roadmap's Phase B happy path is still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "none — next phase not yet chosen. Session UI redesign SHIPPED and visually verified on staging 2026-09-08 (ADR-0036). Shared signaling (ADR-0037) SHIPPED and verified live on staging 2026-09-07 — signaling is now one shared service, not per deploy colour."
active_branch: "docs/ci-cost-optimization-close (this session, docs-only). Every code repo is on its trunk otherwise. TRUNK-BASED (ADR-0028) — a merge to meta `master` IS a deploy."
last_green_ci: "meta 480b78b (PR #190, ADR-0038 CI cost change) → master, 2026-09-08. Run 34206968953: triage code=true verified=true, all 7 gates SKIPPED (guard matched the PR's proven tree), deploy-staging SUCCESS, staging confirmed live after. See `docs/runbook/ci.md`."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/). Keep this file under ~60 lines.
> If you are adding a fourth section, you are writing a journal entry — put it in the journal.

## Where we are

Phase C (scheduling) is closed. A parent can pay, be matched to a teacher, book a recurring
slot, and hold a real video call relayed through our own coturn. Phase B (billing) is closed,
dunning gate included. What is **not** closed: the roadmap's Phase B happy path
(`assessment`/`analytics` don't exist — a delivered lesson leaves no trace), and preview mode
has never run, which the roadmap makes non-optional before the next phase's priorities are
final.

**CI cost optimization shipped** (ADR-0038, PR #190). `triage` skips the seven gate jobs on
docs-only changes and on a push whose exact tree a PR run already proved. Verified on the
real merge (see `last_green_ci`): 4 billed minutes vs. an 18-minute baseline. Modelled saving
~54% (~10,040 → ~4,650 min/month; dollars are modelled, not read off an invoice — the billing
API needs `admin:org`, which this project's token lacks). **Not yet exercised on a real
push:** the artifact-miss direction, and any Dependabot push/PR — see `docs/runbook/ci.md` and
`journal/2026-W37.md`.

## ▶ Next actions, in order

1. **Choose the next phase with the user.** Candidates: `assessment` (closes the roadmap's
   happy path) or `notifications`. Preview mode has not run, so priorities are provisional —
   do not pick unilaterally.
2. Watch C3e-a's `CallDiagnostic` codes for real Safari/iOS traffic — the only verification
   loop that phase has (`journal/2026-W36.md`).
3. A coturn config-only change does not restart the running relay — close before it bites
   again (`ISSUES.md`).
4. **Blocks launch:** the quota cycle is keyed by an exact `current_period_end`; a mid-cycle
   rewrite would hand out a second allowance.
5. **Someday:** confirm the CI cost model against one real month's Actions invoice; force the
   artifact-miss path once a code change merges >7 days after going green (`ISSUES.md`).

## Standing warnings

- ⚠ **A merge to `master` is a deploy** (ADR-0028).
- ⚠ **Deploy between lessons.** A deploy still drops every call in progress — the drain is
  unbuilt (`ISSUES.md`, "Blocks launch").
- ⚠ C3d staging fixture passwords (`c3d.student@`/`c3d.teacher@`, `KaleemC3d!2026`) proved
  unstable once for no found reason — reset rather than assume a regression if refused again.
- ⚠ Dependabot PRs #182/#183/#184 now report green with nothing tested (ADR-0038 consequence);
  #183 (`upload-artifact` 4→7) is a real upgrade `ci.yml` should take deliberately, not merge
  on the tick.

## Recently verified

- **CI cost optimization (ADR-0038)** — see "Where we are" above; full account
  `journal/2026-W37.md`.
- **Session UI redesign** verified on staging 2026-09-08: desktop grid, measured reflow, RTL
  mirroring, Lobby gesture gate, no false diagnostics. Two cosmetic findings logged, not fixed.
- **Shared signaling (ADR-0037)** verified live 2026-09-07: a room created before a colour
  flip stayed joinable; mutation-checked (the old colour's host now 404s).
- **Phase C (C0–C3e)** shipped and verified live 2026-09-05→07: matching, booking+quota, video
  rooms, signaling, TURN, the call client, diagnostics, and browser hardening. No Safari/iOS
  device exists in this project — every browser-hardening D9 click-through is a stated
  deviation, compensated by watching `CallDiagnostic` codes in production. Full account:
  `journal/2026-W36.md`.
- **Phase B (billing)** closed 2026-09-04, `past_due`→`unpaid` dunning verified nightly against
  real Stripe test clocks. Leaked credentials from `588a1e35` rotated 2026-09-05;
  `.gitleaksignore` fingerprints stay by design (ADR-0032).
