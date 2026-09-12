---
current_phase: "C — Scheduling. **C5 and C6 SHIPPED to staging 2026-09-12** in the two-deploy order the relay requires (meta#201 backend pointer → relay live → meta#202 dashboard pointer). C4 closed 2026-09-11 except its manual phone pass, which C5 supersedes. C0–C3e closed 2026-09-07. Phase B (billing) CLOSED 2026-09-04. Phase A closed via ADR-0024. Roadmap's Phase B happy path still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "**`2026-09-12-design-system-v2-design.md`** — replace the palette outright, own it in `@kaleem/tokens`, close the dashboard's component duplication, and repair three pieces of verification that are documented but do not work (a contrast test mirroring 26 hex literals, a `tokens` repo with no CI at all, and a `/design-preview` route that does not exist). ADR-0040 (palette + EN 301 549) and ADR-0041 (DTCG tokens). Plan: `plans/2026-09-12-design-system-v2.md`. **Phases 0 and 1 done — still no code in any submodule.** Next is phase 2 (`tokens` repo). C5/C6 remain merged and deployed; what remains of each is the manual pass on a real phone, which no harness here can do."
active_branch: "`feat/design-system-v2-palette` in **meta** (docs only). Everything else merged 2026-09-12: backend#51, dashboard#47/#48/#49, meta#199/#200/#201/#202/#204. Three Dependabot PRs still open in meta."
last_green_ci: "meta#202 (the C5+C6 dashboard pointer bump) → master, 2026-09-12. PR run 34695702515: all seven gates PASS including e2e with C5 and C6 together for the first time. Master run 34696063499: triage skipped every gate (the tree was already proven by the PR run — ADR-0038 working), deploy-staging SUCCESS. `app-staging.kaleem.academy` and `ws-staging.kaleem.academy/health/live/` both 200 after."
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
3. **Design-system v2 — phase 2: the `tokens` repo.** Phases 0 (spec, ADR-0040/0041, doc
   repair) and 1 (the palette) are **done**. The palette is derived and verified — 50
   pairs, both themes, 0 failures, bench at `specs/assets/2026-09-12-palette-v2-bench.mjs`.
   Both blocking decisions are closed: `Button` `sm` keeps its 40px ink with a 44px
   pseudo-element hit area (this closes what was next-action #3), and gold stays banned as
   a text colour. **Phase 2 starts by giving the `tokens` repo its first CI workflow** — it
   has no `.github/` at all, so nothing in that package has ever been checked
   automatically, and every later step is unverified until it exists. Then phases 3→5 in
   strict PR order: `tokens` → `dashboard` → `marketing` → **one** meta pointer PR
   carrying all three. **Only the meta PR deploys** — merge it between lessons.
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
