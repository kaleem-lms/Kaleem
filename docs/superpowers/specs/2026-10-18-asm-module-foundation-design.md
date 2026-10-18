---
name: asm-module-foundation
phase: v1 (wave 2, assessment stream; roadmap B3)
modules: [assessment]
status: approved
approved: 2026-10-18
created: 2026-10-18
closed: null
---

## Goal

Give the empty `assessment` scaffold its two tables, the typed content of a session report,
and the services the later assessment units build on: `SessionReport` (what a teacher
writes after a lesson) and `Rating` (stars one party gives the other). This unit adds no
endpoint and no UI. asm-report-api, asm-ratings and asm-admin-oversight add those.

It also joins the export/erase registry (ADR-0048), builds the rating purge that
`asm-d-retention` requires, adds `pydantic` for the typed content (roadmap module map,
section 4) and writes `docs/architecture/assessment.md`.

## Decisions this spec rests on

Answered: `asm-d-retention` (reports live as long as the lesson; rating comments are
purged after 12 months), `dec-lesson-outcomes` (reports share the lesson's start-to-7-days
window; enforced by asm-report-api, see below), `lb-dec-erasure-semantics` (anonymize in
place), `asm-d-progress-scope` (no ProgressSnapshot).

**Resolved by the owner on 2026-10-18.** The owner accepted each of the five before-spec
decisions exactly as this spec's draft assumed it, and approved the spec, including the
rating export (stars and date only, no comment).

| Id | Resolved answer |
| --- | --- |
| `asm-d-report-content` | Option 2: covered, next, homework, plus an optional passage and an optional focus tag (the slugs listed below). The rating of the student is a `Rating` row, not report content. |
| `dec-quran-reference-source` | Option 2: surah number and ayah range only, no Quran text. Hafs/Kufan count, totalling 6,236. |
| `asm-d-report-audience` | Option 2: writer, the student, the student's parents and staff, plus the student's current teacher of the same subject for reports from the last 3 months, read as 90 days. |
| `asm-d-rating-visibility` | Option 2: a teacher sees only their average, and only once 3 or more distinct students have rated them; comments are staff-only; staff can hide a rating. |
| `dec-student-rating-visibility` | Staff only, kept 12 months. |

`asm-d-parent-rating` stays open and belongs to asm-ratings. This unit refuses a parent as a
rater; the model needs no change for either answer, because the rater is a plain user.

## User flow

None in this unit. Nothing calls the services yet, and no route exists.

## Data model delta

Two new tables in `assessment` (migration `0001_initial`). References to `scheduling` use
a string foreign key (`"scheduling.Session"`), the precedent of
`scheduling.TeacherAssignment.subject`. Nothing imports `scheduling.models`.

```
scheduling.Session 1 ── 0..1 SessionReport ──> User (student)
         │                         └────────> User (author, nullable)
         └──────── 0..n Rating ──> User (rater), User (ratee)
```

**`SessionReport`**

| Field | Type | Notes |
| --- | --- | --- |
| `session` | FK `scheduling.Session`, CASCADE | unique: one report per lesson |
| `student` | FK user, CASCADE | copied from the session at write time, so reads by student never join scheduling's tables |
| `author` | FK user, SET_NULL, nullable | the teacher who wrote it; NULL after the author's erasure |
| `content` | JSON | always written through the Pydantic model below; never free-form |
| `created_at`, `updated_at` | datetime | |

Index: `(student, created_at)` for the per-student list.

**Report content, schema version 1** (`kaleem/assessment/content.py`, Pydantic v2,
`extra="forbid"`, strings stripped):

| Key | Rule |
| --- | --- |
| `schema_version` | literal `1` |
| `covered` | required, 1 to 2,000 characters |
| `next_plan` | optional, up to 2,000 characters |
| `homework` | optional, up to 2,000 characters |
| `passage` | optional `{surah, from_ayah, to_ayah}`: surah 1 to 114, `1 <= from_ayah <= to_ayah <= ayah count of that surah`. One surah per passage. (`asm-d-report-content`, `dec-quran-reference-source`) |
| `focus` | optional, one of `memorization`, `revision`, `recitation`, `tajweed`, `tafsir`, `arabic`, `other`. Stored as slugs; labels and their Arabic wording belong to asm-teacher-report-ui and its Arabic review. (`asm-d-report-content`) |

