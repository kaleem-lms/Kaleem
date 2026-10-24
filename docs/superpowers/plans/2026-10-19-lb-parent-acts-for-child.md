---
spec: docs/superpowers/specs/2026-10-19-lb-parent-acts-for-child-design.md
status: approved
---

Repos: `backend` and `dashboard`, each on branch `feat/lb-parent-acts-for-child`, in worktrees
`/home/abdulkhalek/Projects/kaleem-worktrees/{backend,dashboard}-lb-parent-acts-for-child`. Both
are created from `origin/main` as runbook section 1 says (backend 2f13d53, dashboard f76677b at
writing).

- No migrations, no dependency changes, no floor edits.
- Shared files are `backend/kaleem/scheduling/booking.py` and `dashboard/e2e/booking.spec.ts`.
  The conductor serialises them against the other wave-2 scheduling units.
- Backend lands first. The dashboard needs `student_id`, `next_session_at` and the parameters,
  and the old bundle keeps working against the new backend.

## Steps

### Backend

1. [ ] **Worktree.** Create the worktree. Run `_tools/backend-gate.sh <wt>` once to record the
   baseline.

2. [ ] **Red: who may act for whom.** In `test_booking_claim.py`, add tests for
   `booking.student_for(actor, student_id)`:
   - self returns self;
   - a linked parent gets the child;
   - another family's parent gets `NotFoundError`;
   - the child's own teacher gets `NotFoundError`;
   - an unknown id gets `NotFoundError`.

   Then add tests for `booking.resolve_assignment(actor, student_id, subject_slug)`:
   - a single assignment with no slug returns it;
   - zero assignments returns `None`;
   - two assignments with no slug raise `ValidationError(field="subject")`;
   - a slug resolves its assignment;
   - an unknown slug, or one with no ACTIVE assignment, raises `NotFoundError`.

   Add fixtures to `tests/conftest.py`: `arabic` (subject), `second_assignment` (student ×
   arabic) and `other_family_parent`.

3. [ ] **Green.** Write `student_for` and `resolve_assignment` in `booking.py`, and delete
   `_active_assignment`. Add the new message ids to `scheduling/locale/ar/LC_MESSAGES/django.po`
   as drafts, so `test_server_strings` stays green.

4. [ ] **Red, then green: service signatures.**
   - Change `claim_slot`, `slot_options` and `get_active_slot` to the keyword-only signatures
     in the spec.
   - Port every existing call in `test_booking_claim.py` (about 25 calls) to `student_id=`.
   - Replace `test_a_student_with_two_active_assignments_cannot_claim_a_slot` with:
     - `…must_name_a_subject` (the `ValidationError`);
     - `…claims_each_subject` (two ACTIVE slots).
   - Add `test_a_parent_claims_for_their_child` and the cross-family refusal. The refusal also
     asserts that no `RecurringSlot` row exists.
   - Update `seed_e2e_matching.py:141` and `seed_load_scheduling.py:197` to pass
     `student_id=…, subject_slug=None`. Their tests (`test_seed_e2e_matching.py`,
     `test_seed_load_scheduling.py`) must stay green unchanged.

5. [ ] **Red, then green: the lock.** Add `test_claim_locks_teacher_and_student_assignments_in_id_order`.
   - Under `CaptureQueriesContext`, take the claim's `FOR UPDATE` statements.
   - Assert there is exactly one, that it filters on both `teacher_id` and `student_id`, and
     that it has `ORDER BY … "id"`.
   - Then change the lock query in `claim_slot`. Add `order_by("id")` to `generate_sessions`'s
     per-student lock.
   - Update the `tasks.py` docstring, which describes the old lock orders.

6. [ ] **Red, then green: date-order generation.** In `test_booking_generation.py`, add:
   - `test_a_shared_quota_is_spent_in_date_order_across_subjects`: two slots (Sat and Mon), a
     limit of 4, a cycle of five or more weeks. Expect four sessions, alternating subjects, in
     date order.
   - `test_a_subject_claimed_after_the_quota_is_spent_waits_for_the_next_cycle`.

   Then rewrite the `generate_sessions` loop:
   - group slots by `assignment__student_id`;
   - per student, take one lock, read the quota once and merge `_occurrences` across that
     student's slots;
   - sort by `(moment, slot.id)`;
   - `get_or_create` until `remaining` is 0.

   **Mutation check:** restore the per-slot loop. The first test must go red, with one subject
   getting all four sessions.

