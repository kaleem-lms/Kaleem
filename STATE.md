---
current_phase: "C — Scheduling. C4 (call experience redesign) CODE-COMPLETE 2026-09-11 — C4a the capability, C4b the UI, both on the submodule trunks. Only the D9 manual phone pass remains. Previously CLOSED 2026-09-07: C0-C3e (matching, booking+quota, video) all shipped and live. Phase B (billing) CLOSED 2026-09-04. Phase A (identity) closed via ADR-0024, one residual human check outstanding. Roadmap's Phase B happy path is still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "`docs/superpowers/specs/2026-09-11-call-experience-redesign-design.md` — C4a and C4b both shipped. ADR-0039 ACCEPTED and amended after measurement (the answerer adopts the offer's lines; it cannot pre-create its own). No spec is open."
active_branch: "chore/c4b-pointer — the C4b pointer bump, open. Everything else is merged: dashboard#43/#44/#45/#46, backend#50, meta #191-#195."
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

**CI cost optimization shipped; its justification was rewritten twice and is now settled
against the real invoice** (ADR-0038, PR #190). The mechanism works and was verified on the
real merge (`last_green_ci`): `triage` skips the seven gate jobs on docs-only changes and on a
push whose exact tree a PR already proved. It was justified by a modelled ~$64/month Actions
bill. The real invoice — readable all along via
`/organizations/kaleem-lms/settings/billing/usage`, the replacement for the `410`'d endpoint
the spec gave up on — says **2,098 minutes and $0.00 net in Sept 2026, and $0.00 in every
month on record**; the model was ~5× high. A first correction (09-08) blamed "the repo is
public, runners are free" — also wrong: it *was* public then, is private now, and neither is
why the bill was zero. ADR-0038's Correction section carries the full account. The real
benefit is wall-clock and signal, plus keeping a now-private repo inside its 2,000-min
allowance, which Sept's usage sits exactly on.

**Also not exercised on a real push:** the artifact-miss direction — see `docs/runbook/ci.md`.

## ▶ Next actions, in order

1. **The D9 manual pass for C4, on a real phone.** Portrait and landscape, light and dark,
   English and Arabic. Everything else in C4's Definition of Done is met; this is the only
   step no harness here can do. ⚠ Nothing in C4 is verified on Safari or iOS — no Apple
   device exists in this project, a standing deviation (see `journal/2026-W36.md`).
2. **Then choose the next phase with the user.** `assessment` closes the roadmap's happy path
   — a delivered lesson still leaves no trace — and `notifications` is the other candidate.
   Preview mode has still never run, so priorities remain provisional. Do not pick unilaterally.
3. Watch C3e-a's `CallDiagnostic` codes for real Safari/iOS traffic — the only verification
   loop that phase has (`journal/2026-W36.md`). C4 added `screenshare-failed` and
   `line-mismatch`; the second fires only when two peers' media lines disagree, which is the
   mismatched-bundle deploy window ADR-0039 names and nothing exercises.
4. A coturn config-only change does not restart the running relay — close before it bites
   again (`ISSUES.md`).
5. **Blocks launch:** the quota cycle is keyed by an exact `current_period_end`; a mid-cycle
   rewrite would hand out a second allowance.
6. **Someday:** force the artifact-miss path once a code change merges >7 days after going
   green (`ISSUES.md`).

## Standing warnings

- ⚠ **A merge to `master` is a deploy** (ADR-0028).
- ⚠ **Deploy between lessons.** A deploy still drops every call in progress — the drain is
  unbuilt (`ISSUES.md`, "Blocks launch").
- ⚠ C3d staging fixture passwords (`c3d.student@`/`c3d.teacher@`, `KaleemC3d!2026`) proved
  unstable once for no found reason — reset rather than assume a regression if refused again.
- ⚠ Dependabot PRs #182/#183/#184 now report green with nothing tested (ADR-0038 consequence);
  #183 (`upload-artifact` 4→7) is a real upgrade `ci.yml` should take deliberately, not merge
  on the tick.
- ⚠ **The repo was PUBLIC until the owner made it private (between 2026-09-08 and 09-11).**
  Live staging passwords were world-readable in `STATE.md` on `master` during that window and
  are still in git history. Anonymous access 404s as of 2026-09-11, so the window is closed,
  but anyone who cloned while it was open still has them. **Rotate them** — `ISSUES.md` →
  *Blocks launch*.
- ⚠ ADR-0038 made the `security` job (gitleaks) skip on docs-only changes, and root `*.md`
  counts as docs — the exact shape of this project's one previous leak (`portal-snapshot.md`).

## Recently verified

- **CI cost optimization (ADR-0038)** — mechanism verified on the real merge; justification
  corrected against the real invoice 2026-09-11. Full account `journal/2026-W37.md`.
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
