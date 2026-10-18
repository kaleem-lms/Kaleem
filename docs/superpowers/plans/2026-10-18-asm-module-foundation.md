---
spec: docs/superpowers/specs/2026-10-18-asm-module-foundation-design.md
status: draft
---

# Plan: asm-module-foundation

Repos: `backend` (code) and meta (ADR, `docs/architecture/assessment.md`). Branch
`feat/asm-module-foundation` in both.

- Backend worktree `/home/abdulkhalek/Projects/kaleem-worktrees/backend-asm-module-foundation`,
  created from backend `origin/main` as conductor-runbook section 1 says. Its base must
  contain plat-module-scaffolds, ana-scheduling-read-api, plat-dsar-registry and
  ci-parallel-guards (all on main at 31cf4a6).
- Meta worktree `/home/abdulkhalek/Projects/kaleem-worktrees/meta-asm-module-foundation`.

Do not start until the owner has answered the five open decisions in the spec and approved
it. If an answer differs from the assumed one, update the spec and this plan first.

**Dependency change.** `pydantic>=2.9,<3.0` in `requirements/base.txt` (upper-bounded, as
`stripe` is). The gate image is keyed on `requirements/*.txt`, so `backend-gate.sh` exits 3
after step 1 until the conductor builds the new image (runbook section 7). Ask for it then;
do not work around it. One dependency-changing unit per repo at a time: the conductor
allocates the slot.

**Migration.** One: `kaleem/assessment/migrations/0001_initial.py`, generated, depending on
the latest `scheduling` migration on main and on `AUTH_USER_MODEL`. Additive only. If
ana-session-outcomes lands a `scheduling` migration first, the dependency stays valid; do
not hand-edit it to the newer one.

**Floors.** Never edit `fail_under` (dec-floor-ownership).

## Steps

