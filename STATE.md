---
current_phase: "C — Scheduling. **C5 (call fixes found on a real phone) code-complete 2026-09-12**, in three PRs sequenced by a deploy constraint: backend#51 (the `media-state` relay) must deploy BEFORE dashboard#47, and #48 is stacked on #47. C4 closed 2026-09-11 except its manual phone pass, which C5 supersedes. C0–C3e closed 2026-09-07. Phase B (billing) CLOSED 2026-09-04. Phase A closed via ADR-0024. Roadmap's Phase B happy path still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "`docs/superpowers/specs/2026-09-12-call-fixes-design.md` (C5) — status in-progress, three PRs open and unmerged. Plan: `docs/superpowers/plans/2026-09-12-call-fixes.md`."
active_branch: "Three open, merge in THIS order: backend `feat/media-state-relay` (#51) → deploy → dashboard `feat/call-fixes-behaviour` (#47) → dashboard `feat/call-controls-redesign` (#48). Meta `docs/c5-call-fixes-spec` (#198) carries the spec, plan and runbook."
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

1. **Merge C5 in order, and do not collapse the steps.** `signaling/app.py` closes the
   socket on a message type it does not recognise, so a dashboard bundle that ships ahead
   of the relay drops the lesson it is in, the first time anyone toggles a camera.
   backend#51 merges → meta pointer bump → `deploy-staging` → **confirm the new relay is
   live** → then dashboard#47, then #48. `docs/runbook/signaling.md` has the rule in its
   own section now.
2. **The manual pass, on the iPhone C5 came from.** Portrait and landscape, light and
   dark, English and Arabic. Specifically unprovable by any harness here: that the OS
   camera indicator really goes out when the camera is switched off, that a shared screen
   is legible, and that audio is audible. Fake media proves plumbing only.
3. **Decide whether the Safari/iOS deviation can close.** The capture that started C5 is
   from an iOS device. W36 records a standing D9 deviation that nothing in C3e or C4 is
   verifiable on Safari or iOS because no Apple device exists in this project, and
   C3e-a's `CallDiagnostic` codes have had no real reporter for that reason. If that
   device is available for testing, that changes. It is the user's call.
4. **Then choose the next phase with the user.** `assessment` closes the roadmap's happy
   path — a delivered lesson still leaves no trace — and `notifications` is the other
   candidate. Preview mode has still never run, so priorities remain provisional. Do not
   pick unilaterally.
5. A coturn config-only change does not restart the running relay — close before it bites
   again (`ISSUES.md`).
6. **Blocks launch:** the quota cycle is keyed by an exact `current_period_end`; a
   mid-cycle rewrite would hand out a second allowance.
7. **Someday:** force the artifact-miss path once a code change merges >7 days after
   going green (`ISSUES.md`).

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
