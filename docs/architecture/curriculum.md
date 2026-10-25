# curriculum — architecture

What kaleem teaches, and who teaches or wants to study it. Two halves: a `Subject`
catalogue with the teacher and student links to it (`curriculum` exists this early because
Phase C's matcher needs subject as an input), and the course builder, where a teacher makes
a `Course` of ordered `Unit`s and `Lesson`s, and gives lessons to the students they teach
(`LessonAssignment`).

Specs: `docs/superpowers/specs/2026-09-04-phase-c0-matching-inputs-design.md` (subjects,
ADR-0031, shipped Phase C0) · `docs/superpowers/specs/2026-10-18-cur-course-structure-design.md`
(the course builder, v1 wave 2) · `docs/superpowers/specs/2026-10-25-cur-lesson-assignment-design.md`
(assigning lessons and the student's view, v1 wave 3).

## Data model

```mermaid
erDiagram
    User ||--o{ TeacherSubject : teaches
    User ||--o{ StudentSubjectInterest : "wants to study"
    Subject ||--o{ TeacherSubject : "taught as"
    Subject ||--o{ StudentSubjectInterest : "wanted as"
```

- **Subject** — `slug` (unique), `name`, `is_active`, timestamps. Admin-managed, so adding
  a fourth subject is a row rather than a migration and a deploy. Seeded with `quran`,
  `tafsir` and `arabic` by migration `0002_seed_subjects`, which uses `update_or_create` so
  it converges on a database where a row was added by hand instead of failing the deploy.
  Retiring a subject means `is_active = False`, never a delete — existing links stay
  readable.
- **TeacherSubject** — `user` → `subject`, unique together. A teacher teaches many.
- **StudentSubjectInterest** — `user` → `subject`, unique together. A student wants many.

Both links are **rows, not a JSON blob on a profile** (rule #3) and **many-over-time, not a
`OneToOneField`** (rule #7). Both key to `AUTH_USER_MODEL` **by string**, which is what lets
this module reference users without importing `identity`'s models.

### The course builder

```mermaid
erDiagram
    User ||--o{ Course : owns
    Subject ||--o{ Course : "is the subject of"
    Course ||--o{ Unit : "ordered by position"
    Unit ||--o{ Lesson : "ordered by position"
```

- **Course** — `owner` → user (by string, CASCADE), `subject` → `Subject` (PROTECT:
  subjects are retired, never deleted), `title` (200), `description` (at most 2,000
  characters), timestamps. A course is **private to its owning teacher**
  (dec-cur-ownership, option 1: students keep access after a teacher change, which binds
  cur-lesson-assignment, not this table).
- **Unit** — `course` (CASCADE), `title`, `position`. **Lesson** — `unit` (CASCADE),
  `title`, `body` (plain text, at most 20,000 characters), `position`. A lesson belongs to
  one unit for good: lessons do not move between units.
- **Positions are 0-based and dense** (0..n-1) after every add, delete and reorder. Each
  `(parent, position)` pair has a `UniqueConstraint` with `deferrable=DEFERRED`, so a
  reorder can rewrite every position in one transaction without tripping over a
  half-finished swap. ⚠ pytest-django never commits, so a deferred violation passes
  silently in an ordinary test: `test_models.py` forces the check with
  `SET CONSTRAINTS ALL IMMEDIATE`, and swapping inside one transaction is its own test.
- **Limits**, enforced in the services, not the database: 50 courses per teacher, 50 units
  per course, 100 lessons per unit. A limit is reported as a 400 on the `title` field.
- **Deletes are hard deletes.** Deleting a course takes its units and lessons with it.

### Lesson assignment

```mermaid
erDiagram
    Lesson ||--o{ LessonAssignment : "is assigned as"
    User ||--o{ LessonAssignment : holds
```

- **LessonAssignment** — `lesson` → `Lesson` (CASCADE, `related_name="assignments"`),
  `student` → user (by string, CASCADE, `related_name="lesson_assignments"`), `created_at`,
  unique on `(lesson, student)`. The assigner is always the course's owner, so there is no
  `assigned_by`. **Withdrawal is a hard delete**; assigning again later makes a new row. Many
  rows over time, never a `OneToOneField` (rule #7).
- **What removes a row.** The teacher withdrawing it; deleting the lesson, its unit or its
  course (the cascade, so a deleted course disappears from every student who held it); erasing
  the student; erasing the teacher (their courses go, and the cascade takes the assignments).
  A lesson added to a unit later is **not** assigned automatically.
- **A student keeps their lessons after a teacher change** (dec-cur-ownership, option 1).
  `get_student_curriculum` makes no teaching-link check. The teacher's side is the opposite:
  every teacher service checks the link *now*, so a former teacher cannot list, assign to or
  withdraw from that student.
- **Parents** see their linked children's lessons read-only (dec-cur-parent-visibility,
  option 1). Completion by a parent is not part of this unit.

ADR-0023 for assignments: the table holds which lessons a student holds and since when,
linked to the student's user id (for a child account, children's data). It is what the
student studies and what completion builds on. Kept until the teacher withdraws it, the
lesson, unit or course is deleted, or the student's account is erased. Seen by the student,
their linked parents (read-only) and the owning teacher while they teach that student; not in
the Django admin (dec-admin-surface).

ADR-0023: the tables hold text a teacher writes (titles, descriptions, lesson bodies),
linked to the teacher's user id; nothing about students. Kept until the teacher deletes it
or the account is erased. Seen by the owning teacher only, through the API; not registered
in the Django admin.

## Public API

Everything outside the module goes through `kaleem.curriculum.services`. Callers never touch
the models.

| Service | Does |
| --- | --- |
| `list_active_subjects()` | Every `is_active` subject |
| `get_teacher_subjects(user_id)` | The teacher's slugs, sorted |
| `set_teacher_subjects(user_id, slugs)` | Replaces the whole set; returns what was stored |
| `get_student_subjects(user_id)` | The student's slugs, sorted |
| `set_student_subjects(user_id, slugs)` | Replaces the whole set; returns what was stored |
| `subject_display_name(name)` | The stored subject name in the language of the current request (`pgettext("subject name", name)`). A name with no catalog entry comes back as stored |

`subject_display_name` is how a subject name reaches a client in Arabic. Services keep returning the
stored name (scheduling hands one to the video provider); the serializers of curriculum and of
scheduling (`SubjectNameField`) translate at the edge. The three seeded names are marked with
`pgettext_lazy` in `services.py` so `makemessages` finds them; a subject an admin adds shows its
stored name until a catalog entry ships (ADR-0058).

Course builder services take the acting teacher's id first and scope every query to it, so
a course nobody owns and a course somebody else owns are the same `NotFoundError`:

| Service | Does |
| --- | --- |
| `create_course(teacher_id, *, title, subject_slug, description="")` | New course; returns the tree |
| `list_courses(teacher_id)` | The teacher's courses, oldest first, with unit and lesson counts |
| `get_course(teacher_id, course_id)` | The tree: units and lessons in position order |
| `update_course(...)` / `delete_course(...)` | Change only the fields given / hard delete |
| `add_unit` / `rename_unit` / `delete_unit` / `reorder_units` | By course id, then unit id |
| `add_lesson` / `update_lesson` / `delete_lesson` / `reorder_lessons` | By unit id, then lesson id |
| `list_course_assignments(teacher_id, course_id)` | The roster: `{students: [{id, name}], assignments: [{lesson, student}]}`. `students` is who the teacher teaches now (the teaching port, names from `identity.services.get_users`); `assignments` covers this course's lessons and only those students |
| `assign_lessons(teacher_id, course_id, *, lesson_ids, student_ids)` | Gives every lesson to every student; pairs that exist are skipped. Returns the roster |
| `withdraw_lessons(...)` | Same signature; deletes the pairs, ignores absent ones. Returns the roster |
| `get_student_curriculum(student_id)` | `{courses: [{id, title, subject, units: [{id, title, lessons: [{id, title, body}]}]}]}`: only what the student holds, courses oldest first, units and lessons in the teacher's order, in one query. Takes no actor: the caller has decided the viewer is the student or their parent. The subject name is in the language of the request |

Every service except `list_courses` and `delete_course` returns the whole course tree, so
the dashboard replaces its cache in one step. A course keeps a subject that is retired
later; only changing *to* an unknown or retired subject is refused.

**Ordering and locking.** Every write runs in one transaction and takes
`select_for_update()` on the course row first (a unit or lesson id is resolved to its
course, locked, then re-read, so a concurrent delete surfaces as not-found). Concurrent
edits of one course are therefore serialized rather than interleaved. Creating a course
takes a transaction-scoped Postgres advisory lock per teacher instead, because there is no
row to lock for "the next course" and locking the user row would reach into identity's
table. A reorder must name **exactly** the current set of ids: a missing, extra,
duplicated or foreign id is a `ConflictError` (409, "reload"), never a partial write,
because it means the caller is working from a stale view.

**Assignment writes** run in one transaction that locks the course row first (so they
serialize with edits and deletes), then refuse, writing nothing, unless every lesson id is in
that course (`ConflictError`, 409: the caller's view is stale) and every student id is
taught by the teacher right now (`NotFoundError` "Student", the same 404 for a student the
teacher does not teach and for an id that is no account). Empty lists, more than 100 lessons
or more than 50 students are a `ValidationError`.

A symmetric quartet on purpose: the dashboard hooks mirror these names exactly, so a reader
can move between the two repos without translating.

**`_resolve` runs before the delete inside `_set`.** Validation first is not incidental — the
obvious ordering (delete, then insert what resolves) wipes a user's existing subjects on its
way to rejecting a payload with one bad slug, and passes every other test. Pinned by
`test_a_rejected_payload_leaves_the_previous_set_intact`.

Unknown or inactive slugs raise `platform.exceptions.ValidationError` rather than being
dropped silently: a typo'd slug that vanished would look to the caller like a successful save
of a smaller set (rule #8).

## API surface

All under `/api/v1/curriculum/`, mounted through `config.api_router` (ADR-0029).

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `subjects/` | any authenticated user |
| `GET` `PUT` | `me/teacher-subjects/` | teacher (403 otherwise) |
| `GET` `PUT` | `me/student-subjects/` | student (403 otherwise) |
| `GET` `POST` | `courses/` | teacher (403 otherwise) |
| `GET` `PATCH` `DELETE` | `courses/<id>/` | the owning teacher (404 for anyone else) |
| `POST` | `courses/<id>/units/` | the owning teacher |
| `PUT` | `courses/<id>/unit-order/` | the owning teacher |
| `PATCH` `DELETE` | `units/<id>/` | the owning teacher |
| `POST` | `units/<id>/lessons/` | the owning teacher |
| `PUT` | `units/<id>/lesson-order/` | the owning teacher |
| `PATCH` `DELETE` | `lessons/<id>/` | the owning teacher |
| `GET` `POST` | `courses/<id>/assignments/` | the owning teacher; `POST {lessons, students}` assigns, both answer with the roster |
| `POST` | `courses/<id>/assignments/withdraw/` | the owning teacher; `{lessons, students}`, answers with the roster |
| `GET` | `students/<user id>/lessons/` | that student, or a parent linked to them (`identity.services.is_parent_of`); anyone else, and an unknown id, get the same 404 "Student not found." No write verbs |

Every mutation except a course delete (204) answers with the whole course tree; order is
the array order and positions are not exposed. "Teacher" means a teacher *profile*, so an
account that is also a student can build. A course that is not yours and one that does not
exist return the same 404.

**Two role-explicit paths rather than one `/me/subjects/`.** A person may hold both profiles,
so a single endpoint would have to guess which set the caller meant, or reject the ambiguity
with a 400 that has no correct follow-up. Two paths make the dual-role case ordinary.

There is no shared base class behind the two views. An earlier draft had one; its entire
content was stubs that existed to be overridden, and covering them meant a test reaching into
private members. Two explicit views duplicate three lines per verb and name the table they
touch.

## Personal-data registry and e2e seed

`kaleem/curriculum/personal_data.py` registers three hook sets from `CurriculumConfig.ready()`
(ADR-0048): `curriculum.courses` (export and erase), `curriculum.lesson_assignments` (export
and erase) and the export-only `curriculum.subjects` (below). The assignments export is a
student's lessons as course, unit and lesson titles with the date assigned (the lesson text is
the teacher's, so it is not in it); its erase deletes the student's rows. The courses export is the teacher's course trees in the order
they built them, with ISO dates; its erase deletes the teacher's courses. The subject tables
have no erase hook yet, so curriculum stays in the coverage guard's `PENDING_ERASE`
(lb-gdpr-erasure removes the entry). `erase_courses` keeps its cascade on purpose: erasing a
teacher removes their students' lessons too (decided with cur-lesson-assignment).

`seed_e2e_curriculum` (listed in `config/e2e_seeds.txt` after `seed_e2e_matching`) deletes
`e2e.teacher@kaleem.test`'s courses and rebuilds "E2E Course" through the services: Unit 1
with Lesson A, B and C, and an empty Unit 2. It adds no `TeacherSubject` row, so matching
state is unaffected, and it refuses `DEBUG=False`. Deleting the courses cascades to any
assignment, so a re-run leaves `e2e.booked` holding no lessons, which is what the assignment
e2e flows start from.

## Boundaries

`curriculum` depends on `identity` and `content`, each only through its `services` module
plus the `AUTH_USER_MODEL` string. Three import-linter contracts hold it there:

- `curriculum imports no business modules except identity and content`
- `curriculum does not reach past identity's public API` — `allow_indirect_imports`, so the
  legitimate `curriculum.services → identity.services → identity.models` chain stays legal
  while a direct model import fails.
- `curriculum does not reach past content's public API` — the same shape for
  `kaleem.content.models`.

The `content` edge is allowed by ADR-0049 and nothing uses it yet; cur-lesson-resources
creates it. Scheduling's contract ignores that one import (`curriculum → content.services`)
so the transitive rule does not turn it red.

**`curriculum` never imports `scheduling`** (`scheduling → curriculum` exists, ADR-0033, and
the reverse would be a cycle). "Does this teacher teach this student?" is answered by the
platform port `kaleem.platform.teaching` (`teaches`, `student_ids_taught_by`), which
scheduling fills from its `ready()`. Both raise `ImproperlyConfigured` when nothing is
registered rather than answering False. Lesson assignment is its first consumer
(`student_ids_taught_by`, once per call). curriculum's own tests register a fake provider;
`tests/test_curriculum_assignment_wiring.py` drives the real one over HTTP, because a
curriculum test may not import scheduling.

The identity mirror was written **before** any code and verified by breaking it. That is the
lesson from `scheduling`, which shipped without the mirror and where a direct
`from kaleem.identity.models import User` passed CI until 2026-09-04.

Note the arrow's direction is load-bearing in the other direction too: **`identity` may not
import `curriculum` at all.** This is why `seed_e2e`, which lives in `identity`, cannot reset
a teacher's subjects — the e2e specs converge their own fixture instead.

## Dashboard text

The course builder's and the lessons view's English and Arabic copy is a feature catalogue
(`dashboard/src/locales/{en,ar}/curriculum.json`, namespace `curriculum`), not part of the
global `common.json`. The `/curriculum` layout route's `loader` registers it before either
child route renders, so it stays out of the entry chunk and the initial-JS budget. The
pattern and its guards are in `docs/developer-guide/i18n.md`.

## Deliberately not here

- **Matching.** No `TeacherAssignment`, no ranking. Phase C1.
- **Booking, sessions, quota, video.** Phases C2 and C3.
- **Completion and progress, lesson resources,** moving a lesson to another unit, assigning
  a whole course in one action, due dates, assigning to a group, and sharing, duplicating or
  publishing a course. Later units (cur-lesson-completion, cur-lesson-resources) build on
  these tables.
- **Notifications about an assignment.** cur-assignment-notifications.
- **Subject proficiency or level** (beginner vs advanced Arabic). A matching refinement; C1
  adds it if the ranking needs it.

## Personal-data export

`curriculum.subjects` (`personal_data.py`, registered from `CurriculumConfig.ready()`)
exports the subjects a person teaches and the subjects they want to study, as
`{subject (slug), since}`. `Subject` itself is a `NOT_PERSONAL` catalogue row. The erase hook
is lb-gdpr-erasure.
