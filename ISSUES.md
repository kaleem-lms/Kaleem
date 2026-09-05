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

- **`semgrep`, `trivy` and `pnpm audit` still do not run anywhere.** ADR-0030 wired in
  `gitleaks` + `pip-audit` (blocking) and Lighthouse (nightly), so the OWASP-Top-10 SAST
  pass, the container-image CVE scan, and the JS dependency audit are what remains of the
  original "nothing scans anything" entry. Each needs its own triage budget — a SAST tool
  adopted with 200 findings gets muted within a week.
- **Submodule git *histories* are unscanned for secrets.** The `security` job scans the
  meta history plus the checked-out tree (submodules included); a secret committed and
  then removed inside `backend`/`dashboard`/`marketing` is caught only by that repo's
  pre-commit hook, on a machine that has pre-commit installed. (ADR-0030, stated gap.)
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
- **Throwaway users in the staging DB.** `stg.smoke@example.com`, `ses.smoke@example.com`,
  and `c0.subjects.check@example.com` (a child of `billing.clickthrough@`, created
  2026-09-05 while verifying C0 and left unverified — it cannot log in). Clear via
  Django admin or on the next staging DB reset.
- **The nightly dunning harness exercises `basil`-shaped webhook payloads, but production
  receives `dahlia`-shaped ones.** `stripe listen` forwards events at the Stripe
  **account default** API version and cannot be told to forward at an arbitrary pin — it
  offers only the account default or `--latest`. This account's default is
  `2025-06-30.basil` (verified 2026-09-04 off three live events), while the production
  webhook endpoint `we_1UBdRwCavwnriKDQ2ygx6z2V` is pinned to `2026-08-26.dahlia`. Both
  shapes parse today, because `_subscription_period_end` and `_invoice_subscription_id`
  carry basil-vs-legacy fallbacks written for exactly this. But it means the harness does
  **not** prove the payload shape production actually meets: it proves the dunning state
  machine against the older shape. Closing this means upgrading the Stripe account's
  default API version to match the pin — a change to shared config that also affects
  staging billing, so it needs a deliberate decision and its own runbook step, not a
  drive-by. Phase B's dunning gate is closed regardless — the state machine is genuinely
  exercised end to end. What remains is narrower: the harness proves that machine against
  the older payload shape, so a `dahlia`-only regression in the parsers would not be
  caught here before real users.

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
- **`TeacherProfile.availability` is a dead JSONField that duplicates
  `scheduling.WeeklyAvailability`** and violates rule #3 (no role-specific data as JSON blobs
  on a profile). Nothing reads it — availability has lived in `scheduling` since that module
  shipped. Delete it with a migration; check first that no admin screen or fixture writes it.
  (Spotted 2026-09-04 while specing Phase C0; not fixed in passing, D10.)
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

### Phase C1 (matching) — deferred findings

Logged 2026-09-05 from C1's task reviews and its final whole-branch review. None blocks the
phase; each was reviewed and consciously deferred rather than missed.

**Worth doing sooner than the rest:**

- **The accept race's lock is unproven by any test.** `accept_offer` takes `select_for_update`
  and re-checks eligibility inside the transaction, but both race tests run sequentially inside
  pytest-django's per-test transaction — they exercise the status guard and the partial-unique
  index, not the lock. Deleting `select_for_update()` would turn nothing red. Proving it needs a
  `TransactionTestCase` with two threads.
- **`/account` overflows horizontally in Arabic** — `scrollWidth` 1162 vs `innerWidth` 1018
  (144px); clean at 1003/1018 in English. Traced to the "Preferred teacher gender" radio group's
  visually-hidden inputs using a physical `left:-159px` instead of a logical inset. This is a
  WCAG 1.4.10 Reflow (AA) failure on a page C1 adds a card to. Belongs to identity/curriculum.
- **N+1 in the teacher inbox.** `list_offers_for` calls `_student_preference`, `get_user` and
  `overlap_minutes` per candidate row, and `overlap_minutes` → `to_utc_intervals` →
  `get_availability` re-queries *the teacher's own availability on every row*. Fine at 3 open
  requests, not at 300. Hoist the teacher's intervals; batch the student reads.
- **`is_eligible` and `list_offers_for` assemble the same three filters separately.** They agree
  today, and no test asserts that they do. A fourth hard filter (OQ-C1-1's capacity cap is the
  named candidate) added to only one of them is silently exploitable in one direction or
  silently broken in the other. Extract the predicate over pre-fetched context.

**The rest:**

