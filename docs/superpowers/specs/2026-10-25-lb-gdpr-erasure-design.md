---
name: lb-gdpr-erasure
phase: v1 (wave 3, legal stream)
modules: [identity, billing, scheduling, curriculum, platform]
status: approved
created: 2026-10-25
closed: null
---

## Goal

ADR-0023 promised a data-subject-request flow before launch. lb-gdpr-data-export shipped
the access half. This unit ships the erasure half: a signed-in person deletes their own
account from `/account` after re-entering their password. The deletion **anonymizes in
place** (lb-dec-erasure-semantics) by running `personal_data.erase_user(user)` (ADR-0048).
That function finally gets a caller, and the four modules still on `PENDING_ERASE`
(identity, billing, scheduling, curriculum) join with erase hooks, which leaves the list
empty. Assessment, messaging and `curriculum.courses` already have erase hooks; they do
not change.

Decisions this follows: lb-dec-erasure-semantics (anonymize in place), lb-dec-retention
(accounts and billing 12 months after closure, diagnostics 90 days, logs 30 days),
lb-dec-legal-entity, dec-spec-approval, dec-d9-substitute, dec-floor-ownership. No open
decision blocks it. The owner confirms five product rules at approval (see Open questions).

## User flow

1. On `/account`, every signed-in user who is not staff sees a **Delete account** card,
   placed last in the grid. It has one sentence and a **Delete my account** button.
2. The button opens a dialog that says what happens: the account is removed and cannot be
   recovered; the email address is freed; a role-specific line follows. A teacher reads
   "your students' upcoming lessons are cancelled and they are matched again". A parent
   reads "your children keep their own accounts, unlinked from yours, and lose access a
   family plan gave them". Then the current-password field and a destructive **Delete my
   account** button.
3. Correct password: the account is erased, the session ends, and the browser lands on
   `/login` with a toast "Your account was deleted." The former primary address gets one
   email saying the account was deleted, with "if this wasn't you, contact support".
4. Signing in again with the old email and password fails with the ordinary "Invalid
   credentials." The same address can register a new, empty account.
5. Wrong password: the dialog stays open with "Incorrect password." on the field. Nothing
   changes and no email is sent.
6. A subscription is still live (`active`, `past_due`, `unpaid` or `incomplete`): 409
   `subscription_active`. The dialog says to cancel the plan first and links to
   `/billing`. Nothing changes.
7. Too many attempts: the existing throttled message (`account.throttled`). Any other
   error: the generic error, and nothing changes.

Staff accounts (`is_staff` or `is_superuser`) get 403 and never see the card. An admin
removes them.

A linked child who can sign in deletes their own account the same way (rule 2 below). A
parent deleting a child's account is not in this unit.

## What erasure does, per hook

Each hook runs inside `erase_user`'s single transaction. If any hook raises, every
database change rolls back. Outside work is deferred with `transaction.on_commit`.

| Hook (order) | Deleted | Anonymized or ended in place | Kept unchanged |
| --- | --- | --- | --- |
| `billing.subscriptions` (100) | nothing | `BillingIncident.detail` set to `{}` | `Subscription` and `BillingCustomer` rows, kept under lb-dec-retention (billing, 12 months after closure). lb-gdpr-retention-jobs purges them, and the provider's customer record, on that clock. |
| `curriculum.subjects` (500) | `TeacherSubject`, `StudentSubjectInterest` | n/a | n/a |
| `scheduling.lessons` (500) | `WeeklyAvailability`, `MatchDecline` (the user's), `CallDiagnostic` (the user's) | the user's open `MatchRequest`s become `cancelled`. Every active `TeacherAssignment` the user is in (either side) and its active `RecurringSlot`s end now. Their future `scheduled` sessions become `cancelled` with `cancelled_by` = the user and `consumes_quota=False`; active rooms of those sessions are ended on commit through `rooms.end_rooms_for_session`. | past and in-progress sessions, rooms and ended assignments: they are also the other person's record and the anchor of assessment's reports |
| `identity.account` (900, last) | allauth `EmailAddress` rows (and `mfa` / `socialaccount` rows, none written today), `ParentStudent` links on both sides, the user's `ParentInvite`s | `User`: `email` becomes `erased-<id>@erased.invalid` (RFC 2606, never deliverable, and unique). `full_name` "", `birthdate` null, `timezone` "UTC", `language` "", `last_login` null, unusable password, `is_active=False`, groups and permissions cleared, `erased_at` set once. Profiles: student `notes` "" and gender preference reset; teacher `gender` "", `is_in_pool=False`, `internal_notes` "". Admin `LogEntry.object_repr` values that name one of the user's addresses as a whole address (not as part of a longer one) become `erased user <id>`. | the `User` row and its profile rows, as empty anchors for the records others keep |

