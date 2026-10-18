---
title: The full v1 supersedes the product spec's out-of-scope lines; group sessions stay deferred
status: accepted
date: 2026-10-17
decided-by: the owner — the full-v1 choice of 2026-10-17 (journal 2026-W42, ADR-0005) and dec-group-sessions-scope on the kickoff sheet. Drafted by the conductor for the owner to commit (base-05).
supersedes: the lines of "Out of Scope (v1)" in docs/superpowers/specs/2026-06-08-kaleem-product-spec.md that this record marks superseded
superseded-by: null
---

## Context

The product spec (`docs/superpowers/specs/2026-06-08-kaleem-product-spec.md`, status approved)
lists eight items under "Out of Scope (v1)", at lines 212–221. It describes a smaller v1 than the
one the roadmap commits to: the roadmap's v1 (line 48 of
`docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md`, ADR-0005) includes gamification,
in-app chat, a curriculum builder and Arabic. On 2026-10-17 the owner chose to build the full v1
before launch (ADR-0045; ADR-0046, proposed).

So the two documents disagree, and a unit spec citing the product spec would be citing a scope
the plan does not follow. The messaging and engagement streams start only after this record is
committed (base-05).

## Decision

**Where the full v1 builds something the product spec lists as out of scope, the full v1
wins.** Line by line:

| Product spec line | Out of scope there | In the full v1 | Disposition |
| --- | --- | --- | --- |
| 214 | Group sessions (class with multiple students) | Not built. Group sessions stay deferred (ADR-0034, `dec-group-sessions-scope`); group chats are parked with them. | **Stands** |
| 215 | Student level / progress tracking (planned for a later phase) | Partly built. Gamification levels computed from points (`eng-points-levels`), lesson completion with a curriculum progress view (`cur-lesson-completion`), a progress UI including the Home streak (`eng-dashboard-ui`), and attendance on the role dashboards. Not built: an assessed proficiency level and ProgressSnapshot (`asm-d-progress-scope` = defer). | **Superseded in part**: v1 builds gamification levels (`eng-points-levels`), a curriculum progress view (`cur-lesson-completion`) and a progress UI (`eng-dashboard-ui`); an assessed proficiency level and ProgressSnapshot stay out. |
| 216 | Student leaderboard and gamification (planned) | Built: points, levels, streaks, badges and leaderboards (the engagement stream, roadmap D2). The leaderboards are planned as opt-in and alias-only; `dec-eng-leaderboard` is still open. | **Superseded** |
| 217 | Subject selection (all subjects bundled in v1) | Already built before this programme: teachers declare the subjects they teach and students choose their interests for matching (Phase C0, ADR-0031). The programme adds booking per subject (`lb-parent-acts-for-child`; quota per `dec-multi-subject-quota`, still open). | **Superseded** (by C0 already; recorded here) |
| 218 | In-platform support chat (v1 uses external support channel) | Not built. Support stays outside the platform, at a monitored support@ mailbox (`D-ntf-support-contact`). The chat the programme builds is between families and teachers (roadmap D1), which this line does not exclude; the product spec lists `messaging` among its modules (line 4). | **Stands** |
| 219 | Teacher self-service onboarding (admin-reviewed only) | Onboarding stays staff-run (`adm-teacher-onboarding`). If `dec-teacher-application` keeps it in v1, a teacher application form (the spec's own Flow 3 and BR-12) feeds staff review. Nothing activates a teacher without staff. | **Stands** |
| 220 | Mobile apps (web-first) | No native apps. The dashboard becomes an installable PWA (roadmap E3), which is still the web app. | **Stands** |
| 221 | Multiple languages in UI (Arabic UI in a later phase) | Arabic and English with full RTL in v1 (roadmap E2; the ADR-0020 baseline). The dashboard already ships both languages, and the i18n stream ends with a native Arabic review. | **Superseded** |

One item is in the full v1 but absent from the product spec rather than excluded by it: the
**curriculum builder** (roadmap C2). The product spec's module list (line 4) and its module build
order (lines 190–199) have no curriculum module. It is in v1.

**Group sessions stay deferred.** ADR-0034 moved them out of v1 because they need an SFU and a
class entity, and the owner kept that at kickoff (`dec-group-sessions-scope` = stay deferred,
record the cut). The product spec's line 214 and v1 agree on this; it is the roadmap's line 48
that changes, which ADR-0046 records.

## Why

The owner chose the full v1 (ADR-0005), and on 2026-10-17 chose to build all of it before launch.
A governing document that contradicts the plan misleads every spec that cites it, and the
roadmap's section 6.4 forbids silent drift. Lines the full v1 does not contradict stay as they
are: the product spec is still right about group sessions, support chat, teacher onboarding and
native apps.

## Consequences

- The product spec stays approved for everything else: actors, flows and business rules. Its
  text is not edited by this record. A unit spec that relies on an out-of-scope line cites this
  record as well.
- The messaging and engagement streams may start once this record is committed.
- No class teaching in v1, no group chats, and leaderboards are cohort and global rather than
  per class (ADR-0046).
- Not covered here: BR-14 (LiveKit) is superseded by ADR-0034 and is marked separately (base-04);
  the product spec's "No age threshold" (line 39) stays true (`rch-d-minors` = no gate; see
  `docs/decisions/2026-10-17-v1-kickoff-decisions.md`).