- **Withdrawing a subject interest never closes the open match request.** Nothing writes
  `MatchRequest.Status.CANCELLED`, yet the enum member exists and `MyMatchRequestsView`
  `.exclude()`s it as though something did. A student who un-ticks Quran stays broadcast for it.
  Ruled out of C1 scope (the spec's cancellation story is OQ-C1-2: staff act in Django admin).
- **A rematched student can see "Your teacher:" with a blank name.** After staff end an
  assignment, the old `MATCHED` request survives while the name is joined only from *ACTIVE*
  assignments.
- **The `unique_active_assignment` backstop would surface as a 500,** not the 409 the same
  situation produces one line earlier in `accept_offer`.
- **A teacher who declined an offer can still accept it** by posting the id — "declined" is a
  visibility fact, not a domain rule, and nothing says so.
- **`_today()` uses `timezone.localdate()`,** correct only because `TIME_ZONE` is `"UTC"`; the
  overlap engine is UTC-instant-based and does not consult Django's zone.
- **`MatchOfferAcceptView` rebuilds the assignment projection by hand** rather than reusing
  `list_assignments_for`'s shape — a second place to keep in sync.
- **The reconciler's per-read cost grows with students who never subscribe** — an unentitled
  student's pair is never taken and never open, so it costs a `get_user` + `is_entitled_to` on
  every inbox and `/account` load, forever.
- **Zod schemas in the dashboard are defined but never `.parse()`d** anywhere — a repo-wide
  pattern, so the runtime-validation value of using zod is currently unrealised.
- **`SubjectsCard`'s whole-card loading gate exists partly for the e2e harness's benefit**, and
  introduces a layout shift (loading and empty both render nothing, then the card appears).
  `dirtyRef` also never clears on a net-zero edit.
- **Arabic copy wants a native-speaker pass** — `نحن نبحث لك عن معلم` is grammatical but less
  idiomatic than `نحن نبحث عن معلم لك`.
- **Pre-existing pytest warnings**: 7 in `scheduling`, 155 backend-wide. Test output should be
  pristine.

### Lighthouse findings on staging (nightly, `lighthouse.yml`)

Measured 2026-09-04 by the first run (ADR-0030). The floors in `.lighthouserc.json` sit
just below these, so none of them is red today — each is what stops a category reaching
100.

- **Marketing SEO should now measure higher than its floor.** The home page's missing
  `<meta name="description">` is fixed (marketing #5), so the next nightly re-measures
  SEO on `staging.kaleem.academy`. Raise the `.lighthouserc.json` SEO floor to the new
  measured value once it has run — a ratchet left below the real number stops ratcheting.
- **Marketing has no type-check in CI**, so `interface Props` in its Astro components
  enforces nothing: `astro build` does not type-check and `marketing-build` runs only the
  build. Measured 2026-09-04 — deleting a required prop built clean. `Layout.astro`'s
  `description` guard is therefore a runtime throw, which is a workaround for the missing
  check, not a substitute for it. Add `astro check` to the job and the throw can go.
- **`app-staging` login page: colour contrast fails** (a11y 96). Same root cause as the
  `@kaleem/tokens` contrast entry under "Blocks launch" — fix there, not here.
- **`app-staging`: browser errors logged to the console, and `robots.txt` is invalid**
  (best-practices 78, SEO 82). The dashboard has no `robots.txt` at all, which for an
  authenticated app is arguably fine but currently reads as a failure rather than a
  decision.
- **Both sites: `deprecations` fails** (best-practices). Neither the source of the
  deprecated API nor whether it is ours or a dependency's has been checked yet — read
  the uploaded report.
- **`app-staging`: missing source maps for large first-party JS.** Deliberate or not, it
  has never been decided; it also makes Sentry stack traces unreadable.

### Stripe dunning harness (nightly, `stripe-clock.yml`)

Surfaced by the final review of the harness on 2026-09-04. None affects what the harness
proves; all are robustness of an unattended job.

- **`process.stdout.readline()` in the CLI readiness scan blocks unboundedly.** The deadline
  is only checked between lines, so a `stripe listen` that emits nothing hangs until the
  30-minute job cap — losing the named 60s diagnostic *and* skipping the `finally`, which
  leaks the test clock. A reader thread or non-blocking pipe would fix it.
- **No stale-clock sweep.** Any hard kill (the above, or the job timeout) skips both
  `finally` blocks and leaks a clock plus its customer with no signal. A "delete clocks named
  `kaleem-dunning-harness`" step at job start would make the leak self-healing.
- **The delivery probe asserts only `StripeEventLog.count() > before`.** `stripe listen`
  forwards *all* account events and the account is shared with staging, so a concurrent
  staging event could satisfy it. Delivery and signature verification are still genuinely
  proven; the assertion is just looser than it reads.
- **The Stripe API key is passed on argv** (`stripe listen --api-key …`), so it is visible in
  the runner's process table. `STRIPE_API_KEY` in the environment would be tighter. Log
  exposure is already covered — GitHub masks the secret.

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
- **`.gitleaksignore` is not empty, and must not be emptied.** The credentials it
  fingerprints were rotated 2026-09-05, but rotation makes a credential *dead*, not
  *absent* — the strings are still in git history, so deleting the lines makes gitleaks
  report them again and turns CI red on every branch. ADR-0030 said to remove a line once
  rotated; **ADR-0032 amends that**. The file is a rotation record now. Only a history
  rewrite could empty it legitimately, and that is rejected.

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