Already in place and unchanged: `assessment.records` deletes reports about the person and
their ratings, and removes them as author of reports they wrote. `messaging.chats` blanks
their messages and keeps the thread. `curriculum.courses` deletes the courses they own.

**Refusal.** A hook may refuse an erasure by raising a `KaleemError`. The transaction
rolls back and the error reaches the client through the existing handler. Billing's hook
runs first (order 100) and raises `SubscriptionStillActive`, a `ConflictError` with
`code = "subscription_active"` (409), when any of the user's subscriptions is in
`LIVE_STATUSES`. A live subscription can still charge upstream. Refusing keeps erasure
out of money decisions entirely: there is no cancellation, no proration and no refund
here. `docs/architecture/platform.md` records refusal as part of the contract.

**Sign-in and sessions.** The unusable password changes the session auth hash, so every
other session of the user stops authenticating on its next request. `is_active=False`
makes both authentication backends refuse the user, and the endpoint logs the current
session out. Session rows expire on their normal schedule and hold no more than a user id.

**Consequences for other people.** When a teacher is erased, their students' assignments
end. `sync_match_requests` then opens a fresh request for each student who is still
entitled, so matching resumes with no new code, and their chats become read-only under
messaging's existing policy. When a parent is erased, the links go, so a child loses
family-plan entitlement and, if under 18, chat posting (`dec-safeguarding-under-18`). No
notification is sent to anyone but the erased person (rule 2).

## Data model delta

One field: `identity.User.erased_at = DateTimeField(null=True, blank=True)`. Migration
`identity/0010_user_erased_at` adds it as nullable with no default. That is expand-only:
the previous release's inserts omit the column and stay legal during a blue-green deploy.
The field marks an erased account for staff, makes the hook's idempotence explicit, and
is the "closure" clock that lb-gdpr-retention-jobs reads for the 12-month purge.

Billing, scheduling and curriculum get no schema change.

ADR-0023's four points:

- **What:** nothing new is collected. The unit removes data. It writes one timestamp
  (`erased_at`) and one log line (`identity.account_deleted user_id=<id>`).
- **Why:** the right to erasure (GDPR Art. 17). Records kept after erasure are those the
  other party also holds, and billing records under lb-dec-retention.
- **How long:** the anonymized rows follow each domain's retention (accounts and billing
  12 months after `erased_at`, diagnostics 90 days, logs 30 days), enforced by
  lb-gdpr-retention-jobs. Backups expire on the backup unit's schedule.
- **Who sees it:** staff see an erased account in Django admin as an inactive user with no
  name, a placeholder address and `erased_at`. Other people see the anonymized user id
  where they saw the person before.

## API delta

`POST /api/v1/identity/me/delete/` (session auth, CSRF), route name `account-delete`.

- Body: `{"current_password": "..."}`.
- 204: the account is erased, the session is logged out, and the alert is enqueued on
  commit.
- 400: `{"current_password": ["Incorrect password."], "error_code": "validation_error"}`,
  the same as the export and add-email re-authentication.
- 401/403: not signed in. 403 `permission_denied`: a staff account.
- 409: `{"detail": "...", "error_code": "subscription_active"}`.
- 429: `ScopedRateThrottle`, scope `account-delete`, `5/hour`. Wrong-password attempts
  count.

Python:

- `identity.services.delete_account(user_id, current_password) -> None`. It refuses staff,
  checks the password, captures the primary address, calls `personal_data.erase_user`,
  then registers `on_commit` for the `account_deleted` alert. The alert is English, like
  the other alerts; translation is rch-i18n-server-strings.
- `_send_email_security_alert` gets an `account_deleted` branch. The unknown-action guard
  stays.
- The new server strings (the staff refusal and the `subscription_active` message) go
  through gettext with Arabic catalog entries.

## Frontend

- Route: `/account` (all non-staff roles). A new `DeleteAccountCard` goes last in the
  grid.
- States: idle, dialog open, submitting (button disabled, labelled busy), success (cache
  cleared, navigate to `/login`, toast), wrong password (field error), `subscription_active`
  (an inline alert with a link to `/billing`), throttled, and other errors.
