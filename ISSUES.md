# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

**Triaged by consequence, not by date.** Three buckets, and nothing else:

- **Blocks launch** — must be fixed before real users and real money. Read this section
  before planning any phase.
- **Blocks a phase close** — stops the current or next phase reaching D9.
- **Someday** — real, small, unbounded in time. Polish, D10 notes, deferred niceties.

Resolved entries are **deleted**, not struck through — git remembers them. Last triage:
2026-09-03 (removed 11 entries that were already fixed or stale).

---

## Blocks launch

- **Production environment does not exist.** Staging only. Prod hosts (`app.` / `api.` /
  apex + `www`), the `www` redirect, and a prod VPS are all deferred per ADR-0019.
- **First production deploy must start from an empty DB.** `migrate` orders `identity`
  (the custom `AUTH_USER_MODEL`) before `account` (allauth); any environment whose
  `account` migrations were applied first hits `InconsistentMigrationHistory` and the
  deploy aborts. This bit staging once (2026-06-10, fixed by recreating the DB). Either
  start prod empty or write the documented repair step first.
- **`develop → master` is squash-merged, so the branches never share history** — and
  `deploy-staging` `needs:` every check, which means a red required check makes the deploy
  **silently skip**: the PR looks merged but nothing shipped. That bit us on #88, and a
  squash once silently dropped a pointer-bump commit (#85, fixed by #87). Every promotion
  now needs a manual `git merge origin/master` into develop to reconcile submodule
  pointers. Fix: merge commits (no squash) for `develop → master`, plus a deploy gate or
  status so a skipped deploy is visible. **Needs an ADR.**
- **GDPR operational obligations.** ADR-0023 fixed the by-design engineering rule and the
  email leaks; these are the heavier operational duties, all still missing: a data-retention
  policy, a DSAR / right-to-erasure flow (export + delete a user's data), a cookie/consent
  decision for the marketing site, and a Records-of-Processing (RoPA) document.
- **No security-alert email on password change or reset.** `add_email` / `set_primary_email`
  send one (ADR-0023); `change_password` and `confirm_password_reset` do not — so a silent
  account takeover via password change never notifies the owner. Reuse
  `_send_email_security_alert` with a new action.
- **allauth templates still echo an email address in the body** —
  `account_already_exists_message.txt`, `unknown_account_message.txt`,
  `email_changed_message.txt` (ADR-0023 violation). Currently unreachable: `RegisterView`
  raises `ValidationError` for duplicates and we do not use allauth's native signup/change
  flows. **Override these before enabling any allauth-native signup or social-auth path.**
- **AA contrast failures live only as dashboard-local overrides; the shared
  `@kaleem/tokens` package still ships the failing values.** Anything else consuming the
  package (marketing) inherits them. See the token-promotion entry under "Blocks a phase
  close" for the full list — promote the package, don't just keep the overrides.
- **Two throwaway smoke-test users in the staging DB** (`stg.smoke@example.com`,
  `ses.smoke@example.com`). Clear via Django admin or on the next staging DB reset.

## Blocks a phase close

- **No Playwright harness exists in any repo**, so ADR-0021's e2e requirement is unmet
  repo-wide and D9's e2e clause is formally suspended (ADR-0026, `CLAUDE.md` D3). Standing
  one up is its own D1 slice. Note the hosted-Stripe redirect can never run in Playwright —
  card → checkout → webhook stays a manual staging test (`docs/runbook/stripe-billing.md`
  §5) even after the harness lands.
- **A fresh subscription has no renewal date until the nightly reconciler runs (up to ~24h).**
  Found in the 2026-09-03 staging click-through, reproducible and timestamped:
  `invoice.paid` arrived 80ms **before** `checkout.session.completed`, so no `Subscription`
  row existed yet, the event was dropped with an `unknown_subscription` incident — and it was
  the only event carrying the period end. A Checkout Session payload has no
  `current_period_end` and no `items`, so the row is created with `current_period_end=None`.
  The UI therefore shows "Active" with no renewal date. Only `reconcile_subscriptions`
  (nightly) fixes it, via the SDK path where `items[0].current_period_end` exists — the
  `reconciled_drift` incidents for users 5 and 7 are exactly this. Not money-wrong, but a
  visible defect in the primary flow, and it means the authoritative period end is discarded.
  Fix candidates: have `checkout.session.completed` / `settle` read the period end off the
  subscription via the SDK, or re-drive dropped `unknown_subscription` invoice events once the
  row appears. **Verified 2026-09-03.**

- **`invoice.paid` does not pass `keep_canceled=True` to `_apply_to_existing`**
  (`billing/services.py:565`), unlike the `async_payment_succeeded` (`:483`) and
  `customer.subscription.updated` (`:537`) arms. A late `invoice.paid` that survives the
  out-of-order timestamp guard (no `created`, or equal timestamps) can resurrect a solo
  `canceled` row to `active` — the one-live-subscription constraint only fires when a
  second live row already exists. Same class as the `updated` case that B2 fixed; extend
  the floor to the invoice arms. **Verified still open 2026-09-03.**
- **The Stripe webhook endpoint is pinned to `2025-06-30.basil`; the backend SDK pins
  `2026-07-29.dahlia`.** Runbook §3 says to keep them equal. Stripe does **not** allow changing
  `api_version` on an existing endpoint — it is create-only — so fixing this means creating a
  fresh endpoint, which issues a NEW signing secret: `DJANGO_STRIPE_WEBHOOK_SECRET` must be
  rotated on the VPS and the stack restarted, with a brief window where deliveries still hit
  the old endpoint. Deferred deliberately 2026-09-03 (owner decision) because the parser
  tolerates both shapes and the 2026-09-03 click-through passed on basil. Do it before
  production. Re-check it whenever the `stripe` pin moves.

- **The `scheduling` import-linter contract does not forbid `kaleem.identity.models`** —
  the same hole billing closed in B2. A direct model import there would pass CI today (D4).
- **`WebhookEvent.stripe_customer_id` is parsed but never consumed.** A subscription created
  directly in the Stripe dashboard (no checkout, no metadata) is invisible to us and its
  events are logged `unknown_subscription` and dropped. B2's nightly reconciler covers the
  drift case, but the customer-id path is still dead code — either wire it or delete it.
- **The spec requires `display_amount`/`currency` "validated against the Stripe Price on
  save"; there is no `clean()` or admin validation.** The runbook says keep them in lockstep
  by hand. Either implement the validation or amend the spec — right now the spec is wrong.
- **Promote the dashboard token overrides into `@kaleem/tokens`.** These values live in the
  dashboard's own `@theme`/cascade (`src/index.css`) rather than the shared package, because
  the package is consumed as a pinned git tag baked into `node_modules`
  (`github:…#v0.1.1`) — changing it needs publish → re-pin → reinstall → Docker rebuild,
  which also breaks live HMR verification. On the next tokens release:
  - *layout:* content-width scale (`--container-page/narrow/wide`) + `--text-display`.
  - *color/elevation:* dark `--primary` / `--primary-foreground` (deeper green so the filled
    CTA dominates), lifted light `--shadow-sm`, neutral dark `--shadow-sm/md/lg`.
  - *contrast (AA gaps):* light `--muted-foreground` `#62736C`→`#55655F` (secondary text on
    `bg-muted` pills was 4.14:1 on `#EFE9DB`); `--input` light `#E0D9C8`→`#968B71` and dark
    `#2A3A34`→`#5E766C` (field-boundary affordance was ~1.4:1, WCAG 1.4.11 wants 3:1 —
    `--border` card hairlines are exempt); dark `--success-foreground` `#07302A`→`#052621`
    (label was exactly on the 4.5:1 line).
- **Dashboard zod validation messages are not i18n'd** — they render English regardless of
  locale (`registerSchema`'s birthdate refine, plus zod's defaults on every form). zod runs
  outside React so `t()` cannot be called in the schema. Breaks ar parity for validation copy
  (ADR-0020). Fix repo-wide via a locale-aware resolver wrapper or per-field `setError`.
- **Submodule git-flow does not match ADR-0014.** Submodules have no `dev` branch (they merge
  `feat → main`); only meta has `develop`. Either grow a `dev` layer in the submodules or
  amend ADR-0014 to match the two-tier reality. **Needs an ADR.**
- `test_checkout_completed_for_a_valid_plan_but_an_unknown_user_is_ignored` would still pass
  if the explicit `get_user` existence check were deleted — the `IntegrityError` savepoint
  handler masks the resulting FK violation. Add a `caplog` assertion on `reason=unknown_user`
  to pin the intended path.
- The `canceled`-but-paid-through mirror of the documented `past_due` divergence: such a row
  is entitled, yet `get_current_subscription` returns `None`, so the UI reads "no
  subscription" while the user can still book, and an overlapping purchase is permitted
  during the paid-through window. Only the `past_due` direction is documented.
- `/billing` nav shows for every student; a linked child gets a server-side typed 403 at
  checkout rather than a hidden nav entry. Refine once `/me` exposes whether a student has
  a parent.
- A parent cannot edit an existing **child's** learning preferences (time slots / teacher
  gender) — they are only set at child creation (`POST children/`). Needs its own endpoint
  and UI.
- Plan/Price creation is manual in Stripe; no programmatic sync (B1 scope).
- Dunning UX beyond mirroring `past_due` (retry/notice flow) is deferred.

## Someday

### Backend

- Email security alerts dispatch via `send_email_message.delay(...)` *inside*
  `@transaction.atomic` (`identity.services.add_email_address` / `set_primary_email`). In
  prod the worker can pick the task up before commit. The clean fix is
  `transaction.on_commit(...)`, but that breaks pytest-django's non-committing test
  transactions. Decide deliberately (e.g. `on_commit` + `django_capture_on_commit_callbacks`).
  Low harm today — the alert only fires after all validation passes.
- `identity.services._send_email_security_alert` picks the body with an `else` fallback, so
  an unknown `action` silently uses the "primary changed" wording. Only `"added"` /
  `"set_primary"` are passed today; harden to an explicit `elif` + raise.
- `/me/emails/` `@extend_schema` documents success responses only, not the 400/404 shapes.
  Worth a sweep across the identity module.
- `billing.services.get_current_subscription` lacks `select_related("plan")`, costing one
  extra query when serializing `current` (the history query already does it).
- `WeeklyAvailability.weekday` is only service-validated (0..6), not DB-constrained — a raw
  ORM insert > 6 would `IndexError` in `__str__`. Add a `CheckConstraint` if direct inserts
  ever happen.
- **tz-awareness is partial:** availability is stored/edited in the owner's timezone and
  `to_utc_intervals` converts for a reference week, but DST exactness and multi-tz-per-user
  are out of scope (documented in the spec). Revisit when the matching feature lands.

### Dashboard

- `/availability` has no in-component teacher gate — nav hides it and the API 403s, but a
  parent deep-linking lands on the editor then hits a bare 403. Add a route-level gate +
  friendly empty state.
- `parseApiError` lives in `features/identity/api.ts`; promote it to `src/lib` so other
  features don't cross-import identity.
- The child-create/preferences payload still sends `time_preferences: []` though the backend
  dropped the field (unknown keys are ignored — harmless).
- `TimezoneBar` picker has no Escape-to-close, and its listbox `aria-label` reuses the search
  label.
- `WeeklyAvailabilityEditor` pill React key collides on two identical ranges in one day
  (cosmetic; the backend merges them on save).
- App-shell mobile drawer sets `aria-modal="true"` and moves/restores focus + closes on
  Escape, but does **not** trap Tab. Low impact (only the topbar is behind it). Note `inert`
  would break the drawer-landmark-count test, which relies on jsdom keeping both navs
  queryable.
- Shell CSS padding drift: `UserMenu` uses logical `ps-/pe-`, `AppSidebar` uses symmetric
  `px-` (both RTL-safe). Unify on logical.
- Topbar brand wordmark is a plain `<span>`, not a `<Link to="/">`. Make it and the
  auth-layout span links in one pass.
- `features/identity/schemas.ts` has two near-identical child shapes — `ChildSummary` (the
  `/me`-embedded one) and `Child` (the `/children/` list shape). Unify once the child surface
  settles.
- `InviteCard`'s copy button calls `navigator.clipboard.writeText(...)` with no `.catch` — a
  permissions rejection is an unhandled promise rejection.
- `StudentPreferencesCard`: the per-row validation message is a sibling `<p role="alert">`,
  not `aria-describedby`-linked to the offending input, and the time inputs carry no
  `aria-invalid`. Also the "required times" message anchors on `end_time` even when
  `start_time` is the empty one. And it hand-rolls a `SELECT_CLASS` string replicating the
  shadcn `Input` classes — replace when a `Select` primitive lands in `@/ui`.
- `verify-email.tsx`: the `started` ref is "confirm once per **mount**", not "once per
  **key**" as its comment claims; and the route passes a vestigial `onVerified={() => {}}`.
- `?checkout=cancelled` never clears from the URL (only the success path calls `onSettled`),
  so a refresh after an abandoned checkout re-shows the banner.
- Dead i18n keys after the billing promotion: `billing.subscribed`,
  `modules.billing.{title,description}`.
- Arabic `_few`/`_many`/`_other` plural categories for the plan-session copy are verified via
  `Intl.PluralRules` but only the dual (`_two`) has a rendered test.
- `SubscriptionCard`'s history list includes the current subscription as its first row and is
  hidden entirely for a lapsed user; `useDateFormatter` builds a fresh `Intl.DateTimeFormat`
  per call.
- The cancel dialog's `bg-black/40` overlay is a non-token colour, carried over from
  `RemoveEmailDialog`. Fix both call sites in a token audit.

---

## Known-good gotchas (not bugs — read before panicking)

- **Dashboard tests look catastrophically broken under memory pressure.** During the billing
  build, agents running full suites plus throwaway Postgres containers concurrently saw ~55
  failures across 16 files, all `localStorage`/`window` undefined in jsdom 29
  (`src/ui/toggles.test.tsx` and others) — the jsdom environment failing to initialise, not a
  code defect. Re-verified twice on a clean tree: green. If it reappears on a loaded CI runner
  or a busy dev box, suspect resources (or cap `poolOptions.threads.maxThreads`) before
  suspecting the tests.
- `requirements/base.txt` pins `stripe>=15.5,<16.0` and the Stripe API version default is read
  off the installed SDK. The upper bound is load-bearing: without it a routine `pip` upgrade
  silently changes the pinned inbound webhook shape. When you raise it, re-check the webhook
  endpoint's pinned API version in the Stripe dashboard (runbook §3).
