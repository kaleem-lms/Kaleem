---
spec: docs/superpowers/specs/2026-10-18-lb-access-log-redaction-design.md
status: approved
---

> **Publication hold (ADR-0045 §4).** Not pushed or merged to the public meta repo until
> landing 1 has deployed.

Bases: backend `origin/main` f2b86d2, dashboard 9d21e01, marketing 2efb535, infra 962c8b5, meta
master d62b772. Worktrees `kaleem-worktrees/<repo>-lb-access-log-redaction`, branch
`feat/lb-access-log-redaction` in every repo (runbook section 1). Gates only through
`_tools/*.sh` (runbook section 2). Floors are not touched (`dec-floor-ownership`).

Each code step: write the test, run it red, write the code, run it green, then mutation-check
(revert the code, see red, restore) and record it in the hand-back block.

## Landing 1 (expand): logging + dashboard accepts both link forms

1. [ ] **Backend: path redaction helpers.** Test first,
   `kaleem/platform/tests/test_access_log.py`:
   - `test_redact_path_masks_credential_prefixes`, parametrized:
     `/accounts/confirm-email/PROBE/` → `/accounts/confirm-email/[redacted]`,
     `/accounts/password/reset/key/1-PROBE/` → `/accounts/password/reset/key/[redacted]`;
     `/api/v1/identity/me/` unchanged.
   - `test_redact_uri_drops_query`: `/x?token=PROBE` → `/x`; a credential path with a query is
     both truncated and masked.
   Code: `kaleem/platform/access_log.py` with `CREDENTIAL_PATH_PREFIXES`, `redact_path`,
   `redact_uri`.
2. [ ] **Backend: test env gets gunicorn.** `requirements/local.txt`: `-r base.txt` →
   `-r production.txt`. `_tools/backend-gate.sh` exits 3 (new requirements hash): hand to the
   conductor to build `kaleem-gate:<hash>` (runbook section 7) before step 3. Declare
   "dependency change" in the hand-back; the owner's dev image needs a rebuild.
3. [ ] **Backend: gunicorn logger + config.** Tests in `test_access_log.py` and
   `tests/test_gunicorn_config.py`:
   - `test_config_file_loads`: `runpy.run_path("gunicorn.conf.py")` values set on a fresh
     `gunicorn.config.Config`; `accesslog == "-"`; `logger_class` resolves to
     `RedactingLogger`; `access_log_format` names none of `%(r)s %(q)s %(f)s %(a)s %(h)s` or a
     `{…}i` atom.
   - `test_access_line_has_path_not_probe`: the configured logger's `access(resp, req, environ,
     timedelta)` with `QUERY_STRING`, `HTTP_REFERER`, `HTTP_USER_AGENT` and `RAW_URI` carrying
     `PROBE`, captured from `access_log`: line contains `GET /verify-email 200`, no `PROBE`.
   - `test_access_line_redacts_credential_path`: `PATH_INFO=/accounts/confirm-email/PROBE/`.
   - `test_atoms_are_safe_under_any_format`: with `access_log_format` set to gunicorn's default
     (`%(r)s`, `%(f)s`, `%(a)s`, `{referer}i`), still no `PROBE`.
   - `test_error_log_redacts_uri`: `logger.exception("Error handling request %s",
     "/x?token=PROBE")` emits no `PROBE`.
   Code: `RedactingLogger(gunicorn.glogging.Logger)` in `access_log.py`: `atoms()` rewrites
   `U` (redacted), `r` (`m U H`), blanks `q`, `f`, `a`, `h`, drops every `{…}i/o/e` key;
   `setup()` adds a filter applying `redact_uri` to string args on `error_log`. New
   `backend/gunicorn.conf.py`: `accesslog = "-"`, `access_log_format = '%(t)s "%(m)s %(U)s"
   %(s)s %(b)s %(M)sms'`, `logger_class = "kaleem.platform.access_log.RedactingLogger"`.
   `Dockerfile` production `CMD` gains `-c gunicorn.conf.py`.
