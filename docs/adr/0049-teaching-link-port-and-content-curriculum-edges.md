---
number: 0049
title: Content and curriculum edges, and the teaching link as a platform port
status: proposed
date: 2026-10-18
---

## Context

Three v1 units, all in the curriculum stream, need edges that the import-linter contracts
forbid today:

- **cur-lesson-resources**: a lesson links resources through `content.services`. That is
  `curriculum -> content`, the roadmap's own arrow (section 2.1).
- **cur-lesson-assignment**: a teacher assigns lessons only to students they teach.
- **cur-resource-assignment**: a teacher assigns resources only to students they teach.

The last two need the same check, "does this teacher teach this student?". The link is
`scheduling`'s `TeacherAssignment`, and `scheduling -> curriculum` already exists
(ADR-0033). So `curriculum -> scheduling` closes a package cycle, and `content ->
scheduling` closes one through `curriculum -> content`.

State of `backend` `origin/main` (48371cf) when this was decided: `curriculum` may import
`identity` only; `content` is an empty scaffold with the same boundary; `scheduling` may
import `identity`, `curriculum` and `billing`. `scheduling.services.is_active_teacher_of`
exists and nothing outside tests calls it. `kaleem.platform.personal_data` (ADR-0048) is the
precedent for a platform registry that modules fill from `AppConfig.ready()`.

Each probe below was a one-line import added to a scratch copy and run through
`lint-imports` (import-linter 2.15):

| Probe | Result |
| --- | --- |
| `curriculum.services` imports `content.services` | **2 contracts broken**: curriculum's own, and scheduling's, through `scheduling.matching -> curriculum.services -> content.services`. A forbidden contract is transitive by default. |
| `content.services` imports `scheduling.services` | content's contract broken |
| `curriculum.services` imports `scheduling.services` | curriculum's contract broken |

So the roadmap arrow alone turns scheduling's contract red. This ADR has to deal with that,
not only with the teaching check.

## Decision

1. **`curriculum -> content` is allowed, through the public API only.** Curriculum's sibling
   contract drops `kaleem.content` from its forbidden list. A new mirror forbids
   `kaleem.content.models`, with `allow_indirect_imports`. This is the shape of ADR-0033's
   mirrors.
2. **`content` never imports `curriculum` or `scheduling`.** Its contract is unchanged and is
   now load-bearing. Content stays the leaf that identity photos, chat attachments and
   teacher applications can also sit on.
3. **Scheduling's contract ignores exactly one edge:** `kaleem.curriculum.** ->
   kaleem.content.services`, with `unmatched_ignore_imports_alerting = "warn"` until
   cur-lesson-resources creates the edge (an ignore that matches nothing is an error
   otherwise). A direct `scheduling -> content` import still breaks the contract, and so
   does `curriculum -> content.models`.
4. **The teaching link goes through a platform port, `kaleem.platform.teaching`.**
   `scheduling` registers its provider from `SchedulingConfig.ready()`. `content` and
   `curriculum` call the port and import nothing from `scheduling`.
   - `teaches(teacher_id, student_id) -> bool` delegates to
     `scheduling.services.is_active_teacher_of`.
   - `student_ids_taught_by(teacher_id) -> frozenset[int]` delegates to a new read,
     `scheduling.services.active_student_ids_of`, for the student picker and bulk checks.
     Without it a bulk assignment would make one query per student.
   - With no provider registered both raise `ImproperlyConfigured`. They never return
     False, because "nobody is taught" would quietly hide a wiring fault.
   - Registering the same pair twice is a no-op (`ready()` can run twice). A different pair
     raises `ImproperlyConfigured`, the same rule as the personal-data registry.
   - "Teaches" means an ACTIVE assignment in any subject. A subject-scoped check, and what
     happens to existing assignments when the link ends, belong to the consuming specs.
5. **Parents are out of the port.** "Is a parent of" is `identity.services.is_parent_of`,
   which both modules may already call.

The contract change is in `backend/pyproject.toml`; the port is `kaleem/platform/teaching.py`.
No model, migration, endpoint or personal data is involved: the port returns user ids to
server code and keeps nothing.

## Alternatives considered

- **`curriculum -> scheduling`.** A package cycle with `scheduling -> curriculum`, and
  curriculum would inherit scheduling's `billing` and `signaling` edges. Probe 3 above.
- **`content -> scheduling`** (the programme's first wording). A cycle through `curriculum ->
  content`, and it ties the leaf module to the busiest one. Probe 2 above.
- **A teaching-link copy in curriculum, written by scheduling.** A second source of truth
  plus a backfill, the copy ADR-0033 rejected.
- **Move `TeacherAssignment` to `identity`.** A cross-module migration and the inversion
  ADR-0031 rejected.
- **`content -> curriculum` for lesson resources.** It would pull curriculum under every
  content user, including those with no lessons.

## Consequences

Good:

- No cycle, and the roadmap arrow `curriculum -> content` is honoured.
- One check serves two modules, and its read is a single query for bulk use.
- The edge that scheduling's contract tolerates is exactly one named import.

Owed:

- import-linter cannot see the runtime dependency of `content` and `curriculum` on
  `scheduling`. The wiring test in `scheduling/tests/test_read_api.py` (the port answers
  from the real app registry and database) is what makes it visible: it goes red if
  `ready()` stops registering.
- The `warn` setting on scheduling's ignore is temporary. When cur-lesson-resources lands
  the edge, delete the `unmatched_ignore_imports_alerting` line so the ignore is an error
  if it ever goes stale. If import-linter ever drops the option, delete the ignore here and
  have cur-lesson-resources add it with the edge.
- Content learning about lessons (for example refusing to delete a resource a lesson uses)
  is a registry hook filled by curriculum under rule 2, never a `content -> curriculum`
  import.
- `docs/architecture/content.md` does not exist yet; cur-content-storage writes it and
  cites this ADR.

Each contract was proved by breaking it on the unit branch. `curriculum.services ->
content.services` kept all 24 contracts. Adding `scheduling.matching -> content.services`
broke scheduling's. `curriculum -> content.models` broke the new mirror and scheduling's.
`content -> curriculum.services`, `content -> scheduling.services` and `curriculum ->
scheduling.services` each broke their sibling contract. With scheduling's ignore deleted,
the allowed edge broke scheduling's contract again.
