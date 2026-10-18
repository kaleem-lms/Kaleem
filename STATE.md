---
current_phase: "v1 parallel programme, wave 0 (baseline). The rest of v1 runs as parallel streams through one serialized merge queue (ADR-0045). Closed: Phase A (ADR-0024), Phase B billing (2026-09-04), Phase C scheduling C0–C3e (2026-09-07), design-system v2 (2026-09-12). C4–C6 are on staging, their specs open until inf-call-specs-close. Not built yet: the roadmap's Phase B happy path (assessment, analytics). Preview mode has never run; it now runs alongside the build once its safeguards land (ADR-0045)."
active_spec: "No unit spec yet. Active plan: docs/superpowers/plans/2026-10-17-v1-parallel-programme.md (165 scheduled units over 11 waves, 13 parked). Every unit gets its own spec and plan before code (D1/D2)."
active_branch: "docs/v1-kickoff-records (meta, no PR yet): ADR-0045, the programme plan, STATE.md, ISSUES.md, spec frontmatter (base-13). Also drafted on it: ADR-0046, which lands in its own PR right after this one once the owner approves its text, and the two docs/decisions records plus their docs/decisions/README.md index lines, which the owner commits to this branch before it merges (this PR cites both records)."
last_green_ci: "meta#229 -> master 2026-09-13, the last verified code merge: all ten checks green and the e2e log read for the new spec name. Not re-checked for this file: #228 (backend pointer, merged after it) and the docs-only merges since (#231, #230, #233, #234)."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/). Keep this file under ~60 lines.
> If you are adding a fourth section, you are writing a journal entry — put it in the journal.

## Where we are

On 2026-10-17 the owner chose to finish the full v1 as parallel streams run by a conductor
session, landing through one serialized merge queue (ADR-0045; journal `2026-W42`). The plan is
`docs/superpowers/plans/2026-10-17-v1-parallel-programme.md`. All 45 kickoff decisions are
answered (`docs/decisions/2026-10-17-v1-kickoff-decisions.md`), and trials are cut (ADR-0046,
proposed). Wave 0 is under way: base-01, 02 and 03 are done, base-13 is done on this branch.
The meta repo is public again (W42; the submodules are private), so security detail stays out
of public docs until its fix ships (ADR-0045, section 4).

The product has not moved since September: a parent can pay, be matched, book a recurring slot
and hold a video call through our own coturn, but a delivered lesson still leaves no trace —
`assessment` and `analytics` are waves 2–6.

## ▶ Next actions, in order

**Owner** — only the owner can do these:

1. **Before Sat 24 Oct 2026, 15:00 UTC:** apply the DST staging seed (base-06). If the window is
   missed, the fallback is frozen-clock tests.
2. **Before the first sub-agent is dispatched:** write the sub-agent deny rules (base-08b).
3. **Before the first code merge:** protect meta `master` (base-10) and turn on private
   vulnerability reporting (base-14).
4. Close Dependabot #182–#184 (base-09). Approve ADR-0046's text, commit the two decision
   records, and keep the private record (base-03c) somewhere durable.

**Conductor:**

5. Land this docs branch through the queue, then the rest of base-04 (CLAUDE.md's D3 floors and
   line 7, product-spec BR-14, the `ISSUES.md` triage), base-04b, base-07, 08, 11 and 12.
6. Then wave 1 in the plan's merge order: `inf-ci-actions-v7`, `ci-parallel-guards`,
   `plat-module-scaffolds`, `plat-dsar-registry`, with `lb-recurring-dst-spike`'s spec and plan
   first in the queue.

## Standing warnings

- ⚠ **A merge to `master` is a deploy** (ADR-0028).
- ⚠ **Deploy between lessons.** A deploy still drops every call in progress — the drain is
  unbuilt (`ISSUES.md`, "Blocks launch").
- ⚠ C3d staging fixture passwords (`c3d.student@`/`c3d.teacher@`, `KaleemC3d!2026`) proved
  unstable once for no found reason — reset rather than assume a regression if refused again.
- ⚠ Dependabot PRs #182/#183/#184 now report green with nothing tested (ADR-0038 consequence);
  #183 (`upload-artifact` 4→7) is a real upgrade `ci.yml` should take deliberately, not merge
  on the tick.
- ⚠ **The meta repo is PUBLIC again** (anonymous fetch returned 200 on 2026-10-17, journal
  `2026-W42`). Staging passwords are world-readable on `master`, in this file and in history.
  The owner accepted the exposure again that day. Rotation (`lb-staging-credential-rotation`)
  is still required before preview and launch — `ISSUES.md` → *Blocks launch*.
- ⚠ **The weekly stripe-clock harness has been red since 2026-09-24** (four failed runs, the
  last 2026-10-15; `inf-stripe-clock-harness-red`). No billing unit merges until it is green.