7. [ ] **Red, then green: the API.** In `test_booking_api.py`:
   - flip `test_a_parent_cannot_end_a_childs_slot` to `…can_end…`;
   - add allowed-parent tests for `slots/?student=`, `slot-options/?student=&subject=`,
     `POST slots/` with `student`, `subject` in the body, and `quota/?student=`;
   - add a cross-family 404 test for each;
   - add a test that `next_session_at` is present, and null when the quota is spent;
   - keep `test_a_parent_cannot_get_a_slot` (no parameter, 403).

   In `test_api.py`, add tests for `me/availability/?student=`:
   - a parent's GET and PUT round-trip;
   - the time zone lands on the child;
   - a teacher or stranger gets 404;
   - without the parameter, behaviour is unchanged.

   In `test_matching_api.py`, assert that `assignments/` rows have `student_id`.

   Then make the changes:
   - `api/views.py`: one `_target_student(request)` helper. Without the parameter it keeps
     `_require_student`; with it, it calls `booking.student_for`.
   - `ClaimSlotSerializer` gains optional `student` (int) and `subject` (slug).
   - `SlotSerializer` gains `next_session_at`.
   - `matching.list_assignments_for` and `AssignmentSerializer` gain `student_id`.
   - Delete the scoping comment in `SlotView.get`; it is no longer true.

8. [ ] **The e2e seed.**
   - In identity's `seed_e2e`, add verified accounts following the `guardian` precedent:
     - `e2e.family.parent@` (a ParentProfile);
     - `e2e.family.child@` (a StudentProfile), linked to that parent;
     - `e2e.multi@` (a StudentProfile);
     - `e2e.family.teacher@` (a TeacherProfile).
   - Add a new command `scheduling/management/commands/seed_e2e_family_booking.py`. It is
     DEBUG-guarded and converges like `seed_e2e_matching`. It:
     - gives the teacher quran and arabic;
     - gives the child quran, and the multi student quran and arabic;
     - sets identical UTC availability on Saturday and Monday;
     - calls `grant_dev_subscription` for the child and for the multi student. That helper
       makes an INDIVIDUAL plan with 4 sessions and a 30-day cycle. A parent's grant would
       not reach the child, because only a FAMILY plan chains. A 30-day cycle holds at
       least four of every weekday, so the first claim always spends all four and the
       second card's "No sessions left this cycle" is deterministic;
     - accepts each request through `matching.accept_offer`;
     - claims **no** slots, because the e2e flows claim them.

     It obeys the manifest's rule 2: every entitled account ends with an assignment.
   - Append `seed_e2e_family_booking` to `config/e2e_seeds.txt` after `seed_e2e_matching`.
   - Add `test_seed_e2e_family_booking.py`: run twice, assert the converged state is the same
     each time, assert there are no slots, and assert `e2e.teacher@`'s offers are untouched.

9. [ ] **Full backend gate.** Run `_tools/backend-gate.sh <wt>`: migrate,
   `makemigrations --check`, pytest with coverage, ruff and lint-imports. Then commit in
   Conventional Commits, by explicit path.

### Dashboard

10. [ ] **Worktree.** Create it and run `pnpm install --frozen-lockfile`.

11. [ ] **Red, then green: API and queries.**
    - `features/booking/api.ts`: `slotOptions`, `activeSlot`, `quota` and `claimSlot` take
      `{ studentId?, subjectSlug? }` and send them as `params` or body fields.
    - `queries.ts`: the keys become `["slot-options", studentId, subjectSlug]` and the like.
      A claim or end invalidates by prefix for that student, plus `sessions`.
    - `schemas.ts`: `Slot.next_session_at`. The matching `assignmentSchema` gains `student_id`.
    - `features/scheduling/api.ts` and `queries.ts`: `getAvailability` and `saveAvailability`
      take `studentId?`, and the key becomes `["availability", studentId ?? "me"]`.
    - Tests go in `api.test.ts`, `queries.test.tsx` and `schemas.test.ts`. The case that
      matters: switching student changes the key, so the cache is never shared.

