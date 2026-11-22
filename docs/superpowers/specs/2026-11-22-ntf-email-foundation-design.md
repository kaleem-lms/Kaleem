---
name: ntf-email-foundation
phase: v1 (wave 3, notifications stream)
modules: [platform, notifications]
status: draft
created: 2026-11-22
closed: null
---

## Goal

Every email kaleem sends today is English plain text, rendered in the web request
(ADR-0018). The notice units need more than that: a bilingual layout with an HTML part, a
render that runs in the worker for the recipient's language and time zone, and a sender that
implements the `EmailChannel` interface `ntf-core` fixed (`kaleem/notifications/channels.py`).
This unit builds that foundation and sends nothing new by itself. No producer calls
`notify()` yet, and identity's mail moves onto the layout in `ntf-identity-emails-relayout`.

It adds:

- **platform's email layout and renderer** (`kaleem.platform.email`): a text and an HTML
  part from one template, rendered under an explicit language and time zone, with a header
  slot that holds the text wordmark until `inf-brand-email-header` swaps in the raster
  (`dec-brand-email-header`);
- **a guarded send**: a typed "not configured" error (with a startup warning), a recipient
  denylist, `List-Unsubscribe` support and no lossy fallback;
- **a platform task** that renders and sends in the worker, so identity can move onto it next
  release (`ntf-identity-emails-relayout`);
- **the email channel adapter** in `kaleem.notifications`: `dispatch()` enqueues one task per
  delivery, and the task renders, sends and records the result. It retries transient
  failures, and a sweep re-sends deliveries left `pending`.

**Decisions it rests on**, all answered: `D-ntf-template-ownership` (copy lives in code with
gettext, no template table), `D-ntf-support-contact` (a monitored `support@`; staging uses a
default and the real mailbox is a launch gate), `dec-brand-email-header` (a slot here, the
raster later), and the owner's 2026-10-25 rule that credentials come in one final setup step,
so this unit ships and starts without SMTP credentials and reports "not configured".

## User flow

No user sees anything from this unit. The first email through it comes from a producer unit,
such as `ntf-booking-notifications`. From then on:

1. A producer calls `notify()` in its transaction. On commit, `ntf-core` hands the pending
   email delivery ids to `EmailChannelAdapter.dispatch()`, which enqueues
   `send_email_delivery(delivery_id)` once per id.
2. In the worker the task reads the delivery (`get_pending_email_delivery`), which carries the
   recipient's current language and time zone. It also reads the recipient's address from
   `identity.services.get_user`. Then it renders the notice under that language and zone,
   sends it, and calls `record_delivery_result`.
3. The recipient gets one `multipart/alternative` message. The plain-text part comes first,
   then the HTML. An Arabic reader gets `lang="ar" dir="rtl"` and Arabic copy. Times are shown
   in the reader's zone. The body names nobody and carries no address (ADR-0023). It has one
   link to the app, on its own line in the text part.

Failure cases. Each ends in a terminal delivery row with an `error_code`, so nothing is
dropped silently:

