---
name: ana-scheduling-read-api
phase: v1 (wave 1, scheduling stream)
modules: [scheduling]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Give other modules a typed, read-only way into scheduling. Eight v1 units depend on this one:
the three dashboards, assessment's foundation, messaging's core, resource assignment and two
staff tools. Today none of them has a legal path. `kaleem/scheduling/services.py` covers
availability only (backend `origin/main` 2401dc7). The session and assignment reads live in
places another module must not import:

- `_visible_sessions` is a private helper in `api/views.py:192`.
- `_session_payload` sits beside it in `api/views.py:225`.
- `get_quota` is in `booking.py:90`.
- The party rule is the private `booking._is_party`.

This unit moves those reads into `services.py`, adds the typed reads the dependents need, and
leaves every HTTP payload byte-for-byte unchanged.

## User flow

None. No endpoint, route, payload or behaviour changes for any user. `GET /api/v1/scheduling/sessions/`,
the cancel and complete responses and `GET .../quota/` return exactly what they return today.

## Data model delta

None. No model, field, index or migration.

**Personal data (ADR-0023).** This unit adds no storage, so there is no new retention.

- **What the reads return:** data scheduling already holds. That is session and assignment
  ids, times, status, subject, and the student's and teacher's `full_name`. **No email**, the
  same rule `list_assignments_for` already follows.
- **Why:** the dependent units render it, or authorize against it.
- **For how long:** the existing rows' lifetime. This unit changes nothing about it.
- **Who sees it:** server code only. A read reaches a person only through a dependent unit's
  endpoint, and that unit's spec states its own audience.

Students may be minors. That is why the user-scoped reads enforce the same visibility rule the
sessions endpoint enforces today, and why the id-scoped reads say plainly that the caller
authorizes.

**Expand/contract:** nothing to stage. With no schema, API or cookie change, the previous
release runs unchanged beside this one during the blue-green window.

## API delta

No HTTP change. The new Python public API lives in `kaleem/scheduling/services.py`:

```python
Role = Literal["student", "teacher", "parent"]

@dataclass(frozen=True, slots=True)
class SessionInfo:
    id: int; assignment_id: int; student_id: int; teacher_id: int
    subject_id: int; subject_slug: str; subject_name: str
    student_name: str; teacher_name: str
    starts_at: datetime; ends_at: datetime; duration_minutes: int
    status: str            # Session.Status value
    cancelled_at: datetime | None; cancelled_by_id: int | None

@dataclass(frozen=True, slots=True)
class AssignmentInfo:
    id: int; student_id: int; teacher_id: int
    subject_id: int; subject_slug: str; subject_name: str
    student_name: str; teacher_name: str
    status: str; since: datetime; ended_at: datetime | None
```

The reads return frozen dataclasses, never model instances. So a caller cannot traverse into
scheduling's models or `save()` one. Import-linter cannot see that kind of leak, because it
happens through attributes rather than imports.

**User-scoped reads** apply the visibility rule:

| `role` | What the user sees |
| --- | --- |
| `None` | their own sessions as student, their own as teacher, and their children's. This is today's `_visible_sessions` rule. |
| `"student"` | their own sessions as student only |
| `"teacher"` | their own sessions as teacher only. A teacher who is also a parent gets a clean teaching view. |
| `"parent"` | their children's sessions only. A user with no children gets an empty result. |

The reads:

| Read | Returns |
| --- | --- |
| `upcoming_sessions(user, *, now)` | The moved `_visible_sessions`: every status, `ends_at >= now`, ascending. The sessions endpoint uses this. |
| `sessions_between(user, start, end, *, role=None)` | Sessions overlapping `[start, end)`, **every status, ended ones included**, ascending. The window is at most 31 days. |
| `session_history(user, *, role=None, before=None, limit=20)` | Sessions with `ends_at < before` (default now), every status, newest first. `before` is the keyset cursor, and `limit` runs 1..100. |
| `next_sessions(user, *, role=None, now=None, limit=5)` | `SCHEDULED` sessions with `ends_at >= now`, so a lesson in progress counts. Ascending, and `limit` runs 1..50. |
| `next_session_per_child(user, *, now=None)` | `{student_id: SessionInfo}`: each child's next `SCHEDULED` session, in one query. A child with none is absent. This is the parent dashboard's batched read. |
| `active_assignments(user, *, role=None)` | `list[AssignmentInfo]`: the user's ACTIVE assignments under the same role rule, oldest first. |

**Id-scoped reads.** The caller authorizes these.

| Read | Returns |
| --- | --- |
| `get_session(session_id)` | A `SessionInfo`. Raises `NotFoundError` if the session does not exist. |
| `is_session_party(user, session_id)` | `True` for the session's student, its teacher, or a parent of its student. This is the existing `booking._is_party` rule, now written **once**, here, with `booking` delegating to it. `False` for an unknown id. It is **not** the join rule: `rooms.is_participant` stays the only rule for entering a call, and it excludes parents. |
| `is_active_teacher_of(teacher_id, student_id)` | Whether an ACTIVE assignment links the pair, in any subject. |
| `get_quota(student, now=None)` | Moved verbatim from `booking.py`, together with `Quota` and `_consumed`. The signature and semantics are unchanged. `booking` re-imports it for `generate_sessions`. |

