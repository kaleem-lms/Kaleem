# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- ~~Frontend deploy gap~~ — RESOLVED 2026-06-13 (ADR-0019, frontend-delivery-pipeline).
  Dashboard + marketing now build to GHCR nginx images and deploy behind Traefik on
  `app-staging`/`staging`; backend moved to `api-staging`. Deployed green to staging.
- Two throwaway smoke-test users linger in the staging DB (`stg.smoke@example.com`,
  `ses.smoke@example.com`). Clear via Django admin or on the next staging DB reset.
- Production env not wired yet (staging only). Prod hosts (`app.`/`api.`/apex+`www`),
  `www` redirect, and a prod VPS are deferred per ADR-0019 — needed before public launch.
- Submodule git-flow vs ADR-0014: submodules have no `dev` branch (they merge `feat→main`);
  only meta has `develop`. Either grow a `dev` layer in submodules or amend ADR-0014 to
  match the two-tier reality. Needs an ADR.

## Soon (next month or two)

- Deploy assumes a fresh DB. `migrate` orders `identity` (the custom `AUTH_USER_MODEL`)
  before `account` (allauth); any environment whose `account` migrations were applied
  before `identity` existed hits `InconsistentMigrationHistory` and the deploy aborts.
  Bit us once on staging (2026-06-10, fixed by recreating the DB). Production's first
  deploy must start from an empty DB, or include a documented repair step.
- ~~Dev email goes nowhere useful~~ — RESOLVED 2026-06-13. `config.settings.local` now
  sends to mailpit's SMTP (`mailpit:1025`); verification links are visible at
  `http://localhost:8025`.
- Email security alerts dispatch via `send_email_message.delay(...)` *inside*
  `@transaction.atomic` (`identity.services.add_email_address` / `set_primary_email`). In
  prod the worker can pick the task up before commit. The clean fix is
  `transaction.on_commit(...)`, but that breaks pytest-django's non-committing test
  transactions (the outbox assertions). Decide deliberately (e.g. `on_commit` +
  `django_capture_on_commit_callbacks` in the tests). Low harm today — the alert only
  fires after all validation passes.
- `identity.services._send_email_security_alert` selects the message body with an `else`
  fallback, so an unknown `action` string silently uses the "primary changed" wording.
  Only `"added"`/`"set_primary"` are passed today; harden to an explicit `elif` + raise
  if a third caller appears.
- New `/me/emails/` endpoints' `@extend_schema` documents success responses only, not the
  400/404 error shapes. Doc-only; worth a sweep across the identity module's schemas.
- Dashboard app-shell mobile drawer (`features/shell/AppShell.tsx`) sets `aria-modal="true"`
  and moves/restores focus + closes on Escape, but does NOT trap Tab — focus can leave the
  open drawer into the (hidden) background. Real-world impact is low (only the topbar is
  behind it); add a focus trap or mark background `inert` when open. Note: `inert` would
  break the current drawer-landmark-count test, which relies on jsdom keeping both navs
  queryable — adjust that test if adding `inert`.
- Dashboard shell CSS padding convention drift: `UserMenu` uses logical `ps-/pe-`,
  `AppSidebar` uses symmetric `px-` (both RTL-safe). Pick one (prefer logical `ps-/pe-`)
  and unify across `features/shell/*`.
- Dashboard topbar brand wordmark is a plain `<span>`, not a `<Link to="/">` home link
  (matches the auth-layout's current span). A clickable logo is conventional; make both a
  link in one pass when convenient.

## Someday / Won't fix

(empty)
