---
number: 0045
title: Finish v1 as parallel streams through one serialized merge queue
status: accepted
date: 2026-10-17
approved: by the owner on the kickoff decision sheet, 2026-10-17 (pre-approval of "the execution model and every process deviation", base-04)
amends: for the v1 programme only — CLAUDE.md D1, D6, D9 and D11, the /new-feature approval rule, the submodule-first landing practice, the roadmap's Section 3 phase rule and preview gate, and who raises a coverage floor under ADR-0026
related: ADR-0005 (full v1), ADR-0026 (floors), ADR-0027 (e2e), ADR-0028 (a merge is a deploy), ADR-0038 (no branch protection), ADR-0046 (v1 roadmap reconciliation, proposed)
---

## Context

On 2026-10-17 the owner chose to finish the whole remaining v1 — the roadmap's Phases B to E,
the open launch blockers and the in-flight brand work — as parallel streams run by a conductor
session, instead of one feature at a time (`docs/superpowers/journal/2026-W42.md`). A planning
workflow turned that into a programme of 177 units. The owner then answered its 45 before-start
decisions on a private sheet (`docs/decisions/2026-10-17-v1-kickoff-decisions.md`), and the
replan that applied them left 178 units in 19 streams: 165 scheduled over 11 waves, 13 parked
(`docs/superpowers/plans/2026-10-17-v1-parallel-programme.md`). Ten of the 45 answers set
process.

The process this repo runs on assumes one developer doing one thing at a time:

- **D6** allows one feature branch at a time. It exists because every merge to `master` deploys
  staging (ADR-0028), parallel submodule pointer bumps collide, and one reviewer cannot follow
  many open PRs.
- **D9** has the developer click through every feature in a real browser.
- **ADR-0026** has the PR that lifts coverage raise the floor. Parallel raises conflict, and a
  local measurement differs from CI's.
- **`/new-feature`** requires an approved spec but names no approver.
- **Roadmap Section 3** (`docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md` line 370):
  no phase starts until the previous phase's exit criteria are green. Lines 495–506 make preview
  mode a non-optional gate before any Phase C spec.

Two facts make a parallel version riskier than the serial one. GitHub enforces nothing on the
private submodules, and there is no branch protection anywhere (ADR-0038), so "green before
merge" has always rested on discipline. And the owner is one person whose R2 warning sign is
visible, so the owner's hours, not agent hours, are the scarce resource.

The meta repo is public again (W42). That needs a rule for how much security detail public docs
may carry.

## Decision

### 1. Execution model

- **Conductor.** The main session owns the unit graph and the single merge queue, and makes
  every push and merge. It is the only writer of `STATE.md`, `ISSUES.md`, the journal and the
  CLAUDE.md D3 tables, it hands out ADR numbers, and it is the only voice to the owner. It merges
  green PRs itself; the owner hears failures and decisions.
- **Orchestrators.** One background workflow per stream walks that stream's units in dependency
  order. A unit that hits an escalation trigger stops and returns to the conductor; the other
  units carry on.
- **Sub-agents.** They write each unit in isolated git worktrees of the submodules, under a
  worktree root outside the owner's checkouts and outside `/tmp`, and they never push. An
  independent read-only reviewer checks each unit, repeats its mutation checks and runs the
  secret scan over its commits.
- **One serialized merge queue.** One meta PR goes to `master` at a time, docs PRs included. A PR
  merges only on a completed all-green run whose tree equals the merge result (the verified-tree
  artifact). The next merge waits until that push run's `deploy-staging` has finished.
- **Limits.** At most 6 code-writing agents, and at most 3 meta code PRs gating at once.
- **Unchanged.** Every unit still gets a spec (D1) and a plan (D2), TDD with mutation-checked
  regression tests, the coverage floors, e2e where the harness covers its area, import-linter, a
  staging deploy, an architecture-doc update and a journal line. The per-unit protocol, the
  escalation triggers and the serialization rules are in the programme plan.

### 2. The process deviations the owner accepted

Each one holds for the v1 programme, which ends at `launch-go-no-go`, unless a later ADR keeps
it. This ADR does not rewrite CLAUDE.md's D1–D11; it is the recorded deviation CLAUDE.md asks
for.

