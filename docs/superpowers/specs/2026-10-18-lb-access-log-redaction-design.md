---
name: lb-access-log-redaction
phase: v1 programme (wave 1, security stream)
modules: [identity, platform, nginx (dashboard, marketing), infra]
status: approved
created: 2026-10-18
closed: null
---

> **Publication hold (ADR-0045 §4, `rch-d-security-disclosure`).** This spec describes a logging
> control. It is committed on `feat/lb-access-log-redaction` and is not pushed or merged to the
> public meta repo until landing 1 below has deployed. Specifics are in the owner-held private
> record (base-03c).

## Goal

No server log in kaleem records a credential. Two rules, one per side of the request:

1. **Links carry credentials in the URL fragment.** Email links that hold a single-use
   credential (email verification, password reset, child activation) put it after `#`, which
   browsers never send to a server, never put in `Referer`, and no proxy can log. The dashboard
   reads it from the fragment, POSTs it to the API in the request body as today, and removes it
   from the address bar.
2. **Access logs record paths, never query strings.** Every access log kaleem writes (nginx in
   the dashboard and marketing images, gunicorn in the API) records method, path, status, size
   and duration only: no query string, no `Referer`, no other header. Paths under the two
   credential-carrying allauth prefixes ISSUES.md names are redacted, in gunicorn's access and
   error logs and in Django's `django.request` log, as defence in depth.

This gives dashboard and marketing the path-level logging ISSUES.md asks for (Traefik keeps
`RequestPath` dropped) and closes both ISSUES.md access-log entries. Recorded as an ADR,
"access-log policy" (number allocated by the conductor).

## User flow

1. A user clicks a verification, reset or child-activation link from an email. The page opens
   exactly as today. The credential leaves the address bar as soon as the page has read it, so a
   reload, bookmark or screenshot no longer carries it.
2. **Links sent before the switch** (query-string form) keep working: the dashboard reads the
   fragment first and falls back to the query string, and strips either. The fallback is removed
   later, once every pre-switch link has expired (follow-up, see Out of scope).
3. Error cases are unchanged: a missing, invalid or expired credential shows the existing
   "verification failed" / "invalid or expired link" states.

## Personal data (ADR-0023)

- **What:** access-log lines hold a timestamp, method, path, status, response size and duration.
  Paths can hold numeric object ids (for example a child profile id). No query string, client
  address, user agent, referrer or cookie is logged by nginx or gunicorn. (Behind Traefik both
  would only see Traefik's address anyway; client-address handling is `rch-sec-client-ip-trust`.)
- **Why:** debugging and incident response.
- **How long:** the life of the container. Each deploy recreates the dashboard, marketing and
  Django containers, which discards their logs; any log collector's retention is set by the
  monitoring units.
- **Who sees it:** operators with Docker access on the host.

The change removes personal data from logs (credentials, email addresses in query strings); it
adds none. Nothing is stored in the database.

## Data model delta

None. No migration.

## API delta

None. `POST /api/v1/identity/verify-email/` and `POST /api/v1/identity/password/reset/confirm/`
already take the credential in the body. Only the **email link format** changes:

| Link | Before | After |
| --- | --- | --- |
| Email verification | `{FRONTEND_URL}/verify-email?key=…` | `{FRONTEND_URL}/verify-email#key=…` |
| Password reset, child activation | `{FRONTEND_URL}/reset-password?uid=…&token=…` | `{FRONTEND_URL}/reset-password#uid=…&token=…` |

**Expand/contract and blue-green.** The link format is a contract between the backend and the
dashboard bundle, and `ship.sh` starts the new Django colour before it switches the frontends.
So the unit lands in two releases:

- **Landing 1 (expand):** the dashboard accepts both forms; nginx, gunicorn and Django logging
  change; the CI checks land. The backend still sends query-string links.
- **Landing 2 (switch):** the backend sends fragment links. Only after landing 1 has deployed.

No cookie or schema change; both colours serve both bundles throughout.

## Frontend

- Routes `/verify-email` and `/reset-password` (public, all roles): each reads its credential
  from the URL fragment, falling back to the query string; holds it in component state; then
  replaces the URL with the bare path (`replace`, no new history entry). The page components
  (`VerifyEmailPage`, `ResetPasswordPage`) keep their props and states unchanged.
- A small pure helper parses the fragment/query pair; a hook captures once and strips. Under
  React StrictMode the verify POST still fires exactly once with the key, and stripping the URL
  never flips the page into its error state.
- No copy, layout, locale or token change. RTL and a11y unaffected.
- `dashboard/nginx.conf` and `marketing/nginx.conf`: a path-only `log_format` (the path taken from
  `$request_uri` before `?`, not `$uri`, which `try_files` rewrites to `/index.html`) and
  `access_log` set to it in the server block.

## Module boundaries

`identity` (link builders), `platform` (the logging helpers: path redaction, gunicorn logger
class, `django.request` filter). No cross-module call, no event, no import-linter change. The
gunicorn config file sits at the backend root and is loaded explicitly (`-c gunicorn.conf.py`)
by the Dockerfile `CMD` and both compose colours.

The backend test environment gains gunicorn (`requirements/local.txt` includes
`production.txt`), so the logger is tested through gunicorn's real `Logger`. This is a
requirements change (one dependency-changing unit at a time; the gate image is rebuilt).

## Out of scope

- Removing allauth's routes (`lb-allauth-surface-lockdown`, merges after this unit and inherits
  the fragment link builder for teacher set-password).
