---
current_phase: "C — Scheduling. **C5 and C6 SHIPPED to staging 2026-09-12** in the two-deploy order the relay requires (meta#201 backend pointer → relay live → meta#202 dashboard pointer). C4 closed 2026-09-11 except its manual phone pass, which C5 supersedes. C0–C3e closed 2026-09-07. Phase B (billing) CLOSED 2026-09-04. Phase A closed via ADR-0024. Roadmap's Phase B happy path still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "**`2026-09-12-design-system-v2-design.md`** — ADR-0040 (palette + EN 301 549), ADR-0041 (DTCG tokens). Plan: `plans/2026-09-12-design-system-v2.md`. **Phases 0–5 done: the v2 palette is DEPLOYED.** tokens v0.2.1 tagged, dashboard and marketing re-pinned, override block deleted, `/design-preview` built, three verification gaps closed. **Phase 7 — the component consolidation — is NOT started, and it is the part the original request actually asked for** (no Dialog primitive: 14 files hand-roll Radix; 4 selects at 3 heights; 5 re-implemented Cards; focus ring copy-pasted 12x). C5/C6 remain deployed; each still owes the manual pass on a real phone."
active_branch: "`fix/infra-ship-hardening` in meta (infra pointer + docs). Design-system v2 merged and DEPLOYED 2026-09-12: tokens#4/#5 (v0.2.0, v0.2.1), dashboard#50/#51, marketing#6/#7, infra#11, meta#204/#205/#206/#207. Dashboard `feat/focus-ring` (phase 7 P1) is STASHED mid-migration, not committed. Three Dependabot PRs still open in meta."
last_green_ci: "meta#207 -> master 2026-09-12: gates skipped (verified-tree from the PR run), deploy-staging SUCCEEDED on the image build after the Dockerfile `insteadOf` fix, then DIED at ship.sh step 9 on a full disk AFTER tearing down the old colour. Host remediated by hand (73G/0-free -> 7.5G/65G-free; `.active-color` restored to `green`). **Staging is UP and serving the v2 palette on both surfaces** — verified in the deployed CSS (`--background:#fbf5eb`, `--input:#938d83`, `--overlay:#191c1b8c`). ship.sh hardened in infra#11; that fix is NOT on the box until this meta pointer bump deploys. Previous: meta#202 (the C5+C6 dashboard pointer bump) → master, 2026-09-12. PR run 34695702515: all seven gates PASS including e2e with C5 and C6 together for the first time. Master run 34696063499: triage skipped every gate (the tree was already proven by the PR run — ADR-0038 working), deploy-staging SUCCESS. `app-staging.kaleem.academy` and `ws-staging.kaleem.academy/health/live/` both 200 after."
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

1. **The manual pass on a real phone.** The one thing nothing here can do. C5 came from
   an iOS photo and C6's last four defects came from someone using the result; both still
   rest on checks a harness cannot make: that the OS camera indicator really goes out,
   that audio is audible, that a shared screen is legible, and anything at all on Safari
   or iOS. Staging is live and carrying both.
2. **Fix the CI concurrency group before the next busy merge day** (`ISSUES.md`).
   `ci.yml`'s group is `${{ github.head_ref || github.run_id }}`; on a push `head_ref` is
   empty, so every master run gets a unique group and two `deploy-staging` jobs can
   overlap on the same host. This nearly bit on 2026-09-12 and was avoided by cancelling
   a run by hand.
3. **Design-system v2 — phase 7: the component consolidation.** Phases 0–5 are done
   and the v2 palette is live. What remains is the part the original request was
   actually about: there is **no `Dialog` primitive at all** (14 files hand-roll Radix
   across two recipes), 4 `<select>` implementations at 3 heights, 5 re-implemented
   `Card` surfaces, 4 hand-rolled skeletons, and one focus-ring recipe copy-pasted into
   12 files. Order and rationale in the plan (P1 focusRing first, P8 `CallControlButton`
   last and deliberately NOT a merge into `Button`). Also still owed from phase 5: the
   staging walk and the Lighthouse re-measure — if a11y now scores above 0.95, **raise
   the floor** (ADR-0026 ratchet).
4. **Then choose the next phase with the user.** `assessment` closes the roadmap's happy
   path — a delivered lesson still leaves no trace — and `notifications` is the other
   candidate. Preview mode has still never run, so priorities remain provisional. Do not
   pick unilaterally. (Design-system v2 was chosen by the user, not picked here.)
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
