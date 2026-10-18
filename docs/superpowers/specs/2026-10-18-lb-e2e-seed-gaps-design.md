---
name: lb-e2e-seed-gaps
phase: v1 (wave 2, sched stream)
modules: [identity (seed only), dashboard e2e]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Close two e2e gaps that `ISSUES.md` records and the `CLAUDE.md` D3 table marks as uncovered:

1. **A parent sees no Join control.** The C3a spec lists it, but it shipped with only an API
   403 test and a component test. `seed_e2e` creates no parent-to-student link, so a browser
   flow would pass without proving anything.
2. **Change-password.** It is uncovered because the flow would change the shared seed
   password partway through the suite. It needs its own account.

This unit adds two seeded accounts, one parent-to-student link and two Playwright flows. It
does not change product code, copy, schema or API.

## User flow

**Flow A: a parent sees no Join control** (new `e2e/parent-schedule.spec.ts`)

1. The booked student (`e2e.booked`) signs in and opens `/schedule`. At least one
   `button` named `/join/i` is visible. This is the positive control: it proves the locator
   finds the control on these sessions.
2. A new parent, `e2e.guardian` ("E2E Guardian"), signs in and opens `/schedule`. The seed
   links this parent to `e2e.booked` and to no one else. First, at least one session row
   (`listitem` containing "E2E Booked Student") must be visible. This proves the parent sees
   the child's sessions, so the next check cannot pass on an empty or still-loading page.
3. On the parent's page, the same locator (`button` named `/join/i`) has count 0.

What makes the difference is the server's `may_join` flag (`_session_payload` in
`scheduling/api/views.py`). `JoinButton` renders nothing when `may_join` is false. The page
never decides this from the viewer's role (`SessionList.tsx`, `ViewerRole`).

**Flow B: change-password** (new `e2e/change-password.spec.ts`)

1. A new account, `e2e.password` ("E2E Password Change"), signs in with the seed password and
   opens `/account`.
2. In the form that contains "New password", it enters the seed password as the current
   password and a new password. Then it submits. A toast says "Password updated."
3. The page reloads and stays on `/account`. This proves the session survives the
   password-hash change. `ChangePasswordView` calls `update_session_auth_hash` with the user
   the service returns, because a stale hash logs the user out on the next request.
4. The user signs out through the account menu.
5. Signing in with the old password is refused: an `alert` appears and the URL stays on
   `/login`.
6. Signing in with the new password succeeds.

Retries are off for this file (`test.describe.configure({ retries: 0 })`). After step 2 has
run, a retry would sign in with the old password and fail. That second failure would hide the
real one. Re-running `seed_e2e` resets the password, because `_account` sets it every run.

## Data model delta

None. The seed creates rows in existing tables (`User`, `EmailAddress`, `ParentProfile`,
`identity.ParentStudent`). No migration.

## API delta

None.

## Frontend

No product change. Test-side changes only:

- New `dashboard/e2e/accounts/identity.ts`, the per-area fixture module (programme
  convention, `e2e/accounts/<area>.ts`). It exports `IDENTITY_ACCOUNTS` with `guardian` and
  `passwordChange`, each with an `email` and a `name`.
- `dashboard/e2e/fixtures.ts`: `ACCOUNTS` spreads `IDENTITY_ACCOUNTS` so `login(page, who)`
  accepts the new names. That is a one-line import plus a one-line spread. `login` itself is
  unchanged. Flow B's two sign-ins with other passwords go through the real form, inline.

## Module boundaries

The seed work stays inside `identity`. `seed_e2e` is identity's own management command and
already imports identity models. The link goes there, not in `seed_e2e_matching`
(scheduling), because both accounts belong to `seed_e2e`. `seed_e2e_matching`'s
`_reset_student_state` deletes only scheduling rows, so the link survives it. No new seed
command, so `config/e2e_seeds.txt` does not change.

`seed_e2e` changes:

- Two new constants: `GUARDIAN_EMAIL = "e2e.guardian@kaleem.test"` and
  `PASSWORD_CHANGE_EMAIL = "e2e.password@kaleem.test"`. Both are verified and have a
  `ParentProfile`. A parent profile does not interact with matching or booking. The password
  account has no children.
- After the accounts exist, the guardian is linked to `BOOKED_STUDENT_EMAIL`'s
  `StudentProfile`. Its other links are deleted, so every run ends in the same state (the
  file's documented contract).
- `e2e.parent` stays unlinked. `family.spec.ts` and the "non-parent empty state" depend on
  its own children list, which is why the parent link uses a dedicated parent account.
- The success line says 7 accounts.

**Personal data (ADR-0023):** none. These are fixture accounts at `@kaleem.test`, created
only by a DEBUG-guarded command (`seed_e2e` refuses to run with `DEBUG=False`). The "child" is
the existing fixture student, not a real minor. No retention question arises.

**Expand/contract:** not applicable. No schema, API or cookie change. The seed never runs on
staging or production.

**e2e time budget:** Flow A takes about 10 s (two sign-ins, two page loads). Flow B takes
about 12 s (three sign-in attempts, one reload).

## Out of scope

- A parent opening `/sessions/<id>/room` directly. The refusal is already tested at service
  and API level (`test_rooms_service.py::test_a_parent_may_not_join_their_childs_lesson`,
  `test_rooms_api.py::test_the_session_list_marks_a_parent_as_not_joinable`). A browser flow
  for it is a separate gap and is not in this unit's entry.
- Whether a parent should see a Cancel control on a child's session. That is today's
  behaviour (`may_cancel`) and a product question. These flows do not assert it either way.
- Inbox-dependent flows: password reset, registration and child activation. The
  security-alert email that change-password sends is not read here. `ntf-mail-e2e-harness`
  owns the inbox.
- Arabic/RTL: no new copy and no new route.

## Test plan

**Backend (`kaleem/identity/tests/test_seed_e2e.py`, written first):**

1. The guardian is linked to the booked student's profile, and only to it.
2. Reseeding when the guardian has a stray link (for example to `e2e.student`) and the booked
   link already exists leaves exactly one link, to the booked student.
3. `e2e.parent` is not linked to the booked student (the family flows' state is unchanged).
4. The two new accounts exist, are verified, hold a `ParentProfile`, and authenticate with
   `E2E_PASSWORD`. These are extended from the existing account-set tests.
5. After the password account's password has been changed, a reseed restores `E2E_PASSWORD`.
   Flow B's local re-runs rely on this.

**e2e:** flows A and B above.

**Mutation checks** (each must turn its test red, then be reverted):

- M1 (`JoinButton.tsx`): ignore `may_join` (`const active = session.status ===
  "scheduled"`). Flow A step 3 goes red.
- M2 (backend `_session_payload`): `"may_join": True`. Flow A step 3 goes red.
- M3 (seed): drop the guardian link. Flow A step 2 goes red, which shows the flow cannot pass
  with no rows to check.
- M4 (backend `ChangePasswordView`): remove `update_session_auth_hash`. Flow B step 3 goes
  red.
- M5 (backend `change_password` service): skip `user.save`. Flow B step 6 goes red.
- M6 (seed): remove the link-pruning line. Backend test 2 goes red.

## Open questions

None. No decision id gates this unit. The flows rely on `cur-session-wording`'s
wording-neutral selectors (`/join/i`), and that unit has merged.
