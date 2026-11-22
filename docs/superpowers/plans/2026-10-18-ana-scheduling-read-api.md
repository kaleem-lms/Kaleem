---
spec: docs/superpowers/specs/2026-10-18-ana-scheduling-read-api-design.md
status: draft
---

**Repo:** `backend` only. **Worktree:**
`/home/abdulkhalek/Projects/kaleem-worktrees/backend-ana-scheduling-read-api`, branch
`feat/ana-scheduling-read-api`, created per runbook section 1 from `origin/main`. Base at
writing: 2401dc7.

**Files:**

- `kaleem/scheduling/services.py`: the reads, the DTOs, the moved quota and the party rule.
- `kaleem/scheduling/booking.py`: drop `Quota`, `_consumed` and `get_quota`, and re-import
  them from `services`. `_is_party` delegates to the rule in `services`.
- `kaleem/scheduling/api/views.py`: drop `_visible_sessions`, and `_session_payload` reads a
  `SessionInfo`.
- New: `kaleem/scheduling/tests/test_read_api.py` and
  `kaleem/scheduling/tests/test_payload_characterization.py`.

**No migration. No dependency change. No floor edit** (dec-floor-ownership).

## Steps

Run every focused test with `"${R}/_tools/backend-gate.sh" "${WT}" <test path>`. Commit after
each green step, staging the step's paths explicitly.

1. [ ] **Characterization first, against unchanged code.** Write
   `test_payload_characterization.py`:
   - The exact key list and values of the sessions list for four viewers: a student, a
     teacher, a parent, and a teacher who is also a parent of another student.
   - The same for the cancel response, the complete response and `GET quota/`.
   - The list's query count at 1 session against 4 sessions (`django_assert_num_queries`).

   It must be **green on untouched `main` code**. Mutation check: change one field in
   `_session_payload` and see it go red, then restore it.
2. [ ] **Move the quota.** In `test_read_api.py`, write a failing
   `services.get_quota(student) == booking.get_quota(student)` and an import smoke test. The
   smoke test is a subprocess, `python -c "import kaleem.scheduling.services"`, run under
   Django setup, so it catches any import cycle. Then move `Quota`, `_consumed` and `get_quota`
   into `services.py` verbatim, docstrings included, and have `booking` import them.
   `test_booking_quota.py` stays unchanged and green.
3. [ ] **DTOs and visibility.** Write failing tests first:
   - for `SessionInfo` and `AssignmentInfo`: frozen, no email, the fields as the spec lists
     them;
   - for the role rule, each of `None`, `student`, `teacher` and `parent`, plus a stranger and
     another family's parent;
   - an unknown role raises `ValidationError`.

   Then add the private Q-builder, `_session_info(row)` and `_assignment_info(row)`, with
   `select_related("assignment__subject", "assignment__teacher", "assignment__student")`.
   Mutation check: drop the children clause, and the parent tests go red.
4. [ ] **`upcoming_sessions`, and switch the view.** Write a failing test that it equals the
   old rule (every status, `ends_at >= now`). Then move `_visible_sessions` into `services`,
   and rewrite `_session_payload` over `SessionInfo`. The cancel and complete views call
   `services.get_session(session.id)` after the mutation. Step 1's file must pass
   **unchanged**. Re-run its mutation check on the new code.
5. [ ] **`get_session` and `is_session_party`.** Write failing tests first:
   - the student, the teacher and the parent are parties;
   - another student, another teacher and another family's parent are not;
   - an unknown id gives `NotFoundError` from `get_session` and `False` from `is_session_party`.

   Then write the party rule once in `services`, and make `booking._is_party` a one-line
   delegate. `test_booking_cancel.py`'s party tests stay green. Mutation check: drop the
   parent clause, and the parent party test goes red, in **both** files.
6. [ ] **`sessions_between`.** Write failing boundary tests first:
   - straddles `start` gives in;
   - ends exactly at `start` gives out;
   - starts exactly at `end` gives out;
   - cancelled and completed give in;
   - naive input is refused;
   - `end <= start` is refused;
   - 31 days passes and 32 days is refused.

   Then implement with the `ends_at` annotation. Mutation check: change `<` to `<=` on `end`,
   and it goes red.
7. [ ] **`session_history`.** Write failing tests first:
   - newest first;
   - paging with `before` (two pages, no overlap, no gap);
   - an in-progress lesson is excluded;
   - `limit` 0 and 101 are refused.

   Then implement.
8. [ ] **`next_sessions` and `next_session_per_child`.** Write failing tests first:
   - `SCHEDULED` only, in-progress included, cancelled future excluded, `limit` honoured;
   - the per-child read: two children each get their own, a child with no scheduled session is absent, a
     non-parent gets `{}`, and the session query count is constant at 1 child against 3.

   Then implement. The per-child read uses `.order_by("assignment__student_id", "starts_at")`
   with `.distinct("assignment__student_id")`, which is Postgres, as CI and the gate are.
9. [ ] **`active_assignments` and `is_active_teacher_of`.** Write failing tests first: an ENDED
   assignment is excluded, the role rule applies, and the pair check is true in any subject.
   Then implement.
10. [ ] **Module docstring.** At the top of `services.py`, list the public reads, the role rule,
    "id-scoped reads: the caller authorizes", and "returns DTOs, never models". The docstring
    is where the public API is documented (see the spec's Out of scope on the architecture
    doc).
11. [ ] **Full gate and hand-back.** Run `"${R}/_tools/backend-gate.sh" "${WT}"`, which covers
    migrate, `makemigrations --check`, `pytest --cov=kaleem --cov=signaling`, ruff, format and
    `lint-imports`. Then run the five ready-checks in runbook section 3 and
    `gitleaks-range.sh "${WT}" origin/main..HEAD`, and fill in the hand-back block. Record
    every mutation check, red then green.

## e2e

**No new flow.** Nothing user-facing changes, so D3 asks for no new flow. The guard is the
existing booking (3) and matching (3) flows, which must stay green in CI. Read the e2e log for
`booking` and `matching` spec names rather than trusting a green job. The time budget is
therefore zero: the unit adds no new e2e time. The D3 table needs no new row. Close-out adds
"`scheduling` read API: no e2e by design, server-only reads" if the conductor wants the gap
written down.

## Risks

- **Import cycle.** `services` must never import `booking`, `matching` or `rooms`. The
  subprocess smoke test in step 2 fails on a cycle even when pytest's import order would hide
  it.
- **Silent payload drift.** Step 1 is written and proven green before anything moves. If the
  characterization test needs editing after step 4, the payload changed, and the unit stops
  and escalates.
- **An extra query on cancel and complete.** It is accepted and stated in the spec. These are
  mutations, not hot reads.
- **Window queries filter on an expression, not an index.** That is adequate at current volume,
  and no index is added (spec, Out of scope).
- **Coverage.** Every branch of the refused-input checks has a test, so this should be
  coverage-positive. The conductor sets any floor change from CI.
- **Shared files.** `services.py` and `api/views.py` are this unit's shared files in the
  programme. A later unit touching either merges `main` after this lands.

## Verification

- Each step: its focused tests are red first, then green, with the mutation checks recorded.
- Whole unit: the full backend gate is green, step 1's characterization file is unchanged
  since step 1 (`git log -p` on it shows one commit), `lint-imports` shows 0 contracts
  broken, and CI e2e is green with the booking and matching flows named in the log.
- D9 for a server-only unit: there is no click-through beyond a staging spot-check that the
  sessions list, cancel and quota still render for a student, a teacher and a parent. The
  journal line and ISSUES spots go in at close-out.
