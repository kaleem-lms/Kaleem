---
number: 0055
title: The messaging to scheduling edge
status: proposed
date: 2026-10-18
---

## Context

`messaging` was scaffolded with the narrowest boundary: it may import `kaleem.platform` and
call `kaleem.identity.services`, and its contract comment says an edge beyond that opens in
the unit that needs it, under that unit's ADR. `msg-core-backend` needs one.

Direct chats exist because two people are linked by teaching: a student and the teacher who
teaches them, or a parent and the teacher of one of their children. Who may open a chat,
who may post in it, and when it turns read-only are all answers to "does an ACTIVE
assignment join these two people right now?". That fact belongs to `scheduling`, which
exposes it as typed, frozen reads: `active_assignments(user, role=...)` and
`is_active_teacher_of`, both from `ana-scheduling-read-api`.

State of `backend` `origin/main` (cd9812e) when this was decided: `scheduling` may import
`identity`, `curriculum` and `billing` (ADR-0033); `assessment` may import `scheduling`
(ADR-0051); `messaging` forbids `scheduling` outright. The probe below was a one-line
import added to `messaging/services.py` and run through `lint-imports` (import-linter 2.15).

| Probe | Result |
| --- | --- |
| `messaging.services` imports `scheduling.services` | **1 contract broken**: messaging's own, twice over. Directly (`messaging -> scheduling`) and through `scheduling.services -> billing.services`. A forbidden contract is transitive by default. |
| `messaging.services` imports `scheduling.models` (after the change below) | the new mirror is broken |
| `messaging.services` imports `billing.services` (after the change below) | messaging's own contract is broken |

## Decision

1. **`messaging -> scheduling` is allowed, through `scheduling.services` only.** The sibling
   contract is renamed `messaging imports no business modules except identity and
   scheduling` and drops `kaleem.scheduling` from its forbidden list. Billing, assessment,
   curriculum, content, notifications, engagement and analytics stay forbidden for a direct
   import.
2. **One transitive edge is ignored:** `kaleem.scheduling.services -> kaleem.billing.services`,
   scheduling's own legitimate import (ADR-0033). It is the only edge the probe found.
   `scheduling.services` does not reach curriculum or content, so the curriculum edges that
   ADR-0049 and ADR-0051 had to tolerate do not appear here. A direct `messaging -> billing`
   import still breaks the contract, and so does any future edge from `scheduling.services`
   to another forbidden module.
3. **A mirror forbids `kaleem.scheduling.models`**, with `allow_indirect_imports`, the shape
   of ADR-0033's mirrors: "except scheduling" permits any scheduling import, so a direct
   model import would otherwise pass.
4. **Messaging's tests are exempted from three model imports, and only the tests:**
   `kaleem.messaging.tests.* -> kaleem.identity.models` (users, profiles, parent links),
   `-> kaleem.scheduling.models` (an assignment and its match request) and
   `-> kaleem.curriculum.models` (the `Subject` row an assignment needs). They build a
   teaching link directly, as scheduling's and assessment's tests do.
5. **Chat facts come from `scheduling.services`**, never from a query on `TeacherAssignment`:
   `active_assignments(user, role="student" | "teacher" | "parent")` for contacts and for the
   post rule. A chat list asks each of the three at most once, however many chats it holds.
6. **Parents of many students come from one new identity read**,
   `identity.services.get_parents_of_students`. The existing `get_parent_user_ids` is one query
   per student, which would make a teacher's chat list cost one query per student.

The contract change is in `backend/pyproject.toml`. The tables, rules and endpoints are in
`docs/architecture/messaging.md`.

## Alternatives considered

- **Widen the `platform.teaching` port** (ADR-0049) with `teacher_ids_of(student_id)` and
  `student_ids_taught_by`'s mirror. The right tool when the caller must not import the
  provider at all. Here the dependency is the module map's own arrow, `scheduling.services`
  already offers exactly the reads, and the port would still need a parent-to-teachers read
  that scheduling does not expose, so it would grow the port and the provider for no
  boundary gain. It stays available if a third module needs the same answer.
- **Copy the link into messaging** (a `can_chat` row written by scheduling on accept and
  end). A second source of truth that goes stale on a reassignment, the copy ADR-0033
  rejected, and a backfill besides.
- **Let messaging query `TeacherAssignment` directly.** Breaks the module-boundary rule this
  ADR exists to keep.
- **Ignore every edge scheduling reaches.** A wildcard ignore would let a new
  scheduling-to-X import slide under this contract unseen. One named edge means a second is
  a visible change.

## Consequences

Good:

- The roadmap arrow is honoured, with the same shape as ADR-0051's, and the rule "a chat is
  read-only once the assignment ends" follows scheduling's truth the moment it changes.
- A new scheduling dependency of `scheduling.services` on another forbidden module turns
  messaging's contract red, so the ignore cannot hide a growing graph.

Owed:

- import-linter cannot see attribute access, so "messaging never walks into a scheduling
  model" is a review rule for the DTOs returned by `active_assignments`.
- `msg-retention` needs an assignment's end date; this unit needs only "active now".
  Assignment history in `scheduling.services` is that unit's addition, under its own ADR if
  it widens the edge.
- Whether a chat that was reported must survive an erasure request is for `msg-moderation`
  and counsel. This unit's erase hook anonymizes the person's own messages in place
  (`lb-dec-erasure-semantics`) and leaves the thread for the other member.

Each contract was proved by breaking it on the unit branch. `messaging.services ->
scheduling.services` kept every contract. `-> scheduling.models` broke the mirror and no
other. `-> billing.services` broke messaging's own contract and no other.