Each step: write the named tests, run them red with
`backend-gate.sh <wt> <test file>`, write the code, run them green. Tests build users with
identity's services and lessons with a fixture in `kaleem/assessment/tests/conftest.py`
that creates scheduling rows directly (the exemption is in step 2's contract).

1. [ ] **Dependency.** Add pydantic to `requirements/base.txt`. Request the gate image.
   No test: the next step's import is the proof.

2. [ ] **Boundary first.** In `pyproject.toml`, rewrite
   `assessment imports no business modules except identity` to
   `... except identity and scheduling` (forbidden: billing, curriculum, content,
   messaging, notifications, engagement, analytics; `ignore_imports` for
   `kaleem.scheduling.** -> kaleem.billing.services`,
   `kaleem.scheduling.** -> kaleem.curriculum.services` and
   `kaleem.curriculum.** -> kaleem.content.services`, alerting `warn` as scheduling's
   contract does). Add `assessment does not reach past scheduling's public API`
   (forbidden `kaleem.scheduling.models`, `allow_indirect_imports = true`, ignore
   `kaleem.assessment.tests.* -> kaleem.scheduling.models`). Add a tests exemption to the
   identity mirror only if a test imports identity's models: an ignore that matches nothing
   fails `lint-imports`. Mutation check: a throwaway
   `from kaleem.scheduling.models import Session` in `services.py` must turn
   `lint-imports` red; remove it.

3. [ ] **Ayah counts.** Tests in `tests/test_quran.py`: `test_has_114_surahs`,
   `test_counts_sum_to_6236`, `test_spot_checks` (1: 7, 2: 286, 108: 3, 114: 6).
   Code: `kaleem/assessment/quran.py` with the tuple and its source in the docstring,
   checked against Tanzil's metadata.

4. [ ] **Content schema.** Tests in `tests/test_content.py`:
   `test_minimal_v1_is_accepted`, `test_covered_is_required_and_bounded` (0, 1, 2,000,
   2,001 chars), `test_optional_texts_are_bounded`, `test_unknown_key_is_refused`,
   `test_unknown_schema_version_is_refused`, `test_passage_bounds`
   (surah 0/1/114/115; from > to; to = last ayah accepted, last + 1 refused),
   `test_focus_must_be_a_known_slug`, `test_round_trip_is_stable`,
   `test_errors_map_to_platform_validation_error`. Code: `content.py`
   (`ReportContentV1`, `parse_report_content`, the version dispatch).

5. [ ] **Models and migration.** Tests in `tests/test_models.py`:
   `test_stars_outside_1_to_5_rejected_by_db` (0 and 6, via `.update()` to bypass
   validation), `test_one_report_per_session`, `test_one_rating_per_rater_per_session`,
   `test_deleting_the_session_removes_report_and_ratings`,
   `test_hidden_defaults_false`. Code: `models.py`, then `makemigrations assessment`.

6. [ ] **Writes.** Tests in `tests/test_services_write.py`:
   `test_teacher_saves_report`, `test_save_replaces_existing`,
   `test_student_parent_and_other_teacher_refused`, `test_unknown_session_not_found`,
   `test_cancelled_or_future_lesson_conflicts`, `test_report_copies_student_from_session`,
   `test_teacher_rates_student_and_student_rates_teacher` (direction and ratee derived),
   `test_parent_and_non_party_cannot_rate`, `test_rating_repeat_replaces`,
   `test_comment_over_1000_refused`. Code: `save_report`, `record_rating`, the DTOs.

7. [ ] **Reads and audience.** Tests in `tests/test_services_read.py`:
   `test_audience_allows_author_student_parent_staff`,
   `test_current_same_subject_teacher_reads_within_90_days`,
   `test_current_same_subject_teacher_refused_after_90_days`,
   `test_other_subject_teacher_former_teacher_unrelated_refused`,
   `test_reports_for_student_pages_newest_first`,
   `test_reports_for_student_returns_nothing_to_an_outsider`,
   `test_get_report_none_when_missing`, `test_reported_session_ids`,
   `test_summary_none_below_three_distinct_raters`,
   `test_summary_excludes_hidden_and_teacher_to_student`,
   `test_reads_return_dtos_not_models`. Code: the read functions.

8. [ ] **Retention.** Tests in `tests/test_retention.py`:
   `test_comment_kept_just_inside_365_days`, `test_comment_blanked_past_365_days`,
   `test_teacher_to_student_rating_deleted_past_365_days`,
   `test_student_to_teacher_stars_kept`, `test_purge_is_idempotent`,
   `test_task_calls_purge`. Code: `purge_expired` in `services.py`, task
   `purge_expired_ratings` in `tasks.py`. **No `CELERY_BEAT_SCHEDULE` entry** (spec,
   Module boundaries); asm-ratings adds it.

9. [ ] **Personal data.** Tests in `tests/test_personal_data.py`:
   `test_hooks_honour_contract` (`assert_hooks_honour_contract`),
   `test_export_shapes_by_role`, `test_received_ratings_export_has_no_rater_or_comment`,
   `test_erase_deletes_reports_about_user_and_nulls_authorship`,
   `test_erase_deletes_ratings_given_and_received`. Code: `personal_data.py` and
   `AssessmentConfig.ready()`. `tests/test_personal_data_hooks_cover_every_model.py` must
   stay green with no `PENDING_*` entry for `assessment`.

10. [ ] **Mutation checks.** For steps 5 to 9, revert one guard at a time (the stars
    constraint, the party check, the 90-day cut-off, the threshold, the hidden filter,
    the purge cut-off, the erase delete) and see the named test go red. Record the pairs
    in the hand-back.

11. [ ] **Docs (meta).** `docs/adr/NNNN-assessment-reads-scheduling.md` (number from the
    conductor): the edge, the ignored transitive edges, the string FK and the rule that
    services use `session_id` only. `docs/architecture/assessment.md`: tables, content
    schema and versioning, services, audience, retention, hooks. Update the scaffold
    docstring in `tests/test_module_scaffolds.py` only if a test there fails; otherwise
    leave it (D10).

12. [ ] **Full gate and hand-back.** `backend-gate.sh <wt>` (migrate,
    makemigrations --check, pytest with coverage, ruff, format, lint-imports, mypy),
    then runbook section 3's five checks and `gitleaks-range.sh`. Commit with explicit
    paths, Conventional Commits, `PIP_CONFIG_FILE=/dev/null`.

## e2e

None. The unit adds no route, screen or endpoint, so there is no flow to drive. The
assessment flows start in asm-teacher-report-ui and asm-report-views, on the fixtures from
asm-e2e-fixtures.

## Risks

- **The string FK lets code walk into scheduling's model** (`report.session.assignment`).
  import-linter cannot see attribute access. Services use `session_id` only; the reviewer
  greps `assessment/` for `.session.` and `session__`.
- **Transitive import edges.** If scheduling gains a new business import before this
  merges, the assessment contract breaks. Fix by adding that one ignore at freshness, in
  the ADR's terms; any wider change escalates.
- **mypy and pydantic.** If pydantic's types fail the mypy gate, add the
  `pydantic.mypy` plugin; do not add ignores.
- **pip-audit.** A pydantic advisory at merge time blocks CI; take the patched version
  within the range.
- **Parallel units.** ana-session-outcomes changes `scheduling` and `SessionInfo` in the
  same wave. This unit reads only fields that exist on main today.
- **A decision answer differs from the assumption.** Content keys, the audience rule and
  the purge are the parts that move; the tables mostly do not.

## Verification

Each step's named tests red then green; the mutation pairs in step 10; the full backend gate
green; `lint-imports` with both new contracts KEPT; the coverage guard green with no
assessment pending entry. CI is the authority for the coverage figure.