| Case | Delivery | Logged |
| --- | --- | --- |
| No SMTP credentials in production | `failed` / `channel_unconfigured` (`ntf-core`'s existing path, because the channel setting is `None`) | ERROR per `notify()`, plus a WARNING at startup |
| The recipient is inactive (an erased account) | `failed` / `recipient_inactive` | INFO |
| The address is on the denylist | `failed` / `recipient_suppressed` | INFO |
| The provider refuses the recipient permanently (5xx RCPT) | `failed` / `recipient_refused` at once | WARNING |
| The provider refuses the recipient temporarily (4xx RCPT, e.g. 450 greylisting) | retried 3 times with backoff; still refused on the last try: `failed` / `recipient_refused` | WARNING per try |
| A permanent SMTP error (5xx: e.g. 554 data, 553 sender, 535 auth) | `failed` / `send_failed` at once, no retry | ERROR |
| A transient SMTP or connection error (4xx, dropped or refused connection) | retried 3 times with backoff, then `failed` / `send_failed` | WARNING per try, ERROR on the last |
| Still `pending` after 15 minutes (broker down at commit, worker lost) | the sweep re-enqueues it | INFO |
| Still `pending` after 24 hours | `failed` / `delivery_expired`, so a day-old notice is never sent | WARNING |
| The adapter runs while delivery is not configured (a misconfiguration; `notify()` normally records `channel_unconfigured` first) | `failed` / `email_not_configured` | ERROR |
| The kind was retired after `notify()` wrote the delivery | `failed` / `unknown_kind` | ERROR |
| The delivery is already terminal, purged or erased | the task does nothing | none |

No log line, task argument or error carries an email address. Logs name the delivery id
and the error code only.

## Data model delta

None. No migration. The unit reads `Delivery` rows through `ntf-core`'s services and adds
no field.

**Personal data (ADR-0023):**

- **What:** the recipient's address, language and zone, read at send time. Nothing new is
  stored.
- **Why:** to deliver the notice the producer wrote.
- **How long:** for the length of one send. The notifications task's only argument is the
  delivery id. The platform task carries the address in the broker message for as long as
  the message waits, which is how `send_email_message` already works. Both tasks are
  `ignore_result=True`, so neither their arguments nor their result is written to the
  result backend (`CELERY_RESULT_EXTENDED` is on).
- **Who sees it:** the recipient, and the mail provider as the processor that delivers the
  message.

**Expand/contract.** There is no schema change. Both task names ship in this release, and
nothing enqueues them until a later release: no kind is registered until the first producer
unit, and the identity relayout is a later unit. The sweep ships with **no beat entry**. The
first producer unit adds `notifications-sweep-pending-email` next to the
`notifications-purge-expired` entry, in a slot the conductor assigns. The previous colour
keeps `NOTIFICATIONS_EMAIL_CHANNEL = None` and calls `notify()` nowhere.

## API delta

There is no HTTP API. These are Python APIs.

**`kaleem.platform.email`** (platform imports no business module):

- `render_email(template, context, *, language, timezone, list_unsubscribe=None) -> RenderedEmail`
  renders `<template>.subject.txt`, `<template>.txt` and `<template>.html` under
  `translation.override(language)` and `timezone.override(timezone)`. Lazy strings in the
  context resolve in that language. A body template extends `platform/email/layout.txt` or
  `layout.html`.
  - The subject is collapsed to one line.
  - The HTML part is autoescaped and the text part is not.
  - `RenderedEmail` is a frozen dataclass: `subject`, `text`, `html` and `headers`.
- The layout's `{% block header %}` holds the wordmark as text (`kaleem` / `كَلِيم`, through
  `pgettext("brand", ...)`). It loads no image, font or stylesheet from outside the message.
  - All styles are inline, in a table at most 600px wide with `role="presentation"`.
  - The text and button colours come from one mapping, `EMAIL_COLOURS`. Each pair has a
    contrast of at least 4.5:1, and a test enforces it. The values are copied from
    `@kaleem/tokens`, because a mail client cannot read CSS variables.
  - The action button is an `<a>` at least 44px high.
  - The footer gives the support contact (`settings.SUPPORT_EMAIL`).
- `headers` always holds `Auto-Submitted: auto-generated` (RFC 3834) and `Content-Language`.
  Given `list_unsubscribe=ListUnsubscribe(url, one_click=...)`, it adds `List-Unsubscribe: <url>`,
  and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) when `one_click` is
  set. No caller passes one in this unit. `ntf-preferences` supplies the signed URL, and a
  mandatory kind never gets one.
- `send_email(to, email) -> None` sends one message from `DEFAULT_FROM_EMAIL`, with
  `Reply-To: SUPPORT_EMAIL`. It raises one of three typed errors from
  `kaleem.platform.exceptions`, each a `KaleemError` with a `code`:
  - `EmailNotConfigured` (`email_not_configured`) when `settings.EMAIL_DELIVERY_CONFIGURED`
    is false. It is raised before any connection is opened, and no other backend is tried.
  - `RecipientSuppressed` (`recipient_suppressed`) when the address's domain, compared
    exactly and case-insensitively, is in `settings.EMAIL_SUPPRESSED_DOMAINS`.
  - The SMTP exception from Django, for any other failure.
- `is_delivery_configured() -> bool`.
- `python manage.py send_sample_email <address> [--language en|ar]` renders the fixed
  `platform/email/sample` template and sends it through `send_email`, so the not-configured
  check and the denylist apply to it too. It is the tool for `hg-mail-client-render` and
  for the setup step's check.