The reader dispatches on `schema_version`. A later version adds a model and an up-converter
for older rows; stored rows are never rewritten by a reader. An unknown version raises.

**Ayah counts.** `kaleem/assessment/quran.py` holds a tuple of 114 integers: the ayah count
of each surah in the Kufan count used by the Hafs mushaf, which totals 6,236. These are
counts, not Quran text, so no licence attaches. The builder checks them against Tanzil's
published metadata and records the source in the module docstring. No fixture, no table.

**`Rating`**

| Field | Type | Notes |
| --- | --- | --- |
| `session` | FK `scheduling.Session`, CASCADE | |
| `rater` | FK user, CASCADE | |
| `ratee` | FK user, CASCADE | copied from the session, so averages never join scheduling's tables |
| `direction` | `student_to_teacher` or `teacher_to_student` | |
| `stars` | small int | CheckConstraint 1 to 5 |
| `comment` | text, blank | up to 1,000 characters; staff-only (`asm-d-rating-visibility`) |
| `hidden` | bool, `db_default=False` | set by staff in asm-admin-oversight; hidden ratings leave the average |
| `created_at` | datetime | |

Constraint: unique `(session, rater)`. Index: `(ratee, direction, hidden)`.

**ADR-0023, the four points**

- **What:** what a teacher wrote about a child's lesson (free text, a passage, a focus
  tag); stars and an optional comment each way. Children's data.
- **Why:** lesson continuity for the teacher, visibility for the family, quality oversight
  for staff. Nothing else; no ranking or matching input in v1.
- **How long:** a report lives as long as its lesson (it cascades with `Session`). Rating
  comments are blanked 12 months after creation. Teacher-to-student ratings are deleted
  after 12 months (`dec-student-rating-visibility`). Student-to-teacher stars live as long
  as the lesson.
- **Who sees:** reports: the author, the student, the student's parents, staff, and the
  student's current teacher of the same subject for reports from the last 90 days
  (`asm-d-report-audience`; "3 months" read as 90 days). Ratings of a teacher: the
  teacher sees an average and a count only, at 3 or more distinct raters, hidden ratings
  excluded; comments and individual rows are staff-only. Ratings of a student: staff only.

**Expand/contract.** Two new tables and nothing else. The previous release never reads
them. No column changes on an existing table.

## API delta

No HTTP route. The Python interface in `kaleem/assessment/services.py`, which returns
frozen DTOs (`ReportInfo`, `RatingSummary`), never models:

- `parse_report_content(data) -> ReportContent`: raises `platform.ValidationError` with
  the field errors.
- `save_report(author, session_id, content) -> ReportInfo`: creates or replaces the
  lesson's report. Refuses (`PermissionDeniedError`) unless `author` is the lesson's
  teacher; refuses (`ConflictError`) a cancelled lesson or one not yet started. The
  outcome and 7-day window rules of `dec-lesson-outcomes` are added to this same function
  by asm-report-api, once ana-session-outcomes has shipped the outcome.
- `get_report(session_id) -> ReportInfo | None`: id-scoped; the caller authorizes.
- `can_read_report(user, session_id) -> bool`: the audience rule above.
- `reports_for_student(viewer, student_id, *, before, limit) -> list[ReportInfo]`: newest
  first, keyset page, filtered by `can_read_report`'s rule.
- `record_rating(rater, session_id, stars, comment="") -> None`: the lesson's teacher rates
  the student, or the student rates the teacher; direction and ratee follow from which
  party the rater is. A parent or a non-party is refused. Same started/cancelled refusals
  as `save_report`. A second rating by the same rater replaces the first.
- `teacher_rating_summary(teacher_id) -> RatingSummary | None`: count and average (one
  decimal) of visible student-to-teacher ratings; `None` below 3 distinct raters. For
  analytics and asm-ratings.
