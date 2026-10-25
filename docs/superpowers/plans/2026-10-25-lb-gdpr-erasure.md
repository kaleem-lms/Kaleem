---
spec: docs/superpowers/specs/2026-10-25-lb-gdpr-erasure-design.md
status: draft
---

Worktrees: `backend-lb-gdpr-erasure` and `dashboard-lb-gdpr-erasure` on
`feat/lb-gdpr-erasure` (runbook section 1). The unit has one migration, in identity
(`0010_user_erased_at`), and the conductor allocates the app. It needs no dependency
change and no env var. Never edit a coverage floor. Merge `origin/main` (never rebase)
right before hand-back.

## Steps

### Backend (`kaleem-worktrees/backend-lb-gdpr-erasure`)

1. [ ] **`erased_at` field.** Test first in `kaleem/identity/tests/test_models.py`: a new
   user has `erased_at is None`. Then add the field to `kaleem/identity/models.py` and
   generate `0010_user_erased_at` (AddField, nullable, no default). The full gate's
   `makemigrations --check` must be clean.
2. [ ] **curriculum.subjects erase.** In `kaleem/curriculum/tests/test_personal_data.py`,
   switch the subjects test from `assert_export_honours_contract` to
   `assert_hooks_honour_contract`, with an `assert_erased` that checks no `TeacherSubject`
   or `StudentSubjectInterest` row remains for the user. Red first: the helper fails on
   `registered`. Then add `erase_subjects` and its `register_erase` in
   `kaleem/curriculum/personal_data.py`, and drop the "erase hook belongs to
   lb-gdpr-erasure" line from the docstring.
3. [ ] **billing.subscriptions erase and refusal.** Tests first in
   `kaleem/billing/tests/test_personal_data.py`:
   - The pair helper runs with a seed of a customer, one `canceled` subscription and one
     incident with a non-empty `detail`. `assert_erased` checks that `detail == {}` and
     that the subscription and customer rows still exist.
   - The test is parametrized over the four `LIVE_STATUSES`. `erase_user` raises an error
     whose `code == "subscription_active"`. A curriculum interest seeded for the same
     user survives, which proves the rollback.
   - The hook is registered with `order=100`.

   Then add `SubscriptionStillActive(ConflictError)` (setting `self.code`) and
   `erase_billing` in `kaleem/billing/personal_data.py`. The message goes through
   gettext, with an `ar` entry in `kaleem/billing/locale/ar/LC_MESSAGES/django.po`.
4. [ ] **scheduling.lessons erase.** Tests first in
   `kaleem/scheduling/tests/test_personal_data.py`, reusing the module's conftest
   factories. A seed puts the user on both sides of an assignment and creates:
   availability, an open request, a decline, a diagnostic, a slot, one past session, one
   in-progress session, and one future session with an active room. Then assert:
   - The pair helper passes. `assert_erased` checks the user's availability, declines and
     diagnostics are gone and the open request is `cancelled`.
   - The assignments and slots are `ended` with `ended_at` set.
   - The future session is `cancelled`, with `cancelled_by` = the user and
     `consumes_quota` false. The past and in-progress sessions are unchanged.
   - The room is still `active` until commit and `ended` after. Use
     `django_capture_on_commit_callbacks(execute=True)`, and a fake provider records the
     `end_room` call.
   - After a teacher is erased, `sync_match_requests()` opens one request for the still
     entitled student.

   Then add `erase_lessons` in `kaleem/scheduling/personal_data.py` and register it. The
   hook calls `rooms.end_rooms_for_session` from `transaction.on_commit` only.
5. [ ] **identity.account erase.** Tests first in `kaleem/identity/tests/test_personal_data.py`.
   The seed builds all three profiles with notes, a child link, a parent link, an invite,
   two addresses, a `LogEntry` whose `object_repr` holds one address, and a staff note.
   Then assert:
   - The pair helper passes, and `assert_erased` checks every row in the spec's identity
     row.
   - Two erased users get distinct placeholder addresses.
   - A second erase keeps the first `erased_at`.
   - `services.register_user` with the old address succeeds afterwards.
   - The hook is registered with `order=900`.

   Then add `erase_account` in `kaleem/identity/personal_data.py`. It reads allauth's
   `mfa`/`socialaccount` models through `apps.get_model` so that a missing app is a
   no-op.
