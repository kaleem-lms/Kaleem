---
spec: docs/superpowers/specs/2026-10-26-lb-prod-env-parametrization-design.md
status: draft
---

Four repos, one branch name, `feat/lb-prod-env-parametrization`: backend, dashboard, infra
(worktrees per runbook section 1) and meta (`meta-lb-prod-env-parametrization`). No migration, no
dependency change, no floor edit. Mutation-check every regression test: revert the fix, see red,
restore it.

## Steps

### Backend (`backend-lb-prod-env-parametrization`)

1. [ ] **Tests first**, in a new file `tests/settings/test_cookie_names_and_hosts.py`. Follow
   `test_cookie_domain.py`'s `importlib` + `sys.modules.pop` pattern with its required env.
   - `test_production_cookie_names_come_from_env`: the names set to `kaleem_sessionid` /
     `kaleem_csrftoken` land in `SESSION_COOKIE_NAME` / `CSRF_COOKIE_NAME`.
   - `test_production_refuses_to_start_without` is parametrized over
     `DJANGO_SESSION_COOKIE_NAME`, `DJANGO_CSRF_COOKIE_NAME`, `DJANGO_COOKIE_DOMAIN`,
     `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`. With the variable deleted, the import
     raises `ImproperlyConfigured`.
   - `test_base_defaults_are_djangos`: `config.settings.base` with neither set gives
     `sessionid` / `csrftoken`.
   - Red: names are not read today, and the three host variables have defaults.
2. [ ] `config/settings/base.py`: `SESSION_COOKIE_NAME = env("DJANGO_SESSION_COOKIE_NAME",
   default="sessionid")`, and the same for CSRF. `config/settings/production.py`: re-read both
   with no default. Drop the defaults on `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and
   `DJANGO_COOKIE_DOMAIN`. If django-environ accepts an empty string for a required var, add an
   explicit non-empty guard that names the variable and never the value, and parametrize the
   test over `""` too. Green. Mutation: restore one default and see its case go red.
3. [ ] **Test first**, `tests/settings/test_check_deploy.py`. It runs
   `[sys.executable, "manage.py", "check", "--deploy", "--tag", "security", "--fail-level",
   "WARNING"]` in a subprocess with `DJANGO_SETTINGS_MODULE=config.settings.production` and a
   minimal explicit env, with no inherited `DJANGO_*`. The env holds
   `secrets.token_urlsafe(60)`, the five variables above and the existing required ones.
   - Assert rc 0.
   - Negative control: `DJANGO_SECRET_KEY=short` gives rc ≠ 0 with `security.W009` in the
     output.
   - Red today on `security.W021` (measured 2026-10-26 on the gate image `cf945cb74b51`: the
     only security-tagged finding).
4. [ ] `production.py`: `SILENCED_SYSTEM_CHECKS = ["security.W021"]` with the one-line reason
   from the spec. Green. Mutation: remove the silence and see red.
5. [ ] Full backend gate: `"${R}/_tools/backend-gate.sh" "${WT}"`. Commit
   `feat(settings): per-environment cookie names, required hosts, check --deploy`.

### Dashboard (`dashboard-lb-prod-env-parametrization`)

6. [ ] **Test first**, `src/lib/api.test.ts`. Use `vi.resetModules()` plus a dynamic import per
   case, setting `globalThis.__KALEEM_CONFIG__` and stubbing `import.meta.env` with
   `vi.stubEnv`.
   - Runtime `apiUrl` beats `VITE_API_URL`.
   - Runtime `csrfCookieName` reaches `api.defaults.xsrfCookieName`.
   - With no runtime config, the name is `csrftoken` and the base is `VITE_API_URL`.
   - An empty-string `apiUrl` falls through (`||`, not `??`).
   - `PROD` true with no base at all throws.
   - Red: none of these hold today.
7. [ ] `src/lib/api.ts`: read `globalThis.__KALEEM_CONFIG__` and implement the resolution order.
   Declare the global's type. Keep the existing plain-Node comment accurate. Green, then
   mutation-check the runtime-over-VITE case.
8. [ ] **Test first**, `docker/test-runtime-config.sh` (POSIX sh, table-driven like
   `infra/scripts/test-deploy-lib.sh`). Cases from the spec's test plan:
   - Exact output for valid values.
   - Each refusal leaves a pre-existing `env.js` byte-identical.
   - A last case, skipped with a printed notice when `docker` is absent: `nginx:alpine` (the
     image read from the Dockerfile's production stage) with the script mounted executable in
     `/docker-entrypoint.d/` and no variables. Assert the container is not running after 10 s,
     with a non-zero exit code.
9. [ ] `docker/40-kaleem-runtime-config.sh`: validate with `case`/`grep -E` against the spec's
   two patterns, write to a temp file in the same directory, then `mv` over `env.js`. The output
   directory is `KALEEM_RUNTIME_DIR` (default `/usr/share/nginx/html`), so the test can aim it at
   a temp dir. Green.
10. [ ] `public/env.js` (`window.__KALEEM_CONFIG__ = {};`) and the `<script src="/env.js">` tag
    in `index.html`, placed before the theme script. Vite will warn that a classic script cannot
    be bundled; that warning is expected. If any build check fails on it, stop and escalate
    rather than suppressing the check.
11. [ ] `Dockerfile` production stage: `COPY --chmod=0755 docker/40-kaleem-runtime-config.sh
    /docker-entrypoint.d/`. Delete `ARG VITE_API_URL` / `ENV VITE_API_URL`. Update
    `CLAUDE.md`'s "API URL from `VITE_API_URL`" line to describe the runtime config.
12. [ ] `e2e/call-diagnostics.spec.ts:80`: read the cookie name from
    `process.env.DJANGO_CSRF_COOKIE_NAME ?? "csrftoken"`.
13. [ ] Full dashboard gate: `"${R}/_tools/dashboard-gate.sh" "${WT}"`. Commit
    `feat(dashboard): runtime API base and CSRF cookie name`.

### Infra (`infra-lb-prod-env-parametrization`)

14. [ ] **Test first**, in `scripts/test-deploy-lib.sh`: cases for a new `deploy_check
    <container>` in `deploy-lib.sh`. With the stub docker returning 0, it passes and records
    `exec <container> python manage.py check --deploy --tag security --fail-level WARNING`.
    With the stub returning 1, it fails and prints `check --deploy failed`. Red, then implement.
15. [ ] `ship.sh` step 6c: call `deploy_check "$CONTAINER"` after 6b. On failure, take the same
    rollback as 6b (stop and remove the new trio, `restore_signaling`, `exit 1`).
16. [ ] `docker-compose.production.yml`:
    - Give `dashboard` its two `environment:` entries (spec E).
    - Give `traefik` a `command:` list carrying every setting from `traefik/traefik.yml`
      one-for-one: api dashboard/insecure; entrypoints `web` with the websecure redirect and
      `websecure`, both with 30 s grace; the docker provider endpoint with `exposedByDefault`
      false; the ACME resolver from `${ACME_EMAIL:?ACME_EMAIL is required}`, with storage and
      http challenge; json logs at INFO; the json access log with `RequestPath=drop`.
    - Move the RequestPath comment over with it. Remove the mount and the dead
      `environment: ACME_EMAIL`.
    - Delete `traefik/traefik.yml`.
17. [ ] `.env.production.example`: the spec's additions. Add `# production:` values for the
    host variables: `api.kaleem.academy`, `app.kaleem.academy`, `kaleem.academy`,
    `ws.kaleem.academy`, `flower.kaleem.academy`, and the `https://app.kaleem.academy` origins.
    The production TURN host is left to lb-turn-prod-hardening.