**`kaleem.platform.tasks.send_templated_email(*, to, template, context, language, timezone, datetimes=())`**
is a new task, with no caller yet. `context` must be JSON-safe. Keys named in `datetimes`
are ISO-8601 strings and are parsed into aware datetimes before the render.
- It retries transient SMTP and connection errors three times with backoff.
- `EmailNotConfigured` is logged at ERROR and not retried. `RecipientSuppressed` is logged
  at INFO and not retried.
- The task `send_email_message` stays as it is until the relayout unit.

**`kaleem.notifications.email`:**

- `EmailChannelAdapter.dispatch(delivery_ids)` enqueues `send_email_delivery` per id.
- `send_delivery(delivery_id) -> None` holds the logic the task wraps:
  1. Takes a per-delivery cache lock (`cache.add`, 10 minutes), so a sweep and a slow worker
     never send twice at once.
  2. Reads the pending delivery, resolves the recipient, renders
     `notifications/email/notice` and sends.
  3. Records the result.
  - The notice's subject and heading are the kind's lazy `title`, and its link is
    `FRONTEND_URL + delivery.link`.
  - A producer may add `notifications/email/kinds/<app>.<name>.{txt,html}` in its own app.
    That body is included when it exists, and a generic line is used when it does not.
  - Decoded datetime params are rendered in the recipient's zone.
- Tasks in `kaleem/notifications/tasks.py`:
  - `send_email_delivery(delivery_id)` is `ignore_result=True`.
  - `sweep_pending_email_deliveries()` is idempotent, so a double dispatch is harmless.
- A new internal query in `channels.py` (not exported) lists stale pending email ids for the
  sweep.

**Settings:**

- `base.py` gains three settings:
  - `SUPPORT_EMAIL = env("DJANGO_SUPPORT_EMAIL", default="kaleem <support@kaleem.academy>")`;
  - `EMAIL_DELIVERY_CONFIGURED = True`, which local, test and e2e inherit, so their
    locmem and mailpit backends count as configured, and `EMAIL_DELIVERY_MISSING`, the
    variable names the startup warning reads (empty in base; production fills it);
  - `EMAIL_SUPPRESSED_DOMAINS = ("pool.kaleem.test", "erased.invalid")`. These are the two
    undeliverable domains kaleem creates itself: the staging pool and the erased-account
    placeholder. A test pins them to `staging_pool.POOL_DOMAIN` and to identity's
    `PLACEHOLDER_DOMAIN`. The e2e domain `kaleem.test` is not on the list, so mailpit flows
    keep working.
- `NOTIFICATIONS_EMAIL_CHANNEL` becomes `"kaleem.notifications.email.EmailChannelAdapter"`
  when delivery is configured, and `None` otherwise.
- `production.py` sets `EMAIL_DELIVERY_CONFIGURED` to true only when `DJANGO_EMAIL_HOST`,
  `DJANGO_EMAIL_HOST_USER` and `DJANGO_EMAIL_HOST_PASSWORD` are all non-blank. These are
  ADR-0016's existing names, and no new credential variable is added.
  - It does **not** stop the deploy when only some of the three are set. Staging's current
    values cannot be seen from here, and refusing to start would roll back the deploy.
  - In that case delivery is simply not configured, and the warning names the missing
    variables.
- `PlatformConfig.ready()` logs one WARNING per process when delivery is not configured. It
  names the variables and never a value, as `ContentConfig.warn_if_not_configured` does.

## Frontend

None. The unit has no route, component or API call. The dashboard's first view of an email
outcome is `ntf-inapp-feed`.

## Module boundaries

- **platform** owns the layout, the renderer, the guarded send and the generic task. It
  imports no business module, and the existing contract keeps it that way.
- **notifications** owns the adapter and its tasks. It calls `kaleem.platform.email`,
  `identity.services.get_user` (an existing service and edge, and no identity model import)
  and its own `channels` services.
- No new import-linter edge. No events. Identity is untouched, and its mail keeps using
  `send_email_message` until `ntf-identity-emails-relayout`.

## Out of scope

- Moving identity's mail onto the layout (`ntf-identity-emails-relayout`).
- The brand raster in the header slot (`inf-brand-email-header`).
- The unsubscribe endpoint, its signed token and the preferences card (`ntf-preferences`).
- Every concrete kind and its body copy (the producer units).
- The beat entries for the sweep and the purge (the first producer unit).
- SES credentials, domain verification (SPF and DKIM in DNS) and leaving the sandbox (the
  final setup step).