4. [ ] **Backend: `django.request` filter.** Test
   `test_django_request_not_found_is_redacted`: `logging.getLogger("django.request").warning(
   "Not Found: %s", "/accounts/confirm-email/PROBE/")` under `caplog`: no `PROBE` in
   `caplog.text`. Code: `RedactCredentialPaths(logging.Filter)` in `access_log.py`; LOGGING gains
   `filters` and `loggers: {"django.request": {"filters": [...]}}` (level and propagation
   unchanged).
5. [ ] **Backend full gate** `_tools/backend-gate.sh <WT>` green (migrate, makemigrations
   --check, pytest with coverage, ruff, lint-imports).
6. [ ] **Infra: compose.** In `docker-compose.production.yml` both `django-blue` and
   `django-green`: `gunicorn -c gunicorn.conf.py config.wsgi --bind … --workers 3 --timeout 120
   --graceful-timeout 30` (`--access-logfile -` moves into the config). Replace the "NOT
   blanket-safe … not fixed here" comment with one line citing the ADR. No env var, no `ship.sh`
   change. Check: `docker compose -f docker-compose.production.yml config -q` with dummy env.
7. [ ] **Dashboard: credential capture.** Tests first:
   - `src/lib/url-credentials.test.ts`: `readUrlCredentials(["key"], {hash:"#key=a",
     search:""})` → `{key:"a"}`; query fallback; fragment wins; missing → `""`; URL-encoded
     values decoded.
   - `src/routes/verify-email.test.tsx` (route-level, memory history at
     `/verify-email#key=probe`, StrictMode): `identityApi.verifyEmail` called once with
     `"probe"`; router location afterwards has no hash and no search; history length unchanged;
     success state shown (no flip to error). Same with `?key=probe`.
   - `src/routes/reset-password.test.tsx`: `#uid=u&token=t` → submit posts `{uid:"u",
     token:"t", …}`; URL stripped; form state (not invalid) after the strip.
   Code: `src/lib/url-credentials.ts` (pure parser + `useUrlCredentials(names)` hook: capture in
   a `useState` initializer from `useLocation()`, then `navigate({ to: <path>, search: {}, hash:
   "", replace: true })` in an effect); both route components use it; `validateSearch` keeps
   accepting the legacy params.
8. [ ] **Dashboard + marketing: nginx path-only log.** In each `nginx.conf`, above `server`:
   `map $request_uri $kaleem_log_path { ~^(?<p>[^?]*) $p; }` and `log_format kaleem_path
   '$time_iso8601 "$request_method $kaleem_log_path" $status $body_bytes_sent
   $request_time';` Inside `server`: `access_log /dev/stdout kaleem_path;`. Verified by step 9's
   check, not by hand.
9. [ ] **Meta: CI log check.** New `.github/scripts/check-nginx-access-log.sh <nginx.conf>
   <docroot>`: runs `nginx:alpine` (pinned tag) with the conf as `conf.d/default.conf` and the
   docroot; curls `/verify-email?key=PROBE`, `/reset-password?uid=PROBE&token=PROBE`,
   `/verify-pending?email=PROBE%40example.com`, `/assets/missing.js?x=PROBE` with
   `Referer: https://app.example/reset-password?token=PROBE`; then `docker logs` (stdout and
   stderr): exit 1 if `PROBE` appears, exit 1 if `/verify-email` does not (positive control).
   `.github/scripts/test-check-nginx-access-log.sh` runs it against
   `.github/scripts/fixtures/nginx-default-log.conf` (no `access_log`, so the image default) and
   requires exit 1. `ci.yml`: steps after Build in `dashboard-build` (`dist/`) and
   `marketing-build` (`dist/`), self-test once in `dashboard-build`. Mutation check: run the
   checker against `origin/main`'s `dashboard/nginx.conf`, see exit 1.
10. [ ] **e2e** (`dashboard/e2e/identity.spec.ts`):
    - new "verify-email reads the key from the fragment": `waitForRequest` on POST
      `identity/verify-email/` with `postDataJSON().key === "not-a-real-fragment-key"`, alert visible,
      `expect(page).not.toHaveURL(/probe/)`.
    - existing flow (line 75, `?key=`) kept as the fallback flow, with the same body assertion.
    - new "reset-password reads uid and token from the fragment": goto
      `/reset-password#uid=MQ&token=e2e-probe`, fill and submit, body asserted, invalid state
      shown, URL stripped.
    Mutation check: revert step 7's route change; the two fragment flows go red.
