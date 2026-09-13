---
current_phase: "C — Scheduling, CLOSED. **Design-system v2 is COMPLETE and its spec is closed** (2026-09-12): palette replaced and deployed, primitive layer consolidated, CI gates G1–G7 landed. C5/C6 shipped to staging 2026-09-12. C0–C3e closed 2026-09-07. Phase B (billing) CLOSED 2026-09-04. Phase A closed via ADR-0024. Roadmap's Phase B happy path still open: `assessment` and `analytics` were never built. Preview mode has not run."
active_spec: "**None — pick the next phase with the user.** `2026-09-12-design-system-v2-design.md` is CLOSED; its outcome section carries what the consolidation found and what was deliberately left alone. ADR-0040 (palette + EN 301 549), ADR-0041 (DTCG tokens). Still owed from it: the staging walk and the Lighthouse a11y re-measure (raise the floor if it now exceeds 0.95 — ADR-0026 ratchet). C5/C6 each still owe the manual pass on a real phone."
active_branch: "**None — everything merged and deployed.** 2026-09-13 (later): seven `ISSUES.md` entries closed as a backlog, three of them Blocks launch — backend #52/#53/#54/#55, dashboard #66, meta #215/#216/#217, ADR-0042. Three Dependabot PRs (#182/#183/#184) remain open ON PURPOSE — ADR-0038 means they report green with nothing tested."
last_green_ci: "meta#217 -> master 2026-09-13: all ten jobs green on the PR, deploy-staging SUCCESS on the push. The previous deploy (#215/#216) was verified live rather than assumed: marketing and dashboard 200, api /health/ready/ reporting database ok, signaling /health/live/ healthy. NOTE the four health URLs are /health/ready/ and /health/live/ — /healthz 404s, and reading that as a failure wasted a check."
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
2. ✅ **The staging walk's authenticated half — DONE 2026-09-13.** It never needed the
   deferred rotation, only a working login: a throwaway verified user with all three
   profiles unblocked it in one command. Verified live, measured not eyeballed —
   **`Dialog`**: opens in dark+RTL, focus moves inside, `aria-labelledby`/`describedby`
   set, background `aria-hidden` via Radix `hideOthers` (no `aria-modal`, which is Radix's
   deliberate and more robust choice), Escape closes, focus restored to the exact trigger.
   **`Skeleton`**: all 12 `aria-hidden="true"`, `motion-reduce:animate-none` present, and
   the sibling `role="status" aria-live="polite"` announcements really are there — the
   component's design claim holds in the rendered page. **`Meter`**: both roles present
   and distinct (`progressbar` "Lessons used this month" 3/8, `meter` "Microphone level"
   42/100). Also confirmed as rendered values: the per-theme `--overlay` differs in HUE not
   just alpha (light `#191c1b8c`, dark `#000000ad`), `--primary-text` is `#146a51` light /
   `#9fd0bc` dark, the topbar wordmark is `display:none` below `sm` with no sideways scroll
   at 320px on an authed route, and **today's own focus fix works in production** (focus
   lands on "New email address", not `<body>`).
   ⚠ Still owed to human eyes, because no harness can judge them: 12px → 16px corners on
   session rows and the call end screen, the tightened spotlight gap, and auth headings at
   display rank.
3. ⏸ **Rotate the staging passwords — DEFERRED by the owner 2026-09-13.** Still under
   *Blocks launch* in `ISSUES.md` at unchanged severity: deferred is about when, not
   whether. Accepted meanwhile: staging-only reach, repo private again so the window is
   closed, exposure bounded by whoever cloned during it. Must happen before real users and
   real money, and the new values must never enter the repo — history keeps the old ones.
4. **Then choose the next phase with the user.** `assessment` closes the roadmap's happy
   path — a delivered lesson still leaves no trace — and `notifications` is the other
   candidate. Preview mode has still never run, so priorities remain provisional. Do not
   pick unilaterally.
5. A coturn config-only change does not restart the running relay — close before it bites
   again (`ISSUES.md`).
6. **Someday:** force the artifact-miss path once a code change merges >7 days after
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
  but anyone who cloned while it was open still has them. Rotation is **deferred by the owner
  (2026-09-13)** and still required before launch — `ISSUES.md` → *Blocks launch*.

## Recently verified

- **Five `ISSUES.md` entries closed 2026-09-13**, worked as a backlog rather than a phase:
  password-change/reset security alerts (backend #53, ADR-0023's remaining gap — the change
  an account takeover makes FIRST notified nobody), Sentry frame locals (#54), and the dead
  `TeacherProfile.availability` JSONField (#55), on top of the two launch blockers below.
- **Two launch blockers closed 2026-09-13** by working `ISSUES.md` rather than a phase.
  (1) The quota cycle was keyed by exact `current_period_end` equality — the test the issue
  named was written first and went red in the predicted shape: a **one-second** mid-cycle
  rewrite generated **four extra lessons** on a four-lesson plan (backend #52). (2) The secret
  scan no longer skips documentation-only changes (ADR-0042, amending ADR-0038 for that job
  alone) — a secret scan tests the bytes of a commit, not the code, and both of this
  project's observed leaks were root-level `.md` files.

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
