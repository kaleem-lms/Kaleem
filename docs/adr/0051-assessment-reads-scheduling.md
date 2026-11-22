---
number: 0051
title: The assessment to scheduling edge, and lesson references by id
status: proposed
date: 2026-10-18
---

## Context

`assessment` was scaffolded with the narrowest boundary: it may import `kaleem.platform`
and call `kaleem.identity.services`, and its contract comment says an edge beyond that
opens in the unit that needs it, under that unit's ADR. `asm-module-foundation` needs one.
A report and a rating are about a lesson, and the facts the rules depend on (who the
teacher and the student are, the subject, when it started, whether it was cancelled)
belong to `scheduling`. The roadmap's module map already names the arrow: assessment
"depends on identity, scheduling (read-only via public API)".

`scheduling.services` exposes typed, frozen reads for exactly this (`get_session`,
`active_assignments`, both from ana-scheduling-read-api). What is open is how the
contracts treat it.

State of `backend` `origin/main` (d1c2be6) when this was decided: `scheduling` may import
`identity`, `curriculum` and `billing` (ADR-0033); `curriculum` may import `content`
(ADR-0049); `assessment` forbids `scheduling` outright.

## Decision

1. **`assessment -> scheduling` is allowed, through `scheduling.services` only.** The
   sibling contract is renamed `assessment imports no business modules except identity
   and scheduling` and drops `kaleem.scheduling` from its forbidden list. Everything else
   (billing, curriculum, content, messaging, notifications, engagement, analytics) stays
   forbidden for a direct import.
2. **Exactly three transitive edges are ignored**, the same ones scheduling's own contract
   has to tolerate: `kaleem.scheduling.** -> kaleem.billing.services`,
   `kaleem.scheduling.** -> kaleem.curriculum.services` and
   `kaleem.curriculum.** -> kaleem.content.services`. A forbidden contract is transitive
   by default, so without them `assessment -> scheduling.services` breaks the contract
   through scheduling's own legitimate imports. A direct `assessment -> billing`,
   `-> curriculum` or `-> content` import still breaks it. The `curriculum -> content`
   ignore is `warn` while its edge does not exist yet, as in scheduling's contract, and is
   flipped to an error in the same unit that flips scheduling's.
3. **A mirror forbids `kaleem.scheduling.models`**, with `allow_indirect_imports`, the shape
   of ADR-0033's mirrors. "Except scheduling" permits any scheduling import, so a direct
   model import would otherwise pass. Tests are exempted
   (`kaleem.assessment.tests.* -> kaleem.scheduling.models`) because they create lessons
   directly; the identity mirror gets the same test exemption for users and profiles.
4. **Lessons are referenced by a string foreign key and used by id.** `SessionReport.session`
   and `Rating.session` are `ForeignKey("scheduling.Session")`, the precedent of
   `scheduling.TeacherAssignment.subject`: a real database relation and a cascade, with no
   import. Every key carries `related_name="+"`, so there is no reverse accessor from a
   lesson or a user into assessment's rows. Services read `session_id` and never walk
   `report.session.<anything>`: import-linter cannot see attribute access, so this is a
   review rule, checked by grepping `kaleem/assessment/` for `.session.` and `session__`.
5. **Who the teacher is, and whether they currently teach the student, come from
   `scheduling.services`** (`get_session`, `active_assignments`), never from a query on
   `TeacherAssignment`.

The contract change is in `backend/pyproject.toml`. The tables, services and personal-data
hooks are described in `docs/architecture/assessment.md`.

## Alternatives considered

- **A platform port, as ADR-0049 did for the teaching link.** The right tool when the
  caller must not import the provider at all. Here the dependency is the module map's own
  arrow and `scheduling.services` already offers the reads, so a port would add an
  indirection and a registry for no boundary gain.
- **Copy the lesson facts into assessment** (teacher, student, subject, start) at write
  time. A second source of truth that goes stale on a reassignment or a cancellation, the
  copy ADR-0033 rejected. Only two ids that never change for a lesson are copied
  (`student` on a report, `ratee` on a rating), so reads by person need no join.
- **Ignore every edge scheduling reaches.** A wildcard ignore would let a new
  scheduling-to-X import slide under this contract unseen. Three named edges means a
  fourth is a visible change.
- **An integer `session_id` column with no foreign key.** Loses the cascade (a deleted
  lesson would orphan its report and ratings) and the constraint.

## Consequences

Good:

- The roadmap arrow is honoured, and a direct model import in either direction is a red
  build.
- Deleting a lesson removes its report and ratings in the same transaction.

Owed:

- If `scheduling` gains a new business import before another unit lands, this contract
  breaks. The fix is one more named ignore, decided here in these terms; anything wider
  needs a new ADR.
- The "use `session_id`, never walk the relation" rule is enforced by review, not by a
  tool.
- `assessment -> scheduling` is one-way. `scheduling` still forbids `assessment`, so
  scheduling can never ask assessment anything. Reports-due lists and analytics read
  assessment's `reported_session_ids`; they are not scheduling's calls.

Proved on the unit branch by breaking each contract. A direct
`from kaleem.scheduling.models import Session` in `assessment.services` broke the new
mirror and nothing else. A direct `kaleem.curriculum.services` import broke the
"except identity and scheduling" contract. With the three ignores deleted,
`assessment.services -> scheduling.services` broke it through scheduling's own imports.
