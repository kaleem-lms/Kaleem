---
name: asm-report-api
phase: v1 (wave 3, assessment stream; roadmap B4)
modules: [assessment]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Give the report that asm-module-foundation modelled its HTTP surface: a teacher reads and
writes the report of one lesson, and lists the held lessons still waiting for one
("Reports due"). This unit also adds the rule the foundation left out on purpose: when a
report may be written. It shares the lesson's close-out window (`dec-lesson-outcomes`),
and it applies only to a lesson that was held. Each response carries `may_write` and
`may_edit`, computed on the server, so the client never works out the window itself.
asm-teacher-report-ui builds the form and the list on top of it.

## Decisions this spec rests on

| Id | Answer used here |
| --- | --- |
| `dec-lesson-outcomes` | Answered. Reports share the close-out window, `starts_at <= now < starts_at + 7 days`, measured from the start. |
| `asm-d-report-audience` | Answered (option 2, 90 days). Readers are those `assessment.services.can_read_report` already admits. |
| `asm-d-report-content` | Answered (option 2). The PUT body is schema v1, exactly as `kaleem/assessment/content.py` validates it. |
| `asm-d-report-mandatory` | **Open.** This spec assumes the recommended answer, **prompted but optional**. Reports due is the prompt, and nothing is gated on a report. A lesson whose window closes without one simply leaves the list. Option 1 (mandatory) leaves this API unchanged, because pay and analytics read `reported_session_ids`; their units would decide what "counts". Option 3 (optional, not prompted) would remove `reports-due/` from this unit. |

## User flow

1. A teacher closes a lesson as held (`POST scheduling/sessions/<id>/complete/`, already
   shipped).
2. `GET assessment/sessions/<id>/report/` answers `report: null, may_write: true`.
3. The teacher saves the report with `PUT` and gets back `report: {...}, may_edit: true`.
   A second `PUT` inside the window replaces it.
4. `GET assessment/reports-due/` lists the teacher's held lessons in the window that have
   no report, oldest first. A lesson leaves the list when it gets a report or when its
   window closes.
5. The student, the student's parents, staff and the current same-subject teacher read
   the report through the same `GET`. All four get `may_write: false, may_edit: false`.

The `PUT` refuses requests in this order:

1. An unknown lesson gets 404 `not_found`.
2. Anyone but the lesson's teacher gets 403 `permission_denied`.
3. 409 `conflict`, with one whole sentence for each case:
   - the lesson was cancelled;
   - the lesson has not started;
   - the window has passed;
   - the lesson is still `scheduled`: "Record how the lesson went before reporting it.";
   - the outcome is not `held`. This covers `student_absent`, `teacher_absent`, and a
     completed lesson with no outcome. An outcome is never inferred from `None`.
4. Invalid content gets 400 `validation_error`, with the failing field.

The permission check comes before any state check, so someone outside the lesson learns
nothing about it. The order of the state checks is a choice: a stale lesson reports
"passed" rather than "not closed out".

## Data model delta

None. There are no new tables, no new columns and no migration. `scheduling.Session.outcome`
(ana-session-outcomes) is read through `SessionInfo.outcome`.

**ADR-0023, the four points.** This unit stores nothing new. It exposes report content,
which is children's data, over HTTP.
- **What:** the report fields from the foundation spec. Reports due also shows the
  teacher's own students' names and lesson times, which the teacher already sees in
  `scheduling/sessions/`.
- **Why:** lesson continuity and family visibility, unchanged.
- **How long:** unchanged. A report lives as long as its lesson.
- **Who sees:** exactly the `asm-d-report-audience` rule. Only the lesson's teacher can
  write, and only inside the window. Correcting a report after its window closes belongs
  to staff, in asm-admin-oversight.

**Expand/contract.** The routes are additive. `save_report` gains stricter refusals, but
no shipped route calls it, so the previous release in the blue-green window behaves the
same.

## API delta

These routes are mounted in `kaleem/assessment/api/urls.py`, under `/api/v1/assessment/`
(ADR-0029). Every route requires `IsAuthenticated`. Session auth and CSRF apply as
everywhere else. Instants are UTC ISO 8601.

**`GET sessions/<int:session_id>/report/`**: 200

```json
{
  "session_id": 41,
  "report": {"id": 7, "content": {"schema_version": 1, "covered": "..."},
             "created_at": "...", "updated_at": "..."},
  "may_write": false,
  "may_edit": true,
  "editable_until": "2026-10-31T16:00:00Z"
}
```

- `report` is `null` when none exists.
- `content` is the stored shape (`dump_report_content`).
- `editable_until` is the lesson's start plus 7 days.
- `may_write` is true only when all of these hold: the viewer is the lesson's teacher,
  the outcome is `held`, the window is open and no report exists yet. `may_edit` has the
  same conditions, except that a report must already exist.

Status codes:
- 200 for the lesson's teacher, the student, the student's parents and staff, with or
  without a report;
