---
number: 0018
title: Transactional email sent via Celery
status: accepted
date: 2026-06-10
---

## Context

Account emails (verification, resend-verification, password reset) were sent
synchronously inside the request via SMTP/SES. Each send added ~2s of latency
(observed on staging) and coupled request success to SES availability — a slow or
failing provider would slow or 500 the request. We already run Celery + Flower, so
email is a natural fit for a background task.

A related latent bug surfaced: `config/__init__.py` never imported the Celery app, so
`@shared_task` bound to Celery's *default* (unconfigured) app in the web process and in
tests. `.delay()` from gunicorn would not reach the configured Redis broker — tasks
would be silently lost. The workers happened to work only because they are launched with
`-A config.celery_app`.

## Decision

Send all allauth account emails via a Celery task.

- A custom adapter, `kaleem.identity.adapter.CeleryAccountAdapter` (set as
  `ACCOUNT_ADAPTER`), overrides `send_mail`: it still **renders** the message in the
  request (rendering needs the request/Site context to build correct links), then hands
  the rendered message to `kaleem.platform.tasks.send_email_message.delay(...)`. Only the
  SMTP send runs in the worker.
- `send_email_message` rebuilds the `EmailMultiAlternatives` and sends it, with
  `autoretry_for=(Exception,)` + backoff (3 tries) for transient SES failures.
- `config/__init__.py` now imports the Celery app so it is the default whenever Django
  loads (web, tests, worker). Tests run with `CELERY_TASK_ALWAYS_EAGER` +
  `CELERY_TASK_EAGER_PROPAGATES` so task failures surface loudly.

## Alternatives considered

- **Keep sending synchronously** — simplest, but every register/resend/reset blocks ~2s
  on SES and fails the request if SES is down. Rejected.
- **Override `send_messages` / a custom email backend that enqueues** — would also catch
  non-allauth mail, but serializing an arbitrary `EmailMessage` for the broker is
  fiddlier; the adapter is the precise, allauth-blessed seam. Revisit if non-allauth
  email appears (e.g. the future `notifications` module).

## Consequences

- Register/resend/reset return immediately (register dropped from ~2.0s to ~0.12s);
  delivery happens in the worker and retries on failure.
- Email sends are now visible and monitorable in Flower.
- The web process correctly enqueues to the Redis broker (the `config/__init__.py` fix is
  required for *any* `.delay()` from gunicorn to work).
- Rendering still happens in-request; if a future email is expensive to render, move the
  render into the task too (passing only the context).

## Amendment 2026-11-22: new mail renders in the worker, through platform's layout

Part of `ntf-email-foundation` (spec `docs/superpowers/specs/2026-11-22-ntf-email-foundation-design.md`).
Nothing above is reversed. The last line of the original Consequences ("if a future email
is expensive to render, move the render into the task too") is now the rule for every email
that is not an allauth account email.

1. **Render in the worker, for an explicit language and zone.** `kaleem.platform.email.render_email`
   renders `<template>.subject.txt`, `.txt` and `.html` under the recipient's language and
   time zone, passed in. The worker has no request, so nothing is read from an active
   language. One layout (`platform/email/layout.txt` and `layout.html`) gives every message
   the same bilingual, right-to-left aware shell, with a header slot that holds the wordmark
   as text until `inf-brand-email-header` swaps in the raster.
2. **A guarded send, with no fallback.** `send_email` raises the typed `EmailNotConfigured`
   (`email_not_configured`) before it opens a connection when outgoing email is not set up,
   and never tries another backend: a message dropped by a stand-in looks delivered. In
   production, delivery counts as configured only when `DJANGO_EMAIL_HOST`,
   `DJANGO_EMAIL_HOST_USER` and `DJANGO_EMAIL_HOST_PASSWORD` are all non-blank (ADR-0016's
   own names). Some-but-not-all does not stop the deploy, because a process that refuses to
   start rolls the deploy back; the channel is simply off, and one startup WARNING names the
   missing variables, never a value.
3. **A recipient denylist.** `EMAIL_SUPPRESSED_DOMAINS` holds the two undeliverable domains
   kaleem creates itself (the staging pool and the erased-account placeholder), matched
   exactly and case-insensitively. A send to one raises `RecipientSuppressed`.
4. **`List-Unsubscribe`.** The renderer adds `List-Unsubscribe` (and the RFC 8058 one-click
   `-Post` header) when a caller passes a URL. No caller does yet; the preferences unit
   supplies the signed URL, and a mandatory kind never gets one. Every message carries
   `Auto-Submitted: auto-generated` and `Content-Language`.
5. **No result stored.** The new tasks are `ignore_result=True`. `CELERY_RESULT_EXTENDED` is
   on, so a stored result would keep the task's arguments, which for `send_templated_email`
   include an address. The notifications task takes only a delivery id.
6. **The notifications adapter** (`kaleem.notifications.email.EmailChannelAdapter`) is the
   first caller: one task per delivery, a per-delivery lock, retries for transient failures,
   and a sweep that re-sends deliveries left pending and expires day-old ones. Every ending
   is a terminal `Delivery` row with an `error_code`; no log line carries an address.

**Still true.** allauth's own emails keep the in-request render and `send_email_message`
until `ntf-identity-emails-relayout` moves them onto the layout. `send_email_message` is
untouched in this unit.

**Not covered here.** How Gmail, Outlook and Android mail lay the message out, dark-mode
inversion, clipping, and deliverability need real mail clients and SES out of its sandbox
with SPF and DKIM in DNS. They are the owner's `hg-mail-client-render` session, run with
`manage.py send_sample_email`, after the setup step supplies credentials.
