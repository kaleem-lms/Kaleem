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

- **No automated security or performance scanning runs anywhere.** `semgrep`, `gitleaks`
  (as a CLI), `pip-audit`, `trivy` and `lhci` are all absent, so every `/handoff` gate has
  been satisfied by "review manually" and no OWASP-Top-10 pass, dependency-CVE scan, or
  Core-Web-Vitals budget has ever actually executed. Same shape as the coverage and e2e
  gates before ADR-0026/0027: a documented check that does not run. `backend`'s pre-commit
  does run a gitleaks hook, so committed secrets have *some* cover; nothing else does.
  Wire at least `pip-audit` + `gitleaks` into CI, and Lighthouse against staging, before
  real users. (Surfaced 2026-09-04 during handoff.)
- **Production environment does not exist.** Staging only. Prod hosts (`app.` / `api.` /
  apex + `www`), the `www` redirect, and a prod VPS are all deferred per ADR-0019.
- **First production deploy must start from an empty DB.** `migrate` orders `identity`
  (the custom `AUTH_USER_MODEL`) before `account` (allauth); any environment whose
  `account` migrations were applied first hits `InconsistentMigrationHistory` and the
  deploy aborts. This bit staging once (2026-06-10, fixed by recreating the DB). Either
  start prod empty or write the documented repair step first.
- **`deploy-staging` `needs:` every check, so a red required check makes the deploy
  *silently skip*** — the PR looks merged but nothing shipped. That bit us on #88. Add a
  deploy gate or status so a skipped deploy is visible rather than looking like success.
  (The squash-divergence half of this entry is **resolved** by ADR-0028: no `develop`, and
  merge commits for anything carrying submodule pointers.)
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

- **e2e now covers every shipped user-facing area; what remains is listed below.** The
  2026-09-04 conversion took the suite from 6 flows to 20 — availability, family, account
  and email, and the app shell all have specs, and the `CLAUDE.md` D3 table names them.
  Still uncovered, each for a stated reason: **change-password** (would rotate the shared
  seed password mid-suite — needs its own throwaway account, a small slice), the
  inbox-dependent flows below, and billing. A table that claims less than reality is
  harmless; one that claims more is how the gate stayed fictional for three months.
- **Flows the harness structurally cannot reach without more infrastructure:** anything
  needing a real inbox — registration, password reset, child activation — because CI has no
  mail-catcher wired in. That is its own slice (a mailpit service plus a way to read the
  link). Note this is *not* the same as the billing exclusion below, which is permanent.
- **The `past_due` / dunning path has never been exercised end to end.** A *declined card at
  checkout* is verified (2026-09-03: `4000 0000 0000 0341` → 0 subscriptions, not entitled,
  no incidents — correct). But `past_due` arises from a **renewal** failing on an already
  active subscription, which cannot be reached by clicking: it needs Stripe **test clocks**
  to advance the billing cycle. Since `past_due` keeps full access by design (OQ-B2-1) and
  `unpaid` is where access stops, the transition nobody has ever observed is the one that
  actually removes entitlement. Worth a test-clock harness before launch.

  **Scoped precisely 2026-09-04 while closing the billing specs**, because "past_due is
  untested" overstates it. *Covered by tests at the provider seam:*
  `invoice.payment_failed → past_due`; `past_due` entitled; `unpaid` not; child inherits
  `past_due` but not `unpaid`; an `unpaid` row blocks a second checkout. *Covered
  manually:* a declined card **at checkout**. *Covered by nothing:* that real Stripe's
  renewal failure emits those events, in the shape we parse, on an already-`active`
  subscription. So the gap is the wiring between real Stripe and well-covered handlers —
  narrower than an untested state machine, but still the only path to `unpaid`. **This is
  now the sole gate on closing Phase B, and it needs a spec (D1).**

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
- **App-shell mobile drawer does not restore focus when it closes.** Measured in a real
  browser on 2026-09-04 while writing `e2e/shell.spec.ts`: after Escape, focus is on
  `<body>`, so a keyboard user is dropped at the top of the document every time they
  dismiss the menu (WCAG 2.4.3, and ADR-0020 makes AA a repo-wide baseline). Cause: the
  drawer is opened from `AppShell` state rather than a `Dialog.Trigger`, so Radix has no
  trigger to restore to. Fix is either a `Dialog.Trigger` around the topbar's menu button —
  which reshapes `AppTopbar`'s `onOpenMenu` prop contract — or an `onCloseAutoFocus`
  handler focusing a ref. The e2e spec documents the gap in a comment rather than asserting
  it. (Supersedes the older "does not trap Tab" note: the Radix migration fixed the trap.)
- Two buttons on `/family` share the accessible name **"Add child"** — the disclosure that
  opens the form and the form's submit. A screen-reader user hears the same name for two
  different actions, and the e2e spec has to scope to the form to disambiguate. Rename the
  submit (`family.addChildSubmit`) to something distinct. Same shape worth checking on
  `account.addEmail` / `account.addEmailSubmit`, which happen to differ today.
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
- **The Stripe API version is now pinned explicitly, and it must stay that way.**
  `DJANGO_STRIPE_API_VERSION=2026-08-26.dahlia` is set on staging, and the webhook endpoint
  `we_1UBdRwCavwnriKDQ2ygx6z2V` was created at that same version (2026-09-03). Do the same in
  every new environment — **production included** — or the two sides drift.

  This is not theoretical. Watched live on 2026-09-03: the SDK's default moved from
  `2026-07-29.dahlia` to `2026-08-26.dahlia` **between two deploys on the same day**, because
  `requirements/base.txt` allows `stripe>=15.5,<16.0` and the rebuild picked up 15.6.1. Left
  to the SDK default, the inbound payload shape is a function of Stripe's release calendar
  and whenever you last rebuilt. The explicit env var is what stops that.

  Note `api_version` is **create-only** on a webhook endpoint — changing it means creating a
  new endpoint and rotating `DJANGO_STRIPE_WEBHOOK_SECRET`. Cheap to get right up front,
  annoying afterwards.