18. [ ] Run `bash scripts/test-deploy-lib.sh` and `shellcheck` on the changed scripts. Commit
    `feat(infra): ACME contact and dashboard config from env, check --deploy in ship.sh`.

### Meta (`meta-lb-prod-env-parametrization`)

19. [ ] **Test first**, `.github/scripts/test-check-traefik-static-config.sh` and
    `check-traefik-static-config.sh <compose-file>`.
    - The checker resolves the compose file with dummy `:?` values, the way
      `check-shipsh-services.sh` does, and an `ACME_EMAIL=probe@example.invalid`.
    - It runs the compose's traefik image with that command plus `--log.level=DEBUG`, with
      `--network none` for 8 s, and parses the static-configuration JSON.
    - It asserts: the email equals the probe; `accessLog.fields.names.RequestPath == "drop"`;
      the web→websecure redirect; `exposedByDefault == false`. It fails if Traefik logs a
      flag-decode error or prints no static configuration.
    - If a duplicated `--log.level` does not take the last value, rewrite the INFO flag instead.
      This is unverified, so check it first.
    - Self-test fixtures: one without the drop flag, one with a misspelled flag, one without
      the email. Each must fail.
20. [ ] `ci.yml`:
    - (a) Remove `--build-arg VITE_API_URL=…` from the scan build (≈l.846) and the deploy build
      (≈l.1189).
    - (b) Remove `traefik/traefik.yml` from the deploy sync `tar` list.
    - (c) Run the Traefik checker and its self-test in "The deploy pipeline's scripts and
      service lists" step.
    - (d) Run `dashboard/docker/test-runtime-config.sh` in the dashboard-build job.
    - (e) e2e job: add `DJANGO_SESSION_COOKIE_NAME: kaleem_sessionid` and
      `DJANGO_CSRF_COOKIE_NAME: kaleem_csrftoken` to the job env, and drop `VITE_API_URL` from
      the build step. The serve step mounts `dist` read-write and
      `docker/40-kaleem-runtime-config.sh` into `/docker-entrypoint.d/`, and passes
      `KALEEM_API_URL=http://api.kaleem.localhost:8000/api/v1/` and
      `KALEEM_CSRF_COOKIE_NAME=kaleem_csrftoken`. Echo `docker exec dash cat
      /usr/share/nginx/html/env.js` into the log.
