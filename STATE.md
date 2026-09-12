---
current_phase: "C — Scheduling, CLOSED. **Design-system v2 is COMPLETE and its spec is closed** (2026-09-12): palette replaced and deployed, primitive layer consolidated, CI gates G1–G7 landed. C5/C6 shipped to staging 2026-09-12. C0–C3e closed 2026-09-07. Phase B (billing) CLOSED 2026-09-04. Phase A closed via ADR-0024. Roadmap's Phase B happy path still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "**None — pick the next phase with the user.** `2026-09-12-design-system-v2-design.md` is CLOSED; its outcome section carries what the consolidation found and what was deliberately left alone. ADR-0040 (palette + EN 301 549), ADR-0041 (DTCG tokens). Still owed from it: the staging walk and the Lighthouse a11y re-measure (raise the floor if it now exceeds 0.95 — ADR-0026 ratchet). C5/C6 each still owe the manual pass on a real phone."
active_branch: "`feat/design-system-v2-phase-7` in meta (dashboard pointer + docs) — THIS IS A DEPLOY when merged. Phase 7 shipped as dashboard #52-#61: focusRing, Dialog+AlertDialog, Select, Skeleton, Card, Meter, PageHeader, target sizes, colour lint. Design-system v2 phases 0-5 deployed earlier the same day: tokens#4/#5 (v0.2.0, v0.2.1), dashboard#50/#51, marketing#6/#7, infra#11, meta#204-#208. Three Dependabot PRs still open in meta."
last_green_ci: "meta#208 -> master 2026-09-12: deploy-staging SUCCEEDED end to end after the ship.sh hardening (disk precheck, atomic state write, state recorded BEFORE teardown, bounded prune). Verified on the host: `.active-color=blue`, only `kaleem-django-blue-1` running, 64G free, all four staging endpoints 200, and the deployed CSS still serving the v2 palette after the colour flip. Dashboard main is green at #61 (1156 unit tests, 25+ e2e, floors 96.71/93.31/88.7)."
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
2. **Finish the staging walk's authenticated half.** Still blocked: every staging
   credential in `ISSUES.md` is refused, consistent with the rotation already tracked
   there. `Dialog`, `Skeleton` and `Meter` are therefore unverified on staging. The
   unauthenticated half passes — v2 palette live in both themes, RTL flips, one `h1` and
   one `banner` per auth page, Lighthouse a11y **1.00** (floor raised to match).
   ⚠ Visible changes from phase 7 + the a11y fixes deserve human eyes: 12px → 16px corners
   on session rows and the call end screen, a tightened spotlight gap, auth headings at
   display rank, **emerald links lighter in dark mode**, and **the topbar wordmark hidden
   below `sm`**.
3. **Rotate the staging passwords** (`ISSUES.md` → Blocks launch). They were
   world-readable on a then-public master and are still in history; they are ALSO simply
   wrong now — every documented credential is refused — so the rotation and the blocked
   walk above are one task, not two.
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

- **Design-system v2, complete 2026-09-12.** Palette replaced (ADR-0040/0041) and
  primitives consolidated. The consolidation itself found four defects no gate had
  caught — a 1.29:1 form boundary, a 20×20 checkbox, a select with no focus ring, and
  `text-end` mis-aligning Arabic — and measurement overturned three plan assumptions,
  most notably that `CallControlButton`'s alpha was a defect (it measures 7.15:1, above
  AAA, and was left alone). Full account: spec outcome + `journal/2026-W37.md`.
- **Four real accessibility failures fixed 2026-09-13**, each found by a gate that another
  gate was blind to: `--primary` used as text (4.29:1 on cards in dark → new `--primary-text`
  token, v0.2.2, pair now DECLARED); the app topbar overflowing at 320px on **every** authed
  route (SC 1.4.10); standalone auth links at 19px (SC 2.5.8); and the focus ring offsetting
  against the wrong surface in a `bg-secondary` well. New gates: auth-route contrast in both
  themes, reflow at 320/360/430, and the target sweep pointed at real routes.
- **Lighthouse re-measured 2026-09-12 after the palette deployed: accessibility 1.00** on both
  staging URLs, 3/3 runs each, up from 0.96. The `.lighthouserc.json` a11y floor is raised to
  1.00. It is not a clean bill of health — an axe sweep the same day found a live 1.4.3 failure
  Lighthouse scored 1.00 straight through, because it audits the default theme only.

- **CI cost optimization (ADR-0038)** — mechanism verified on the real merge; justification
  corrected against the real invoice 2026-09-11. `journal/2026-W37.md`.
- **Phase C (C0–C3e, then C4–C6)** shipped and verified live 2026-09-05→12: matching,
  booking+quota, video rooms, signaling, TURN, the call client, diagnostics, browser
  hardening, the session UI redesign and the call fixes. Shared signaling (ADR-0037)
  mutation-checked on a colour flip. No Safari/iOS device exists in this project, so every
  browser-hardening D9 click-through is a stated deviation, compensated by watching
  `CallDiagnostic` codes in production. `journal/2026-W36.md`, `journal/2026-W37.md`.
- **Phase B (billing)** closed 2026-09-04, `past_due`→`unpaid` dunning verified nightly against
  real Stripe test clocks. Leaked credentials from `588a1e35` rotated 2026-09-05;
  `.gitleaksignore` fingerprints stay by design (ADR-0032).