| Rule | Deviation | Decision |
| --- | --- | --- |
| D6: one feature branch at a time | Parallel streams (at most 6 writers) feed one merge queue that only the conductor runs. | Owner, 2026-10-17 (W42) |
| D9: manual browser click-through | Per unit, an agent Playwright click-through on staging with the unit's pool accounts, in both themes, in Arabic RTL and at 320px. On top of that, owner device sessions batched per wave (Android, and iOS on the owner's own device), and an owner session for any unit that touches children's data or money. | `dec-d9-substitute`, `dec-ios-manual-pass` |
| ADR-0026: the PR that lifts coverage raises the floor | The conductor sets the CI-measured floor on the unit's own branch at the freshness step, from that run's coverage log. Floors still only go up, lowering one still needs an ADR, and no floor is ever set from a local run. | `dec-floor-ownership` |
| `/new-feature`: spec approved before code | The conductor approves routine specs. The owner approves any spec that touches children's data, money, legal text or new product behaviour. | `dec-spec-approval` |
| Landing: merge the submodule, then prove it | The pushed feature SHA is proven in a draft meta PR before the submodule merges, and that tested SHA is what gets pinned; nothing is re-pinned to the submodule's merge commit. The exception is a `@kaleem/tokens` release: the gitlink must equal the release tag (G3), so it lands as one three-repo slot. | `dec-landing-variant` |
| Push and merge rights | Only the conductor pushes and merges. Sub-agent permissions deny `git push`, creating and merging PRs, GitHub API writes and edits to permission settings; the owner writes those rules (base-08b) before the first sub-agent runs. The owner protects meta `master` (base-10). Squash and rebase merges are disabled in all six repos (done 2026-10-17). | `dec-push-rights` |
| Roadmap Section 3: no phase starts before the previous exit is green (line 370) | Phases B–E overlap. Each phase still gets an exit walk and a retrospective ADR (`ana-phase-b-exit-review`, `phase-c-exit-review`, `phase-d-exit-review`, `phase-e-exit-review`), and launch requires all four. | `dec-preview-mode`, `dec-launch-shape` |
| Roadmap: preview mode gates every Phase C spec (lines 495–506) | Suspended. Preview runs alongside the build once its safeguards land: staging credentials rotated, a counsel-approved preview notice and parental consent, DPAs for vendors that see staging data, the throwaway-user cleanup, deploy continuity or published no-merge windows, and preview teachers isolated in the matching pool. Its findings re-plan only units not yet started. The preview-review ADR closes it. | `dec-preview-mode` |
| D11: sustainable pace | Owner time is batched into kickoff, review and device sessions. Two escalation triggers pause new starts: an energy line of 2/5 or lower two weeks running, and an owner gate or decision waiting more than a week (or a wave at twice its estimate). The owner supplies the energy line; the conductor never infers it. | Owner, 2026-10-17 |
| D1: a committed spec before any code | Specs and plans of the security units named in section 4 are written and approved privately and committed publicly only after the fix deploys. | `rch-d-security-disclosure` |
| mypy named as a gate (roadmap lines 383–384) that runs nowhere | A correction rather than a deviation: mypy is made clean and gated in CI (`plat-mypy-gate`). | `dec-mypy-gate` |

### 3. E4 was offered and not taken

E4, the phased public launch, is pre-approved when two of R1, R2, T2 and T8 fire together
(roadmap section 6.2). It was offered at kickoff because R2's warning sign is visible. The owner
chose to launch after the full v1 (`dec-launch-shape`). If two of those triggers fire, the
conductor pauses new starts and puts E4 back to the owner; it never takes E4 on its own. What the
full v1 contains after the kickoff cuts is ADR-0046's subject.

### 4. Security disclosure in a public repo

The meta repo is public, and specs, plans and `ISSUES.md` live in it. Under
`rch-d-security-disclosure`:

- Public docs do not describe an unfixed weakness or a missing security control beyond what
  `ISSUES.md` already says. A control is described once it has shipped.
- Specs and plans for the units `rch-d-security-disclosure` blocks (the programme plan's
  `sec-h1`, `sec-h2`, `sec-h3`, `rch-ratelimit-drf` and both OWASP passes), for
  `cur-upload-safety`, and for any other unit that could not otherwise meet the first rule are
  written and approved privately (base-03c) and committed publicly only after the fix deploys.
  The specifics stay in a private record the owner holds. This is a D1 deviation.
- Security findings, the reviewers' included, go to a private channel: private vulnerability
  reporting on the meta repo (base-14, switched on before the first code merge). They do not go
  to `ISSUES.md`, and nothing about a finding is public until its fix deploys.
- Both OWASP passes (`rch-owasp-walkthrough-b`, `rch-owasp-walkthrough-launch`) are committed
  only after their fixes deploy.