- 200 for anyone `can_read_report` admits, which here means the current same-subject
  teacher with a report from the last 90 days;
- 403 for everyone else;
- 404 for an unknown lesson.

**`PUT sessions/<int:session_id>/report/`**: the body is the content object (schema v1).
The response is 200 with the same body as `GET`, whether it created the report or
replaced it. The refusals are listed under User flow.

**`GET reports-due/`**: 200, a list ordered by `starts_at`, then `session_id`:

```json
[{"session_id": 41, "starts_at": "...", "duration_minutes": 60,
  "subject_slug": "quran", "subject_name": "Quran", "student_name": "...",
  "editable_until": "..."}]
```

It returns 403 `permission_denied` without a teacher profile, as
`scheduling/sessions/to-close/` does. The list covers the viewer's own lessons as a
teacher only, so a teacher who is also a parent never sees their child's lessons in it.
`subject_name` is translated with `pgettext("subject name", ...)`, the catalog context
ADR-0058 section 4 fixes. The lookup happens in the serializer, because assessment may
not import `curriculum`. The service makes 2 queries no matter how many rows it returns.

**Services** (`kaleem/assessment/services.py`) return frozen DTOs:
- `save_report(author, session_id, content, *, now=None)` gains the outcome and window
  rule.
- `report_view(viewer, session_id, *, now) -> ReportView` (`session_id`, `report`,
  `may_write`, `may_edit`, `editable_until`) applies the 200/403/404 rule above.
- `reports_due(teacher, *, now) -> list[ReportDue]` is built from
  `scheduling.services.sessions_between(role="teacher")`, filtered to held lessons inside
  `close_out_window`, minus `reported_session_ids`.

The window uses `scheduling.services.close_out_window` and `CLOSE_OUT_WINDOW`. Assessment
does not keep a second copy.

No new `error_code`. The flags are what the client branches on (ADR-0058: a specific code
is added only when a client needs one).

## Frontend

None in this unit. asm-teacher-report-ui builds the form (from the close-out control)
and the Reports due list on `/assessments`. asm-report-views builds the student and
parent views. Both consume these routes.

## Module boundaries

`assessment` owns the routes. It calls `scheduling.services` (`get_session`,
`sessions_between`, `close_out_window`, `CLOSE_OUT_WINDOW`) and `identity.services`
(`get_teacher_profile`, `is_parent_of`). These are the edges ADR-0051 already opened, so
no contract changes. Nothing imports `curriculum` or scheduling's models. The unit adds
no events, and no notices (asm-report-notices handles those).

## Out of scope

- Ratings and their endpoint: asm-ratings. `record_rating`'s rules are unchanged.
- Staff correction after the window, and the audit trail: asm-admin-oversight.
- The per-student report list endpoint: asm-report-views.
- Notices and reminders: asm-report-notices.
- Seed data: asm-e2e-fixtures and plat-dev-seed.
- Any dashboard code.

## Test plan

- **Write rule:** a held lesson can be reported at its start and at start plus 7 days
  minus 1 second, and is refused at start plus 7 days. A `scheduled`, `student_absent`,
  `teacher_absent` or outcome-less completed lesson is refused. Editing after the window
  is refused and leaves the row unchanged. Permission still comes before state.
- **Flags:** for the teacher, `may_write` is true before the report exists and `may_edit`
  after. Both are false once the window closes, for a lesson that was not held, and for
  every non-author reader.
- **Read rule:** the student, a parent and staff read, and get `report: null` when there
  is none. The current same-subject teacher reads a report from the last 90 days, and is
  refused for one 91 days old or a lesson with no report. A stranger and a former teacher
  get 403. An unknown lesson gets 404.
- **Reports due:** the list contains only held, unreported lessons inside the window,
  oldest first. Each of these is excluded: a reported lesson, a `student_absent` one, a
  `scheduled` one, a cancelled one, one exactly at start plus 7 days, another teacher's
  lesson, and the teacher's own child's lesson. A user without a teacher profile gets
  403. The query count is constant across 1 and 5 rows.
- **HTTP:** each status code and `error_code` above is tested. A PUT creates and then
  replaces. Under `Accept-Language: ar` the refusal message and `subject_name` come back
  in Arabic. A PUT without a CSRF token through an enforcing client is refused.
- **Gates:** `lint-imports`, the API-versioning test, the catalog completeness test and
  mypy all stay green.
- **e2e:** none in this unit. The programme puts the contract flow in
  asm-teacher-report-ui ("a filed report persists and leaves Reports due"). That unit adds
  the D3 row.

## Open questions

1. **`asm-d-report-mandatory`: is a report mandatory for a lesson to count?** This spec
   assumes "prompted but optional". The owner's answer is needed before this spec is
   approved.
2. **Reporting is limited to held lessons.** A teacher cannot report a lesson that is
   still running or not yet closed out, which the foundation allowed. They close it first
   (the UI reaches the form from the close-out control). The owner approves this along
   with the spec.