- Bounce and complaint webhooks (ADR-0016: SMTP, no event tracking).

## Test plan

Every render test runs in **both locales**. That is the e2e substitute the programme entry
names.

- **Render:**
  - `en` gives `lang="en" dir="ltr"` and English copy. `ar` gives `lang="ar" dir="rtl"`,
    the Arabic wordmark and Arabic copy, in both parts.
  - A lazy string in the context resolves in the given language, not the active one.
  - A datetime renders in the given zone (for example `Asia/Riyadh` versus `UTC`).
  - HTML escapes a `<script>` value and the text part does not.
  - The subject is one line.
  - The HTML has no `http` resource other than the one link: no `<img>`, no external
    `<link>`.
  - Each `EMAIL_COLOURS` pair has a contrast of at least 4.5:1.
  - Headers: `Auto-Submitted` and `Content-Language` are always present.
    `List-Unsubscribe` appears only when it is passed, and `-Post` only with `one_click`.
- **Send:**
  - Not configured raises `EmailNotConfigured` and sends nothing to locmem.
  - A denylisted domain raises `RecipientSuppressed`, in any case. `kaleem.test` and
    `notpool.kaleem.test` are not suppressed, because the match is exact.
  - A sent message is `multipart/alternative` with the text part first, carrying `From`,
    `Reply-To` and the headers.
- **Platform task:** `datetimes` keys are parsed. Not configured and suppressed are logged
  and not retried. A transient `SMTPServerDisconnected` is retried and then raised.
- **Settings** (`tests/settings/`): production with all three variables is configured and
  the channel is set. With none or only some, delivery is not configured, the channel is
  `None`, nothing raises, and the startup warning names the missing variables with no
  value.
- **Adapter:**
  - `dispatch` enqueues one task per id.
  - A pending delivery is sent in the recipient's stored language and zone, and the result
    is `sent`.
  - The link is absolute. The body holds no address and no name.
  - A kind body template is included when present, and the generic line is used when it is
    absent.
  - Each failure case in the table above ends in its own `error_code`, and no case logs the
    address.
  - A second call for a terminal delivery sends nothing.
  - A held lock sends nothing.
  - The sweep re-enqueues rows pending for more than 15 minutes, expires rows older than 24
    hours, and leaves newer ones alone.
  - The `ntf-core` test that relies on an unconfigured default now sets
    `NOTIFICATIONS_EMAIL_CHANNEL = None` explicitly.
- **Regression mutation checks:**
  - Remove the `translation.override` and the Arabic render tests go red.
  - Remove the lock and the double-send test goes red.
  - Make the denylist a suffix match and the `kaleem.test` test goes red.
- **Catalogs:** `tests/test_translation_catalogs.py` passes with the new platform and
  notifications msgids. Arabic entries are drafts for `hg-arabic-review`, which holds spec
  closure, not the merge.
- **Gates:** `lint-imports` (no new edge), `mypy .`, `ruff` and the coverage floor
  unchanged.

e2e: **none**, time budget 0 s. No user action reaches this path until a producer exists.
The first mailpit flow is `ntf-booking-notifications` ("A cancellation email reaches
mailpit").

**`hg-mail-client-render`: what can and cannot be verified here.**

- **Can be verified** without a real mail client, and is covered by the tests above:
  - the MIME structure and part order, and the headers;
  - `lang` and `dir`, and the Arabic text in both parts;
  - escaping, and the absence of remote resources;
  - the colour contrast of the defined pairs;
  - the absolute link and the absence of any address or name.
- **Cannot be verified** in this project without the owner's devices and the final setup:
  - how Gmail (web and Android), Outlook and the Android mail app lay out the RTL table,
    align the text and size the button;
  - dark-mode colour inversion and the Arabic font fallback;
  - Gmail clipping and how `List-Unsubscribe` shows in each client;
  - deliverability and spam placement, which need SES out of the sandbox with SPF and DKIM
    in DNS.
- The owner's session needs a sent message. `python manage.py send_sample_email <address>
  --language ar|en` renders a fixed sample through the layout and sends it. It is run over
  ssh once SMTP credentials exist. The same session closes the Phase A real-inbox residual.

## Open questions

None. The decisions are listed under **Goal**. The `hg-vps-env` names are in the plan. Every new
variable is optional, so no variable must be added before the merge.
