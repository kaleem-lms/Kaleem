---
name: ntf-mail-e2e-harness
phase: v1
modules: [ci, identity]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Give the CI e2e job a real inbox, so the three flows that end in an email can be driven
end to end. Today they cannot: the job sets `DJANGO_EMAIL_BACKEND` to locmem
(ci.yml, `e2e` env), so a mail the Celery worker sends is gone, and the CLAUDE.md D3
table lists "anything needing an inbox" as uncovered (ISSUES.md, "Flows the harness
structurally cannot reach"). Mailpit already serves this role in local compose
(`docker-compose.local.yml`, `axllent/mailpit:latest`); CI has none.

This unit adds:

1. a pinned mailpit (`axllent/mailpit:v1.30.1`) as an e2e service container, with the
   e2e job's email settings pointed at it, and the existing worker probe extended to
   prove a mail actually reached it;
2. a Playwright inbox helper other units reuse (every `ntf-*` unit and `trl-*`
   notification units depend on this one);
3. three flows: register and verify, password reset, and child activation.

It depends on `ci-parallel-guards`, which put the Celery worker and the seed manifest in
the e2e job. All three mails are sent by that worker (`CeleryAccountAdapter.send_mail`,
`identity.services.request_password_reset`, `_send_child_set_password_link`, each through
`platform.tasks.send_email_message.delay`), so without the worker there is nothing to read.

## User flow

No end-user change. Contributors get three new e2e flows in `dashboard/e2e/inbox.spec.ts`:

1. **Register and verify.** An anonymous visitor registers a parent account with a fresh
   `e2e.register.<id>@kaleem.test` address, lands on `/verify-pending`, the confirmation
   mail arrives, its `/verify-email?key=` link shows "Email verified", and the new
   account then signs in through the real form. The sign-in is the assertion: the page
   would say "verified" for a key that verified nothing.
2. **Password reset.** `/forgot-password` for the seeded `e2e.reset@kaleem.test`; the
   reset mail arrives; its `/reset-password?uid=&token=` link sets a fresh random
   password; the account signs in with it; the "a change was made to your kaleem
   account" security alert arrives at the same address.
3. **Child activation.** The seeded parent adds a child with no password (a fresh
   `e2e.child.<id>@kaleem.test`); the "Set your kaleem password" mail arrives; its link
   sets the child's password; the child signs in. The sign-in proves activation, because
   an unverified child cannot sign in and only `confirm_password_reset` verifies them.

Failure behaviour the helper guarantees:

- No matching mail within 20 s fails with the recipient and subject in the message, not
  a generic timeout.
- A link whose origin is not the app's `baseURL` fails. This catches a mail pointing at
  the wrong host (the job sets `DJANGO_FRONTEND_URL`; without it every link would point
  at port 80).
- The recipient's old mail is cleared before each triggering action, so a retry, or a
  second run against a developer's long-lived mailpit, never reads a stale link.

## Data model delta

None. No migrations.

`seed_e2e` (identity) gains one account and one prune prefix:

- `e2e.reset@kaleem.test`, "E2E Reset", verified, with a `ParentProfile`. It exists so
  the reset flow never rotates a password another flow relies on, the reason
  change-password stays uncovered. A parent profile has no matching side effects
  (manifest rule 2).
- The prune also deletes `User` rows whose address starts `e2e.register.` at
  `@kaleem.test`, as it already does for `e2e.child.`. A developer's database would
  otherwise collect one account per run.

## API delta

None.

## Frontend

No product change. Test-only files in `dashboard`:

- `e2e/support/inbox.ts` (new): `clearInbox(request, to)`, `waitForMail(request,
  { to, subject })` and `linkIn(mail, pathname)`. It talks to the mailpit API at
  `E2E_MAILPIT_URL` (default `http://localhost:8025`, the local compose port) through
  Playwright's `request` fixture. It uses `GET /api/v1/search`, `GET /api/v1/message/{ID}`
  and `DELETE /api/v1/search`, all checked against v1.30.1 on 2026-10-18.
- `e2e/fixtures.ts`: `uniqueEmail` accepts `"register"`; `ACCOUNTS` gains `reset`.
- `e2e/inbox.spec.ts` (new): the three flows.

## Module boundaries

- Backend: only `identity`'s own `seed_e2e` and its test, plus the comment in
  `config/settings/local.py` that says CI has no mailpit. No new import edges. The seed
  manifest is not touched; `seed_e2e` is already its first entry.
- Meta, `.github/workflows/ci.yml` `e2e` job:
  - a `mailpit` service on ports 1025 and 8025 with a `/mailpit readyz` health check;
  - env `DJANGO_EMAIL_BACKEND` (SMTP), `DJANGO_EMAIL_HOST=localhost`,
    `DJANGO_EMAIL_PORT=1025`, `DJANGO_FRONTEND_URL=http://app.kaleem.localhost:4173`,
    `E2E_MAILPIT_URL=http://localhost:8025`;
  - the "Prove the worker executes a task" step also asserts the probe mail is in
    mailpit, so a broken mail path fails before Playwright starts.
- `docker-compose.local.yml` pins the same `v1.30.1`, because the helper's API contract
  is per version and local runs use that mailpit.
- **ADR**: a new ADR amending ADR-0027 (number from the conductor; 0050 if free). It
  records that e2e now reads a real inbox and what that does not prove.

Personal data (ADR-0023): none real. Every address is a fixture at `@kaleem.test`.
Mail exists only inside the job's mailpit container, or a developer's local one, and is
discarded with it. Nothing here runs in staging or production: `seed_e2e` refuses
`DEBUG=False`, and neither the deploy job nor any production settings change.

Expand/contract: not applicable. There is no schema or API change.

e2e time budget: 30 s or less for the three flows. The suite's 9-minute
`globalTimeout` does not change.

## Out of scope

- Proof that real mail is delivered. Mailpit proves the app sends the right mail with a
  working link. It proves nothing about the production provider, SPF/DKIM, spam
  placement or how the HTML part renders. The D3 row says so.
- Notification mails (`ntf-*` units bring their own flows on this helper).
- change-password (it needs its own throwaway account; separate slice).
- The parent-set-password child path (it sends the same allauth confirmation flow 1
  covers).
- The conductor's local e2e-slot recipe in `_ops`. It is not in a repo; the plan says
  what it needs.

## Test plan

Backend (pytest, written first, in `kaleem/identity/tests/test_seed_e2e.py`):

- The seed creates six accounts; `e2e.reset@kaleem.test` is verified, has a
  `ParentProfile` and authenticates with the fixture password.
- Reseeding restores the reset account's password after a reset changed it.
- The prune deletes an `e2e.register.*@kaleem.test` user, and the existing "leaves
  everything it does not own alone" test gains a lookalike outside the domain.

e2e: the three flows above. Each is mutation-checked locally, red with the mutation
and green without it:

| Flow | Mutation | Expected red |
| --- | --- | --- |
| register and verify | drop `confirmation.confirm(...)` in `VerifyEmailView.post` | sign-in refused after "Email verified" |
| password reset | drop `user.set_password(...)` in `confirm_password_reset` | sign-in with the new password refused |
| child activation | drop the `EmailAddress...update(verified=True)` line in `confirm_password_reset` | child sign-in refused |
| helper (all) | unset `DJANGO_FRONTEND_URL` | `linkIn` refuses the port-80 origin |

CI: the PR run's e2e log names all three flows as passed, with no retry, and the probe
step prints that the probe mail reached mailpit.

## Open questions

None. No owner decision applies. The only new decision is the ADR-0027 amendment.
