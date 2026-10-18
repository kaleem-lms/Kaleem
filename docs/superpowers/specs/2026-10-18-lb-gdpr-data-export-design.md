---
name: lb-gdpr-data-export
phase: v1 (wave 2, legal stream)
modules: [identity, billing, scheduling, curriculum, platform]
status: approved
created: 2026-10-18
closed: null
---

## Goal

ADR-0023 promised a data-subject-request flow before public launch. This unit is its
first half: a signed-in person downloads a copy of their own data as one JSON file, from
`/account`, after re-entering their password. It is built on the personal-data registry
(plat-dsar-registry, ADR-0048): identity, billing, scheduling and curriculum join it with
**export** hooks, and the file is whatever `export_user(user)` returns from every module
that has joined, assessment's existing hook included. Erase hooks for the four modules
belong to lb-gdpr-erasure; their `PENDING_ERASE` entries stay.

Decisions this follows: lb-dec-erasure-semantics (the erase half is not here),
lb-dec-retention (nothing new is stored, so no new retention), dec-spec-approval,
dec-d9-substitute. No open decision blocks it.

## User flow

1. On `/account`, every signed-in user (any role) sees a **Your data** card: one sentence
   on what the file holds and a **Download my data** button.
2. The button opens a dialog asking for the current password.
3. Correct password: the browser saves `kaleem-data-export-<YYYY-MM-DD>.json`, the dialog
   closes, a success toast shows, and the account's primary address gets a security-alert
   email ("a copy of your data was downloaded; if this wasn't you, reset your password").
4. Wrong password: the dialog stays open with "Incorrect password." on the field; nothing
   is downloaded and no email is sent.
5. Too many attempts: the existing throttled message (`account.throttled`).
6. Network or server error: the dialog shows the generic error; nothing is saved.

A child account that can sign in exports its own data the same way. A parent exporting
on behalf of a child who cannot sign in is lb-parent-acts-for-child, not this unit.

## What the file contains

```json
{
  "format": "kaleem.data-export",
  "version": 1,
  "generated_at": "2026-10-18T09:00:00Z",
  "user_id": 42,
  "sections": {
    "assessment.records": { "...": "existing hook, unchanged" },
    "billing.subscriptions": { "...": "..." },
    "curriculum.subjects": { "...": "..." },
    "identity.account": { "...": "..." },
    "scheduling.lessons": { "...": "..." }
  }
}
```

`sections` is `export_user(user)` verbatim, keyed by hook name. A module that joins the
registry later appears with no change here; `version` changes only if the envelope does.

Three rules every new hook follows:

- **Other people appear by role and user id only**, never by name, email or their own
  fields. Students are often children, and a teacher's file must not carry their names
  out of kaleem (GDPR Art. 15(4) and 20(4)). Assessment's hook already follows this.
- **No secrets or provider handles**: no password hash, no invite code, no Stripe id, no
  video-room id.
- **Staff-only fields are withheld**: `StudentProfile.notes`, `TeacherProfile.internal_notes`
  (written only in Django admin), and `BillingIncident.detail`, `severity`,
  `occurrences`, `resolved_by`. A person who wants those makes a written request, which
  staff handle by hand. **Confirmed by the owner at approval (2026-10-18).**

Per hook (lists ordered by id; dates and times as ISO strings):

