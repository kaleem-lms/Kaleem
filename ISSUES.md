# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- **Topbar `LocaleToggle` + `UserMenu` trigger are 40px (`size="sm"`), under the 44px
  best-practice touch target.** The UI a11y-polish pass (dashboard PR #17) bumped the
  default Button/Input and icon buttons to 44px but deliberately kept `sm` compact
  (40px) for dense, pointer-first use. These two live in the mobile topbar, so they're
  touchable below 44px — passes WCAG 2.2 AA's 24px floor, not the 44px ideal. Bump them
  to the default size if mis-taps surface. (Surfaced 2026-06-25, UI/UX audit.)
  _Update 2026-06-26: the related mobile horizontal-overflow caused by the wide
  user-name button is fixed (name hides below `sm`); the 40px height itself still stands._

- **Promote the dashboard token overrides into `@kaleem/tokens`.** Several token values now
  live in the dashboard's own `@theme`/cascade (`src/index.css`), not the shared package,
  because `@kaleem/tokens` is consumed as a pinned git tag baked into `node_modules`
  (`github:…#v0.1.1`) — changing it needs publish → re-pin → reinstall → Docker rebuild, which
  would also break live HMR verification. On the next tokens release, move these into the
  package's `:root`/`.dark` and have the dashboard consume them:
  - layout: content-width scale (`--container-page/narrow/wide`) + `--text-display` (layout-system pass).
  - color/elevation: dark `--primary`/`--primary-foreground` (deeper green so the filled CTA
    dominates), lifted light `--shadow-sm`, and neutral dark `--shadow-sm/md/lg` (styling pass).
  (Surfaced 2026-06-26, dashboard layout-system + styling passes — Deviation.)

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
- **`develop → master` is squash-merged → perpetual divergence (ADR candidate).** Every
  promotion squashes, so develop and master never share history (after #90: master 1-ahead,
  develop 60-ahead). Consequence: each promotion needs a manual `git merge origin/master`
  into develop to reconcile submodule pointers, and a squash once silently dropped a
  pointer-bump commit (#85 → fixed by #87). Switch develop→master to **merge commits** (no
  squash) or flatten the two-tier flow. ALSO: `deploy-staging` `needs:` all checks, so a red
  required check makes the deploy **silently skip** — looks "merged" but ships nothing (bit us
  on #88). Add a deploy gate / status so a skipped deploy is visible. (Surfaced 2026-06-19.)
- **CI does not enforce the D3 test/coverage gate for the dashboard.** `.github/workflows/ci.yml`
  runs only `tsc --noEmit` + `pnpm build` for the dashboard — it never runs `pnpm test`
  (vitest) or a coverage check, and biome isn't run either. Backend `pytest --cov` runs but
  has no `--cov-fail-under`, so 100% line+branch (D3, ADR-0021) is reported, not enforced, in
  any repo. Wire vitest + a coverage floor into CI so the gate is real. (Surfaced 2026-06-19.)
- No Playwright e2e harness in the dashboard yet; D3/D9 e2e is currently met by a manual
  browser click-through. Stand up Playwright as its own slice so flows like verify-email +
  the login gate run in CI. (Surfaced 2026-06-19.)
- Pre-existing `mypy` error: `kaleem/platform/drf.py:28` — the conditional
  `{field: [exc.message]} if field else {"detail": exc.message}` trips `[dict-item]`
  (`str: str` vs expected `list[str]`). Annotate the result `dict[str, Any]`. Harmless at
  runtime and NOT in CI (ci.yml runs no mypy), but `mypy kaleem` is red locally. (Surfaced 2026-06-19.)

## Soon (next month or two)

- **Scheduling-availability follow-ups (deferred from the final review, 2026-06-26).** All
  non-blocking; the feature shipped (backend `scheduling` module + dashboard editor).
  (1) `/availability` route component has no in-component `teacher` profile gate — nav hides
  it for non-teachers and the API 403s a profile-less user, but a parent deep-linking lands on
  the editor then hits a backend 403 with no graceful empty-state; add a route-level gate +
  friendly empty-state. (2) `parseApiError` lives in `dashboard/src/features/identity/api.ts`;
  promote it to a shared `src/lib` so other features (scheduling, future) don't cross-import
  identity. (3) The dashboard still sends `time_preferences: []` in the child-create/preferences
  payload though the backend dropped that field (backend ignores unknown keys — harmless);
  tidy in a future identity slice. (4) `TimezoneBar` picker has no Escape-to-close and its
  listbox `aria-label` reuses the search label; minor a11y polish. (5) `WeeklyAvailability.weekday`
  is only service-validated (0..6), not DB-constrained — a raw ORM insert >6 would `IndexError`
  in `__str__`; add a `CheckConstraint` if direct inserts ever happen. (6) `WeeklyAvailabilityEditor`
  pill React key collides on two identical ranges in one day (cosmetic warning; backend merges them
  on save anyway). (7) **tz-awareness is partial:** availability is stored/edited in the owner's
  timezone and `to_utc_intervals` converts for a reference week, but DST exactness + multi-tz-per-user
  are out of scope (documented in the spec) — revisit when the matching feature lands.
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
- **GDPR operational follow-ups (deferred from ADR-0023, due before public launch):** a
  data-retention policy + a DSAR/right-to-erasure flow (export + delete a user's data), a
  cookie/consent decision for the marketing site, and a Records-of-Processing (RoPA) doc.
  ADR-0023 fixes the by-design engineering rule + the email leaks; these are the heavier
  operational obligations. (Surfaced 2026-06-19.)
- allauth's `account_already_exists_message.txt` / `unknown_account_message.txt` /
  `email_changed_message.txt` still echo an email address in the body (ADR-0023 violation).
  Currently unreachable — `RegisterView` raises `ValidationError` for duplicates rather than
  triggering allauth's email, and we don't use allauth's native signup/change flows — but
  **override these before enabling any allauth-native signup or social-auth path** (e.g. v2).
  (Surfaced 2026-06-19 in the email-privacy-cleanup review.)
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
- **Children can't actually log in yet.** `identity.create_child` makes a User with a
  placeholder email (`child.<uuid>@placeholder.kaleem`) and an unusable password; the
  parent can set a password (UI shipped in Spec 3, the `/family` page), but the child has
  no externally known login identity, so the end-to-end child sign-in flow doesn't exist.
  Needs its own spec (how a child authenticates: real email, parent-managed handle, magic
  link, etc.). Surfaced by the children+invites UI (2026-06-18).
- Dashboard `features/identity/schemas.ts` now has two near-identical child shapes:
  `ChildSummary` (the `/me`-embedded `{id, full_name, student_profile_id}`) and `Child`
  (the `/children/` list shape, adds `teacher_gender_preference`). Harmless (both are real
  backend shapes) but a candidate to unify once the child surface settles. (D10 note from
  Spec 3.)
- Dashboard `InviteCard` copy button calls `navigator.clipboard.writeText(...)` with no
  `.catch` — a clipboard rejection (permissions) would be an unhandled promise rejection.
  Low impact (authenticated same-origin dashboard); add a catch + neutral message when
  convenient. (D10 note from Spec 3.)
- A parent cannot edit an existing **child's** learning preferences (time slots /
  teacher gender) — they are only set at child creation (`POST children/`). The
  student-preferences UI (Spec 4) edits the *caller's own* profile. A parent-edits-child
  surface needs its own endpoint + UI. (Out-of-scope note from Spec 4.)
- Dashboard `StudentPreferencesCard` per-row validation message is a sibling
  `<p role="alert">`, not `aria-describedby`-linked to the offending time input (and the
  time inputs carry no `aria-invalid`). `role="alert"` announces it on appearance (WCAG-
  acceptable, jest-axe passes), but a SR user navigating fields later won't hear which
  input is invalid. Wire `aria-invalid`/`aria-describedby` on the row's `end_time` Input
  when set. Also: the "required times" message anchors on `end_time` even when
  `start_time` is the empty one (cosmetic). (D10 notes from Spec 4.)
- Dashboard `StudentPreferencesCard` hand-rolls a `SELECT_CLASS` string replicating the
  shadcn `Input` classes (no Select primitive exists in `@/ui`). When a `Select` primitive
  is added, replace the duplicated class string. (D10 note from Spec 4.)
- Dashboard `verify-email.tsx` `started` ref is effectively "confirm once per **mount**",
  not "once per **key**" as the comment says — it's set true and never reset, so an in-place
  `verifyKey` change would skip confirming the new key. Latent only (the route remounts
  rather than re-keys). Tighten the comment or reset on key change. (D10 note, email-verify slice.)
- Dashboard `verify-email.tsx` route now passes `onVerified={() => {}}` (no-op); the prop is
  retained for the spec'd component signature but is vestigial in the only production caller.
  Drop it or wire it when the post-verify UX firms up. (D10 note, email-verify slice.)
- Dashboard **zod validation messages are not i18n'd** — they render English regardless of
  locale (e.g. `registerSchema` birthdate refine "Enter a valid birthdate.", plus the default
  zod messages on every form: full_name/email/password). zod runs outside React so `t()` can't
  be called in the schema. Breaks ar parity for validation copy (ADR-0020). Fix repo-wide via a
  locale-aware resolver wrapper or per-field `setError` translation. (Surfaced 2026-06-19, registration-polish review.)
- **No security-alert email on password change/reset.** `add_email`/`set_primary_email` send a
  security alert (ADR-0023), but `change_password` and `confirm_password_reset` do not — a
  silent takeover via password change/reset won't notify the account owner. Out of scope for the
  password-management slice; add a "changed/reset" alert (reuse `_send_email_security_alert`
  with a new action) as a follow-up. (Surfaced 2026-06-19, password-management review.)

## Someday / Won't fix

(empty)