- `reported_session_ids(session_ids) -> frozenset[int]`: which of these lessons have a
  report. For reports-due and analytics.
- `purge_expired(*, now=None) -> int`: the retention job; idempotent.

Lesson facts (teacher, student, subject, start, status) come only from
`scheduling.services.get_session`, the student's parents from
`identity.services.is_parent_of`, and the current-teacher check from
`scheduling.services.active_assignments`.

## Frontend

None. This unit has no route and no screen. asm-teacher-report-ui mirrors the content
schema in zod; asm-report-views and asm-ratings render it.

## Module boundaries

`assessment` owns both tables. It calls `identity.services` and `scheduling.services`
only. The import-linter contract opens the `assessment -> scheduling` edge that the
roadmap's module map already names ("Depends on: identity, scheduling (read-only via
public API)"), recorded in a short ADR (number from the conductor) as the scaffold's
contract comment requires:

- `assessment imports no business modules except identity and scheduling`, with
  `billing` and `curriculum` still forbidden for direct imports and the transitive
  `scheduling -> billing.services`, `scheduling -> curriculum.services` and
  `curriculum -> content.services` edges ignored, as scheduling's own contract does.
- A new mirror: `assessment does not reach past scheduling's public API`
  (`kaleem.scheduling.models` forbidden, indirect imports allowed, tests exempted).

Personal data: `kaleem/assessment/personal_data.py`, registered from
`AssessmentConfig.ready()`, covering both models:

- export: reports about the user, reports the user wrote, ratings the user gave (with
  their own comment), ratings the user received as stars, direction and date only (no
  rater, no comment).
- erase (order 500): delete reports about the user; set `author` to NULL on reports the
  user wrote; delete ratings the user gave or received.

The retention task `kaleem.assessment.tasks.purge_expired_ratings` ships here **without a
beat entry**. The blue-green rule deploys a task name one release before anything
enqueues it, and nothing writes a rating until asm-ratings, so asm-ratings adds the
`CELERY_BEAT_SCHEDULE` entry.

No new events.

## Out of scope

- Any endpoint, serializer or screen (asm-report-api, asm-report-views, asm-ratings,
  asm-teacher-report-ui).
- The outcome and window rule for writing (asm-report-api, after ana-session-outcomes).
- Hiding a rating, staff correction of a report, the audit trail (asm-admin-oversight).
- Parent ratings (`asm-d-parent-rating`, asm-ratings), ProgressSnapshot (deferred).
- Quran text, surah names and their translations.
- Seed accounts and lesson states (asm-e2e-fixtures).

## Test plan

- Content: each rule above accepted at its boundary and refused one past it; an unknown
  key, an unknown `schema_version` and a passage past the surah's last ayah refused; the
  ayah table has 114 entries summing to 6,236, with spot checks (1: 7, 2: 286, 108: 3).
- Models: stars 0 and 6 refused by the database; a second report for one lesson refused;
  a second rating by one rater for one lesson refused; deleting the lesson removes both.
- `save_report` and `record_rating`: the teacher and the student succeed; a parent, an
  unrelated teacher and an unknown session are refused with the typed error; a cancelled
  or future lesson is refused; a repeat replaces.
- Audience: each reader in the rule reads; an unrelated teacher, a former teacher, the
  current teacher of another subject, and the current same-subject teacher for a
  91-day-old report are refused.
- Summary: `None` at 2 distinct raters, a value at 3; a hidden rating leaves both count and
  average; teacher-to-student ratings never count.
- Purge: a comment at 365 days minus a second stays, past 365 days is blanked; a
  teacher-to-student rating past 365 days is deleted; a second run changes nothing.
- Personal data: `assert_hooks_honour_contract` passes for both hooks; the coverage guard
  stays green with no pending entry for `assessment`.
- Boundaries: `lint-imports` green; a direct `kaleem.scheduling.models` import in
  `assessment` turns it red (mutation check).
- e2e: none. There is no user-facing behaviour; the D3 table gets no row from this unit.

## Open questions

1. Exporting ratings a person received as stars and date only, without the comment: the
   owner approved it on 2026-10-18; lb-gdpr-data-export may still confirm the legal reading.