- A security-relevant decision answer is recorded publicly as "decided; recorded privately".

`ISSUES.md` keeps everything that is not a security finding.

### 5. Stream labels

The roadmap's item labels (C1 `content`, C2 `curriculum`, C3 `notifications`, C4 trials, D1–D3,
E1–E4) collide with this repo's spec labels (Phase C1 matching, C2 booking, C3a–C3e video, C4–C6
call work). Streams are therefore named by area, with the roadmap item in brackets — for example
"Content: storage, uploads, resources (roadmap C, content)". Specs keep their date-and-name
filenames.

## Alternatives considered

- **Keep D6 as written.** The remaining scope is about 409 agent unit-days. Done serially, it
  would take well over a year. The owner chose parallel streams.
- **Parallel streams that merge their own PRs.** Rejected. Every meta merge deploys staging,
  concurrent pointer bumps collide, a third queued push cancels the pending one, and a green run
  on a stale merge ref proves nothing about the tree that lands.
- **A paid GitHub plan to protect the private submodules** (`dec-push-rights` option 2). Not
  taken, because conductor-only push and merge costs nothing; it stays open to the owner. **The
  rule alone** (option 3) was rejected: nothing would stop an agent session from pushing.
- **D9 by the owner, per unit or per user-facing unit** (`dec-d9-substitute` options 2 and 3).
  Rejected: it puts the owner in the path of about 165 units.
- **A periodic ratchet PR, or each unit raising its own floor** (`dec-floor-ownership` options 2
  and 3). Rejected: a periodic PR lets coverage sag in between, and concurrent raises conflict.
- **The owner approves every spec, or the conductor approves all of them**
  (`dec-spec-approval` options 2 and 3). The first makes the owner a bottleneck. The second leaves
  children's data and money without a human.
- **Re-pin to the submodule merge commit and rerun CI** (`dec-landing-variant` option 2).
  Rejected: about 6 minutes per unit to re-prove a tree the pinned SHA already proved.
- **Honour the preview gate** (`dec-preview-mode` option 1), holding C/D/E until the
  preview-review ADR, or **skip preview by ADR** (option 3). The first adds weeks of calendar
  time on top of the safeguards. The second gives up preview's evidence entirely.
- **Take E4 now, or decide the launch shape at the Phase B exit** (`dec-launch-shape` options 2
  and 3; option 3 was the recommendation). The owner chose full v1 first.
- **Disclose everything up front, or make the meta repo private**
  (`rch-d-security-disclosure` options 2 and 3). The first publishes live weaknesses. The owner
  chose neither.
- **Public security specs that describe the control only, committed before the fix ships.** Not
  taken: a spec for a control shows that the control is missing today, and the owner's answer
  is that public docs describe a control after its fix deploys.
- **Record mypy as "not a gate"** (`dec-mypy-gate` option 2). Not chosen.

## Consequences

**Good.**

- The rest of v1 has one graph, one owner for every shared resource, and one merge path whose
  order is known in advance.
- The owner's time goes to decisions, reviews and device sessions, not to per-unit clicks.
- Every unit still passes through D1, D2, TDD, CI and a staging deploy. The deviations change who
  does a step and when, not whether it happens.

**Costs.**

- Staging takes several deploys a day and no human approves each merge. The gates (coverage
  floors, e2e, the secret scan, the verified-tree check) are all that stands between a PR and
  staging, so a gate that passes on a broken build now costs more than it did.
- An agent click-through proves plumbing, not taste. Device and visual defects surface at the
  next batched owner session, which can be a wave later.
- Running preview alongside gives up most of R5's re-ordering power: by the time preview
  reports, much of C, D and E is already built.
- GitHub still enforces nothing on the submodules. Enforcement rests on the conductor being the
  only pusher and on the owner's deny rules for sub-agents.
- Readers of the public repo see a security control only after it ships.
- Owner load stays high: 60 decisions are still open and 47 gate types exist.
- CLAUDE.md's statements that the project has no Apple device (the C3e-a and C3e-b D3 rows) are
  now stale. `inf-call-specs-close` runs the C3e-a/b iOS checks with the C4–C6 pass, retires the
  no-device D9 deviation and corrects them.

**Prerequisites.**

- Before the first sub-agent: the owner's deny rules (base-08b).
- Before the first code merge: this ADR merged (base-04), meta `master` protected (base-10) and
  private vulnerability reporting on (base-14).

**Revisit** after wave 1 with measured velocity, and at `launch-go-no-go`, where these
deviations end unless a later ADR keeps them.