6. [ ] **Coverage guard.** In `tests/test_personal_data_hooks_cover_every_model.py`, set
   `PENDING_ERASE = {}`. `test_a_pending_app_with_no_models_is_stale` must still pass
   (it spreads the live map). Red first: empty the map before steps 2-5 and see each
   uncovered model named.
7. [ ] **Service.** Tests first in a new `kaleem/identity/tests/test_account_delete.py`:
   - `delete_account` erases, and the user is inactive with `erased_at` set.
   - A wrong password raises `ValidationError(field="current_password")`, changes nothing
     and enqueues no email.
   - A staff or superuser account raises `PermissionDeniedError`.
   - The `account_deleted` alert goes to the former primary address exactly once, and
     only when the transaction commits (`django_capture_on_commit_callbacks`).
   - A subscription refusal from billing propagates unchanged.

   Then write `delete_account` and add the `account_deleted` branch in
   `kaleem/identity/services.py`. The unknown-action test still raises.
8. [ ] **Endpoint.** Tests first in the same file, through the API client:
   - 204, and then a `GET identity/me/` with the same client is 401/403.
   - A second client logged in beforehand is refused on its next request.
   - `POST identity/login/` with the old credentials is 400 "Invalid credentials.".
   - A wrong password gives the 400 shape. Staff get 403. A live subscription gives 409
     with `error_code == "subscription_active"`. Anonymous is 401/403.
   - Past a monkeypatched tiny `account-delete` rate the response is 429 (the
     `test_diagnostics_api.py` pattern).
   - The log line carries the user id only.

   Then add `DeleteAccountSerializer` (or reuse `DataExportSerializer`'s shape),
   `DeleteAccountView` (`ScopedRateThrottle`, `throttle_scope = "account-delete"`,
   `extend_schema`, `logout(request)` after the service), the `me/delete/` URL, and
   `"account-delete": "5/hour"` in `config/settings/base.py`. The staff-refusal string
   gets an Arabic entry in `kaleem/identity/locale`.
9. [ ] **e2e seed.** Test first in `kaleem/identity/tests/test_seed_e2e.py`. `seed_e2e`
   creates `e2e.erase@kaleem.test`: a verified student with the shared password and
   nothing else. Running `seed_e2e` again after that account is erased creates a fresh
   active account under the same address. Then add the constant and the account to
   `kaleem/identity/management/commands/seed_e2e.py`, with a comment saying it belongs to
   `account-delete.spec.ts` alone.

### Dashboard (`kaleem-worktrees/dashboard-lb-gdpr-erasure`)

10. [ ] **Catalogue.** Tests first: `src/lib/i18n-namespaces.test.ts` has the `account`
    namespace registered and never imported statically, and `src/locales/parity.test.ts`
    picks up the new pair. Then add `src/locales/en/account.json`,
    `src/locales/ar/account.json` and one line in `FEATURE_CATALOGUES`, and update
    `src/routes/_authed/account.test.tsx` and `account.tsx` with
    `loader: () => loadNamespace("account")`.
11. [ ] **API, schema, mutation.** Tests first in `src/features/identity/api.test.ts`,
    `schemas.test.ts` and `queries.test.tsx`: `identityApi.deleteAccount` posts to
    `identity/me/delete/`; the schema requires `current_password`; `useDeleteAccount`
    clears the query cache on success. Then update `api.ts`, `schemas.ts` and
    `queries.ts`.
12. [ ] **DeleteAccountCard.** Test first
    `src/features/identity/components/DeleteAccountCard.test.tsx`:
    - The dialog opens with the role line for a teacher and for a parent.
    - On 204 it navigates to `/login` and shows the toast.
    - On 400 it shows "Incorrect password." on the field.
    - On 409 `subscription_active` it shows the alert with a `/billing` link.
    - On 429 it shows `account.throttled` (from `common`). Other errors show the generic
      error.
    - The button is disabled while submitting, and axe is clean.

    Then build the component with the `@/ui` dialog, field, alert and destructive button,
    tokens only, using logical properties.
13. [ ] **Account page.** Test first in `src/routes/_authed/account.test.tsx`: the card
    renders for a student, a teacher and a parent, and not when `me.is_staff`. Then put it
    last in the grid in `src/routes/_authed/-pages/Account.tsx`.
14. [ ] **e2e.** Write `e2e/account-delete.spec.ts` and add `ACCOUNTS.erase` in
    `e2e/accounts/identity.ts`. One serial test, `retries: 0`, budget 15 s. Sign in,
    then:
    1. Open the dialog and enter a wrong password. The field error shows, and a reload
       still shows `/account`.
    2. Enter the right password. The URL is `/login` and the toast is visible.
    3. Sign in again with the same credentials. "Invalid credentials." shows and the URL
       stays `/login`.

    Scope the password field to the dialog, because `/account` carries other "Current
    password" fields.

### Close-out (handed to the conductor)

15. [ ] Docs and close-out items:
    - `docs/architecture/platform.md`: the registry now has its caller, a hook may refuse
      by raising, `PENDING_ERASE` is empty, and the "Not covered" list is trimmed to logs
      and backups.
    - `docs/architecture/identity.md`: the endpoint and `erased_at`.
    - `docs/architecture/billing.md`: the refusal and what is kept.
    - `docs/architecture/scheduling.md`: what an erasure ends.
    - The CLAUDE.md D3 row `identity — account deletion: 1 flow`, saying what is not
      covered (alert delivery, the 409 path, teacher and parent consequences).
    - The spec status and a journal line.

## Gates

- TDD loop: `_tools/backend-gate.sh <wt> <test file>` and
  `_tools/dashboard-gate.sh <wt> <test file>`.
- Before hand-back, run both full gates:
  - Backend: migrate, `makemigrations --check`, pytest with `--cov=kaleem --cov=signaling`,
    ruff, ruff format, lint-imports. CI also runs mypy, so type the new hooks.
  - Dashboard: tsc, lint, `test:coverage --maxWorkers=6`, build, the built-colour check.

  Then run the runbook section 3 checks and `gitleaks-range.sh` on each worktree.
- Mutation checks, each red and then green:
  - (a) Drop `is_active=False` from the identity hook: the login-refused test fails.
  - (b) Drop the unusable password: the second-session test fails.
  - (c) Call `end_rooms_for_session` directly instead of on commit: the before-commit
    room assertion fails.
  - (d) Leave `consumes_quota` true: the scheduling test fails.
  - (e) Remove billing's refusal: the rollback test fails.
  - (f) Send the alert outside `on_commit`: the commit-only test fails.
  - (g) Remove `throttle_scope`: the 429 test fails.
  - (h) In the e2e test, skip the password field: it fails.
- e2e: optional locally in a port slot; CI is the authority. Read the CI log for the new
  test name.

## Risks

- **New models with a pending erase entry.** Units that land first (messaging, ntf-core,
  cur-*, pay-*) may add models or `PENDING_ERASE` entries that name this unit. The
  freshness merge re-runs the guard, which names each one. Cover it in this unit's hooks
  when it is identity, billing, scheduling or curriculum. Otherwise the owning module's
  entry stays with its own unit id: never re-add one of the four.
- **Quota or matching rules changed by in-flight scheduling units** (sched-reschedule,
  sched-teacher-no-show, lb-parent-acts-for-child). The hook sets the session fields
  directly rather than going through `booking._apply_cancellation`, because erasure is not
  a 24-hour-rule cancellation. At freshness, re-read `Session` for new fields an erasure
  must clear.
- **The placeholder address and email senders.** A later sender that mails an inactive
  user hits an `.invalid` address that is never delivered. Add a one-line ISSUES entry
  asking notification units to skip `is_active=False` recipients.
- **Shared files.** `kaleem/identity/services.py` (shared_files), `config/settings/base.py`
  (one throttle line), `seed_e2e.py` and `e2e/accounts/identity.ts`. When one of these
  conflicts at freshness, keep both sides.
- **e2e rerun locally.** The erased account is gone until `seed_e2e` runs again, which
  recreates it (step 9). CI always starts from a fresh seed.
- **Owner changes a rule at approval.** Rule 1 (cancel instead of refuse) would add a
  provider call and a money decision, so it would come back as a spec change. Rule 2
  (notify the parent) adds one alert branch and a test. Rules 3-5 change only copy.

## Verification

Each step's tests go red and then green. Both full gates pass, along with the eight
mutation checks. CI is green, including the new e2e flow. A staging click-through per
dec-d9-substitute deletes a throwaway account on `/account` (both themes, Arabic RTL,
320px) and confirms that sign-in is refused. The Arabic strings go to hg-arabic-review
before spec closure.
