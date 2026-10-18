---
spec: docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md
status: in-progress
adr: ADR-0045 (execution model and process deviations, accepted); ADR-0046 (v1 roadmap reconciliation, proposed)
created: 2026-10-17
updated: 2026-10-18
---

# kaleem v1 parallel programme

The plan for finishing v1: every remaining roadmap item, the open launch blockers and the
in-flight brand work, built as parallel streams and landed through one serialized merge queue
(ADR-0045). The owner chose this on 2026-10-17 and answered the 45 decisions it needed before
any unit could start (`docs/decisions/2026-10-17-v1-kickoff-decisions.md`).

This document renders the programme of record: the unit graph as replanned on 2026-10-18 after
those answers. The graph file itself is kept with the conductor, outside the repo, because parts
of it are kept private. Security units are listed here under neutral titles and described only
after their fixes deploy (ADR-0045, section 4).

Every unit still gets its own spec and plan before code (D1, D2). This document is the programme
around them, not a substitute for them.

## 1. Summary

| Measure | Value |
| --- | --- |
| Units | 178 (165 scheduled, 13 parked) |
| Streams | 19 |
| Waves | 11 after wave 0; sizes 39, 36, 21, 35, 17, 9, 4, 1, 1, 1, 1 |
| Decisions | 105: 45 answered at kickoff, 60 open (50 before the unit's spec, 10 during build; 6 of them gate only parked trial units) |
| Human gate types | 47 |
| Precedence critical path | 27 working days |
| Agent work | 409 unit-days; at least 68.2 working days at 6 writers; greedy estimate about 72 |

**After the kickoff answers.** 37 answers took the recommended default; the 8 that did not
reshaped the graph:

- **Trials are cut** (ADR-0046, proposed). The trial stream and `trl-entitlement` are parked,
  which moved the scheduling read API, and much of the assessment and messaging chain behind it,
  one wave earlier.
- **No self-registration age gate.** `rch-legal-age-gate` is parked. Counsel reviews the
  position with the legal texts, and `launch-go-no-go` records the answer (`ISSUES.md`,
  *Blocks launch*).
- **Payment-failed notices come from kaleem only.** Stripe's own failed-payment emails are
  switched off before `ntf-billing-notifications` merges.
- **Monitoring is self-hosted.** `lb-uptime-host-alerts` owns the ADR-0006 amendment;
  `lb-error-tracking` waits for it.
- **The brand restarts at a rewritten brief.** One unit is added (`inf-brand-brief-rewrite`), the
  brand chain runs a wave later, and no fallback direction is agreed.
- **The iOS passes run on the owner's device**, batched with the Android passes in waves 2 and 3.
- **Launch follows the full v1.** E4 was offered and not taken (ADR-0045).
- **One upload-handling security decision is recorded privately.**

**Critical path.** `ci-parallel-guards` → `ana-session-outcomes` → `eng-event-bus` → `eng-points-levels` → `eng-streaks` → `eng-badges` → `eng-dashboard-ui` → `phase-d-exit-review` → `rch-i18n-arabic-copy-review` → `phase-e-exit-review` → `launch-go-no-go`. That is 27 working days of precedence (S=1, M=3, L=5,
XL=8). The content chain runs 3 days off it.

**Calendar time is set elsewhere.** Agent work totals 409 unit-days, so 6 writers need at least
68.2 working days; a greedy 6-writer simulation gives about 72. Owner and external gates come on
top: the legal entity, counsel, Stripe activation, the production VPS and DNS, the brand brief
and pick, the Arabic review and the preview cohort. The S/M/L weights are assumptions and agent
velocity is unmeasured, so the programme is re-planned after wave 1.

**Launch is the graph's sink.** `launch-go-no-go` requires every *Blocks launch* closer, all four
phase exits, production parity, counsel's answer on the no-age-gate position and a live purchase
and refund. `lb-prod-first-deploy` is only an empty-database infrastructure smoke.

**There is no global kickoff gate.** Each unit waits for its own decisions, its `depends_on` and
the baseline items it uses. Capacity: at most 6 code-writing agents, 3 meta code PRs gating at
once, and one serialized merge queue (4–7 merges an hour, capped by staging disk until
`lb-deploy-pipeline-hardening` lands). Only the conductor pushes and merges.

## 2. Owner tasks still open

In deadline order. Nothing below can be done by an agent.

1. **Apply the DST staging seed before Sat 24 Oct 2026, 15:00 UTC** (base-06, in preparation).
   Recurring lessons are only ever generated for the future, so after that instant the
   pre-switch lesson of one seeded pair can never be created. Run the dry run, then the apply,
   then the baseline read; read again after each switch (London 25 Oct, Cairo 29 Oct, New York
   1 Nov). If the window is missed, the agreed fallback is frozen-clock tests. Until the last
   read on 2 Nov: no staging database reset, and `lb-recurring-dst-anchoring` does not merge.
   The operator notes are held privately; credentials never enter the repo.
2. **Write the sub-agent deny rules before the first sub-agent is dispatched** (base-08b,
   `dec-push-rights`). They deny `git push`, `gh pr create`, `gh pr ready`, `gh pr merge`,
   `gh api` writes and edits to permission settings, and they bind sub-agents but not the
   conductor's session. The conductor then proves them with a `git push --dry-run` from a
   sub-agent. Only the owner can write them: auto mode refuses an agent's edits to its own
   permission settings.
3. **Protect meta `master` before the first code merge** (base-10). Squash and rebase merges
   are already disabled in all six repos.
4. **Turn on private vulnerability reporting on the meta repo before the first code merge**
   (base-14). Review findings go there from wave 1.
5. **Close Dependabot #182–#184** (base-09), pointing them at `inf-ci-actions-v7`.
6. **Approve ADR-0046's text** (base-03b), **commit the two decision records** (base-05 and the
   kickoff record; decision records are written but not auto-committed) and **hold the private
   record** (base-03c).
7. **Plan the wave-1 owner gates now:**

   - `hg-vps-access`: `ci-staging-pool-seed`, `lb-access-log-redaction`
   - `hg-stripe-key-conditional`: `inf-stripe-clock-harness-red`
   - `hg-staging-accounts`: `lb-recurring-dst-spike`
   - `hg-dns`: `sec-h2`, `lb-prod-host-dns-tls`
   - `hg-counsel-review`: `lb-gdpr-governance-docs`
   - `hg-legal-entity`: `lb-gdpr-governance-docs`
   - `hg-owner-commit`: `lb-gdpr-governance-docs`
   - `hg-shipsh-review`: `lb-deploy-pipeline-hardening`, `lb-uptime-host-alerts`, `lb-signaling-deploy-continuity`
   - `hg-vps-env`: `lb-prod-env-parametrization`, `lb-uptime-host-alerts`
   - `hg-prod-vps`: `lb-prod-host-dns-tls`
   - `hg-monitoring-host`: `lb-uptime-host-alerts`
   - `hg-staging-rotation`: `lb-staging-credential-rotation`

## 3. Baseline (wave 0)

Status as of 2026-10-18.