21. [ ] Docs:
    - `docs/adr/0019-…` gets an "Amendment 2026-10-26" section (no new number): per-environment
      cookie names, runtime dashboard config, one image for every environment.
    - Point ADR-0009's cookie-name line at it.
    - Change the `traefik/traefik.yml` references in ADR-0053 l.20, `docs/runbook/signaling.md`
      l.297 and `docs/runbook/deploy.md` l.18 to "the traefik service's `command:`".
    - `deploy.md`: the new variables, step 6c and the `/env.js` check.
    - `CLAUDE.md` l.187: "the configured base (`VITE_API_URL` in dev, the runtime
      `KALEEM_API_URL` in images)". The ADR-0019 amendment covers this edit.
22. [ ] Gitleaks over each repo's range (runbook section 3), then hand back. The "needs" line
    reads: `env vars DJANGO_SESSION_COOKIE_NAME, DJANGO_CSRF_COOKIE_NAME, ACME_EMAIL
    (hg-vps-env); infra/ship.sh + compose (hg-shipsh-review, pre-approved: summarise both in
    the PR body)`. Add row 5 to `_ops/programme/setup-and-deployment-checklist.md`: the
    production values of these variables, for lb-prod-secrets-accounts.

### Conductor, before the merge (sub-agents cannot ssh)

```bash
# Prints names and counts only, never values.
ssh kaleem 'cd /opt/kaleem && for v in DJANGO_COOKIE_DOMAIN CORS_ALLOWED_ORIGINS CSRF_TRUSTED_ORIGINS ACME_EMAIL DJANGO_SESSION_COOKIE_NAME DJANGO_CSRF_COOKIE_NAME; do printf "%s=%s\n" "$v" "$(grep -c "^${v}=." .env.production)"; done'
ssh kaleem 'cd /opt/kaleem && printf "%s\n" DJANGO_SESSION_COOKIE_NAME=sessionid DJANGO_CSRF_COOKIE_NAME=csrftoken >> .env.production'
# ACME_EMAIL is the owner's value, piped over stdin:
#   printf 'ACME_EMAIL=%s\n' "<owner value>" | ssh kaleem 'cat >> /opt/kaleem/.env.production'
# The live security check before the change; expect only security.W021, and escalate on anything else:
ssh kaleem 'cd /opt/kaleem && docker exec "kaleem-django-$(cat .active-color)-1" python manage.py check --deploy --tag security --fail-level WARNING 2>&1 | grep -o "security\.[EW][0-9]*" | sort -u'
```

## Risks

- **A misspelled Traefik flag takes all of staging offline** (Traefik refuses to start). Step
  19's checker runs the exact resolved command in CI before merge. Rollback: revert the meta
  merge and redeploy.
- **The live `check --deploy` finds something on staging** (for example W009), and step 6c then
  blocks every deploy. The conductor's pre-merge run finds it first. Anything besides W021
  escalates to the owner rather than being silenced.
- **The entrypoint hook is silently skipped** when not executable (nginx logs "Ignoring" and
  continues). `COPY --chmod=0755`, and the e2e job builds with no `VITE_API_URL`, so a skipped
  hook fails every flow. A production build with no base also throws.
- **A malformed dashboard value crash-loops the container**, and `ship.sh` does not gate static
  frontends. The values are derived from validated variables. The post-deploy `curl /env.js` is
  the check. Gating is out of scope.
- **The Traefik recreate is a seconds-long routing gap**, and a new ACME account if the address
  changed. Accepted, and stated in the PR body.
- **The Lighthouse floor:** one extra same-origin, no-cache request before the bundle on the
  login page. If the nightly run drops below a floor, escalate (never lower it).
- **`ci.yml` is shared with lb-deploy-pipeline-hardening and others.** Merge `origin/master`
  into the meta branch right before hand-back.

## Verification

- Per step: the named test is red before and green after, and its mutation check is recorded in
  the hand-back block.
- Whole unit:
  - Backend and dashboard full gates rc 0, `test-deploy-lib.sh` green, the new meta checkers and
    self-tests green.
  - CI green, with the e2e log showing `env.js` carrying `kaleem_csrftoken` and every existing
    flow passing.
  - After deploy, staging `curl -s https://app-staging.kaleem.academy/env.js` shows `api-staging`
    and `csrftoken`, and the deploy log shows step 6c passed.
  - The D9 click-through on staging: login, one mutation, logout, both themes, RTL, 320 px.
- e2e: no new flow (the programme entry). The existing suite runs on the runtime path with
  production's cookie names, which is the unit's end-to-end proof.