- Traefik's access log (stays as is: `RequestPath` dropped) and client-address fields
  (`rch-sec-client-ip-trust`).
- `Referrer-Policy` and other headers (`rch-security-headers`).
- Log shipping, rotation and retention settings (monitoring units).
- Removing the query-string fallback (contract step): a follow-up once every pre-switch link has
  expired (3 days after landing 2), tracked at close-out.
- The staging log purge itself is an owner action under `hg-vps-access`, after landing 1 deploys.

## Test plan

Backend (pytest, failing first):

- Path redaction: the two allauth credential prefixes are redacted to `<prefix>[redacted]`;
  other paths pass through unchanged; query strings are dropped from URIs.
- gunicorn: `gunicorn.conf.py` loaded through gunicorn's own `Config`, its logger's `access()`
  given a request whose query string, `Referer`, user agent and path all carry a probe value: the
  emitted line holds method, path, status and duration, and the probe appears nowhere. A
  credential-prefix path is logged redacted. A format that names `%(r)s`, `%(q)s`, `%(f)s` or a
  header atom still cannot emit the probe. The error log's "Error handling request" line is
  redacted too.
- `django.request`: a `Not Found` record for a credential-prefix path reaches handlers redacted.
- Link builders: verification, reset and child-activation emails carry `#key=` /
  `#uid=…&token=…` and no `?key=` / `?uid=`; the uid/token parsed from the fragment pass
  `confirm_password_reset`.

Dashboard (vitest): fragment read; query fallback; fragment wins over query; URL stripped after
capture with no history entry added; StrictMode fires one verify POST with the key; after the
strip the page does not flip to its error state; missing credential still shows the error state.

CI log check (new, meta `.github/scripts`): runs `nginx:alpine` with each repo's `nginx.conf` and
its built output, sends probe requests (credential query strings, a probe `Referer`, a missing
asset), and asserts the probe is absent from the container's entire output while the path is
present. A self-test runs the checker against a default-format config and requires it to fail.

e2e (Playwright, `identity.spec.ts`): verify-email via fragment (asserts the POST body carries the
key and the URL no longer does); the existing query-string verify flow kept as the fallback flow
with the same body assertion; reset-password via fragment with a bogus token reaching the invalid
state (body asserted). Budget: about 5 s added. Not covered: a real inbox link end to end (CI has
no mail-catcher, ISSUES.md).

Staging (after landing 1): agent probe requests with a unique marker; owner confirms on the VPS
the marker is absent from the dashboard, marketing and Django logs and the path is present, then
purges older copies (`hg-vps-access`).

## Open questions

None. Decisions cited: `rch-d-security-disclosure`, `dec-spec-approval`, `dec-floor-ownership`.
Owner gate: `hg-vps-access` (staging log check and purge).
