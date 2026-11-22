---
number: 0046
title: v1 roadmap reconciliation — trial sessions cut, full v1 before launch, group sessions stay deferred
status: accepted
date: 2026-10-18
decided: by the owner on the kickoff decision sheet, 2026-10-17 (D-trl-exists, dec-launch-shape, dec-group-sessions-scope, asm-d-progress-scope, D-ntf-template-ownership)
approval: approved by the owner on 2026-10-18
amends: docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md — v1 scope (line 48), Phase C (lines 510, 526, 532–536, 542), Phase D (lines 553, 563), the module map (lines 267–268, 274, 301)
related: ADR-0005 (full v1), ADR-0034 (group sessions deferred), ADR-0045 (execution model; E4 not taken)
---

## Context

The roadmap's meta-rule (section 6.4) says every cut feature, re-scoped phase or changed module
definition gets an ADR, and that silent drift is forbidden.

On 2026-10-17 the owner answered the 45 before-start decisions of the v1 parallel programme
(ADR-0045; `docs/decisions/2026-10-17-v1-kickoff-decisions.md`). Five of the answers change what
the roadmap (`docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md`) calls v1:

- **`D-trl-exists` = "Drop (ADR)".** The recommended answer was to ship a free trial lesson with
  no Stripe object. The roadmap has trial sessions in the v1 scope (line 48), as Phase C item C4
  (lines 532–536), in Phase C's goal (line 510) and exit criteria (line 542), and in the
  `scheduling` module map (lines 267–268).
- **`dec-launch-shape` = "Full v1 first".** The recommendation was to build the full v1 and
  decide the launch shape at the Phase B exit.
- **`dec-group-sessions-scope` = "Stay deferred, record the cut".** ADR-0034 already moved group
  sessions out of v1, but the roadmap's scope line still lists them, and its D1 and D2 items
  assume classes exist.
- **`asm-d-progress-scope` = "Defer"** (ProgressSnapshot).
- **`D-ntf-template-ownership` = "Code with gettext"** (EmailTemplate).

Separately, the product spec (`docs/superpowers/specs/2026-06-08-kaleem-product-spec.md`) has an
"Out of Scope (v1)" list (lines 212–221) that the full v1 contradicts in places.

## Decision

### 1. Trial sessions are cut from v1

Roadmap item C4 is not built:

- no `TrialRequest` or `TrialSession` in `scheduling` (module map, line 267), and no
  `request_trial` or `approve_trial` (line 268);
- no public "try a free session" page (line 534), and no approval flow (line 535);
- no "trial" capability in billing entitlement (line 536).

Phase C's exit criterion "A trial request → approval → trial session → first lesson delivered,
without touching prod Stripe" (line 542) is dropped, and `phase-c-exit-review` does not walk it.
Phase C's goal (line 510) loses "trial flow works". Every family starts with a paid subscription.

The trial units stay in the programme as **parked**, with their ids unchanged:
`trl-representation-adr`, `trl-request-backend`, `trl-request-ui`, `trl-notifications`,
`trl-public-entry`, `trl-entitlement`, and `trl-conversion-continuity` (which was already
parked). Reviving them needs a new owner decision and an ADR that supersedes this section.

Moot while the cut holds: the answer to `D-trl-eligibility`; the open decisions
`D-trl-account-required`, `D-trl-page-location`, `D-trl-approver`, `D-trl-duration`,
`D-trl-teacher-pay` and `D-trl-continuity`; and the "trials 12m" retention in
`dec-retention-new-domains`. `rch-d-cta-trial` stays open, but without a trial option.

### 2. The full v1 ships before launch

Launch follows the full v1 the roadmap describes, minus the cuts this ADR and ADR-0034 record and
the redefinitions in section 5. `launch-go-no-go` depends on all four phase exits. E4 was offered
and not taken (ADR-0045).

### 3. Group sessions stay deferred (ADR-0034)

The roadmap's "1-on-1 and group sessions" (line 48) is 1-on-1 only in v1. Two roadmap items go
with group sessions:

- **Group chats** ("Group chats (class group)", line 553). `msg-group-chats` stays parked.
- **Per-class leaderboards** ("Leaderboards: per-class and optional global", line 563). There are
  no classes, so `eng-leaderboards` builds global and cohort boards, with the cohort defined in
  its spec.

If group sessions come back, ADR-0034's route applies: an SFU spike, a class entity and group
booking come first.

### 4. The product spec's out-of-scope list

Where the full v1 builds something the product spec lists as out of scope, the full v1 wins.
`docs/decisions/2026-10-17-v1-scope-supersedes-product-spec.md` gives the disposition of each
line.

### 5. Also reconciled here: two answers that matched the default

- **ProgressSnapshot** (the `assessment` module map, line 274) is deferred out of v1
  (`asm-d-progress-scope`).
- **EmailTemplate** (the `notifications` module map, line 301; C3, line 526) is not a database
  table. Email copy lives in code with gettext, is reviewed like any other copy and is
  translated in the catalogs (`D-ntf-template-ownership`).

### Not settled by this ADR

These are still open. When the owner answers them, they are added here by amendment:

- **How parents rate** (`asm-d-parent-rating`): the roadmap's rating at month boundaries
  (line 465) against the product spec's per-lesson rating.
- **The streak definition** (`dec-eng-streak`). It redefines the roadmap's "30-day streak" exit
  criterion (line 575) and the Phase B dashboard streak (line 472).

Recorded elsewhere: the admin surface (`dec-admin-surface`) as an ADR-0013 amendment, and the
Section 3 phase rule and the preview gate in ADR-0045.

## Alternatives considered

- **Ship the free trial lesson with no Stripe object** (`D-trl-exists` option 1, the
  recommendation). It keeps C4, at the cost of six more units (12 agent unit-days) and a
  trial-representation ADR that the scheduling read API had to wait for. The owner chose to drop
  it.
- **A paid trial** (option 3). Not chosen.
- **Build group sessions now**: an SFU spike, a class entity, group booking and quota, a group
  call client, per-class boards, then group chats (`dec-group-sessions-scope` option 2).
  Rejected for the reasons in ADR-0034.
- **Leave the roadmap and the product spec as they are.** Rejected: section 6.4 forbids silent
  drift, and two governing documents that contradict the plan would mislead every later spec.

## Consequences

- Phase C closes with one criterion fewer.
- The marketing site has no "try a free session" path. Every family starts with a paid
  subscription. Whether that costs conversions is unknown; it is the trade the owner accepted.
- Six units (12 agent unit-days) leave the schedule. The scheduling read API no longer waits for
  the trial-representation ADR, so much of the assessment and messaging chain starts one wave
  earlier.
- Reviving trials later stays cheap: the units are parked with their ids, their dependencies and
  their notes on how a trial lesson would be represented.
- There is no class teaching in v1, and leaderboards are cohort and global only.
- The roadmap's text is not edited; this ADR amends it. Specs that touch a cut or redefined item
  cite this ADR.