| Task | Owner | What | Status |
| --- | --- | --- | --- |
| base-01 | owner | Clean the owner's checkout; only the owner touches it. | Done (by the conductor). |
| base-02 | conductor | Remote-only backup pushes: dashboard `feat/design-sync` and the `docs/brand-identity` commits. | Done. |
| base-03 | owner | Answer the 45 before-start decisions. | Done 2026-10-17. |
| base-03b | conductor | Record every answer before it is used: product decisions in `docs/decisions/`, technical ones in an ADR, plus the v1 roadmap reconciliation ADR, which the owner approves. | In progress: the kickoff record and ADR-0046 drafted 2026-10-18. |
| base-03c | conductor drafts, owner holds | A private, durable record of what the disclosure rule keeps out of public docs. | Drafted 2026-10-18, held outside every repo. |
| base-04 | conductor | One docs PR after the owner approves ADR-0045: ADR-0045, `STATE.md`, CLAUDE.md (D3 floors, weekly Lighthouse and stripe-clock, line 7 corrected to ADR-0034, product-spec BR-14 marked superseded) and the `ISSUES.md` triage. | Partial: ADR-0045 (pre-approved) and `STATE.md` written; CLAUDE.md and the triage outstanding; the W42 journal merged (#234). |
| base-04b | conductor | Restore the dashboard coverage floors lowered in `cc8b20c` without an ADR, or write the ADR. | Open. |
| base-05 | conductor | Draft the decision record: the full v1 supersedes the product spec's out-of-scope lines, and group sessions stay deferred. The owner commits it; messaging and engagement start after. | Drafted 2026-10-18. |
| base-06 | owner | The staging agent account pool, and the DST spike's staging lessons. | In preparation; due before Sat 24 Oct 2026, 15:00 UTC. |
| base-07 | conductor | The conductor environment: worktree root, meta worktree, gate scripts, e2e settings shim, gate image. | Open in the programme file; the conductor reports the environment built on 2026-10-18. |
| base-08 | conductor | Prove the conductor's push access; verify the reviewer's secret-scan command. | Open; the scan command was replaced and verified on 2026-10-18. |
| base-08b | owner | Sub-agent deny rules. | Open; required before the first sub-agent. |
| base-09 | owner | Close Dependabot #182–#184. | Open. |
| base-10 | owner | Protect meta `master`; disable squash and rebase merges in all six repos. | Partial: squash and rebase disabled 2026-10-17; protection required before the first code merge. |
| base-11 | conductor | The graph file: owned resources per unit, ADR numbers (units take theirs from 0047), amendment owners, merge order. | Open. |
| base-12 | conductor | Confirm the host's memory headroom for 6 writers. | Measured 2026-10-18; to be closed by the conductor. |
| base-13 | conductor | Reconcile spec frontmatter: shipped work marked shipped with a closed date. | Done 2026-10-18 (this docs change). |
| base-14 | owner | Private vulnerability reporting on the meta repo. | Open; required before the first code merge. |

## 4. Execution protocol

**Roles** (ADR-0045). The *conductor* owns the graph, the merge queue and every push and merge,
and is the only voice to the owner. One *orchestrator* workflow per stream walks its units in
dependency order. *Sub-agents* write in isolated worktrees and never push; an independent
read-only *reviewer* checks each unit.

**When a unit may start.** Its own decisions are answered and recorded (base-03b), its
`depends_on` units have merged and deployed, and the baseline items it uses are done: base-02,
base-07 and base-08 before any code; base-08b before the first sub-agent; base-04, base-10 and
base-14 before the first merge; base-03c before the private spec of any unit ADR-0045 §4
names; base-06 before the staging verification in step 11. A `merge_after` edge holds only the
merge.

**Per unit:**

0. **Allocate** (conductor): the branch `feat/<unit>` in every repo the unit touches; the Django
   app whose migrations it may change; its e2e fixture module and accounts; its route files and
   locale namespace; its staging pool accounts; any beat slot; an ADR number.
1. **Spec** (D1): `docs/superpowers/specs/<date>-<unit>.md`. It states what personal data is
   kept, why, for how long and who sees it (ADR-0023), the expand/contract plan, its e2e time
   budget, and the decision ids it relies on — never real rates, prices or entity details.
   The specs and plans of the security units ADR-0045 §4 names are written and approved
   privately and committed publicly only after the fix deploys.
2. **Decision check**: an open or new decision parks the unit and escalates.
3. **Plan** (D2): spec and plan go in one docs-only meta PR, batched per stream if useful.
   Approval follows `dec-spec-approval`: the owner approves any spec that touches children's
   data, money, legal text or new product behaviour; the conductor approves the rest and merges.
4. **Worktree**: one git worktree per touched submodule on `feat/<unit>` from `origin/main`,
   under the conductor's worktree root — never in `/tmp`, in the owner's checkouts or in a meta
   worktree. `pnpm install --frozen-lockfile`; a dependency-changing unit writes the lockfile with
   pnpm 10.28.0. Agents never run `just`.
5. **TDD**: the failing test first. Every regression test is mutation-checked: revert the fix
   and see it go red.
6. **Local gates.** Backend, in an isolated compose project (Postgres 18 on tmpfs, Redis 8, a
   gate image keyed by the requirements hash, CI's environment, no host ports, no
   `backend/.env`): `migrate`, `makemigrations --check`, `pytest --cov=kaleem --cov=signaling`,
   `ruff`, `lint-imports`. Dashboard, in a heavy slot: `tsc`, lint,
   `test:coverage --maxWorkers=6`, build. e2e locally is optional; CI is the authority.
7. **Review** (read-only reviewer): the diff against the spec and CLAUDE.md's don't-do list;
   module contracts; token-only styles; RTL and accessibility; the migration, routeTree and
   locale rules; expand/contract; no floor decrease without an ADR; ADR-0023's four data
   points. It repeats the mutation checks and runs gitleaks v8.30.1 over
   `origin/main..feat/<unit>`. Security findings go to the private channel (base-14), never to
   `ISSUES.md`.
8. **Commit and push** (the conductor pushes): explicit paths, `PIP_CONFIG_FILE=/dev/null`,
   never `git add -A` and never `--no-verify`. First the submodule PR, then a draft meta PR from a
   meta worktree that pins the pushed SHA after an ancestry guard
   (`git merge-base --is-ancestor <old pin> <new>`). Only units holding a gating slot push meta.
9. **CI**: watch the run to completion and confirm every job green; read the e2e log for every
   new spec's name. A pass that needed a rerun is a finding, reported with its run URL. Billing
   units also need a green stripe-clock dispatch on their own meta branch.
10. **Merge queue** (conductor only):
    - *Freshness*: merge `origin/main` into the feature (renumber migrations, regenerate the
      routeTree, resolve locales by script, take main's lockfile), set the CI-measured coverage
      floor, and prove it again.
    - Merge the submodule PR with a merge commit.
    - Pin per `dec-landing-variant`, require the verified-tree artifact for the exact merge tree,
      then merge the meta PR from outside any checkout.
    - Watch the push run until `deploy-staging` succeeds before the next merge, and read the
      deploy log's free-disk line. A new environment variable needs `hg-vps-env` first; a
      `ship.sh` change needs `hg-shipsh-review` first.
11. **Staging verification**, under the staging lock (`dec-d9-substitute`): an agent Playwright
    click-through with the unit's pool accounts, in both themes, in Arabic RTL and at 320px.
    Owner device sessions (Android, plus iOS where `hg-ios-device` applies) and Arabic sessions
    are batched per wave.
12. **Close-out** to the conductor: the architecture doc updated (`platform.md` for platform
    API), the D3 row stating what is not covered, the spec marked shipped with a closed date and
    the plan done, a journal line, `ISSUES.md` spots (never security ones), and floor evidence
    from CI. The conductor batches these into a docs PR and removes the worktrees and branches.

**Limits.** At most 6 writers and 3 gating code PRs. The conductor dispatches stripe-clock and
Lighthouse weekly inside a staging window, puts the self-hosted monitoring upgrade check to the
owner at the ADR-0006 amendment's cadence, and re-plans after wave 1 with measured velocity.

### Escalation triggers

A unit that hits one of these stops and returns to the conductor; other units continue.

- An open or new decision blocks the unit: park it; other units continue.
- Owner-only access is needed and was not planned as a gate: env var, infra service, ship.sh change, Stripe, DNS, GitHub settings, SSH/VPS, staging DB, production, a real device.
- A gate is red twice on the same SHA after one fresh-runner rerun; any pass-on-rerun is reported as a finding (no standing exceptions).
- Coverage can only be met by lowering a floor, or a Lighthouse floor is at risk.
- Scope grows beyond the spec: a new model, endpoint, route, dependency or migration, or one size class larger.
- A CLAUDE.md don't-do item would be needed: cross-module model import, CSRF exemption, unversioned route, JSON blob on User, OneToOne for over-time data, bare except, print, hardcoded URL, a .env commit, --no-verify, a direct trunk commit, or a refactor.
- An import-linter contract must widen beyond its ADR, or a change would break the previous release during the blue-green window.
- A regression test stays green with its fix reverted, twice.
- The ancestry guard refuses a pin; freshness fails twice; a conflict hits a conductor-only file or another unit's migration; or the frozen pnpm 10.28.0 install fails.
- deploy-staging fails, rolls back or is skipped, staging lags master, or free disk is below 15 GiB after a deploy: freeze the queue.
- Any security finding: private channel only (base-14); nothing public until the fix deploys.
- Production, live Stripe, real money, or real users' or children's data is involved, including any action on preview families' records.
- Arabic religious terminology or legal wording is uncertain: owner, batched.
- A weekly workflow (stripe-clock, Lighthouse) is red or cancelled.
- The owner's weekly energy line is 2/5 or lower two weeks running (R2/D11): pause new waves and re-plan; the owner supplies the line, the conductor never infers it.
- An owner-gate or decision backlog is older than one week, or a wave runs past twice its estimate (T2): pause new starts and ask the owner. E4 was offered at kickoff and not taken (dec-launch-shape: full v1 first); if two of R1, R2, T2, T8 fire, the conductor puts it back to the owner rather than taking it.
- MemAvailable stays below 6 GB for 10 minutes or disk is below 10 GB: throttle.

## 5. Streams

| Stream | Name | Units | Repos |
| --- | --- | --- | --- |
| `platform` | Platform, CI & supply chain | 11 + 1 parked | backend, dashboard, meta |
| `sched` | Scheduling core & live lessons | 14 | backend, dashboard, meta |
| `asm` | Assessment (roadmap B3) | 8 + 1 parked | backend, dashboard, meta |
| `ana` | Analytics, Phase B close, preview | 7 | backend, dashboard, meta |
| `admin` | Staff and admin surface (ADR-0013) | 7 | backend, dashboard, meta |
| `content` | Content: storage, uploads, resources (roadmap C, content) | 8 | backend, dashboard, infra, meta |
| `curriculum` | Curriculum builder (roadmap C, curriculum) | 7 | backend, dashboard, meta |
| `ntf` | Notifications & email (roadmap C, notifications) | 11 | backend, dashboard, infra, meta |
| `trial` | Trial lessons (roadmap C, trials) - parked | 0 + 6 parked | backend, dashboard, marketing, meta |
| `msg` | Messaging (roadmap D) | 8 + 1 parked | backend, dashboard, infra, meta |
| `eng` | Engagement & event bus (roadmap D) | 7 | backend, dashboard, meta |
| `billing` | Billing: payouts, state gaps | 5 + 1 parked | backend, dashboard, meta |
| `i18n` | i18n & Arabic (roadmap E) | 6 | backend, dashboard, meta |
| `pwa` | PWA & bundle (roadmap E) | 4 | dashboard, meta |
| `mkt` | Marketing site (roadmap E) | 9 | marketing, infra, meta |
| `sec` | Identity & security | 7 | backend, dashboard, marketing, infra, meta |
| `legal` | GDPR & legal | 8 + 1 parked | backend, dashboard, meta |
| `ops` | Production, operations & launch | 24 | infra, backend, meta |
| `brand` | Brand, tokens & design system (in flight) | 14 + 2 parked | tokens, dashboard, marketing, backend, meta |

- **`platform`.** Owns the shared registries (api_router, LOCAL_APPS, import-linter), the export/erase registry, CI gate jobs and the seed manifest. Scaffolds, registry and guards land first. CI-changing units merge one at a time, inf-ci-actions-v7 first.
- **`sched`.** The read API and lesson outcomes are hubs for 5 streams and run first. ana-session-outcomes owns the ordered close-out sequence; later units add a step to it and extend its matrix test instead of editing complete_session ad hoc. The DST spike is date-bound (switches 2026-10-25 London, 10-29 Cairo, 11-01 New York).
- **`asm`.** UI units run in sequence: they share assessments.tsx and the assessment locale namespace.
- **`ana`.** ana-foundation owns the Home and nav restructure; every other unit that edits nav.ts, AppTopbar or Home merges after it and only mounts sections.
- **`admin`.** New stream. ADR-0013 puts admin UX in the dashboard; Django admin stays internal-only, and IP-restricted in production (`lb-prod-admin-ip-allowlist`). dec-admin-surface's answer is recorded as an ADR-0013 amendment.
- **`content`.** Runs 3 working days off the precedence critical path (cur-content-storage -> cur-resources-library -> cur-resource-assignment), so a late bucket gate can make it critical. Its storage and file-policy decisions were answered at kickoff; the bucket gate (hg-cur-storage-credentials) is the owner's. Labels avoid the repo's existing C1-C6 spec names.
- **`curriculum`.** Sole writer of curriculum migrations. Assignment no longer waits on attachments; both chains meet at cur-phase-exit-walk.
- **`ntf`.** ntf-core owns the in-app path and opens every producer edge in one PR; the email channel is an interface ntf-email-foundation implements, so email-only owner gates hold only email-producing units. Matching and billing notices are in scope (product spec Flow 1/2, BR-09); cutting them needs a decision record. Payer notices are kaleem's only (dec-dunning: kaleem only); Stripe's failed-payment emails stay off.
- **`trial`.** Parked in full: D-trl-exists = Drop (owner, 2026-10-17). The cut of the roadmap's C4 trial sessions is recorded in the v1 roadmap reconciliation ADR (base-03b). The units stay visible so a revival starts from them; trl-entitlement in the billing stream is parked with them.
- **`msg`.** Polling ships first; realtime is additive and its transport is decided after the spike. Chat UI merges only after the DPIA addendum is signed off. Group chats stay parked (dec-group-sessions-scope: stay deferred).
- **`eng`.** eng-event-bus is the only bus in the programme.
- **`billing`.** Sole writer of billing models and migrations. Every unit here merges only after inf-stripe-clock-harness-red is green, with a green stripe-clock dispatch on its own meta branch. Real rates, prices and entity details stay out of public specs. trl-entitlement is parked with the trial cut.
- **`i18n`.** The Arabic sweep gate lands before the leak fixes. Backend catalogs are per app. The final native Arabic review runs after the last text-adding unit; hg-arabic-review on each unit holds its spec closure.
- **`pwa`.** Owns the web manifest; the brand units only supply icons.
- **`mkt`.** Owns the indexing policy and .lighthouserc.json.
- **`sec`.** lb-access-log-redaction goes first (the exposure is already public in ISSUES). Findings go to a private channel; public docs describe the control after the fix deploys. Two OWASP passes: Phase B and pre-launch.
- **`legal`.** Owner-commit documents are done when the owner commits them (hg-owner-commit). Counsel review is batched. rch-legal-age-gate is parked (rch-d-minors: no gate); counsel reviews the no-gate position with the legal texts, and launch-go-no-go records the answer.
- **`ops`.** Infra merges one at a time, each with its owner step planned (hg-vps-env, hg-shipsh-review). lb-deploy-pipeline-hardening heads the queue because the 24h image retention cannot survive the programme's deploy rate. launch-go-no-go is the graph's sink. Monitoring is self-hosted (lb-dec-monitoring-services): lb-uptime-host-alerts owns the ADR-0006 amendment with the memory budget, backup scope and upgrade cadence.
- **`brand`.** Sole writer of tokens and src/ui primitives. Tokens releases in order v0.2.3, v0.2.4, v0.3.0, each a three-repo landing with the meta pin; tokens main stays releasable. The direction restarts at a rewritten brief (dec-brand-direction): inf-brand-brief-rewrite precedes inf-brand-direction, and no fallback direction is agreed.

### Security hardening, summarised

Under `rch-d-security-disclosure` (ADR-0045, section 4), public docs describe a security control
only after its fix deploys. The specs and plans of the units that section names are written and
approved privately and committed after the fix deploys; the specifics sit in the owner's private
record (base-03c). What is already public, in `ISSUES.md` or the roadmap, is described here.

- **`lb-access-log-redaction`** (wave 1, first in its stream): the access-log policy and its fix.
  The exposure it closes is already public in `ISSUES.md` (*Blocks launch*). The owner purges the
  old staging logs after it merges.
- **`sec-h1`, `sec-h2`, `sec-h3`** (wave 1) and **`cur-upload-safety`** (wave 3): three security
  hardening units and upload validation, described here after their fixes deploy (ADR-0045,
  section 4); their specifics are in the private record.
- **`rch-ratelimit-drf`** (wave 2): rate limiting (roadmap E4), with its ADR. Every new throttle
  scope ships its e2e override in the same PR.
- **`lb-prod-admin-ip-allowlist`** (wave 2): production admin access, as ADR-0013 specifies.
- **`lb-security-scanning-sca`** and **`lb-security-scanning-sast`** (wave 1): dependency,
  image, submodule-history and static-analysis scanning, under an ADR-0030 amendment.
  `ISSUES.md` already lists these scans as not running.
- **`rch-owasp-walkthrough-b`** (wave 5) and **`rch-owasp-walkthrough-launch`** (wave 6): the
  OWASP Top 10 passes. The Phase B exit needs the first and launch needs the second. Each is
  committed only after its fixes deploy, and its findings go to the private channel.
- **`lb-staging-credential-rotation`** (wave 1): the rotation `ISSUES.md` records as deferred.
  It gates preview and launch.

## 6. Waves

Waves are longest-path layers over `depends_on`. Each unit line reads: id — title · stream ·
kind · size · repos, then *starts after* (its `depends_on`), *merges after* (merge-order-only edges),
*holds* (owner and external gates; *hg-arabic-review* in italics holds spec closure, not the
merge), *open decisions* and the ADR it owes. Sizes: S=1, M=3, L=5 working days.

### Wave 1 (39 units)

Merge order: `inf-ci-actions-v7`, `ci-parallel-guards`, `plat-module-scaffolds` and `plat-dsar-registry` first. `lb-recurring-dst-spike`'s spec and plan go first in the queue, because its live window opens on 2026-10-25. The kickoff answers wave-1 units use must be recorded (base-03b) before those units start: `asm-d-retention`, `dec-admin-surface`, `dec-cookies`, `dec-cur-retention`, `dec-cur-terminology`, `dec-dunning`, `dec-legal-texts`, `dec-msg-retention`, `dec-retention-new-domains`, `lb-dec-erasure-semantics`, `lb-dec-legal-entity`, `lb-dec-monitoring-services`, `lb-dec-paid-through`, `lb-dec-prod-hosting`, `lb-dec-retention`, `lb-dec-staging-cookie-isolation`, `rch-d-security-disclosure`.

Owner and external holds:

- `ci-staging-pool-seed`: `hg-vps-access`
- `inf-stripe-clock-harness-red`: `hg-stripe-key-conditional`
- `lb-recurring-dst-spike`: `hg-staging-accounts`
- `lb-access-log-redaction`: `hg-vps-access`
- `sec-h2`: `hg-dns`
- `lb-gdpr-governance-docs`: `hg-counsel-review`, `hg-legal-entity`, `hg-owner-commit`
- `lb-deploy-pipeline-hardening`: `hg-shipsh-review`
- `lb-prod-env-parametrization`: `hg-vps-env`
- `lb-prod-host-dns-tls`: `hg-prod-vps`, `hg-dns`
- `lb-uptime-host-alerts`: `hg-monitoring-host`, `hg-vps-env`, `hg-shipsh-review`
- `lb-signaling-deploy-continuity`: `hg-shipsh-review`
- `lb-staging-credential-rotation`: `hg-staging-rotation`

Units:

- **`plat-module-scaffolds`** — Scaffold the six unbuilt modules and fix the platform contract · platform · infra · S · backend, meta
- **`plat-dsar-registry`** — Export/erase hook registry and platform architecture doc · platform · infra · S · backend, meta · merges after `plat-module-scaffolds` · ADR: export/erase contract
- **`ci-parallel-guards`** — Missing-migration check, seed manifest, worker in e2e · platform · infra · S · meta, backend · merges after `inf-ci-actions-v7`
- **`ci-fix-known-flakes`** — Fix the two known flakes · platform · fix · S · dashboard
- **`ci-staging-pool-seed`** — Idempotent staging account-pool seed · platform · infra · S · backend · holds `hg-vps-access`
- **`inf-stripe-clock-harness-red`** — Stripe test-clock harness red since 2026-09-24 · platform · fix · S · backend, meta · holds `hg-stripe-key-conditional`
- **`inf-ci-actions-v7`** — Actions v7 bumps by hand · platform · hardening · S · meta
- **`lb-security-scanning-sca`** — pnpm audit, trivy, submodule-history gitleaks · platform · hardening · M · meta · ADR: ADR-0030 amendment (owner of it)
- **`lb-security-scanning-sast`** — semgrep gate · platform · hardening · M · meta, backend, dashboard · merges after `lb-security-scanning-sca` · ADR: Covered by the ADR-0030 amendment
- **`ana-scheduling-read-api`** — Scheduling public read API · sched · feature · M · backend
- **`ana-scheduling-arch-doc`** — docs/architecture/scheduling.md · sched · docs · M · meta
- **`cur-session-wording`** — Live-call copy says session · sched · fix · S · dashboard
- **`lb-recurring-dst-spike`** — Spike: recurring lessons across DST · sched · spike · S · backend · holds `hg-staging-accounts`
- **`adm-staff-shell`** — Dashboard staff shell · admin · feature · M · backend, dashboard · merges after `ana-foundation` · holds *`hg-arabic-review`* · ADR: ADR-0013 amendment (records dec-admin-surface)
- **`msg-realtime-adr`** — Spike and ADR: chat transport · msg · spike · S · backend, meta · ADR: chat transport
- **`lb-billing-state-gaps`** — Paid-through, child nav, dunning banner, price drift · billing · feature · L · backend, dashboard · merges after `inf-stripe-clock-harness-red` · holds *`hg-arabic-review`* · open decisions `lb-dec-price-drift`, `lb-dec-dashboard-created-subs`
- **`rch-i18n-ar-sweep-gate`** — Arabic sweep gate and key parity · i18n · hardening · M · dashboard, meta
- **`rch-i18n-server-strings`** — Localized API text and error codes · i18n · feature · L · backend, dashboard, meta · holds *`hg-arabic-review`* · ADR: API text contract
- **`lb-zod-i18n`** — Localized zod messages · i18n · feature · M · dashboard · holds *`hg-arabic-review`*
- **`rch-pwa-manifest-head`** — Manifest, icons, document head · pwa · feature · S · dashboard
- **`rch-dashboard-code-splitting`** — Route code splitting and bundle budget · pwa · hardening · S · dashboard
- **`rch-mkt-test-harness`** — Marketing test harness · mkt · infra · S · marketing, meta
- **`lb-access-log-redaction`** — No credentials in access logs · sec · hardening · M · backend, dashboard, marketing, infra, meta · holds `hg-vps-access` · ADR: access-log policy
- **`sec-h1`** — Security hardening (described after it ships) · sec · hardening · M · backend · merges after `lb-access-log-redaction` · ADR: published after it ships
- **`sec-h2`** — Security hardening (described after it ships) · sec · hardening · S · infra, backend, meta · holds `hg-dns` · ADR: published after it ships
- **`sec-h3`** — Security hardening (described after it ships) · sec · hardening · M · dashboard, marketing, backend, infra, meta · merges after `lb-error-tracking` · ADR: published after it ships
- **`lb-gdpr-governance-docs`** — GDPR and legal drafts · legal · docs · M · meta, marketing · holds `hg-counsel-review`, `hg-legal-entity`, `hg-owner-commit`
- **`lb-live-captions-decision`** — Clause 7 position and accessibility statement · legal · spike · S · meta · open decisions `lb-dec-en301549` · ADR: ADR-0040 amendment
- **`lb-deploy-pipeline-hardening`** — Deploys that survive the programme's merge rate · ops · hardening · M · meta, infra · holds `hg-shipsh-review`
- **`lb-prod-env-parametrization`** — Make staging-only values environment-driven · ops · infra · M · infra, backend, dashboard, meta · holds `hg-vps-env` · ADR: ADR-0019 amendment
- **`lb-prod-host-dns-tls`** — Production hosts, DNS, TLS · ops · human-task · M · infra, meta · holds `hg-prod-vps`, `hg-dns` · ADR: production topology
- **`lb-uptime-host-alerts`** — Self-hosted uptime checks and host alarms · ops · infra · L · infra, meta · holds `hg-monitoring-host`, `hg-vps-env`, `hg-shipsh-review` · ADR: ADR-0006 amendment (owner of it)
- **`lb-signaling-deploy-continuity`** — Deploys stop dropping live calls · ops · spike · L · infra, backend, dashboard, meta · holds `hg-shipsh-review` · ADR: ADR-0037 amendment
- **`rch-load-test-harness`** — k6 harness and baseline · ops · infra · M · infra, backend
- **`lb-staging-credential-rotation`** — Rotate leaked staging credentials · ops · human-task · S · meta · holds `hg-staging-rotation`
- **`inf-brand-docs-land`** — Land PR #232 with errata · brand · docs · S · meta
- **`inf-fraunces-display-font`** — Headings render Georgia: tokens v0.2.3 · brand · fix · M · tokens, dashboard, marketing, meta
- **`asm-ui-primitives`** — Textarea and RatingInput · brand · feature · S · dashboard
- **`cur-file-upload-primitive`** — File-upload and Avatar primitives · brand · feature · M · dashboard

### Wave 2 (36 units)

Owner and external holds:

- `inf-call-specs-close`: `hg-phone-pass`, `hg-ios-device`, `hg-visual-owed`, `hg-user18-watch`
- `cur-content-storage`: `hg-cur-storage-credentials`, `hg-vps-env`, `hg-vendor-dpa`
- `msg-privacy-docs`: `hg-msg-dpia`, `hg-counsel-review`, `hg-owner-commit`
- `lb-prod-secrets-accounts`: `hg-prod-env`, `hg-ses-production`, `hg-github-prod`
- `lb-prod-deploy-workflow`: `hg-github-prod`
- `lb-prod-admin-ip-allowlist`: `hg-dns`
- `rch-backup-automation`: `hg-offsite-storage`, `hg-vps-access`, `hg-vps-env`, `hg-shipsh-review`, `hg-vendor-dpa`
- `lb-error-tracking`: `hg-monitoring-host`, `hg-vps-env`, `hg-shipsh-review`
- `lb-turn-prod-hardening`: `hg-turn-host`, `hg-dns`
- `rch-redis-caching`: `hg-vps-env`, `hg-shipsh-review`
- `inf-brand-brief-rewrite`: `hg-brand-brief`

Units:

- **`ana-session-outcomes`** — Lesson close-out backend · sched · feature · M · backend · starts after `ci-parallel-guards`
- **`ana-tz-cross-zone-e2e`** — Cairo/London display e2e · sched · hardening · S · dashboard · starts after `cur-session-wording`
- **`lb-parent-acts-for-child`** — Parents book for a child; multi-subject booking · sched · feature · L · backend, dashboard · starts after `cur-session-wording`, `ci-parallel-guards` · holds *`hg-arabic-review`* · open decisions `dec-multi-subject-quota`
- **`lb-recurring-dst-anchoring`** — Anchor recurring lessons per the DST decision · sched · feature · M · backend, dashboard · starts after `lb-recurring-dst-spike`, `ci-parallel-guards` · holds *`hg-arabic-review`* · open decisions `lb-dec-recurring-dst` · ADR: DST anchoring
- **`lb-call-connection-failure-path`** — Signaling connect timeout · sched · fix · S · dashboard · starts after `cur-session-wording` · holds *`hg-arabic-review`*
- **`lb-e2e-seed-gaps`** — e2e: parent sees no Join; change-password · sched · hardening · S · dashboard, backend · starts after `cur-session-wording`, `ci-parallel-guards`
- **`inf-call-specs-close`** — Close C4-C6 and retire the C3e/C4 no-device deviation · sched · docs · S · meta · starts after `inf-fraunces-display-font` · holds `hg-phone-pass`, `hg-ios-device`, `hg-visual-owed`, `hg-user18-watch`
- **`asm-module-foundation`** — Assessment models, typed content, services · asm · feature · M · backend, meta · starts after `plat-module-scaffolds`, `ana-scheduling-read-api`, `plat-dsar-registry`, `ci-parallel-guards` · open decisions `asm-d-report-content`, `asm-d-rating-visibility`, `asm-d-report-audience`, `dec-quran-reference-source`, `dec-student-rating-visibility`
- **`ana-foundation`** — Analytics module, role-sectioned Home, nav restructure · ana · infra · M · backend, dashboard, meta · starts after `plat-module-scaffolds`, `plat-dsar-registry` · holds *`hg-arabic-review`* · open decisions `ana-dec-dashboard-placement`
- **`adm-teacher-onboarding`** — Create teachers, pool membership, password-set · admin · feature · M · backend, dashboard · starts after `adm-staff-shell`, `sec-h1` · holds *`hg-arabic-review`*
- **`adm-families-and-subscriptions`** — Staff view of families, invites, subscriptions · admin · feature · M · backend, dashboard · starts after `adm-staff-shell` · holds *`hg-arabic-review`*
- **`adm-manual-match`** — Staff manual matching for waitlisted students · admin · feature · M · backend, dashboard · starts after `adm-staff-shell`, `ana-scheduling-read-api` · holds *`hg-arabic-review`*
- **`cur-content-storage`** — Content module and durable private storage · content · infra · L · backend, infra, meta · starts after `plat-module-scaffolds`, `plat-dsar-registry` · holds `hg-cur-storage-credentials`, `hg-vps-env`, `hg-vendor-dpa` · ADR: storage and file serving
- **`cur-module-edges-adr`** — ADR: content/curriculum edges and teaching link · curriculum · spike · S · meta, backend · starts after `plat-module-scaffolds` · ADR: This unit is the ADR
- **`cur-course-structure`** — Course builder: Course, Unit, Lesson · curriculum · feature · L · backend, dashboard, meta · starts after `cur-session-wording`, `ci-parallel-guards`, `plat-dsar-registry` · holds *`hg-arabic-review`* · open decisions `dec-cur-ownership`
- **`ntf-mail-e2e-harness`** — mailpit and inbox flows in CI e2e · ntf · infra · M · meta, dashboard, backend · starts after `ci-parallel-guards` · ADR: ADR-0027 amendment
- **`ntf-beat-liveness`** — Beat and worker liveness alarm · ntf · hardening · S · backend, infra · starts after `lb-uptime-host-alerts`
- **`msg-core-backend`** — Direct chats API · msg · feature · L · backend, meta · starts after `plat-module-scaffolds`, `ana-scheduling-read-api`, `plat-dsar-registry` · open decisions `dec-msg-visibility`, `dec-safeguarding-under-18` · ADR: messaging depends on the scheduling API
- **`ntf-recipient-locale-tz`** — Per-user language and timezone · i18n · feature · M · backend, dashboard · starts after `ci-parallel-guards` · holds *`hg-arabic-review`*
- **`rch-i18n-rtl-leak-fixes`** — Fix RTL and l10n leaks · i18n · fix · M · dashboard · starts after `rch-i18n-ar-sweep-gate` · holds *`hg-arabic-review`* · open decisions `rch-d-ar-numerals`
- **`rch-pwa-service-worker`** — Service worker and offline shell · pwa · feature · L · dashboard, meta · starts after `rch-pwa-manifest-head` · holds *`hg-arabic-review`* · open decisions `rch-d-pwa-offline-scope` · ADR: service worker policy
- **`rch-mkt-foundation`** — Marketing shell and i18n routing · mkt · feature · M · marketing, meta · starts after `rch-mkt-test-harness`, `inf-fraunces-display-font` · holds *`hg-arabic-review`*
- **`rch-ratelimit-drf`** — Rate limiting (roadmap E4) · sec · hardening · M · backend, dashboard, meta · starts after `sec-h2` · holds *`hg-arabic-review`* · ADR: rate limiting
- **`lb-gdpr-data-export`** — Self-serve data export · legal · feature · M · backend, dashboard · starts after `plat-dsar-registry` · holds *`hg-arabic-review`*
- **`msg-privacy-docs`** — DPIA addendum for chat and leaderboards · legal · docs · S · meta · starts after `lb-gdpr-governance-docs` · holds `hg-msg-dpia`, `hg-counsel-review`, `hg-owner-commit` · open decisions `dec-msg-visibility`, `dec-msg-moderation`, `dec-msg-attachments`, `dec-eng-leaderboard`, `dec-safeguarding-under-18`
- **`lb-prod-secrets-accounts`** — Production secrets and SES · ops · human-task · S · infra, meta · starts after `lb-prod-host-dns-tls`, `lb-prod-env-parametrization` · holds `hg-prod-env`, `hg-ses-production`, `hg-github-prod`
- **`lb-prod-deploy-workflow`** — Production promotion workflow · ops · infra · M · meta, infra · starts after `lb-prod-env-parametrization`, `lb-deploy-pipeline-hardening`, `lb-prod-host-dns-tls` · holds `hg-github-prod` · open decisions `lb-dec-prod-deploy-trigger` · ADR: promotion model
- **`lb-prod-admin-ip-allowlist`** — Production admin access (ADR-0013) · ops · infra · S · infra, meta · starts after `lb-prod-host-dns-tls` · holds `hg-dns`
- **`rch-backup-automation`** — Nightly encrypted offsite backups · ops · infra · M · infra, meta · starts after `lb-uptime-host-alerts` · holds `hg-offsite-storage`, `hg-vps-access`, `hg-vps-env`, `hg-shipsh-review`, `hg-vendor-dpa` · ADR: backup strategy
- **`lb-error-tracking`** — Self-hosted error tracking for backend and dashboard · ops · hardening · L · backend, dashboard, infra, meta · starts after `lb-uptime-host-alerts` · holds `hg-monitoring-host`, `hg-vps-env`, `hg-shipsh-review` · open decisions `dec-sourcemaps` · ADR: Covered by the ADR-0006 amendment
- **`lb-turn-prod-hardening`** — Dedicated TURN with turns:443 · ops · infra · L · infra, backend, meta · starts after `lb-prod-env-parametrization` · holds `hg-turn-host`, `hg-dns` · ADR: dedicated TURN
- **`rch-redis-caching`** — Redis caching for measured hot reads · ops · hardening · M · backend, infra, meta · starts after `rch-load-test-harness` · holds `hg-vps-env`, `hg-shipsh-review` · ADR: cache topology
- **`inf-brand-brief-rewrite`** — Rewrite the brand brief before any direction pick · brand · docs · S · meta · starts after `inf-brand-docs-land` · holds `hg-brand-brief`
- **`inf-brand-tokens-pipeline`** — Brand pipeline in tokens · brand · infra · M · tokens · starts after `inf-brand-docs-land`, `inf-fraunces-display-font` · merges after `lb-known-wcag-gaps`
- **`lb-known-wcag-gaps`** — Secondary-button contrast (tokens v0.2.4) and unlinked errors · brand · fix · M · tokens, dashboard, marketing, meta · starts after `inf-fraunces-display-font`
- **`plat-mypy-gate`** — mypy clean and gated in CI · platform · hardening · S · backend, meta · starts after `inf-ci-actions-v7`

### Wave 3 (21 units)

Owner and external holds:

- `pay-lesson-completion`: `hg-staging-accounts`
- `cur-resources-library`: `hg-phone-pass`
- `cur-media-backup`: `hg-cur-storage-credentials`, `hg-vendor-dpa`
- `ntf-email-foundation`: `hg-mail-client-render`, `hg-vps-env`
- `rch-pwa-device-verification`: `hg-phone-pass`, `hg-ios-device`
- `rch-restore-drill`: `hg-vps-access`
- `lb-prod-first-deploy`: `hg-first-deploy`
- `inf-brand-direction`: `hg-brand-direction-pick`

Units:

- **`pay-lesson-completion`** — Teacher close-out UI · sched · feature · M · dashboard · starts after `ana-session-outcomes`, `cur-session-wording` · holds `hg-staging-accounts`, *`hg-arabic-review`*
- **`sched-reschedule`** — Reschedule a cancellation made with 24h notice · sched · feature · M · backend, dashboard · starts after `ana-session-outcomes`, `lb-parent-acts-for-child` · holds *`hg-arabic-review`* · open decisions `dec-reschedule`
- **`asm-e2e-fixtures`** — Assessment seed accounts and lesson states · asm · infra · S · backend, dashboard, meta · starts after `asm-module-foundation`, `ana-session-outcomes`, `ci-parallel-guards`
- **`asm-report-api`** — Report write/read and reports-due API · asm · feature · M · backend · starts after `asm-module-foundation`, `ana-session-outcomes` · open decisions `asm-d-report-mandatory`, `asm-d-report-audience`
- **`ana-student-dashboard`** — Student dashboard: next lessons, attendance · ana · feature · M · backend, dashboard, meta · starts after `ana-foundation`, `ana-scheduling-read-api`, `ana-session-outcomes` · holds *`hg-arabic-review`* · open decisions `ana-dec-dashboard-placement`
- **`ana-parent-dashboard`** — Parent dashboard: each child's next lesson · ana · feature · M · backend, dashboard, meta · starts after `ana-foundation`, `ana-scheduling-read-api` · holds *`hg-arabic-review`* · open decisions `ana-dec-parent-quota`, `ana-dec-dashboard-placement`
- **`cur-upload-safety`** — Upload validation · content · hardening · M · backend, meta · starts after `cur-content-storage`, `ci-parallel-guards`
- **`cur-resources-library`** — Teacher resource library · content · feature · L · backend, dashboard, meta · starts after `cur-content-storage`, `cur-file-upload-primitive` · merges after `cur-upload-safety`, `ana-foundation` · holds `hg-phone-pass`, *`hg-arabic-review`* · open decisions `dec-cur-ownership`
- **`cur-media-backup`** — Offsite backup of uploads · content · infra · S · infra, meta · starts after `cur-content-storage`, `rch-backup-automation` · holds `hg-cur-storage-credentials`, `hg-vendor-dpa`
- **`cur-lesson-assignment`** — Assign lessons; student curriculum view · curriculum · feature · M · backend, dashboard, meta · starts after `cur-course-structure`, `cur-module-edges-adr` · holds *`hg-arabic-review`* · open decisions `dec-cur-parent-visibility`
- **`ntf-email-foundation`** — Bilingual HTML email layout rendered in the worker · ntf · infra · M · backend · starts after `ntf-recipient-locale-tz` · holds `hg-mail-client-render`, `hg-vps-env` · ADR: ADR-0018 amendment
- **`ntf-core`** — Notifications module: kinds, notify(), log, preferences · ntf · feature · L · backend, meta · starts after `plat-module-scaffolds`, `ntf-recipient-locale-tz`, `plat-dsar-registry` · open decisions `D-ntf-channels`, `D-ntf-mandatory-kinds` · ADR: every producer edge into notifications
- **`msg-dashboard-ui`** — Messages UI · msg · feature · L · dashboard · starts after `msg-core-backend`, `asm-ui-primitives` · merges after `ana-foundation`, `msg-privacy-docs` · holds *`hg-arabic-review`* · open decisions `dec-msg-visibility`
- **`eng-event-bus`** — Domain event bus · eng · infra · M · backend, meta · starts after `ana-session-outcomes` · ADR: domain event bus
- **`pay-earnings-ledger`** — Teacher rates and earnings ledger · billing · feature · M · backend, meta · starts after `ana-session-outcomes`, `plat-dsar-registry`, `ci-parallel-guards` · merges after `inf-stripe-clock-harness-red` · open decisions `dec-pay-rate-currency` · ADR: scheduling writes earnings via billing
- **`rch-pwa-device-verification`** — PWA install on devices · pwa · human-task · S · meta · starts after `rch-pwa-service-worker` · holds `hg-phone-pass`, `hg-ios-device`
- **`rch-mkt-seo-infra`** — SEO plumbing and indexing policy · mkt · feature · M · marketing, dashboard, infra, meta · starts after `rch-mkt-foundation` · open decisions `dec-indexing` · ADR: Only if a Lighthouse floor is relaxed
- **`lb-gdpr-erasure`** — Account deletion as anonymization · legal · feature · L · backend, dashboard · starts after `lb-gdpr-data-export`, `plat-dsar-registry` · holds *`hg-arabic-review`*
- **`rch-restore-drill`** — First restore drill (staging) · ops · infra · S · meta, infra · starts after `rch-backup-automation` · holds `hg-vps-access`
- **`lb-prod-first-deploy`** — First production deploy: empty-DB infrastructure smoke · ops · human-task · M · meta, infra · starts after `lb-prod-deploy-workflow`, `lb-prod-secrets-accounts`, `lb-turn-prod-hardening`, `lb-prod-admin-ip-allowlist` · holds `hg-first-deploy`
- **`inf-brand-direction`** — Explore against the rewritten brief; owner picks the direction · brand · human-task · M · meta · starts after `inf-brand-brief-rewrite` · holds `hg-brand-direction-pick` · open decisions `dec-brand-typeface`

### Wave 4 (35 units)

Owner and external holds:

- `asm-teacher-report-ui`: `hg-phone-pass`, `hg-staging-accounts`
- `asm-report-views`: `hg-staging-accounts`
- `adm-teacher-application`: `hg-counsel-review`
- `cur-profile-photo`: `hg-phone-pass`
- `cur-content-moderation`: `hg-counsel-review`
- `ntf-identity-emails-relayout`: `hg-mail-client-render`
- `ntf-booking-notifications`: `hg-ses-production`
- `ntf-reminders`: `hg-ses-production`, `hg-staging-reminder-check`, `hg-staging-throwaway-cleanup`
- `ntf-billing-notifications`: `hg-stripe-customer-emails`
- `msg-attachments`: `hg-vps-env`, `hg-phone-pass`
- `msg-realtime`: `hg-vps-env`, `hg-phone-pass`, `hg-shipsh-review`
- `rch-mkt-home`: `hg-marketing-content`
- `rch-mkt-pricing`: `hg-marketing-content`, `hg-counsel-review`
- `rch-mkt-about-curriculum`: `hg-marketing-content`
- `rch-mkt-teachers`: `hg-teacher-consent`
- `rch-mkt-legal-pages`: `hg-legal-entity`, `hg-counsel-review`
- `rch-mkt-apex-hosting`: `hg-dns`
- `lb-prod-ops-apply`: `hg-prod-env`, `hg-vps-access`, `hg-monitoring-host`
- `inf-brand-mark-assets`: `hg-brand-letterforms`, `hg-brand-legibility`

Units:

- **`plat-dev-seed`** — Real seed_basic data · platform · infra · M · backend, meta · starts after `asm-report-api`, `ana-session-outcomes`, `ci-parallel-guards`
- **`sched-teacher-no-show`** — Teacher no-show: report, adjudicate, credit · sched · feature · M · backend, dashboard · starts after `ana-session-outcomes`, `adm-staff-shell`, `ntf-core`, `pay-earnings-ledger` · merges after `inf-stripe-clock-harness-red` · holds *`hg-arabic-review`* · open decisions `dec-teacher-no-show`
- **`asm-teacher-report-ui`** — Teacher report form and Reports due · asm · feature · M · dashboard · starts after `asm-report-api`, `asm-ui-primitives`, `asm-e2e-fixtures`, `pay-lesson-completion` · holds *`hg-arabic-review`*, `hg-phone-pass`, `hg-staging-accounts` · open decisions `asm-d-report-content`, `asm-d-report-mandatory`
- **`asm-report-views`** — Students and parents see reports · asm · feature · M · backend, dashboard · starts after `asm-report-api`, `asm-e2e-fixtures` · merges after `ana-foundation` · holds *`hg-arabic-review`*, `hg-staging-accounts` · open decisions `asm-d-report-audience`
- **`ana-teacher-dashboard`** — Teacher dashboard: today, week, to close · ana · feature · M · backend, dashboard, meta · starts after `ana-foundation`, `ana-scheduling-read-api`, `ana-session-outcomes`, `pay-lesson-completion` · holds *`hg-arabic-review`* · open decisions `ana-dec-dashboard-placement`
- **`adm-sessions-and-teacher-change`** — Session list, end assignment, teacher change · admin · feature · L · backend, dashboard · starts after `adm-staff-shell`, `ana-scheduling-read-api`, `ntf-core` · holds *`hg-arabic-review`*
- **`adm-teacher-application`** — Teacher application and review · admin · feature · L · backend, dashboard, meta · starts after `adm-teacher-onboarding`, `cur-content-storage`, `cur-upload-safety` · holds *`hg-arabic-review`*, `hg-counsel-review` · open decisions `dec-teacher-application`
- **`adm-overview`** — Admin overview · admin · feature · M · backend, dashboard, meta · starts after `adm-staff-shell`, `ana-foundation`, `asm-report-api` · holds *`hg-arabic-review`*
- **`cur-resource-assignment`** — Assign resources; My resources · content · feature · M · backend, dashboard, meta · starts after `cur-resources-library`, `cur-module-edges-adr`, `ana-scheduling-read-api` · holds *`hg-arabic-review`* · open decisions `dec-cur-parent-visibility`, `dec-cur-ownership`
- **`cur-profile-photo`** — Profile photo via content · content · feature · M · backend, dashboard, meta · starts after `cur-content-storage`, `cur-upload-safety`, `cur-file-upload-primitive` · holds `hg-phone-pass`, *`hg-arabic-review`* · open decisions `dec-cur-profile-photos` · ADR: Only if scheduling payloads need photos
- **`cur-content-moderation`** — Rights attestation, reports, takedown · content · feature · M · backend, dashboard, meta · starts after `cur-resources-library`, `cur-course-structure`, `adm-staff-shell` · merges after `ana-foundation` · holds `hg-counsel-review`, *`hg-arabic-review`* · open decisions `dec-cur-copyright`, `dec-cur-ownership`
- **`cur-lesson-resources`** — Attach resources to lessons · curriculum · feature · M · backend, dashboard, meta · starts after `cur-course-structure`, `cur-resources-library`, `cur-module-edges-adr` · holds *`hg-arabic-review`* · open decisions `dec-cur-ownership`
- **`cur-lesson-completion`** — Lesson completion and progress view · curriculum · feature · M · backend, dashboard, meta · starts after `cur-lesson-assignment` · holds *`hg-arabic-review`* · open decisions `dec-cur-parent-visibility`
- **`ntf-identity-emails-relayout`** — Identity emails on the bilingual layout · ntf · hardening · M · backend · starts after `ntf-email-foundation`, `ntf-recipient-locale-tz`, `sec-h1`, `lb-access-log-redaction` · holds *`hg-arabic-review`*, `hg-mail-client-render`
- **`ntf-inapp-feed`** — In-app bell and feed · ntf · feature · L · backend, dashboard · starts after `ntf-core` · merges after `ana-foundation` · holds *`hg-arabic-review`* · open decisions `D-ntf-channels`
- **`ntf-preferences`** — Preferences and one-click unsubscribe · ntf · feature · M · backend, dashboard · starts after `ntf-core`, `ntf-mail-e2e-harness`, `ntf-email-foundation` · holds *`hg-arabic-review`* · open decisions `D-ntf-mandatory-kinds`, `D-ntf-channels` · ADR: unsubscribe endpoint (ADR-0025 requires one per unauthenticated callback)
- **`ntf-booking-notifications`** — Booking and cancellation notifications · ntf · feature · M · backend · starts after `ntf-core`, `ntf-email-foundation`, `ntf-mail-e2e-harness` · holds *`hg-arabic-review`*, `hg-ses-production` · open decisions `D-ntf-parent-recipients`, `D-ntf-pii-in-emails`, `D-ntf-mandatory-kinds`
- **`ntf-reminders`** — 24h and 1h reminders on beat · ntf · feature · L · backend, meta · starts after `ntf-core`, `ntf-email-foundation`, `ntf-beat-liveness`, `ntf-mail-e2e-harness` · holds `hg-ses-production`, `hg-staging-reminder-check`, `hg-staging-throwaway-cleanup`, *`hg-arabic-review`* · open decisions `D-ntf-reminder-timing`, `D-ntf-parent-recipients`, `D-ntf-pii-in-emails` · ADR: Only if it departs from ReminderSchedule
- **`ntf-matching-notifications`** — Match-offer and matched notifications · ntf · feature · M · backend · starts after `ntf-core`, `ntf-email-foundation`, `ntf-mail-e2e-harness` · holds *`hg-arabic-review`* · open decisions `D-ntf-teacher-fanout`, `D-ntf-parent-recipients`, `D-ntf-pii-in-emails`
- **`ntf-billing-notifications`** — Payment-failed and subscription-ended notices · ntf · feature · M · backend, meta · starts after `ntf-core`, `ntf-email-foundation`, `lb-billing-state-gaps` · merges after `inf-stripe-clock-harness-red` · holds `hg-stripe-customer-emails`, *`hg-arabic-review`* · open decisions `D-ntf-mandatory-kinds`
- **`msg-attachments`** — Chat image/PDF attachments · msg · feature · M · backend, dashboard, infra · starts after `msg-core-backend`, `msg-dashboard-ui`, `cur-content-storage`, `cur-upload-safety`, `cur-file-upload-primitive` · holds `hg-vps-env`, `hg-phone-pass`, *`hg-arabic-review`* · open decisions `dec-msg-attachments`, `dec-safeguarding-under-18` · ADR: messaging depends on content (+ contract)
- **`msg-realtime`** — Real-time chat delivery · msg · feature · M · backend, dashboard, infra, meta · starts after `msg-realtime-adr`, `msg-core-backend`, `msg-dashboard-ui` · holds `hg-vps-env`, `hg-phone-pass`, `hg-shipsh-review` · open decisions `dec-msg-realtime` · ADR: Covered by msg-realtime-adr
- **`msg-moderation`** — Reporting, review, suspension, unsend · msg · feature · L · backend, dashboard · starts after `msg-core-backend`, `msg-dashboard-ui`, `adm-staff-shell` · holds *`hg-arabic-review`* · open decisions `dec-msg-moderation`, `dec-safeguarding-under-18`
- **`eng-points-levels`** — Points ledger and levels · eng · feature · M · backend, meta · starts after `eng-event-bus`, `plat-module-scaffolds`, `plat-dsar-registry` · open decisions `dec-eng-audience-points`
- **`pay-payout-runs`** — Monthly payout runs · billing · feature · L · backend, dashboard · starts after `pay-earnings-ledger`, `adm-staff-shell` · merges after `inf-stripe-clock-harness-red` · holds *`hg-arabic-review`* · open decisions `dec-pay-schedule`, `dec-pay-bank-details`
- **`rch-mkt-home`** — Marketing homepage · mkt · feature · M · marketing, meta · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra` · holds `hg-marketing-content`, *`hg-arabic-review`* · open decisions `rch-d-claims-proof`, `rch-d-cta-trial`
- **`rch-mkt-pricing`** — Pricing page · mkt · feature · S · marketing, meta · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra` · holds `hg-marketing-content`, *`hg-arabic-review`*, `hg-counsel-review` · open decisions `rch-d-cta-trial`, `lb-dec-tax` · ADR: price source
- **`rch-mkt-about-curriculum`** — About and curriculum pages · mkt · feature · S · marketing, meta · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra` · holds `hg-marketing-content`, *`hg-arabic-review`* · open decisions `rch-d-claims-proof`
- **`rch-mkt-teachers`** — Meet-the-teachers page · mkt · feature · S · marketing · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra` · holds `hg-teacher-consent`, *`hg-arabic-review`* · open decisions `rch-d-teachers-page`
- **`rch-mkt-blog-scaffold`** — Blog scaffold · mkt · feature · S · marketing · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra`
- **`rch-mkt-legal-pages`** — Publish legal pages · mkt · feature · M · marketing, meta · starts after `rch-mkt-foundation`, `rch-mkt-seo-infra`, `lb-gdpr-governance-docs`, `lb-live-captions-decision` · holds `hg-legal-entity`, `hg-counsel-review`
- **`lb-gdpr-retention-jobs`** — Retention purges for accounts, logs, billing · legal · feature · M · backend · starts after `lb-gdpr-erasure`
- **`rch-mkt-apex-hosting`** — Marketing on the apex domain · ops · infra · S · infra, meta, marketing · starts after `rch-mkt-seo-infra`, `lb-prod-deploy-workflow` · holds `hg-dns`
- **`lb-prod-ops-apply`** — Production backups, alarms, error tracking, restore · ops · infra · M · infra, meta · starts after `lb-prod-host-dns-tls`, `lb-prod-secrets-accounts`, `rch-backup-automation`, `rch-restore-drill`, `lb-uptime-host-alerts`, `lb-error-tracking`, `cur-media-backup` · holds `hg-prod-env`, `hg-vps-access`, `hg-monitoring-host`
- **`inf-brand-mark-assets`** — Mark, lockups, derivatives; tag v0.3.0 · brand · feature · L · tokens · starts after `inf-brand-direction`, `inf-brand-tokens-pipeline` · holds `hg-brand-letterforms`, `hg-brand-legibility` · open decisions `dec-brand-typeface`

### Wave 5 (17 units)

Owner and external holds:

- `asm-ratings`: `hg-phone-pass`, `hg-staging-accounts`
- `prv-preview-mode`: `hg-preview-cohort`, `hg-staging-accounts`, `hg-counsel-review`, `hg-vendor-dpa`, `hg-staging-throwaway-cleanup`
- `lb-prod-stripe-config`: `hg-stripe-activation`, `hg-stripe-config`, `hg-legal-entity`, `hg-stripe-customer-emails`
- `rch-capacity-measurement`: `hg-loadtest-vps`

Units:

- **`asm-ratings`** — Lesson ratings and averages · asm · feature · M · backend, dashboard · starts after `asm-module-foundation`, `asm-ui-primitives`, `asm-report-views`, `asm-e2e-fixtures` · holds *`hg-arabic-review`*, `hg-phone-pass`, `hg-staging-accounts` · open decisions `asm-d-parent-rating`, `asm-d-rating-visibility`, `dec-student-rating-visibility`
- **`asm-report-notices`** — New-report and report-due notices · asm · feature · S · backend · starts after `asm-report-api`, `ntf-core`, `ntf-email-foundation`, `ntf-reminders` · open decisions `asm-d-report-mandatory`, `D-ntf-pii-in-emails`, `D-ntf-parent-recipients` · ADR: Covered by the ntf-core ADR
- **`ana-report-panels`** — Last-report and needs-report panels · ana · feature · M · backend, dashboard, meta · starts after `ana-student-dashboard`, `ana-teacher-dashboard`, `ana-parent-dashboard`, `asm-report-api`, `asm-e2e-fixtures` · holds *`hg-arabic-review`*
- **`prv-preview-mode`** — Preview mode on staging, with its safeguards · ana · human-task · L · meta, backend · starts after `asm-teacher-report-ui`, `asm-report-views`, `ana-student-dashboard`, `ana-parent-dashboard`, `ana-teacher-dashboard`, `lb-staging-credential-rotation`, `lb-signaling-deploy-continuity`, `lb-gdpr-governance-docs` · holds `hg-preview-cohort`, `hg-staging-accounts`, `hg-counsel-review`, `hg-vendor-dpa`, `hg-staging-throwaway-cleanup` · ADR: Preview-review ADR
- **`cur-content-retention`** — Upload and curriculum purge jobs · content · hardening · M · backend, meta · starts after `cur-resource-assignment`, `cur-profile-photo`, `cur-lesson-completion`, `cur-media-backup`
- **`cur-assignment-notifications`** — Notify on resource and lesson assignment · curriculum · feature · S · backend, meta · starts after `cur-resource-assignment`, `cur-lesson-assignment`, `ntf-core`, `ntf-inapp-feed`, `ntf-email-foundation` · open decisions `dec-cur-notify-recipients`, `D-ntf-pii-in-emails` · ADR: Covered by the ntf-core ADR
- **`msg-notifications`** — New-message notifications · msg · feature · S · backend · starts after `msg-core-backend`, `ntf-core`, `ntf-inapp-feed`, `ntf-email-foundation` · ADR: Covered by the ntf-core ADR
- **`msg-retention`** — Message retention purge · msg · feature · S · backend · starts after `msg-core-backend`, `msg-attachments`, `msg-moderation`
- **`eng-streaks`** — DST-correct weekly streaks · eng · feature · M · backend · starts after `eng-points-levels` · open decisions `dec-eng-streak`
- **`eng-leaderboards`** — Opt-in alias leaderboards · eng · feature · M · backend, dashboard · starts after `eng-points-levels` · merges after `ana-foundation`, `msg-privacy-docs` · holds *`hg-arabic-review`* · open decisions `dec-eng-leaderboard`, `dec-safeguarding-under-18`
- **`pay-earnings-dashboard`** — Teacher My earnings · billing · feature · M · backend, dashboard, meta · starts after `pay-earnings-ledger`, `pay-payout-runs`, `pay-lesson-completion` · merges after `ana-foundation` · holds *`hg-arabic-review`*
- **`rch-owasp-walkthrough-b`** — OWASP Top 10 pass for Phase B · sec · docs · M · meta · starts after `sec-h1`, `lb-access-log-redaction`, `rch-ratelimit-drf`, `sec-h3`, `asm-report-api`, `asm-report-views` · open decisions `rch-d-active-security-testing` · ADR: This unit is the ADR
- **`rch-legal-terms-acceptance`** — Stored terms acceptance · legal · feature · S · backend, dashboard · starts after `rch-mkt-legal-pages` · holds *`hg-arabic-review`*
- **`lb-prod-stripe-config`** — Stripe live configuration · ops · human-task · M · meta, backend · starts after `lb-prod-deploy-workflow`, `lb-prod-secrets-accounts`, `rch-mkt-legal-pages` · holds `hg-stripe-activation`, `hg-stripe-config`, `hg-legal-entity`, `hg-stripe-customer-emails` · open decisions `lb-dec-tax`, `lb-dec-stripe-account-api-version`, `dec-plan-price-sync`
- **`rch-capacity-measurement`** — Capacity per VPS size · ops · spike · M · meta, infra · starts after `rch-load-test-harness`, `rch-redis-caching`, `rch-ratelimit-drf`, `msg-realtime`, `cur-upload-safety`, `ntf-reminders`, `eng-event-bus`, `lb-uptime-host-alerts`, `lb-error-tracking` · holds `hg-loadtest-vps` · open decisions `rch-d-loadtest-env`
- **`inf-brand-dashboard`** — Dashboard wordmark and icons · brand · feature · M · dashboard · starts after `inf-brand-mark-assets`, `rch-pwa-manifest-head` · merges after `ana-foundation`
- **`inf-brand-marketing`** — Marketing mark, icons, OG card · brand · feature · S · marketing · starts after `inf-brand-mark-assets`, `rch-mkt-foundation`

### Wave 6 (9 units)

Owner and external holds:

- `ana-phase-b-exit-review`: `hg-visual-review`
- `cur-phase-exit-walk`: `hg-phone-pass`
- `eng-badges`: `hg-badge-catalog`
- `pay-statement-pdf`: `hg-pay-tax-review`, `hg-phone-pass`
- `lb-privacy-notice-final`: `hg-counsel-review`, `hg-owner-commit`
- `inf-brand-email-header`: `hg-mail-client-render`, `hg-vps-env`

Units:

- **`asm-admin-oversight`** — Admin view of reports and ratings · asm · feature · M · backend, dashboard · starts after `asm-ratings`, `asm-report-api`, `adm-staff-shell` · holds *`hg-arabic-review`* · open decisions `asm-d-rating-visibility`
- **`ana-phase-b-exit-review`** — Phase B exit walk and retrospective ADR · ana · docs · S · meta · starts after `ana-report-panels`, `ana-tz-cross-zone-e2e`, `ana-scheduling-arch-doc`, `asm-ratings`, `asm-report-views`, `rch-owasp-walkthrough-b`, `asm-teacher-report-ui` · holds `hg-visual-review` · ADR: Phase B retrospective
- **`cur-phase-exit-walk`** — Prove the content and curriculum exit criteria · curriculum · hardening · S · dashboard, meta · starts after `cur-lesson-resources`, `cur-lesson-completion`, `cur-assignment-notifications` · holds `hg-phone-pass`
- **`eng-badges`** — Auto-awarded badges · eng · feature · M · backend · starts after `eng-points-levels`, `eng-streaks` · holds `hg-badge-catalog`, *`hg-arabic-review`*
- **`pay-statement-pdf`** — Monthly statement PDF · billing · feature · M · backend, dashboard, meta · starts after `pay-payout-runs`, `pay-earnings-dashboard` · holds `hg-pay-tax-review`, `hg-phone-pass`, *`hg-arabic-review`* · open decisions `dec-pay-statement` · ADR: PDF tooling in the image
- **`rch-owasp-walkthrough-launch`** — OWASP Top 10 pre-launch pass · sec · docs · M · meta · starts after `rch-owasp-walkthrough-b`, `cur-upload-safety`, `msg-attachments`, `lb-gdpr-erasure`, `pay-payout-runs`, `adm-sessions-and-teacher-change` · open decisions `rch-d-active-security-testing` · ADR: pre-launch security review
- **`lb-privacy-notice-final`** — Final privacy notice and retention schedule · legal · docs · S · meta, marketing · starts after `lb-gdpr-governance-docs`, `msg-privacy-docs`, `rch-mkt-legal-pages`, `cur-content-retention`, `msg-retention`, `lb-gdpr-retention-jobs` · holds `hg-counsel-review`, `hg-owner-commit`
- **`inf-brand-email-header`** — Swap the email header to the brand raster · brand · feature · S · backend · starts after `inf-brand-marketing`, `ntf-email-foundation` · holds `hg-mail-client-render`, `hg-vps-env`
- **`inf-brand-release-deploy`** — One meta PR for the brand release · brand · infra · S · meta · starts after `inf-brand-dashboard`, `inf-brand-marketing`

### Wave 7 (4 units)

Owner and external holds:

- `phase-c-exit-review`: `hg-staging-reminder-check`, `hg-visual-review`
- `inf-brand-close`: `hg-brand-legibility`

Units:

- **`eng-dashboard-ui`** — Progress UI including the Home streak · eng · feature · M · dashboard, backend, meta · starts after `eng-badges`, `eng-streaks`, `pay-lesson-completion` · merges after `ana-foundation` · holds *`hg-arabic-review`*
- **`eng-more-sources`** — Curriculum and assessment event sources · eng · feature · S · backend · starts after `eng-badges`, `cur-lesson-completion`, `asm-report-api` · open decisions `dec-eng-audience-points`
- **`phase-c-exit-review`** — Phase C exit walk and retrospective ADR · ops · docs · S · meta · starts after `cur-phase-exit-walk`, `ntf-reminders`, `ntf-preferences`, `ntf-identity-emails-relayout` · holds `hg-staging-reminder-check`, `hg-visual-review` · ADR: Phase C retrospective
- **`inf-brand-close`** — Brand usage guide, ADR-0044, D9 · brand · docs · M · meta · starts after `inf-brand-release-deploy`, `inf-brand-email-header` · holds `hg-brand-legibility` · ADR: ADR-0044

### Wave 8 (1 unit)

Owner and external holds:

- `phase-d-exit-review`: `hg-visual-review`

Units:

- **`phase-d-exit-review`** — Phase D exit walk and retrospective ADR · ops · docs · S · meta · starts after `msg-attachments`, `msg-realtime`, `eng-dashboard-ui`, `eng-streaks`, `eng-leaderboards`, `pay-statement-pdf` · holds `hg-visual-review` · ADR: Phase D retrospective

### Wave 9 (1 unit)

Units:

- **`rch-i18n-arabic-copy-review`** — Final native Arabic review · i18n · human-task · M · dashboard, marketing, backend · starts after `phase-c-exit-review`, `phase-d-exit-review`, `rch-i18n-rtl-leak-fixes`, `rch-i18n-server-strings`, `lb-zod-i18n`, `ntf-identity-emails-relayout`, `rch-mkt-home`, `rch-mkt-pricing`, `rch-mkt-about-curriculum`, `rch-legal-terms-acceptance`, `asm-admin-oversight`, `cur-content-moderation`, `sched-teacher-no-show`, `sched-reschedule`, `adm-sessions-and-teacher-change`, `adm-manual-match`, `adm-families-and-subscriptions`, `adm-overview` · holds *`hg-arabic-review`*

### Wave 10 (1 unit)

Owner and external holds:

- `phase-e-exit-review`: `hg-visual-review`

Units:

- **`phase-e-exit-review`** — Phase E exit walk and retrospective ADR · ops · docs · S · meta · starts after `rch-mkt-apex-hosting`, `rch-pwa-device-verification`, `rch-i18n-arabic-copy-review`, `rch-ratelimit-drf`, `lb-prod-ops-apply`, `rch-capacity-measurement`, `rch-mkt-legal-pages`, `rch-mkt-pricing`, `rch-mkt-teachers`, `rch-mkt-blog-scaffold`, `rch-dashboard-code-splitting` · holds `hg-visual-review` · ADR: Phase E retrospective

### Wave 11 (1 unit)

Owner and external holds:

- `launch-go-no-go`: `hg-go-no-go`, `hg-prod-parity`, `hg-support-mailbox`, `hg-counsel-review`

Units:

- **`launch-go-no-go`** — Launch readiness and go/no-go · ops · human-task · M · meta, infra, backend · starts after `lb-prod-first-deploy`, `lb-prod-stripe-config`, `lb-prod-ops-apply`, `ana-phase-b-exit-review`, `phase-c-exit-review`, `phase-d-exit-review`, `phase-e-exit-review`, `lb-staging-credential-rotation`, `lb-signaling-deploy-continuity`, `lb-access-log-redaction`, `sec-h1`, `lb-security-scanning-sca`, `lb-security-scanning-sast`, `lb-gdpr-data-export`, `lb-gdpr-erasure`, `lb-gdpr-retention-jobs`, `lb-privacy-notice-final`, `rch-legal-terms-acceptance`, `rch-owasp-walkthrough-launch`, `lb-billing-state-gaps`, `lb-live-captions-decision`, `inf-fraunces-display-font`, `lb-known-wcag-gaps`, `lb-deploy-pipeline-hardening`, `inf-brand-close`, `sched-teacher-no-show`, `sched-reschedule`, `adm-teacher-onboarding`, `adm-manual-match`, `adm-overview`, `asm-admin-oversight`, `cur-content-moderation`, `msg-moderation`, `msg-retention`, `cur-content-retention`, `eng-more-sources`, `ntf-matching-notifications`, `ntf-billing-notifications`, `ntf-booking-notifications`, `asm-report-notices`, `msg-notifications`, `cur-assignment-notifications`, `pay-earnings-dashboard`, `lb-recurring-dst-anchoring`, `lb-call-connection-failure-path`, `lb-e2e-seed-gaps`, `inf-call-specs-close`, `plat-dev-seed`, `ci-fix-known-flakes`, `adm-teacher-application` · holds `hg-go-no-go`, `hg-prod-parity`, `hg-support-mailbox`, `hg-counsel-review`

### Parked (not scheduled)

Kept visible with stable ids so a revival starts from them. None of them is scheduled, and no
scheduled unit depends on one.

- **`rch-backend-lockfile`** — Hashed backend lockfile (parked) · platform · M · returns if: owner opt-in
  No source in ISSUES, the ADRs, the specs or the roadmap asks for it, and it would make every dependency-adding unit re-lock. Revisit after launch or on the owner's opt-in.
- **`asm-parent-cycle-rating`** — Per-cycle parent rating (parked) · asm · S · returns if: asm-d-parent-rating = per cycle
  Built only if `asm-d-parent-rating` picks the roadmap's per-cycle rating; the recommended per-lesson option drops it.
- **`trl-representation-adr`** — ADR: how a trial lesson is represented (parked) · trial · S · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`trl-request-backend`** — Trial request and one-off trial lesson (parked) · trial · L · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`trl-request-ui`** — Trial request and acceptance UI (parked) · trial · M · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`trl-notifications`** — Trial notifications (parked) · trial · S · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`trl-public-entry`** — Public free-trial entry (parked) · trial · S · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`trl-conversion-continuity`** — Keep the trial teacher on subscribing (parked) · trial · M · returns if: D-trl-exists reversed, then D-trl-continuity = trial teacher first
  Cut with the trials, and also needs `D-trl-continuity` = trial teacher first.
- **`msg-group-chats`** — Group chats (parked) · msg · M · returns if: dec-group-sessions-scope reversed to build
  `dec-group-sessions-scope` = stay deferred (ADR-0046). If ever built, it follows an SFU spike, a class entity and group booking, none of which exist as units.
- **`trl-entitlement`** — Billing trial capability and TrialGrant (parked) · billing · S · returns if: D-trl-exists reversed by a new owner decision and ADR
  `D-trl-exists` = drop (ADR-0046, proposed). Returns only through a new owner decision and an ADR.
- **`rch-legal-age-gate`** — Minimum age at self-registration (parked) · legal · S · returns if: rch-d-minors reversed by a new owner decision (for example after counsel review)
  `rch-d-minors` = no gate (owner, 2026-10-17). Counsel reviews that position with the legal texts; this unit returns only through a new owner decision.
- **`inf-brand-extended-programme`** — Stationery and deck template (parked) · brand · M · returns if: dec-brand-extended-programme = keep
  `dec-brand-extended-programme` = defer. Nothing consumes these assets.
- **`inf-design-sync-disposition`** — Design-sync tooling (parked) · brand · S · returns if: dec-design-sync-disposition = adopt
  `dec-design-sync-disposition` = park; the branch is pushed as a backup. If adopted, it needs a spec and an ADR.

## 7. Serialization rules and the merge queue

- **Meta master merges (each code merge is a staging deploy).** Master is unprotected until base-10; a third queued push cancels the pending one and a docs push can skip a deploy; a green run on a stale merge ref proves nothing about the combination that lands. *Rule:* Only the conductor merges, one PR at a time, docs included. Merge only on a completed all-green run whose tree equals the merge result: compute `git merge-tree --write-tree origin/master <head>` and require its verified-tree artifact, otherwise gh pr update-branch and wait. Then watch the push run to the end. Revert runbook: revert the meta merge, revert the submodule merge commit on main, re-pin, freeze the queue until master is green.
- **Submodule trunks and meta gitlinks.** Submodules have no CI or protection; an unpushed SHA fails checkout; a non-descendant pin drops commits; squash or rebase orphans the tested SHA. *Rule:* Merge submodules only inside the unit's queue slot, --merge only, after the feature contains current main; ancestry guard before every pin. Only the conductor pushes (dec-push-rights).
- **Blue-green deploy window (two code versions, one schema, one broker).** ship.sh starts the new colour (step 5) before migrating (step 7) and stops the old one later (step 8); frontends switch at step 10 and open tabs keep the old bundle; both beats dispatch. *Rule:* Expand/contract in every spec and review: only additive, nullable or db_default columns; NOT NULL changes, renames and drops in a later unit; API and cookie changes accepted by the previous dashboard bundle; new task names deployed one release before anything enqueues them; every beat task idempotent under double dispatch.
- **Staging disk and deploy rate.** ship.sh keeps 24h of images; 74 deploys filled a 75GB disk; step 0 refuses a deploy under 5 GiB free. *Rule:* Until lb-deploy-pipeline-hardening lands, the conductor reads the deploy log's 'Disk now:' line after each deploy, pauses below 15 GiB and uses release trains. Pre-migration dumps stay off /var/lib/docker. The self-hosted monitoring stack's data shares this disk; its budget is in the ADR-0006 amendment.
- **@kaleem/tokens releases.** G3 needs both consumers and the gitlink to match the tag; tagging main with half-built pipeline code ships it. *Rule:* v0.2.3 (Fraunces, --font-quran), then v0.2.4 (secondary button) tagged from main before the pipeline merges, then v0.3.0 (brand). Each release is one three-repo landing with the meta pin in one queue slot; consumer merges freeze during it; a tokens gitlink moves only with a release.
- **dashboard and marketing package.json / pnpm-lock.** Lockfile hunks do not merge; CI uses pnpm 10, the host has pnpm 12. *Rule:* One dependency-changing unit per repo at a time; take main's lockfile and reinstall with pnpm 10.28.0; never hand-merge.
- **Backend requirements, Dockerfile and gate images.** pydantic, storage libs, Pillow, gettext and PDF libs touch them; kaleem-django:latest is the owner's dev image. *Rule:* Gate images are tagged by a hash of the requirements files (`kaleem-gate:<hash>`), built from origin/main's Dockerfile; nobody retags :latest; one dependency-changing unit at a time.
- **Coverage floors.** Concurrent raises conflict; local measurement differs from CI. *Rule:* Per dec-floor-ownership: the conductor sets the CI-measured floor on the unit's branch at the freshness step. The reviewer refuses any decrease in pyproject.toml, vitest.config.ts or .lighthouserc.json without an ADR.
- **Django migrations (every app, including platform and the six new apps).** Two leaves break migrate; RunPython seeds must be mirrored in the reseed fixture. *Rule:* One owning unit per app at a time; the later lander merges main and renumbers (no merge migrations); makemigrations --check in the gate. Notification kinds and event types are validated in Python, so producers never add notifications or platform migrations.
- **Backend registries: api_router, LOCAL_APPS, import-linter.** Every new module appends to all three; contracts define boundaries. *Rule:* plat-module-scaffolds writes them once; ntf-core opens every producer edge into notifications in one PR; other contract changes need the unit's ADR.
- **config/settings/base.py and local.py.** One CELERY_BEAT_SCHEDULE whose times encode order; throttle scopes need e2e overrides; about 70 real-form logins per e2e run share any login limit. *Rule:* The conductor assigns beat slots from a registry of times and ordering constraints; every new throttle scope ships its local.py override in the same PR; real limits are tested with override_settings.
- **scheduling close-out (complete/cancel/claim in booking.py).** Outcomes, earnings, bus publish, notices and no-show credit all hang off it. *Rule:* ana-session-outcomes owns the ordered close-out sequence and its combined matrix test; each later unit adds one step and extends the matrix; never two units in the freshness step at once.
- **dashboard routeTree.gen.ts.** Generated; a stale file is a tsc error, and pnpm build runs tsc first. *Rule:* Take either side, run pnpm exec vite build to regenerate, then pnpm build, commit the result.
- **Translation catalogs.** Dashboard locales are one common.json per language, tab-indented under biome ci; backend makemessages keeps only one side's msgstr. *Rule:* Dashboard: each feature its own top-level key, en and ar together; resolve with a script that fails when both sides changed a key, writes with jq --tab, then biome format. Backend: per-app catalogs (`kaleem/<app>/locale`); CI checks every msgid has an ar msgstr; .mo compiled in the image.
- **Hot UI: nav.ts, AppTopbar, Home, account.tsx, SessionCard.tsx.** About 15 units edit them. *Rule:* ana-foundation lands first and owns the nav restructure; others merge after it and only mount sections or cards; shell e2e updated both ways.
- **Design-system layer: src/ui, index.ts, design-preview.** Shared by every screen; Tailwind scans comments. *Rule:* Only the brand stream edits it, one unit at a time.
- **e2e seeds and fixtures.** CI runs one seeded DB serially within a 15-minute job. *Rule:* Seed manifest from ci-parallel-guards; per-area fixture modules (`e2e/accounts/<area>.ts`) and route lists; seeds pass student_id; a unit that changes a seeded function's signature updates its seeds in the same PR; each spec states its e2e time budget; shard by area before the suite nears the timeout.
- **Export/erase hook registry.** Every module storing personal data must be erasable and exportable. *Rule:* Each such unit registers its hooks in its own PR, with the registry's contract test.
- **Conductor-only docs and ADR numbers.** Single files; sequential numbers. *Rule:* Units send text to the conductor; unit ADRs take numbers from 0047 (0043 is in #232, 0044 is reserved for the brand ADR, 0045 records the execution model, 0046 the v1 roadmap reconciliation). Shared amendments have one owning unit: ADR-0030 lb-security-scanning-sca, ADR-0006 lb-uptime-host-alerts, rate limiting rch-ratelimit-drf.
- **.github/workflows.** PRs run the merged workflow; ci.yml's deploy job copies exactly four infra files. *Rule:* CI-changing units merge one at a time, inf-ci-actions-v7 first, when no meta run is in progress. Any unit adding a VPS file, compose service or deploy step is CI-changing and lists ci.yml and ship.sh.
- **dashboard and marketing nginx.conf.** Log redaction, security hardening and the service worker edit them. *Rule:* One unit at a time.
- **.lighthouserc.json.** Ratchet floors. *Rule:* rch-mkt-seo-infra restructures it; relaxing a floor needs an ADR. The conductor dispatches Lighthouse inside a staging window with the queue paused; cron is a backstop.
- **infra files and staging .env.production.** A missing variable rolls the deploy back; ship.sh's step-4 list silently skips an unlisted service. *Rule:* The owner edits .env.production before the merge (hg-vps-env) and reviews ship.sh changes (hg-shipsh-review); infra units merge one at a time.
- **Staging environment and its account pool.** Every deploy drops live calls; production rate limits apply on staging; preview families will use it. *Rule:* Staging lock with no merges during click-throughs, device checks, spikes and active security tests; during preview, merges only in published windows clear of booked preview lessons. Pool accounts are allocated per unit in step 0; one click-through at a time.
- **Stripe test-clock harness.** Billing's only end-to-end check; dispatches share one concurrency group and a third trigger cancels the pending run. *Rule:* Billing units merge only after a green dispatch on their own meta branch; the conductor dispatches one at a time and treats 'cancelled' as no result.
- **Local CPU, RAM and ports.** Uncapped vitest takes about 4 GB and all cores. *Rule:* 4 heavy slots, --maxWorkers=6, MemAvailable >= 6 GB; e2e only in port slots 1-2; never touch the owner's stack.
- **Actions job pool (20 concurrent).** A code PR uses 6 parallel jobs; every draft meta PR runs the full suite on each re-pin. *Rule:* The conductor hands out at most 3 gating slots before step 8; iterate locally first.

## 8. Open decisions

60 decisions are open. The 45 answered at kickoff are in
`docs/decisions/2026-10-17-v1-kickoff-decisions.md`. A unit waits only for the decisions it
lists. "Recommended" is the default the conductor will propose; the owner answers.

### Before the blocked unit's spec (50)

| Decision | Question | Recommended | Blocks |
| --- | --- | --- | --- |
| `lb-dec-recurring-dst` | How are recurring lessons anchored across DST? | Teacher's local time, and notify students | `lb-recurring-dst-anchoring` |
| `asm-d-report-content` | What does a report contain? | Option 2 ("Plus an optional surah/ayah passage and a focus tag (needs dec-quran-reference-source)") if a licensed reference source exists, else option 1 ("Covered, next, homework, rating") | `asm-module-foundation`, `asm-teacher-report-ui` |
| `asm-d-report-mandatory` | Is a report mandatory for a lesson to count? | Prompted but optional | `asm-report-api`, `asm-teacher-report-ui`, `asm-report-notices` |
| `asm-d-parent-rating` | How do parents rate? | Per lesson; park asm-parent-cycle-rating | `asm-ratings`, `asm-parent-cycle-rating` (parked) |
| `asm-d-rating-visibility` | Who sees ratings of teachers? | Option 2 ("Teacher sees the average only after 3 or more raters; comments admin-only; admin can hide") | `asm-module-foundation`, `asm-ratings`, `asm-admin-oversight` |
| `asm-d-report-audience` | Can a new teacher read earlier reports? | Option 2 ("Plus the current teacher of the same subject"), limited to the last 3 months | `asm-module-foundation`, `asm-report-api`, `asm-report-views` |
| `ana-dec-dashboard-placement` | Where do the role dashboards live? | Home, one section per profile; remove /insights | `ana-foundation`, `ana-student-dashboard`, `ana-teacher-dashboard`, `ana-parent-dashboard` |
| `ana-dec-parent-quota` | Show lessons left per child? | Yes | `ana-parent-dashboard` |
| `dec-eng-streak` | Streak definition and week start? | Option 1 ("Saturday-to-Friday weeks with at least 1 delivered lesson; empty weeks, teacher cancellations and timely cancellations freeze it") | `eng-streaks` |
| `dec-eng-audience-points` | Who earns points, and for what? | Students only | `eng-points-levels`, `eng-more-sources` |
| `dec-eng-leaderboard` | Leaderboards with minors? | Opt-in, aliases only | `eng-leaderboards`, `msg-privacy-docs` |
| `dec-cur-ownership` | Who owns resources and courses? | Option 1 ("Private to the teacher; students keep access after a teacher change") | `cur-resources-library`, `cur-resource-assignment`, `cur-content-moderation`, `cur-course-structure`, `cur-lesson-resources` |
| `dec-cur-parent-visibility` | What can parents see of assigned material? | Read-only | `cur-resource-assignment`, `cur-lesson-assignment`, `cur-lesson-completion` |
| `dec-cur-profile-photos` | Who may have a profile photo? | Teachers only; public use only with opt-in | `cur-profile-photo` |
| `dec-cur-copyright` | Rights terms for teacher uploads? | Option 1 ("Teacher owns, kaleem licensed, attestation and takedown") | `cur-content-moderation` |
| `dec-cur-notify-recipients` | Who is notified of an assignment? | Option 1 ("Student in-app and email, parents email, one per bulk") | `cur-assignment-notifications` |
| `D-ntf-pii-in-emails` | Names in lesson emails? | No names | `asm-report-notices`, `cur-assignment-notifications`, `ntf-booking-notifications`, `ntf-reminders`, `ntf-matching-notifications`, `trl-notifications` (parked) |
| `D-ntf-parent-recipients` | Do parents receive children's lesson notices? | Yes, switchable | `asm-report-notices`, `ntf-booking-notifications`, `ntf-reminders`, `ntf-matching-notifications` |
| `D-ntf-mandatory-kinds` | Which notifications can be switched off? | Option 1 ("Security, payment and cancellation mandatory; the rest switchable"). *Note:* With kaleem the only sender of payment notices, payment notices must stay mandatory. | `ntf-core`, `ntf-preferences`, `ntf-booking-notifications`, `ntf-billing-notifications` |
| `D-ntf-reminder-timing` | Reminder timing? | Option 1 ("24h and 1h before, in the recipient's zone") | `ntf-reminders` |
| `D-ntf-channels` | Which channels? | Email and in-app | `ntf-core`, `ntf-inapp-feed`, `ntf-preferences` |
| `D-ntf-teacher-fanout` | Which teachers hear about waiting students? | Option 1 ("All eligible teachers, in-app and email") | `ntf-matching-notifications`, `trl-notifications` (parked) |
| `D-trl-account-required` | Account required before a trial? | Verified account | `trl-request-backend` (parked), `trl-public-entry` (parked) — *moot while trials are cut* |
| `D-trl-page-location` | Where is the trial entry point? | CTA | `trl-request-ui` (parked), `trl-public-entry` (parked) — *moot while trials are cut* |
| `D-trl-approver` | Who approves trials? | Teacher self-serve | `trl-request-backend` (parked), `trl-request-ui` (parked) — *moot while trials are cut* |
| `D-trl-duration` | Trial length? | 60 min | `trl-representation-adr` (parked), `trl-request-backend` (parked) — *moot while trials are cut* |
| `D-trl-continuity` | Keep the trial teacher after subscribing? | Broadcast at launch (trl-conversion-continuity stays parked) | `trl-conversion-continuity` (parked) — *moot while trials are cut* |
| `dec-msg-visibility` | Who chats with whom; do parents read? | Option 1 ("Direct student/teacher and parent/teacher chats; parents read but do not post") | `msg-core-backend`, `msg-dashboard-ui`, `msg-privacy-docs` |
| `dec-msg-moderation` | How is abuse handled? | Reactive, plus the under-18 rules of dec-safeguarding-under-18 | `msg-moderation`, `msg-privacy-docs` |
| `dec-msg-attachments` | Which attachments? | Option 1 ("Images and PDF up to 10 MB, EXIF stripped") | `msg-attachments`, `msg-privacy-docs` |
| `dec-pay-rate-currency` | Teacher rate and payout currency? | Option 1 ("Per-teacher rate over time, one currency") | `pay-earnings-ledger` |
| `dec-pay-schedule` | Payout period? | Option 1 ("Calendar month UTC, 5-day dispute window, paid by the 10th") | `pay-payout-runs` |
| `dec-pay-bank-details` | Store bank details? | No | `pay-payout-runs` |
| `dec-pay-statement` | Statement content and language? | Option 1 ("Informational, teacher's language, first name and initial") | `pay-statement-pdf` |
| `rch-d-claims-proof` | Which claims may marketing make? | Shipped behaviour only | `rch-mkt-home`, `rch-mkt-about-curriculum` |
| `rch-d-cta-trial` | Primary CTA? | Option 1 ("Get started; switch to trial if trials ship"). *Note:* Trials are cut, so its trial branch no longer applies. | `trl-public-entry` (parked), `rch-mkt-home`, `rch-mkt-pricing` |
| `rch-d-teachers-page` | Real teachers on the site? | Opt-in, with a fallback page | `rch-mkt-teachers` |
| `rch-d-loadtest-env` | Where do load tests run? | Throwaway VPSes | `rch-capacity-measurement` |
| `rch-d-active-security-testing` | Active testing on staging? | Option 1 ("Scheduled in a staging window with a throwaway account, never during preview lessons") | `rch-owasp-walkthrough-b`, `rch-owasp-walkthrough-launch` |
| `rch-d-pwa-offline-scope` | What is cached offline? | Shell only | `rch-pwa-service-worker` |
| `lb-dec-tax` | Collect VAT, and show tax-inclusive prices? | automatic_tax with tax-inclusive display | `rch-mkt-pricing`, `lb-prod-stripe-config` |
| `lb-dec-prod-deploy-trigger` | Who promotes to production? | Owner approves | `lb-prod-deploy-workflow` |
| `dec-brand-typeface` | Typeface for the Arabic outlines? | Follow the chosen direction | `inf-brand-direction`, `inf-brand-mark-assets` |
| `dec-teacher-no-show` | Teacher no-show: who reports, what remedy, pay? | Option 1 ("Student or parent reports inside the close-out window; staff adjudicate reschedule or +1 next cycle; teacher not paid; staff notified") | `sched-teacher-no-show` |
| `dec-reschedule` | Rescheduling a cancellation with 24h notice? | Option 1 ("Refunded unit spendable on a one-off slot in the same cycle") | `sched-reschedule` |
| `dec-multi-subject-quota` | Quota for a student taking two subjects? | Quota per student across subjects | `lb-parent-acts-for-child` |
| `dec-teacher-application` | Teacher applications (Flow 3, BR-12) in v1? | Option 1 ("In v1: CV and certificate uploads, intro video as a link, admin-configurable fields") | `adm-teacher-application` |
| `dec-quran-reference-source` | Source of surah/ayah reference data? | Option 2 ("Surah number and ayah range only, no text") | `asm-module-foundation` |
| `dec-safeguarding-under-18` | Safeguarding rules for under-18s, linked parent or not? | Option 1 ("By age: parent-visible chat for under-18s, images from teachers only, retention as decided, a reporting route, teacher vetting recorded before pool entry"), with counsel input | `msg-core-backend`, `msg-attachments`, `msg-moderation`, `eng-leaderboards`, `rch-legal-age-gate` (parked), `msg-privacy-docs` |
| `dec-student-rating-visibility` | Who sees ratings teachers give students, and for how long? | Staff only, 12 months | `asm-module-foundation`, `asm-ratings` |

### During build (10)

| Decision | Question | Recommended | Blocks |
| --- | --- | --- | --- |
| `D-trl-teacher-pay` | Pay for trial lessons? | Normal rate | `trl-request-backend` (parked) — *moot while trials are cut* |
| `dec-msg-realtime` | Chat transport? | Polling only until the spike reports; then the ADR's pick | `msg-realtime` |
| `rch-d-ar-numerals` | Arabic digits? | CLDR default | `rch-i18n-rtl-leak-fixes` |
| `dec-indexing` | Indexing of the app and staging? | Noindex app and staging | `rch-mkt-seo-infra` |
| `dec-sourcemaps` | Source maps? | Hidden. *Note:* Hidden source maps go to the self-hosted tracker (`lb-error-tracking`). | `lb-error-tracking` |
| `lb-dec-stripe-account-api-version` | Upgrade Stripe from basil to dahlia? | Upgrade before creating the live webhook | `lb-prod-stripe-config` |
| `lb-dec-price-drift` | Flag price drift? | Yes | `lb-billing-state-gaps` |
| `lb-dec-dashboard-created-subs` | Adopt subscriptions created in the Stripe dashboard? | Never | `lb-billing-state-gaps` |
| `lb-dec-en301549` | Captions now or later? | Option 1 ("State the gap; captions post-launch") | `lb-live-captions-decision` |
| `dec-plan-price-sync` | Programmatic Plan/Price sync with Stripe? | Manual with a runbook | `lb-prod-stripe-config` |

## 9. Human gates

47 gate types. *owner* is a decision or review; *owner-access* needs the owner's accounts or
hosts; *owner-device* needs a real device; *external* waits on someone outside the project.

| Gate | Who | What | Holds |
| --- | --- | --- | --- |
| `hg-staging-accounts` | owner-access | Staging account pool per role plus lesson states (Django shell until ci-staging-pool-seed exists, then its daily run); also the DST spike's staging lessons straddling 10-25. Credentials go out of band. | `pay-lesson-completion`, `lb-recurring-dst-spike`, `asm-teacher-report-ui`, `asm-report-views`, `asm-ratings`, `prv-preview-mode` |
| `hg-vps-env` | owner-access | Add each new variable to staging's .env.production before the merge that reads it (a missing variable rolls the deploy back). | `cur-content-storage`, `ntf-email-foundation`, `msg-attachments`, `msg-realtime`, `lb-prod-env-parametrization`, `rch-backup-automation`, `lb-error-tracking`, `lb-uptime-host-alerts`, `rch-redis-caching`, `inf-brand-email-header` |
| `hg-shipsh-review` | owner | Owner reviews a ship.sh, compose-service or deploy-step change before its merge. | `msg-realtime`, `lb-deploy-pipeline-hardening`, `rch-backup-automation`, `lb-error-tracking`, `lb-uptime-host-alerts`, `lb-signaling-deploy-continuity`, `rch-redis-caching` |
| `hg-vendor-dpa` | owner | A signed DPA (and sub-processor entry) for each vendor before it receives personal data: storage, offsite backup, SES. Monitoring is self-hosted, so it needs none. | `prv-preview-mode`, `cur-content-storage`, `cur-media-backup`, `rch-backup-automation` |
| `hg-owner-commit` | owner | The owner commits a written-not-auto-committed document; that commit is the unit's done state. | `lb-gdpr-governance-docs`, `msg-privacy-docs`, `lb-privacy-notice-final` |
| `hg-phone-pass` | owner-device | Batched D9 pass on a real Android phone. | `inf-call-specs-close`, `asm-teacher-report-ui`, `asm-ratings`, `cur-resources-library`, `cur-profile-photo`, `cur-phase-exit-walk`, `msg-attachments`, `msg-realtime`, `pay-statement-pdf`, `rch-pwa-device-verification` |
| `hg-ios-device` | owner-device | Scheduled pass on the owner's iOS device (dec-ios-manual-pass: run the pass), batched with hg-phone-pass in that wave's owner device session: in wave 2 (inf-call-specs-close), the C3e-a/b iOS checks (viewport height, gesture gate, tap-to-play, page suspension, diagnostics arriving from a real iOS client) plus the C4-C6 call pass; in wave 3, the PWA install (rch-pwa-device-verification). inf-call-specs-close then adds an iOS-verified line to the C3e-a/b specs and their CLAUDE.md D3 rows, retiring the no-device deviation (journal 2026-W36). | `inf-call-specs-close`, `rch-pwa-device-verification` |
| `hg-arabic-review` | owner | Arabic copy and religious terms, reviewed in batches per wave. Holds spec closure, not merges. | spec closure of 62 scheduled text-adding units (marked in the unit lines) |
| `hg-visual-owed` | owner | The owed C5/C6 visual checks, after the Fraunces deploy. | `inf-call-specs-close` |
| `hg-visual-review` | owner-device | Role dashboards and phase-exit surfaces in both themes, RTL and on a phone. | `ana-phase-b-exit-review`, `phase-c-exit-review`, `phase-d-exit-review`, `phase-e-exit-review` |
| `hg-user18-watch` | owner-access | One staging query: is user 18's gum-not-found still arriving. | `inf-call-specs-close` |
| `hg-brand-brief` | owner | Say what the current brief gets wrong, then approve the rewritten docs/brand/brief.md before any new exploration (dec-brand-direction: rewrite brief). | `inf-brand-brief-rewrite` |
| `hg-brand-direction-pick` | owner | Verdict and pick from the new round explored against the rewritten brief (dec-brand-direction: rewrite brief); no fallback direction was agreed. | `inf-brand-direction` |
| `hg-brand-letterforms` | owner | Arabic letterform sign-off before the v0.3.0 tag. | `inf-brand-mark-assets` |
| `hg-brand-legibility` | owner | Legibility at 16 and 32px. | `inf-brand-mark-assets`, `inf-brand-close` |
| `hg-design-sync-run` | owner-access | Owner-run re-sync; settle which project is canonical (only if adopted). | `inf-design-sync-disposition` (parked) |
| `hg-stripe-key-conditional` | owner-access | Rotate the Stripe test key, only if diagnosis shows it is the cause. | `inf-stripe-clock-harness-red` |
| `hg-mail-client-render` | owner-device | Gmail, Outlook and Android mail clients; same session closes the Phase A real-inbox residual. | `ntf-email-foundation`, `ntf-identity-emails-relayout`, `inf-brand-email-header` |
| `hg-support-mailbox` | owner-access | Create and route the support address and its env var before launch (staging uses a default). | `launch-go-no-go` |
| `hg-ses-production` | owner-access | SES production access, DKIM/SPF/DMARC and suppression. | `ntf-booking-notifications`, `ntf-reminders`, `trl-notifications` (parked), `lb-prod-secrets-accounts` |
| `hg-staging-reminder-check` | owner | A lesson 24h15m out on staging; each reminder arrives once. | `ntf-reminders`, `phase-c-exit-review` |
| `hg-staging-throwaway-cleanup` | owner-access | Remove throwaway example.com staging users; before reminders go live and before preview. | `prv-preview-mode`, `ntf-reminders` |
| `hg-stripe-customer-emails` | owner-access | Stripe's own failed-payment customer emails switched off, so kaleem is the only sender (dec-dunning: kaleem only): confirmed before ntf-billing-notifications merges and set again in live mode at lb-prod-stripe-config. | `ntf-billing-notifications`, `lb-prod-stripe-config` |
| `hg-cur-storage-credentials` | owner-access | Bucket, least-privilege key and env vars. | `cur-content-storage`, `cur-media-backup` |
| `hg-counsel-review` | external | Counsel reviews legal texts, the preview notice and consent, DPIA and addenda, the no-age-gate position (rch-d-minors: GDPR Art 8 and COPPA exposure), tax-inclusive pricing and the content licence; batched. | `prv-preview-mode`, `adm-teacher-application`, `cur-content-moderation`, `rch-mkt-pricing`, `rch-mkt-legal-pages`, `lb-gdpr-governance-docs`, `rch-legal-age-gate` (parked), `msg-privacy-docs`, `lb-privacy-notice-final`, `launch-go-no-go` |
| `hg-legal-entity` | owner | Entity, governing law and controller contact. | `rch-mkt-legal-pages`, `lb-gdpr-governance-docs`, `lb-prod-stripe-config` |
| `hg-pay-tax-review` | external | Accountant review of the statement. | `pay-statement-pdf` |
| `hg-badge-catalog` | owner | Approve the badge catalog. | `eng-badges` |
| `hg-msg-dpia` | owner | DPIA sign-off (after counsel review). | `msg-privacy-docs` |
| `hg-marketing-content` | owner | About, subject and pricing copy. | `rch-mkt-home`, `rch-mkt-pricing`, `rch-mkt-about-curriculum` |
| `hg-teacher-consent` | owner | Teacher bios and consent. | `rch-mkt-teachers` |
| `hg-dns` | owner-access | Cloudflare records, proxy modes and redirects. | `sec-h2`, `lb-prod-host-dns-tls`, `lb-prod-admin-ip-allowlist`, `lb-turn-prod-hardening`, `rch-mkt-apex-hosting` |
| `hg-offsite-storage` | owner-access | Offsite bucket and encryption key. | `rch-backup-automation` |
| `hg-vps-access` | owner-access | SSH work: backup timer, drill host, log purge, staging pool seed runs. | `ci-staging-pool-seed`, `lb-access-log-redaction`, `rch-backup-automation`, `rch-restore-drill`, `lb-prod-ops-apply` |
| `hg-loadtest-vps` | owner-access | Throwaway VPSes and their cost. | `rch-capacity-measurement` |
| `hg-prod-vps` | owner-access | Production VPS and firewall, sized to include the self-hosted monitoring budget from the ADR-0006 amendment where monitoring runs on it. | `lb-prod-host-dns-tls` |
| `hg-turn-host` | owner-access | TURN host and firewall rules. | `lb-turn-prod-hardening` |
| `hg-prod-env` | owner-access | Production .env.production, including every variable added since it was cut. | `lb-prod-secrets-accounts`, `lb-prod-ops-apply` |
| `hg-github-prod` | owner-access | Production secrets and environment reviewer. | `lb-prod-secrets-accounts`, `lb-prod-deploy-workflow` |
| `hg-stripe-activation` | external | Stripe live activation and KYC. | `lb-prod-stripe-config` |
| `hg-stripe-config` | owner-access | Stripe live prices, webhook, portal and tax. | `lb-prod-stripe-config` |
| `hg-monitoring-host` | owner-access | Room for the self-hosted monitoring stack (lb-dec-monitoring-services): RAM and disk on each host it runs on, sized by the ADR-0006 amendment against measured free memory, and a place off the monitored box for the uptime checks so a dead host is still reported; admin credentials out of band. | `lb-error-tracking`, `lb-uptime-host-alerts`, `lb-prod-ops-apply` |
| `hg-staging-rotation` | owner-access | Staging credential rotation. Deferral accepted and not re-escalated; due before real users (preview) per its own record. | `lb-staging-credential-rotation` |
| `hg-first-deploy` | owner | Go for the empty-DB production infrastructure deploy (no real users or money). | `lb-prod-first-deploy` |
| `hg-prod-parity` | owner-access | Production carries every env var, bucket and service added after the production env was cut. | `launch-go-no-go` |
| `hg-go-no-go` | owner | Launch go/no-go plus a live purchase and refund. | `launch-go-no-go` |
| `hg-preview-cohort` | owner | Recruit and run the preview cohort, including a teacher-fit check. | `prv-preview-mode` |

## 10. Process deviations

Recorded, not silent. The details are in the records named.

| Rule | Deviation | Recorded in |
| --- | --- | --- |
| D6: one feature branch at a time | Parallel streams (at most 6 writers) feed one merge queue the conductor runs. | ADR-0045; journal 2026-W42 |
| Roadmap Section 3: no phase starts before the previous exit is green | Phases B–E overlap; each still gets an exit walk and a retrospective ADR, and launch needs all four. | ADR-0045 |
| Roadmap: preview mode gates every Phase C spec | Preview runs alongside the build once its safeguards land. | ADR-0045; the preview-review ADR |
| D9: manual browser click-through | Agent Playwright click-through per unit, owner device sessions batched per wave (iOS on the owner's device), owner sessions for children's data or money. | ADR-0045; a D9 line per unit; the journal |
| ADR-0026: the PR that lifts coverage raises the floor | The conductor sets the CI-measured floor on the unit's branch at freshness. | ADR-0045 |
| `/new-feature`: spec approved before code | The conductor approves routine specs; the owner approves children's data, money, legal text and new product behaviour. | ADR-0045 |
| Landing: merge the submodule, then prove it | The tested feature SHA is proven in a meta PR first and pinned (tokens releases excepted). | ADR-0045; `docs/runbook/ci.md` |
| ADR-0032: leaked credentials are rotated | The staging rotation stays deferred, unchanged in severity; it precedes preview and launch. | Journal 2026-W42; `ISSUES.md` |
| D11: sustainable pace | Owner time batched into kickoff, review and device sessions; energy and backlog triggers pause new waves. | ADR-0045; the weekly journal |
| Roadmap v1 scope: trial sessions (line 48; C4, lines 532–536; exit criterion, line 542) | Cut; the trial units are parked. | ADR-0046 (proposed) |
| Roadmap v1 scope: group sessions | Stay deferred; group chats parked; cohort boards instead of per-class ones. | ADR-0034; ADR-0046; the scope decision record |
| Product spec: "Out of Scope (v1)" | The full v1 supersedes the lines it builds. | `docs/decisions/2026-10-17-v1-scope-supersedes-product-spec.md` |
| Roadmap items redefined by kickoff answers (EmailTemplate, ProgressSnapshot, the admin surface) | Changed by the answers; the per-cycle parent rating and the 30-day streak follow when decided. | ADR-0046; an ADR-0013 amendment (admin surface) |
| D1: a committed spec before any code | The security units' specs and plans (ADR-0045 §4) are written and approved privately and committed publicly after the fix deploys; findings go to a private advisory until then. | ADR-0045 §4 (`rch-d-security-disclosure`) |

## 11. Risks

- **Calendar time is set by owner and external gates (legal entity, counsel, Stripe KYC, VPS/DNS, brand brief rewrite and pick, Arabic review) and by writer capacity, not by the precedence critical path.** *Mitigation:* Per-unit gating, kickoff batching, weekly owner sessions; the summary reports both the precedence path and a capacity-aware estimate; re-plan after wave 1.
- **Owner load: 60 decisions still open after the 45 answered at kickoff (6 of them only gate parked trial units) and 47 gate types, on a solo developer whose R2 warning sign (a month without commits) is visible.** *Mitigation:* Defaults pre-filled; only before-start decisions at kickoff; energy and backlog triggers pause new waves; E4 offered at kickoff and not taken (dec-launch-shape: full v1 first); it returns only to the owner, through the escalation trigger.
- **Preview puts real children on a shared staging that deploys several times an hour.** *Mitigation:* Preview waits for rotation, counsel-approved notice and consent, DPAs, cleanup, is_in_pool isolation and deploy windows; agents never act on real users' records.
- **Blue-green deploys run two code versions on one schema and broker.** *Mitigation:* Expand/contract rule in spec and review; idempotent beat tasks; task names deployed before use.
- **Staging disk fills at the planned deploy rate.** *Mitigation:* lb-deploy-pipeline-hardening heads the infra queue; the conductor reads 'Disk now:' and pauses below 15 GiB; release trains.
- **The content chain runs 3 working days off the critical path; its storage and bucket gates (hg-cur-storage-credentials, hg-vendor-dpa) can make it critical.** *Mitigation:* Its decisions were answered at kickoff; the library develops against filesystem storage and merges after upload safety (merge_after); the bucket gate is asked early.
- **Seven-plus units touch the scheduling close-out.** *Mitigation:* One ordered close-out sequence with a combined matrix test owned by ana-session-outcomes.
- **Nothing in GitHub enforces green-before-merge on the private submodules.** *Mitigation:* dec-push-rights: only the conductor pushes and merges, enforced for sub-agents by the owner's deny rules (base-08b); base-10 protects meta master and disables squash/rebase.
- **CI lacks storage, coturn and real mail delivery, so some paths look tested when they are not.** *Mitigation:* Worker and mailpit in e2e; fakes stated in each D3 row; staging checks for the rest.
- **Tests pass on broken builds.** *Mitigation:* Implementer and reviewer both mutation-check; reload assertions use different data; negative assertions paired with positive controls.
- **Module boundaries erode; the platform contract checked nothing.** *Mitigation:* Forbidden contract mutation-checked in plat-module-scaffolds; registries filled at AppConfig.ready(); producer edges opened once by ntf-core.
- **Minors' data spreads across new modules.** *Mitigation:* plat-dsar-registry joined by every personal-data unit; ADR-0023's four points in every spec; dec-safeguarding-under-18; DPIA gates chat.
- **Hot UI and catalog files edited by about 15 units.** *Mitigation:* ana-foundation first; merge_after edges; scripted locale resolution; per-app backend catalogs.
- **Brand taste stalls the tokens work, and with no fallback direction agreed, the launch.** *Mitigation:* v0.2.3 and v0.2.4 do not wait for it. The direction restarts at a rewritten brief (dec-brand-direction) and the owner did not take the N4 fallback, so nothing is picked by default: the mark, consumer, release and close units wait on the pick, and launch-go-no-go waits on inf-brand-close. The brief rewrite and the pick are batched owner sessions (hg-brand-brief, hg-brand-direction-pick).
- **Host memory exhaustion.** *Mitigation:* 4 heavy slots, at most 6 writers.
- **Facts drift while units run.** *Mitigation:* Each spec re-measures its premise; the conductor re-reads state before every merge.
- **DST switches (10-25 London, 10-29 Cairo, 11-01 New York) move staging lessons.** *Mitigation:* Spike exempt from wave gating with staging lessons seeded before 10-25; frozen-clock fallback; no launch near a switch.
- **The serial e2e job (15-minute timeout) grows past its budget.** *Mitigation:* Per-spec time budgets; shard by area before the Arabic sweep lands.
- **No minimum self-registration age (rch-d-minors: no gate). Children under the GDPR Art 8 digital-consent age (13-16 by member state), and under-13s under COPPA if US families sign up, can open accounts without verified parental consent, so the lawful basis for their data may fail. A launch risk the owner accepted after the warning.** *Mitigation:* Counsel reviews the position with the legal texts (hg-counsel-review on lb-gdpr-governance-docs, rch-mkt-legal-pages and launch-go-no-go), and launch-go-no-go records counsel's answer. rch-legal-age-gate stays parked, so a gate counsel requires becomes a new owner decision rather than unplanned work; parent-created child accounts remain the route for young children.
- **kaleem is the only sender of payment-failed notices (dec-dunning: kaleem only). If its notice pipeline fails (worker, beat, SES), a payer hears nothing before the subscription ends; the staged option kept Stripe's emails as a backstop.** *Mitigation:* ntf-billing-notifications is asserted by the stripe-clock harness; ntf-beat-liveness alarms on a stale worker or beat; the lb-billing-state-gaps banner shows in-app; launch-go-no-go depends on ntf-billing-notifications.
- **Self-hosted monitoring (lb-dec-monitoring-services) adds standing work for a solo owner: RAM and disk on the VPS, its own backups and upgrades, and a monitor that can fail silently.** *Mitigation:* The ADR-0006 amendment (lb-uptime-host-alerts) sets a per-host budget against measured free memory, the backup scope, pinned versions with an upgrade cadence, and how a dead monitor gets noticed; hg-monitoring-host provisions room before the monitoring units merge; rch-capacity-measurement includes the stack. ADR-0006 already accepted a small ops burden.

## 12. Verification

- **Each unit** proves itself through steps 5–12: TDD with mutation-checked regression tests,
  the local gates, an independent review, CI on the exact merge tree, a staging deploy watched to
  the end, an agent click-through and the batched owner sessions.
- **Each phase** ends with an exit walk and a retrospective ADR, checked on real devices in both
  themes and in RTL (`hg-visual-review`): `ana-phase-b-exit-review` (wave 6),
  `phase-c-exit-review` (wave 7), `phase-d-exit-review` (wave 8) and `phase-e-exit-review`
  (wave 10).
- **Launch** is `launch-go-no-go` (wave 11): every *Blocks launch* closer, production parity,
  counsel's answer on the no-age-gate position, the support mailbox, then a live purchase and a
  refund.
- **The programme itself** is re-planned after wave 1 with measured velocity. The weekly
  stripe-clock and Lighthouse runs, `STATE.md` and the weekly journal show where it stands.