12. [ ] **Red, then green: components.**
    - `StudentPicker`: options are the children plus "Me" if the viewer is a student. It is
      hidden with one option. It has a labelled `Select`.
    - `BookingPanel`: one `ClaimSlotCard` per assignment whose `student_id` matches. The
      "Still looking for a teacher" empty state shows when there are none.
    - `ClaimSlotCard`: new props; the heading names the subject and the teacher; it shows
      `next_session_at` or the "No sessions left this cycle" line.
    - `QuotaBadge`: new props; "Shared across all subjects".
    - `StudentAvailabilityCard({ studentId })`: skip the server sync while dirty (the
      `AvailabilityPage` pattern).
    - `SchedulePage`: the parent and student views render `StudentPicker` and `BookingPanel`.
      The teacher view is unchanged.

    Every "not rendered" assertion gets a positive control. Update `schedule.test.tsx` for the
    new layout. Add the `booking.*` keys to `en` and `ar` `common.json`, using "session" (the
    terminology guard enforces it). Keep the Arabic sweep allowlist untouched.

13. [ ] **e2e.**
    - Add the four accounts to a new `e2e/accounts/booking.ts`, spread into `ACCOUNTS`.
    - Add two flows to `booking.spec.ts`, after the existing serial block and in their own
      `describe`, so they read no state the existing flows write:
      - the parent claims for the child, with a reload;
      - the two-subject student books both subjects, sees "Shared across all subjects", and
        sees "No sessions left this cycle" on the second card.
    - Add one flow to `availability.spec.ts`: the parent edits the child's availability on
      `/schedule`, saves, reloads and still has it. Settle before asserting, per the D3 note
      on refetch.
    - Run locally in an e2e slot if one is free. CI is the authority.

14. [ ] **Full dashboard gate.** Run `_tools/dashboard-gate.sh <wt>`: tsc, lint, coverage,
    build and the built-CSS check. Commit.

15. [ ] **Hand-back** (runbook section 3), for each repo:
    - fresh against `origin/main`;
    - a clean tree;
    - `gitleaks-range.sh` reports CLEAN;
    - no floor touched;
    - the mutation-check evidence for steps 6 and 7.

    The hand-back also lists the close-out items for the conductor:
    - the `scheduling` arch doc and the D3 row;
    - an ISSUES line for parent-set subject interests;
    - batched Arabic strings for hg-arabic-review.

## Risks

- **A lock-order change in a transaction that writes money-adjacent rows.** The fallback is the
  existing `generate_sessions` retry on `OperationalError`. The query-shape test pins the new
  order, and the C2 sequential claim tests stay green.
- **Changing generation order changes which sessions exist for current multi-slot students.**
  None exist today, because a second slot could not be claimed. `get_or_create` keeps the
  rewrite idempotent for single-slot students, and the existing generation tests cover that.
- **Old bundle during blue-green.** Every parameter is optional and every field is additive.
  The one visible difference is a 400 on `GET slots/` for a multi-subject student, who could
  not book before either.
- **e2e collisions.** The flows use dedicated accounts and a dedicated teacher, so neither
  `e2e.teacher`'s offer inbox (matching asserts exactly one) nor `booked`'s sessions are
  touched.
- **Arabic copy** is draft until hg-arabic-review. That holds the spec's closure, not the merge.
- **Scope creep toward parent-set interests.** It is out of scope. If it proves necessary for
  the e2e, escalate rather than add a curriculum endpoint.

## Verification

- Each step: the named tests are red first, then green. Steps 6 and 7 are mutation-checked:
  revert the fix and see red.
- Backend full gate rc 0, and dashboard full gate rc 0.
- CI: every job green, and the e2e log names the three new flows.
- Staging (D9 substitute): an agent click-through with the four accounts in both themes,
  Arabic RTL and 320px.
