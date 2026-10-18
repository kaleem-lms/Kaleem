---
number: 0053
title: Access-log policy — credentials travel in fragments or bodies, and logs record paths only
status: accepted
date: 2026-10-18
---

> **Publication hold (ADR-0045 §4).** This record is committed on the unit's branch and is not
> pushed or merged to the public meta repo until the change has deployed.

## Context

Several flows put a single-use credential in a link: email verification, password reset and
child activation. A credential in a URL is copied to every place that records a URL — a
server's access log, a proxy, a log collector, a `Referer` header. Each of those has its own
retention and its own readers, none of which is the person the credential belongs to.

kaleem has three places that write per-request access logs: the API (gunicorn), the dashboard
image (nginx) and the marketing image (nginx). Traefik, in front of all three, keeps no
request path at all (`RequestPath` is dropped in `traefik/traefik.yml`), because it cannot
redact one route. That left the API's own log as the only per-request path record, with the
caveat already written in `ISSUES.md`: allauth's confirm-email and reset-from-key routes carry
their credential in the path.

## Decision

**1. A credential never rides in a URL a server sees.** Links that hold a single-use
credential put it in the URL **fragment** (`/verify-email#key=…`,
`/reset-password#uid=…&token=…`). Browsers never send the fragment to a server, never put it in
`Referer`, and nothing between the browser and the SPA can log it. The dashboard reads it from
the fragment, POSTs it to the API **in the request body** (as it already did), and replaces the
address-bar URL with the bare path so a reload, bookmark or screenshot no longer carries it.

**2. Access logs record paths, never a query string or a header.** Every access log kaleem
writes records the time, method, path, status, response size and duration, and nothing else: no
query string, no `Referer`, no user agent, no cookie, no client address.

- **nginx (dashboard, marketing):** a `log_format` that takes the path from `$request_uri`
  before the first `?`. Not `$uri`, which `try_files` rewrites to `/index.html` and which would
  log every SPA route as the shell. The policy covers nginx's error log as well: a request for
  a directory is answered by an explicit rule rather than left to the directory-index module,
  because that module's error line carries the whole request line and the `Referer`. The CI
  check reads the container's complete output, error log included, and sends such a request.
- **gunicorn (API):** `gunicorn.conf.py`, loaded with `-c`, sets `accesslog`, the format, and a
  `logger_class` (`kaleem.platform.gunicorn_logging.RedactingLogger`). The logger builds the
  access-log atoms itself from an allowlist; every other atom reads `-` whatever format an
  operator configures, so the policy does not depend on the format string staying as written.
  The error log's "Error handling request <uri>" argument is redacted the same way.

**3. Defence in depth: credential-bearing paths are masked wherever a path is logged.**
`/accounts/confirm-email/<key>/` and `/accounts/password/reset/key/<key>/` are logged as
`…/[redacted]` by gunicorn (access and error logs) and by Django's `django.request` logger
(`Not Found: <path>` records). The masking lives in `kaleem.platform.access_log`. It outlives
the allauth routes: a stale link to a removed route still produces a 404 whose path must not
hold a credential.

**4. Each surface is proven by a test, not by reading config.** A CI check
(`.github/scripts/check-nginx-access-log.sh`) runs each image's real `nginx.conf` over its real
build in a real nginx container, sends probe values in the query string, `Referer`,
`User-Agent` and `Cookie`, and reads the container's whole output. It fails if the probe
appears anywhere, and fails if the request path does not appear (a config that logs nothing
would otherwise pass). A self-test runs the checker against a leaking config and a silent
config and requires it to fail on both. The gunicorn logger is tested through gunicorn's own
`Config` and `Logger`, loading the real `gunicorn.conf.py`, including formats that ask for the
unsafe atoms by name. The dashboard's fragment handling is covered by unit and Playwright
tests that assert the request body carries the credential and the URL no longer does.

**5. Traefik's `RequestPath` stays dropped.** Per-request paths are kept at the two layers that
can redact them. This ADR does not touch Traefik's access log.

**6. Expand, then switch.** The link format is a contract between the backend (which builds the
link) and the dashboard bundle (which reads it), and the blue-green deploy briefly runs both
versions. So: the dashboard first accepts the fragment **and** the query string, then the
backend starts sending fragment links. The query-string fallback is removed only after every
link sent before the switch has expired.

## Alternatives considered

- **Redact the query string in nginx with a `map` that blanks known parameter names.** An
  allowlist of names is a list someone must remember to extend; a new credential parameter
  would log in full until noticed. Logging the path only has no list to maintain.
- **Keep the query string, rely on short-lived tokens.** Reset and verification credentials live
  for days and are single-use account-takeover material until used or expired. A short log
  retention does not make the log a safe place for them.
- **Stop logging at the application and trust Traefik.** Traefik logs no path, so there would be
  no request-level record to debug or investigate with.
- **Rely on gunicorn's `access_log_format` alone.** A format string is configuration; the
  default and the `combined` formats name `%(r)s`, `%(f)s` and `%(a)s`. Enforcing the policy in
  the logger class means a format change cannot reintroduce the fields.
- **`Referrer-Policy` instead of the fragment.** A header limits where a URL is copied, not
  whether the server that received it logs it. It is a separate control, owned by the security
  headers unit.

## Consequences

- No server log kaleem writes holds a credential, an email address from a query string, a
  `Referer` or a client address. Debugging by path, status and duration is unchanged; debugging
  by query string or client address is not possible from these logs, by design.
- The dashboard's two credential routes read the fragment first and fall back to the query
  string. The fallback is a known, temporary widening, removed as a follow-up.
- Backend test requirements now include gunicorn (`requirements/local.txt` includes
  `production.txt`), so the logger is tested through the real class. A dev image rebuild picks
  it up.
- The nginx check adds one container start to each frontend build job (about 5 seconds).
- Existing logs written before the change are not rewritten by it. Where those copies live and
  how they are purged is an operations matter handled outside this record.
- Not covered: Traefik's own log (unchanged), log shipping and retention (monitoring units),
  client-address handling (`rch-sec-client-ip-trust`), and any other place an email body is
  stored or displayed.