**Refused inputs** raise `kaleem.platform.exceptions.ValidationError`:

- a naive `datetime` (in any datetime argument of every read except `get_quota`, which keeps its original contract);
- `end <= start`;
- a window over 31 days;
- a `limit` out of range;
- an unknown `role`.

The reads take UTC-aware instants. Turning a viewer's local day or week into instants, DST
included, is each dashboard's job.

`api/views.py` drops `_visible_sessions`. `_session_payload` reads a `SessionInfo`. The cancel
and complete views re-read the changed row through `get_session` after the mutation commits,
which costs one extra query per mutation. `rooms.can_join_at` and `rooms.is_participant` read
only `starts_at`, `duration_minutes`, `student_id` and `teacher_id`. `SessionInfo` carries all
four, so those two are not touched.

## Frontend

None. The dashboard calls the same endpoints and gets the same payloads. The dashboards that
consume these reads are their own units: `ana-student-dashboard`, `ana-parent-dashboard` and
`ana-teacher-dashboard`.

## Module boundaries

`scheduling` owns all of this. No import-linter contract changes. `services.py` adds a
`billing.services` import (for `get_quota`), which ADR-0033 already allows.

**Import direction inside the module:** `booking` and `matching` import `services`, and
`services` imports neither of them, nor `rooms`. `matching` already does
`from kaleem.scheduling.services import to_utc_intervals`. So a `services → booking` import
would close a cycle (`services → booking → matching → services`) and fail at import time. That
cycle is why `get_quota` and the party rule move *into* `services` rather than being wrapped
there.

Each dependent that calls these reads from another module opens its own contract edge, through
its own ADR where its entry names one (for example `msg-core-backend`). No new events.

## Out of scope

- Any HTTP endpoint for the new reads, and any dashboard UI.
- Assignment history beyond ACTIVE. Messaging's "read-only once ended" will need it, and it
  belongs to `msg-core-backend`.
- Ending assignments or slots (`adm-sessions-and-teacher-change`).
- `docs/architecture/scheduling.md`. ISSUES.md records that a doc covering only the latest
  slice would misrepresent the module. The public API is documented in `services.py`'s module
  docstring instead.
- New indexes. The window filter runs on an `ends_at` annotation over the existing
  `(assignment, starts_at)` index. That is adequate at today's volume, and a later unit adds an
  index if it measures a need.

## Test plan

Every test below is written before the code it covers. Every regression test gets a mutation
check.

1. **Payload characterization, written first, green on `main` before any move.** On today's
   code, assert the exact key list and values for:
   - the sessions list for a student, a teacher, a parent and a teacher who is also a parent;
   - the cancel response;
   - the complete response;
   - the quota response.

   It must stay green, unchanged, after the move. Mutation check: alter one payload field, and
   it goes red.
2. **The query count for the list does not grow with the number of sessions** (1 against 4). A
   per-row lookup that crept into the DTO build is the N+1 this test catches.
3. **The role rule, per read.** For `None`, `student`, `teacher` and `parent`:
   - a stranger sees nothing;
   - another family's parent does not see this child;
   - an unknown role is refused.

   Mutation check: drop the children clause, and the parent tests go red.
4. **`sessions_between`:**
   - a session straddling `start` is included, and one ending exactly at `start` is not;
   - a session starting exactly at `end` is excluded;
   - cancelled and completed sessions are included;
   - naive datetimes, `end <= start` and a 32-day window are refused.
5. **`session_history`:**
   - newest first;
   - `before` pages without overlap or gap;
   - an in-progress lesson is not history;
   - the `limit` bounds are enforced.
6. **`next_sessions`:**
   - only `SCHEDULED`;
   - an in-progress lesson is included;
   - a cancelled future lesson is excluded;
   - `limit` is honoured.
7. **`next_session_per_child`:**
   - two children, each gets their own next session;
   - a child with none is absent;
   - a non-parent gets `{}`;
   - one query for the sessions, whatever the number of children.
8. **`get_session` and `is_session_party`:**
   - the student, the teacher and the parent are parties;
   - another student, another teacher and another family's parent are not;
   - an unknown id gives `NotFoundError` or `False`.
9. **`active_assignments` and `is_active_teacher_of`:** an ENDED assignment is excluded, and
   the role rule applies.
10. **The returned objects are frozen.** An assignment raises.
11. **No read returns an email.** Assert no `@` in any string field.
12. **The existing suites stay green unchanged:** `test_booking_quota.py` (it calls
    `booking.get_quota`), `test_booking_api.py` and `test_booking_cancel.py`, along with the
    booking and matching e2e flows in CI.

## Open questions

None. The unit has no decision ids. `ana-dec-parent-quota` and `ana-dec-dashboard-placement`
belong to the dashboard units that consume these reads. They do not shape the reads.
