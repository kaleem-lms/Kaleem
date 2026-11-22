---
name: cur-module-edges-adr
phase: v1 (wave 2, curriculum stream)
modules: [content, curriculum, scheduling, platform]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Three curriculum-stream units need edges that the import-linter contracts forbid today, and
two of them need the same check: "does this teacher teach this student?"

- **cur-lesson-resources**: a lesson links resources through `content.services`, so
  `curriculum → content` (the roadmap's own arrow, section 2.1).
- **cur-lesson-assignment**: a teacher assigns lessons only to students they teach.
- **cur-resource-assignment**: a teacher assigns resources only to students they teach.

The teaching link is `scheduling`'s `TeacherAssignment`, and `scheduling → curriculum`
already exists (ADR-0033). So `curriculum → scheduling` closes a cycle. `content →
scheduling` closes one too, through the roadmap's `curriculum → content`.

This unit writes the ADR that settles the edges, changes the contracts to match, proves each
contract by breaking it, and builds the small port both consumers call. It ships no product
behaviour.

What the code says today (backend `origin/main` 48371cf):

- `curriculum` may import `identity` only. `content` is an empty scaffold with the same
  boundary. `scheduling` may import `identity`, `curriculum` and `billing`
  (`pyproject.toml`, 23 contracts kept).
- `scheduling.services.is_active_teacher_of(teacher_id, student_id)` already exists (an
  ACTIVE `TeacherAssignment`, any subject). Nothing outside tests calls it.
- `kaleem.platform.personal_data` is the precedent for a platform registry that modules
  fill from `AppConfig.ready()` (ADR-0048).

**Measured on a scratch copy of `origin/main` with the gate image (import-linter 2.15):**

| Probe | Result |
| --- | --- |
| `curriculum.services` imports `content.services` | **2 broken**: curriculum's own contract, and **scheduling's**, through `scheduling.matching → curriculum.services → content.services`. A forbidden contract is transitive by default. |
| `content.services` imports `scheduling.services` | content's contract broken |
| `curriculum.services` imports `scheduling.services` | curriculum's contract broken |

So the roadmap arrow alone turns scheduling's contract red. The ADR must deal with that,
not only with the teaching check.

## The decision the ADR records

1. **`curriculum → content` is allowed, public API only.** Curriculum's sibling contract
   drops `kaleem.content`, and a new mirror forbids `kaleem.content.models` with
   `allow_indirect_imports`. This is the same shape as ADR-0033's mirrors.
2. **`content` never imports `curriculum` or `scheduling`.** Its contract is unchanged.
   Content stays the leaf that identity photos, chat attachments and teacher applications
   can also sit on.
3. **Scheduling's contract ignores exactly one edge:** `kaleem.curriculum.** ->
   kaleem.content.services`, with `unmatched_ignore_imports_alerting = "warn"` until
   cur-lesson-resources creates the edge. A direct `scheduling → content` import still
   breaks it, and so does `curriculum → content.models`.
4. **The teaching link goes through a platform port, `kaleem.platform.teaching`.**
   `scheduling` registers its provider from `SchedulingConfig.ready()`. `content` and
   `curriculum` call the port and import nothing from `scheduling`.
   - `teaches(teacher_id, student_id) -> bool`: delegates to `is_active_teacher_of`.
   - `student_ids_taught_by(teacher_id) -> frozenset[int]`: delegates to a new read,
     `scheduling.services.active_student_ids_of`, for the student picker and bulk checks.
     Without it, a bulk assignment would make one query per student.
   - No provider registered: both raise `ImproperlyConfigured`. They never return False,
     because "nobody is taught" would quietly hide a wiring fault.
   - Registering the same pair twice is a no-op (`ready()` can run twice). A different
     pair raises `ImproperlyConfigured`, the same rule as the personal-data registry.
   - "Teaches" means an ACTIVE assignment in any subject. A subject-scoped check, and what
     happens to existing assignments when the link ends, belong to the consuming specs.
5. **Parents are out of the port.** "Is a parent of" is `identity.services.is_parent_of`,
   which both modules may already call.

The ADR's alternatives, each rejected in a sentence or two with the probe result where one
exists: `curriculum → scheduling` (a package cycle, and curriculum would inherit billing);
`content → scheduling` (the programme's first wording; a cycle through `curriculum →
content`); a teaching-link copy in curriculum written by scheduling (a second source of
truth plus a backfill, the copy ADR-0033 rejected); moving `TeacherAssignment` to
`identity` (a cross-module migration, the inversion ADR-0031 rejected); `content →
curriculum` for lesson resources (it would pull curriculum under every content user).

The port's cost is stated plainly: import-linter cannot see the runtime dependency of
`content` and `curriculum` on `scheduling`. The wiring test below is what makes it visible.
cur-resource-assignment's summary says "via the scheduling read API". The port still
answers from that read API, only without the import.

## User flow

None. No user sees anything from this unit.

## Data model delta

None. No model and no migration.

ADR-0023's four points: **what**: no personal data is stored. The port returns user ids
only. **Why**: authorization checks. **How long**: nothing is kept. **Who sees it**:
server code only. The ADR is public and contains no data.

Expand/contract: code only, with no schema change. Both colours carry the same registration.

## API delta

No HTTP change. Python public API additions:

- `kaleem.platform.teaching`: `register_provider(*, teaches, student_ids_taught_by)`,
  `teaches(teacher_id, student_id)`, `student_ids_taught_by(teacher_id)`.
- `kaleem.scheduling.services.active_student_ids_of(teacher_id) -> frozenset[int]`: the
  students with an ACTIVE assignment to this teacher, in any subject. The caller
  authorizes. The services module docstring lists it under "Id-scoped reads".

## Frontend

None. No route, component or locale string.

## Module boundaries

Owner: `platform` holds the port, `scheduling` provides it. Contract changes in
`backend/pyproject.toml` (this unit's shared file):

| Contract | Change |
| --- | --- |
| `curriculum imports no business modules except identity` | renamed `... except identity and content`; `kaleem.content` removed |
| new: `curriculum does not reach past content's public API` | forbids `kaleem.content.models`, `allow_indirect_imports` |
| `scheduling imports no business modules except identity, curriculum and billing` | one ignore and the warn setting, as in decision 3 |
| `content imports no business modules except identity` | unchanged, and now load-bearing |

`tests/test_import_contracts_cover_every_module.py` stays green: each module keeps a
forbidden contract.

Docs: the ADR (`docs/adr/<NNNN>-teaching-link-port-and-content-curriculum-edges.md`; the
conductor allocates the number, and 0049 is the next free on master today), plus the
Boundaries sections of `docs/architecture/curriculum.md`, `platform.md` (the second user of
the registry pattern) and `scheduling.md`. `content.md` does not exist yet. cur-content-storage
writes it and cites the ADR.

## Out of scope

- Any content or curriculum model, endpoint or screen.
- Calling the port. cur-lesson-assignment and cur-resource-assignment are the first callers.
- Subject-scoped teaching checks and the "link ended" behaviour.
- Content learning about lessons (for example, refusing to delete a resource a lesson
  uses). If cur-lesson-resources needs that, it is a registry hook filled by curriculum,
  under this ADR's rule 2. It is not a `content → curriculum` import.
- Amending the roadmap's module map. It already says `curriculum → identity, content`.

## Test plan

pytest (TDD, written first):

- Port: no provider raises `ImproperlyConfigured` from both functions. Same-pair re-register
  is a no-op. A different pair raises. Both functions delegate. The set read returns a
  `frozenset`.
- `active_student_ids_of`: ACTIVE only. One id for a student taught in two subjects. Empty
  for a non-teacher and after the assignment ends. Never the teacher's own id.
- Wiring, through the real app registry and database: `teaching.teaches` is True for an
  ACTIVE pair and False once it ends. `student_ids_taught_by` matches. This test goes red
  if `ready()` stops registering.

Contracts, mutation-checked on the unit branch, each red with the probe in place and green
with it removed:

| Probe | Must break |
| --- | --- |
| `curriculum.services` → `content.services` | nothing (must stay green) |
| that plus `scheduling.matching` → `content.services` | scheduling sibling contract |
| `curriculum` → `content.models` (stub module) | curriculum→content mirror, and scheduling |
| `content` → `curriculum.services` | content sibling contract |
| `content` → `scheduling.services` | content sibling contract |
| `curriculum` → `scheduling.services` | curriculum sibling contract |
| the curriculum→content probe with the scheduling ignore deleted | scheduling sibling contract |

e2e: none, by design. Nothing is user-facing, and the D3 table gets no row.

## Open questions

None. No owner decision touches the edges. dec-cur-ownership and dec-cur-parent-visibility
belong to the consuming units.