| Hook | Models declared | Exported |
| --- | --- | --- |
| `identity.account` | `User`, `StudentProfile`, `TeacherProfile`, `ParentProfile`, `ParentStudent`, `ParentInvite` | email, full name, birthdate, timezone, date joined, last login; allauth email addresses (address, primary, verified); which profiles exist with the student's teacher-gender preference and the teacher's gender and pool flag; children and parents as `{user_id, linked_at}`; invites as `{expires_at, used}` |
| `billing.subscriptions` | `BillingCustomer`, `Subscription`, `BillingIncident` | customer-since date; each subscription's plan type, sessions per cycle, amount (minor units) and currency, status, period end, cancel-at-period-end, created and updated; incidents as `{kind, first_seen_at, resolved_at}` |
| `scheduling.lessons` | all eight scheduling models | weekly availability; match requests (subject slug, status, dates); assignments with `role` and `counterpart_user_id`; declines the teacher made (request id, date); weekly slots; lessons with role, start, duration, status, outcome, cancelled-at, `cancelled_by_me`, and each room's open and close times; the user's own call diagnostics as `{session_id, code, user_agent, created_at}` (the free-form `stats` is withheld: it can describe the other participant's connection) |
| `curriculum.subjects` | `TeacherSubject`, `StudentSubjectInterest` | subjects taught and subjects of interest, as `{subject, since}` |

`NOT_PERSONAL` gains three reference models: `billing.SubscriptionPlan` (catalogue row),
`billing.StripeEventLog` (provider event id and type, no user link) and
`curriculum.Subject` (catalogue row). `PENDING_EXPORT` becomes empty.

allauth's `mfa` and `socialaccount` apps are installed but no product flow writes their
rows, so they are not exported. A unit that turns either on adds them to
`identity.account`.

## Data model delta

None. No model, no migration.

ADR-0023's four points:

- **What:** a copy of the person's own records across the joined modules, as above.
- **Why:** the GDPR rights of access and portability (Art. 15, 20).
- **How long:** never stored. The file is built in memory per request and returned with
  `Cache-Control: no-store`. The log line records the user id, section names and byte
  size only, never content.
- **Who sees it:** only the signed-in person who re-entered their password. Staff have no
  view of it.

Expand/contract: one new endpoint, one new throttle rate, one new alert wording. The
previous dashboard bundle never calls the endpoint, so both colours are safe.

## API delta

`POST /api/v1/identity/me/export/` (session auth, CSRF).

- Body: `{"current_password": "..."}`.
- 200: the envelope above, `Content-Type: application/json`,
  `Content-Disposition: attachment; filename="kaleem-data-export-<date>.json"`,
  `Cache-Control: no-store`.
- 400: `{"current_password": ["Incorrect password."]}`, the same shape and wording as the
  add-email and change-password re-authentication.
- 401/403: not signed in (DRF session auth; the existing tests accept either).
- 429: `ScopedRateThrottle`, scope `data-export`, `10/hour` per user. Wrong-password
  attempts count.

Python: `identity.services.export_account_data(user_id, current_password) -> dict` checks
the password, builds the envelope from `kaleem.platform.personal_data.export_user`, and
sends the alert through the existing `_send_email_security_alert` with a new
`data_exported` action (English, like the other alerts; server-string translation is
rch-i18n-server-strings).

Platform: `personal_data_contract.assert_export_honours_contract(name, *, seed, make_user)`
runs the export-side rules of the existing helper (`registered` for export only,
`export-json`, `export-deterministic`, `export-read-only`, `unseeded-user`), and
`assert_hooks_honour_contract` calls it first. No rule is loosened; the four modules
switch to the pair helper when lb-gdpr-erasure adds their erase hooks.

## Frontend

- Route: `/account` (all roles). A new `DataExportCard` sits after `ChangePasswordCard`.
- States: idle; dialog open; submitting (button disabled, labelled busy); success (file
  saved, toast, dialog closed); wrong password (field error); throttled; other error.
- API: `identityApi.exportData({ current_password })` through `src/lib/api.ts`; the JSON
  response is saved by a new `src/lib/download.ts` helper (Blob + object URL + a
  `download` anchor), named from `generated_at`.
- Strings: new `account.export.*` keys in `en` and `ar` `common.json`. Arabic copy goes to
  hg-arabic-review, which holds spec closure, not the merge.
- Tokens-only styles, RTL-safe, 44px targets; the dialog uses the existing `@/ui` dialog.

## Module boundaries

- Each module's hook reads only its own models, plus the subject slug through its own FK,
  as scheduling's views already do.
- identity owns the endpoint and calls `kaleem.platform.personal_data.export_user`;
  identity may import platform. No import-linter contract changes.
- No events.

## Out of scope

- Erase hooks and account deletion (lb-gdpr-erasure).
- A parent exporting a child's data (lb-parent-acts-for-child).
- Export on behalf of someone by staff, and the manual written-request process.
- Asynchronous or emailed exports, and uploaded files. Every section today is small;
  a module whose export can grow large (messages, files) raises this in its own spec.
- Other formats (CSV, PDF).
- Translated alert email.

## Test plan

Backend:

- Each of the four hooks passes `assert_export_honours_contract`, with a seed that
  creates the module's data for the user and its counterpart.
- Each hook's output for a seeded user equals an expected dict: own fields present;
  counterpart only as `counterpart_user_id`; withheld fields absent (notes,
  internal notes, incident detail, invite code, Stripe ids, diagnostic stats).
- The coverage guard passes with `PENDING_EXPORT` empty and the three `NOT_PERSONAL`
  entries; its stale-pending test no longer depends on curriculum being pending.
- `assert_export_honours_contract` fails with each rule's name on a bad hook (writes,
  non-JSON, non-deterministic, raises for an unseeded user, not registered).
- Endpoint: 200 with the envelope, headers and every registered hook as a section; 400 on
  a wrong password with no email sent; 401/403 anonymous; 429 past the rate; the alert task
  is enqueued once on success; the password hash appears nowhere in the body.

Dashboard: `DataExportCard` saves a file on success, shows the field error on 400 and the
throttled message on 429; `download.ts` names the file and revokes the URL; locale parity.

e2e (`e2e/data-export.spec.ts`, budget 20 s, two flows):

- `booked` signs in, downloads the file, and it parses with `format`, `version: 1`, the
  five sections, its own email in `identity.account`, at least one lesson in
  `scheduling.lessons`, and no `pbkdf2_` / `argon2` substring anywhere.
- `student` enters a wrong password: the field error shows and no download event fires.

Staging (dec-d9-substitute): the agent click-through on `/account` in both themes, Arabic
RTL and 320px.

## Open questions

None blocking. For the owner at approval: the three content rules above (others by role
and id only; no secrets; staff-only fields withheld until a written request).