11. [ ] **ADR "access-log policy"** (number from the conductor): credentials only in fragments
    or request bodies, never in a URL a server sees; access logs record method, path, status,
    size, duration and nothing else; credential prefixes redacted as defence in depth; each
    surface proven in CI; Traefik's `RequestPath` stays dropped. Supersedes the compensating-
    control comments in `traefik.yml` (left in place; the compose comment is replaced in step 6).
12. [ ] **Hand-back, landing 1:** dashboard full gate (`_tools/dashboard-gate.sh <WT>`),
    marketing `pnpm check && pnpm build`, gitleaks range per repo, hand-back blocks.
    Needs: dependency change (backend requirements), no env var, no `ship.sh` change.

## Landing 2 (switch): fragment links. Only after landing 1 has deployed.

13. [ ] **Backend: link builders.** Tests first (update, do not add duplicates):
    - `kaleem/identity/tests/test_adapter.py:23` → `/verify-email#key=…`.
    - `test_email_branding.py:63,78` → `"/verify-email#key="` and assert `"?key="` absent.
    - `test_password_management.py:113`, `test_services.py:122` → `"/reset-password#uid="`;
      parse `uid`/`token` from the fragment and pass them to `confirm_password_reset`.
    - `test_services.py:187` (a `not in` check): change to `"/reset-password#uid="` **and**
      `"/reset-password?uid="`, else it passes vacuously after the switch.
    Code: `adapter.py:28`, `services.py:191` and `:410`: `?` → `#`.
14. [ ] **Hand-back, landing 2:** backend full gate, gitleaks range.

## Gates

Backend `_tools/backend-gate.sh` (full) per landing; dashboard `_tools/dashboard-gate.sh`
(full, heavy slot); marketing check + build; `gitleaks-range.sh` per repo; CI is the authority
for e2e and the nginx check.

## Migrations

None.

## Risks

- **Gate image / dependency serialization.** Step 2 changes `requirements/local.txt`. The
  conductor allocates the backend dependency slot and rebuilds the gate image; if another unit
  holds the slot, land the dependency change first or wait.
- **TanStack Router and the hash.** If `useLocation().hash` is not populated on first render for
  a direct load, read `window.location` in the hook instead (test both through memory history
  and the e2e flows). The strip must not add a history entry (asserted).
- **nginx `map` regex capture.** Named captures in `map` need nginx ≥ 1.11; `nginx:alpine` is
  far newer. If the error log echoes a request line with a query (step 9 would go red), set
  `log_not_found off;` or raise `error_log` to `crit` for that server.
- **Two landings in one unit.** If landing 2 merged before landing 1 deployed, a link clicked
  during the blue-green window would hit a bundle that ignores the fragment ("verification
  failed"; the user re-requests). The conductor holds landing 2 until landing 1's deploy succeeds.
- **`lb-allauth-surface-lockdown` merges after.** Its teacher set-password test parses uid/token
  from the link body; at its freshness merge it must parse the fragment form. Its spec already
  says it takes whatever builder this unit leaves on `main`.
- **Owner gate.** The staging log check and purge need `hg-vps-access`; the unit's close-out
  waits for them, not the merges.

## Verification

- Each step: red, green, mutation-checked (recorded per hand-back).
- CI: backend-test (gunicorn logger tests), dashboard-build and marketing-build (nginx check +
  self-test), e2e (three identity flows) all green on each landing.
- Staging after landing 1, agent: click-through of `/verify-email` and `/reset-password` with
  bogus fragment credentials in both themes, Arabic RTL and 320 px (`dec-d9-substitute`), plus
  probe requests carrying a unique marker in query, `Referer` and fragment to the dashboard,
  marketing and API hosts. Owner (`hg-vps-access`): marker absent from `docker logs` of
  dashboard, marketing and the live Django colour, `/verify-email` present; then the purge from
  the private record.
- Staging after landing 2: a real verification or reset email (owner inbox session) lands with
  `#` and the URL is stripped after load.
- Close-out: ADR merged, both ISSUES.md access-log entries removed, CLAUDE.md D3 identity row
  updated (fragment flows), follow-up for removing the query fallback recorded, journal line.