- API: `identityApi.deleteAccount({ current_password })` through `src/lib/api.ts`. A
  `useDeleteAccount` mutation calls `qc.clear()` on success, the way `useLogout` does.
- Strings: a new lazily loaded feature catalogue, `account` (`src/locales/{en,ar}/account.json`),
  registered in `FEATURE_CATALOGUES`. The `/account` route loader awaits
  `loadNamespace("account")`. `common.json` grows by nothing, because the entry-chunk
  budget is nearly spent. The Arabic copy goes to hg-arabic-review, which holds spec
  closure, not the merge.
- Styles come from tokens only, with the existing `@/ui` dialog, field and destructive
  button. Layout is RTL-safe, targets are at least 44px, and the dialog keeps focus and
  restores it on close.

## Module boundaries

- identity owns the endpoint and the service and calls `kaleem.platform.personal_data`.
  identity never imports billing or scheduling: billing refuses from inside its own hook.
- Each hook touches only its own module's models. Scheduling's hook reuses its own
  `rooms.end_rooms_for_session`. Identity's hook also owns allauth's and admin's rows, as
  ADR-0048 assigns.
- No import-linter contract changes and no events.

## Out of scope

- A parent deleting a child's account, and staff erasing an account on request.
- Notifying a linked parent, or a teacher's students, beyond what their own screens show
  (rule 2).
- Timed purges, deleting the payment provider's customer, and session-row cleanup:
  lb-gdpr-retention-jobs.
- A cooling-off or undo period (rule 5).
- Translated alert email.

## Test plan

Backend:

- Each of the four hooks passes `assert_hooks_honour_contract` with an `assert_erased`
  that checks the table above. That includes erase-idempotent, and erase-isolated: a
  second user's export is unchanged.
- The coverage guard passes with `PENDING_ERASE` empty.
- Billing: a live subscription in each of the four live statuses raises
  `subscription_active`, and `erase_user` leaves every module's data untouched (the
  rollback). A canceled subscription does not block, and the rows survive.
- Scheduling: a future lesson is cancelled with no quota consumed, a past or in-progress
  one is untouched, the room ends only after commit, and a teacher's erasure lets
  `sync_match_requests` reopen the student's request.
- Identity: the placeholder address is unique per user; the same address can register
  again; a `LogEntry` naming the address is scrubbed; both sides of a family link are
  removed; a second erase keeps the first `erased_at`.
- Service and endpoint: 204, and the session cookie no longer authenticates; another
  session of the same user is refused on its next request; login with the old
  credentials gives 400 "Invalid credentials."; 400 on a wrong password with no change and
  no email; 403 for staff; 409 with `error_code`; 429 past the rate; the alert is enqueued
  once and only on commit.

Dashboard: `DeleteAccountCard` shows each state above; the success path clears the cache
and navigates; locale parity; axe clean; `/account` loads the `account` catalogue.

e2e (`e2e/account-delete.spec.ts`, budget 15 s, one serial test, retries off). It runs on
`e2e.erase@kaleem.test`, a seeded student owned by this file alone. A wrong password shows
the field error and the account stays. The right password lands on `/login`. Signing in
again with the same credentials shows "Invalid credentials." and stays on `/login`. Not
covered: the alert email's delivery (no inbox in CI), the 409 path (unit-tested, because
an e2e bug there would erase a shared account), and the teacher and parent consequences
(unit-tested).

Staging (dec-d9-substitute): an agent click-through on `/account` with a throwaway account,
in both themes, Arabic RTL and 320px.

## Open questions

None blocking. The owner confirms these product rules at approval:

1. **A live subscription blocks deletion.** The person cancels and can delete once the
   plan has ended upstream. The alternative, cancelling on erasure, is a money decision
   this unit avoids.
2. **A linked child may delete their own account,** and no one else is notified. Their
   parent sees the child gone from the family list. The alternatives are a notice email to
   the parent, or refusing until a parent-led path exists.
3. **A teacher may delete with active students.** Upcoming lessons are cancelled with the
   unit returned, and students are matched again automatically.
4. **Billing records and the provider's customer stay for 12 months** after closure
   (lb-dec-retention) and are then purged by lb-gdpr-retention-jobs. Kaleem's own rows
   hold no name or email in the meantime.
5. **Deletion is immediate.** There is no cooling-off period and no undo.
