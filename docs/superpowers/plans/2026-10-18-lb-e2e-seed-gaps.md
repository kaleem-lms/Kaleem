---
spec: docs/superpowers/specs/2026-10-18-lb-e2e-seed-gaps-design.md
status: draft
---

Worktrees: `backend-lb-e2e-seed-gaps` and `dashboard-lb-e2e-seed-gaps`, both on
`feat/lb-e2e-seed-gaps` from `origin/main` (runbook section 1). Close-out docs go in
`meta-lb-e2e-seed-gaps`.

Files touched:

- backend: `kaleem/identity/management/commands/seed_e2e.py`,
  `kaleem/identity/tests/test_seed_e2e.py`
- dashboard: `e2e/accounts/identity.ts` (new), `e2e/fixtures.ts`,
  `e2e/parent-schedule.spec.ts` (new), `e2e/change-password.spec.ts` (new)

This unit needs no migration, no new dependency, no env var and no `config/e2e_seeds.txt`
change.

## Steps

1. [ ] **Backend tests first (red).** In `test_seed_e2e.py`:
   - Add `test_the_guardian_is_linked_to_the_booked_student_only`.
   - Add `test_reseeding_drops_a_stray_guardian_link`: create a guardian link to
     `e2e.student`'s profile, reseed, and assert exactly one link remains, to the booked
     student.
   - Add `test_the_seeded_parent_is_not_linked_to_the_booked_student`.
   - Add `test_reseeding_restores_the_password_change_account`: call
     `set_password("rotated-…")`, reseed, and assert `check_password(E2E_PASSWORD)`.
   - Extend the account-set tests: add `GUARDIAN_EMAIL` and `PASSWORD_CHANGE_EMAIL` to the
     profile and verified/authenticate assertions, and rename "five"/"four" to match.

   Run `backend-gate.sh <wt> kaleem/identity/tests/test_seed_e2e.py`. The new tests fail
   with ImportError or assertion errors.
2. [ ] **Seed (green).** In `seed_e2e.py`:
   - Add the two constants and two `_account(...)` calls with `ParentProfile` and
     `verified=True`.
   - Add a `_link_guardian()` step inside the same transaction:
     `ParentStudent.objects.get_or_create(parent=…, student=booked_profile)`, then delete the
     guardian's links whose student is anyone else.
   - Change the success line to 7 accounts and update the module docstring.

   The focused run must be green. Then do mutation check M6 (remove the prune line and see
   test 2 fail, then restore it).
3. [ ] **Backend full gate.** Run `backend-gate.sh <wt>`. `ruff`, `lint-imports` and
   `makemigrations --check` must be clean. Commit
   `test(identity): seed a guardian link and a change-password account for e2e`.
4. [ ] **Fixture module.** Create `e2e/accounts/identity.ts` exporting `IDENTITY_ACCOUNTS`
   (`guardian`: "E2E Guardian"; `passwordChange`: "E2E Password Change"; emails match the
   backend constants). In `fixtures.ts`, spread it into `ACCOUNTS` with one import and one
   spread line, and add a comment naming `seed_e2e` as the contract.
5. [ ] **Flow A** (`e2e/parent-schedule.spec.ts`, one test). Define
   `const joinControl = (p) => p.getByRole("button", { name: /join/i })`.
   - Sign in as `booked`, open `/schedule`, and expect `joinControl(page).first()` visible.
   - Clear the cookies, or use a fresh context, and sign in as `guardian`. Open `/schedule`
     and expect
     `page.getByRole("listitem").filter({ hasText: ACCOUNTS.booked.name }).first()` visible.
   - Then expect `joinControl(page)` to have count 0.

   Header comment: the `may_join` contract, and why the row assertion must come first.
6. [ ] **Flow B** (`e2e/change-password.spec.ts`, one test, `describe.configure({ retries: 0
   })` with a comment saying why). Follow the spec steps 1 to 6:
   - Scope the form with `page.locator("form").filter({ hasText: "New password" })`, because
     `/account` has two "Current password" fields.
   - The new password is a constant local to the file, at least 8 characters, and must pass
     Django's validators.
   - Sign out the way `identity.spec.ts` does (the account menu, then "Sign out").
7. [ ] **Dashboard gates.** Run `dashboard-gate.sh <wt>` in full: tsc, lint (which covers
   `e2e/`), tests and build. If an e2e port slot is free, run both new specs locally against
   the backend worktree (runbook section 2, e2e slot). Then run the e2e mutation checks
   M1–M5. M2, M4 and M5 change the backend worktree temporarily and are reverted before
   commit. Commit `test(e2e): a parent sees no Join; change-password on its own account`.
8. [ ] **Hand-back.** Use runbook section 3's five checks in both worktrees, gitleaks over
   the range, and the hand-back block listing M1–M6.
9. [ ] **Close-out docs** (meta worktree, after CI is green). Strike both `ISSUES.md`
   entries (the C3a "parent sees no Join" line and "change-password" in the "still
   uncovered" line). In the D3 table, `scheduling` booking/video-room gains the parent flow,
   and the `change-password ❌` row becomes ✅ 1 flow (the conductor owns `CLAUDE.md` edits
   at close-out). Close the spec and plan.

## Risks

- **Ordering against `booking.spec.ts`.** That spec cancels the booked student's latest
  session and joins the earliest. Flow A reads every upcoming row and needs only one
  scheduled row, so a cancellation does not affect it. If a future unit completes the
  earliest session, flow A's own positive control goes red rather than passing on nothing.
- **The joinable session leaving the window** during a long suite does not matter. A future
  row still renders a `/join/i` "Opens …" button for the student (`joinFor` aria-label).
- **The password-changed alert email.** `change_password` sends a security alert after
  `save`. This flow is the first e2e run that reaches that alert. If sending it fails in
  the e2e environment, step 2 of flow B goes red. That is a real finding about the
  environment, not a reason to stub the email. Diagnose it, and escalate if the fix is out of
  scope.
- **The login failure throttle.** Flow B makes one failed sign-in on its own address. It is
  keyed per address, far below the limit.
- **Local re-runs of flow B** need `seed_e2e` re-run first. The test is green there, and
  this is stated in the file header.
- **The `fixtures.ts` merge** with `ntf-mail-e2e-harness` (also a shared file). Two added
  lines at most. Take both.

## Verification

- Backend: the focused test, then the full gate (coverage at or above the floor; floors are
  untouched, per `dec-floor-ownership`).
- Dashboard: the full gate.
- e2e: CI is the authority. Read the e2e log for both new test names, and expect no
  pass-on-retry. Flow B cannot retry.
- Mutation checks M1–M6 each red with the change in place and green once it is reverted,
  recorded in the hand-back.
- D9: nothing user-facing changes, and the seed is DEBUG-only and never runs on staging. The
  click-through is the CI e2e run itself, plus a check that the staging deploy stays green.
