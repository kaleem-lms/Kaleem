# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- ~~**Topbar `LocaleToggle` + `UserMenu` trigger are 40px (`size="sm"`), under the 44px
  best-practice touch target.**~~ RESOLVED 2026-06-26 (UI/UX audit re-check): all three
  topbar controls now meet 44px — `LocaleToggle` and the `UserMenu` trigger carry
  `className="h-11"` over `size="sm"`, and `ThemeToggle` is `size="icon"` (h-11 w-11).
  The related mobile horizontal-overflow (wide user-name button) was already fixed
  (name hides below `sm`). (Originally surfaced 2026-06-25.)

- **Promote the dashboard token overrides into `@kaleem/tokens`.** Several token values now
  live in the dashboard's own `@theme`/cascade (`src/index.css`), not the shared package,
  because `@kaleem/tokens` is consumed as a pinned git tag baked into `node_modules`
  (`github:…#v0.1.1`) — changing it needs publish → re-pin → reinstall → Docker rebuild, which
  would also break live HMR verification. On the next tokens release, move these into the
  package's `:root`/`.dark` and have the dashboard consume them:
  - layout: content-width scale (`--container-page/narrow/wide`) + `--text-display` (layout-system pass).
  - color/elevation: dark `--primary`/`--primary-foreground` (deeper green so the filled CTA
    dominates), lifted light `--shadow-sm`, and neutral dark `--shadow-sm/md/lg` (styling pass).
  - contrast (AA gaps, color/type audit): light `--muted-foreground` `#62736C`→`#55655F`
    (secondary text on `bg-muted` pills was 4.14:1 on `#EFE9DB`); `--input` light
    `#E0D9C8`→`#968B71` and dark `#2A3A34`→`#5E766C` (field-boundary affordance was ~1.4:1,
    WCAG 1.4.11 wants 3:1 — `--border` card hairlines left soft, they're exempt); dark
    `--success-foreground` `#07302A`→`#052621` (label was exactly on the 4.5:1 line). The
    package's own values still fail these — promote the package, don't just drop the overrides.
  (Surfaced 2026-06-26, dashboard layout-system + styling + color/type-contrast passes — Deviation.)

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
- ~~**Children can't actually log in yet.**~~ RESOLVED 2026-06-23 (child-verification, backend
  #27 + dashboard #16, deployed via meta #115). `create_child` now takes a **real
  parent-provided email** and sends an activation link (verification if the parent set a
  password, else a set-password link that also verifies); the parent manages
  email/password/preferences from `/family` with a Verified/Pending badge, and legacy
  placeholder children are migrated on first `set_child_email`. Children now have a real login
  identity and authenticate like adults. (Superseded the placeholder-email v1 design — see
  ADR-0024; `docs/architecture/identity.md` updated. Originally surfaced 2026-06-18.)
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

- Billing e2e gap: the hosted-Stripe redirect cannot run in Playwright; card → checkout →
  webhook is a manual staging test (`docs/runbook/stripe-billing.md`).
- The dashboard has **no Playwright harness at all**, so D3's end-to-end requirement is
  unmet repo-wide, not just for billing.
- **The dashboard has no coverage tooling installed** (`@vitest/coverage-v8` absent), so
  the 100% line+branch gate in CLAUDE.md/D3 cannot actually be measured for the
  dashboard. Reviewers substituted manual branch enumeration for the billing slice.
- **The dashboard test suite has ~55 failures across 16 files on `main`**, pre-existing
  and unrelated to billing: jsdom 29 leaves `localStorage` undefined
  (`src/ui/toggles.test.tsx` and others). This blocks D5 (green CI before merge) until
  fixed.
- `/billing` nav shows for every student; a linked child gets a server-side typed 403 at
  checkout rather than a hidden nav entry. Refine once `/me` exposes whether a student
  has a parent.
- Dunning UX beyond mirroring `past_due` (retry/notice flow) is deferred.
- Stripe billing portal / card-update UI deferred.
- Plan/Price creation is manual in Stripe; no programmatic sync (B1 scope).
- `billing.services.get_current_subscription` lacks `select_related("plan")`, costing
  one extra query when serializing `current` (the history query already does it).
- The cancel dialog's `bg-black/40` overlay is a non-token colour, carried over from
  `RemoveEmailDialog`; fix both call sites together in a token audit.

### From the billing final whole-branch reviews (2026-07-30)

- **The backend coverage gate is measured but not enforced.** CI now runs `--cov-branch`,
  but `--cov-fail-under=100` is deliberately omitted: the backend sits at **97%** from
  pre-existing gaps in `identity`/`platform` (billing itself is 100% line+branch). Owner
  decision 2026-07-30 — backfill those modules, then turn the gate on. Until then D3's
  "machine-enforced" claim in CLAUDE.md is aspirational for the backend too, not just
  the dashboard.
- `requirements/base.txt` pins `stripe>=11.0` with no upper bound, and the Stripe API
  version default is read off the installed SDK — so a routine `pip` upgrade can silently
  change the pinned inbound webhook shape unless the runbook's re-pin step is followed.
  Consider an upper bound or an explicit `DJANGO_STRIPE_API_VERSION` in every environment.
- `invoice.paid` does not pass `keep_canceled=True` to `_apply_to_existing`, unlike the
  `customer.subscription.updated` arm. A late `invoice.paid` that survives the
  out-of-order timestamp guard (no `created`, or equal timestamps) could resurrect a solo
  `canceled` row to `active` — the one-live-subscription constraint only fires when a
  second live row already exists. Same category as the fixed `updated` case; extend the
  floor to the invoice arms.
- `test_checkout_completed_for_a_valid_plan_but_an_unknown_user_is_ignored` would still
  pass if the explicit `get_user` existence check were deleted, because the new
  `IntegrityError` savepoint handler masks the resulting FK violation. Add a `caplog`
  assertion on `reason=unknown_user` to pin the intended path.
- `WebhookEvent.stripe_customer_id` is parsed but never consumed, so a subscription
  created directly in the Stripe dashboard (no checkout, no metadata) stays invisible to
  us permanently and its events are logged as `unknown_subscription` and dropped. All
  subscriptions must originate from `POST /checkout/` until reconciliation exists.
- `unpaid` and `incomplete` are absent from `LIVE_STATUSES`, so such a subscription
  vanishes from `GET me/subscription/` `current`, `cancel_subscription` 404s on it, and
  `create_checkout` will sell the user a second one — while Stripe may still consider the
  first live (end-of-dunning behaviour is account-configurable to `unpaid`).
- The `canceled`-but-paid-through mirror of the documented `past_due` divergence: such a
  row is entitled, yet `get_current_subscription` returns `None`, so the UI reads "no
  subscription" while the user can still book, and an overlapping purchase is permitted
  during the paid-through window. Only the `past_due` direction is documented.
- The spec requires `display_amount`/`currency` "validated against the Stripe Price on
  save"; there is no `clean()` or admin validation — the runbook says keep them in lockstep
  by hand. Either implement the validation or amend the spec.
- The `scheduling` import-linter contract has the same hole billing's just closed: it does
  not forbid `kaleem.identity.models`, so a direct model import there would pass CI.
- `?checkout=cancelled` never clears from the dashboard URL (only the success path calls
  `onSettled`), so a refresh after an abandoned checkout re-shows the banner. Cosmetic now
  that the plan list renders alongside it.
- Arabic `_few`/`_many`/`_other` plural categories for the plan-session copy are verified
  via `Intl.PluralRules` but only the dual (`_two`) is covered by a rendered test.
- Dashboard dead i18n keys after the billing promotion: `billing.subscribed` and
  `modules.billing.{title,description}` are now unreferenced.
- `SubscriptionCard`'s history list includes the current subscription as its first row and
  is hidden entirely for a lapsed user (the card only renders when `current` is non-null);
  `useDateFormatter` builds a fresh `Intl.DateTimeFormat` per call.

## Someday / Won't fix

(empty)
