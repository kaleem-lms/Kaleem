---
number: 0051
title: The e2e job reads a real inbox
status: accepted
date: 2026-10-18
amends: ADR-0027
---

## Context

ADR-0027 built the Playwright harness without a mail catcher: the `e2e` job set
`DJANGO_EMAIL_BACKEND` to locmem, so a message the Celery worker sent was discarded. Three
flows end in an email whose link is the only way to finish them: registration (verify the
address), password reset, and a child's first password. They could not be driven, and the
D3 table listed "anything needing an inbox" as uncovered.

`ci-parallel-guards` has since put the Celery worker in the job, and the worker is what
sends all three (`CeleryAccountAdapter.send_mail`, `request_password_reset` and
`_send_child_set_password_link`, each through `send_email_message.delay`). Mailpit already
serves local development in `docker-compose.local.yml`.

## Decision

1. **Mailpit is an `e2e` service container, pinned to `axllent/mailpit:v1.30.1`.** The job's
   email settings point at it (`DJANGO_EMAIL_HOST=localhost`, port 1025), and
   `DJANGO_FRONTEND_URL` is set to the app's origin so emailed links point at the app.
   `docker-compose.local.yml` pins the same version, because local e2e runs read it and the
   helper's HTTP API contract is per version. A version bump re-checks `GET /api/v1/search`,
   `GET /api/v1/message/{ID}` and `DELETE /api/v1/search` first.
2. **A helper, `dashboard/e2e/support/inbox.ts`, with three guarantees.**
   - A failure to receive a mail names the recipient and subject, not a generic timeout.
   - A link whose origin is not the app's `baseURL` fails, so a mail pointing at the wrong
     host is caught at the link rather than as a connection error.
   - The recipient's old mail is cleared before the triggering action, so a retry or a
     long-lived developer mailpit never supplies a spent link.
3. **Each flow ends by signing in as the account the link was for.** A page that says
   "verified" or "password reset" can do so for a key that did nothing; only a sign-in
   cannot be faked by rendering.
4. **The worker probe also proves the mail path.** After the task result, it waits for the
   probe message in mailpit, so a broken SMTP setting fails before Playwright starts.
5. **`seed_e2e` gains `e2e.reset@kaleem.test`** (the reset flow sets a new password on it,
   so no other spec may share it) **and prunes `e2e.register.*`** (one account per run, which
   the UI cannot delete).

## What this does not prove

Mailpit proves the app sends the right message to the right address with a working link.
It proves nothing about the production mail provider, SPF/DKIM, spam placement, or how the
HTML part renders. The D3 row says so, and delivery stays a staging check.

## Alternatives considered

- **Keep locmem and unit-test the services.** Rejected: that is the status quo, and it is
  exactly what cannot see a link built from the wrong origin or a token the page refuses.
- **Read the Celery task payload from Redis instead of running SMTP.** Rejected: it skips the
  adapter-to-SMTP path that production uses and couples the test to the broker's format.
- **A hosted catcher.** Rejected: a network dependency and a secret for something a
  service container does for free.
- **Re-use the seeded parent for the reset flow.** Rejected: it rotates a password the rest
  of the suite logs in with, the reason change-password stayed uncovered.

## Consequences

**Good**

- Registration, password reset and child activation are covered end to end, and every
  notification unit that follows has an inbox helper to build on.
- The probe now fails in seconds, with the worker log, when mail cannot reach the inbox.

**Bad / costs**

- One more service container in the slowest job, and about 30 seconds of flows.
- A pinned version is a pin to maintain.
- Dev settings now serve two masters in one more way: `config.settings.local` is also
  what the job runs, so the email host is configured by environment (the existing ADR-0027
  consequence, now including the mail host).
- The reset flow leaves `e2e.reset@kaleem.test` with a password that is not the fixture one
  until the next `seed_e2e`. The email-scoped throttle (5/hour per address) also applies on
  a developer machine: a sixth local run of the reset flow in an hour gets a 429 until that
  Redis database is flushed. CI starts from a fresh Redis, so it is unaffected.
