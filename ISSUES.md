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

- **A deploy drops every live call (C3b).** `scripts/ship.sh` step 8 stops the old signaling
  container with `stop --timeout 30`; room membership is an in-process dict, so every call in
  progress dies with it — the 30s is a SIGTERM grace period, not a drain, and nothing waits for
  rooms to empty. The fix is a **real drain**: stop routing new joins to the old colour, wait for
  its rooms to empty, then stop it. That needs a join-routing switch which does not exist yet, so
  it is not to be attempted as a side change. Interim rule, in `docs/runbook/signaling.md`:
  **deploy between lessons.**

  *(The second half of this entry — the colour overlap splitting one room across two processes —
  was **fixed in C3c, then the fix itself caused a different bug** (`Room.signaling_url` pinned a
  room to a colour `ship.sh` later removed, making it permanently unjoinable — hit live on
  staging 2026-09-07). Both are now closed by ADR-0037: signaling is one shared, never-stopped
  replica, not one per colour, so there is no second process to split across and no colour for a
  pin to outlive. Implemented and unit-tested; **not yet verified by a live staging colour
  flip** — see the new entry below.)*

- **Traefik logs no request path for any route, and C3c did NOT make it safe to restore.**
  The token itself is fixed — since C3c it rides `Sec-WebSocket-Protocol`, not a query string.
  But the plan to then restore Traefik's dropped `RequestPath` field **does not survive contact
  with the URLconf and is withdrawn.** `config/urls.py` includes `allauth.urls`, which serves
  `/accounts/confirm-email/<key>/` and `/accounts/password/reset/key/<uidb36>-<key>/` — single-use
  **account-takeover** credentials in the **path**, not the query string. Removing the signaling
  token changed nothing about whether `RequestPath` is safe to log, and Traefik still has no
  per-router access-log config and no partial-field redaction.
  The remedy is therefore not a Traefik rollback: **give dashboard and marketing path-level
  logging from their own container access logs**, the same compensating control Django already
  has through gunicorn. Until that lands, those two surfaces have no path-level visibility at the
  gateway.

- **The gunicorn access log captures account-takeover credentials, and the compose comment
  claiming otherwise is wrong (C3b, spotted in C3c's final review).**
  `infra/docker-compose.production.yml`'s django-blue/django-green comment used to assert "safe
  to log in full: no capability token ever appears in an API URL." That is true of the video
  signaling token, but the entry directly above establishes the opposite for `allauth.urls`:
  `/accounts/confirm-email/<key>/` and the password-reset key are single-use account-takeover
  credentials carried **in the path**, and those requests go through Django, so
  `gunicorn --access-logfile -` records them in full. Pre-existing since C3b; C3c nominated that
  same compensating control as the model for dashboard and marketing to copy (the bullet above),
  which is what surfaced the contradiction. The compose comment has been corrected to say so; the
  underlying leak is not fixed here.

- **No `turns:` TLS listener, so a TLS-443-only egress filter still blocks the relay (C3c).**
  coturn listens on `3478` UDP and TCP only. Traefik owns 443 on the staging box, and a `turns:`
  listener on 5349 would need a certificate delivered to a container Traefik does not front, so
  C3c shipped without one (spec decision 3). Media is DTLS-SRTP end to end regardless and the
  credentials are ephemeral and single-user — what is missing is *reachability* for users behind
  a filter that permits only TLS on 443. Closing it needs a second IP or a dedicated TURN host.
- **The TURN DNS record publishes the origin IP (C3c).** `turn-staging.kaleem.academy` must be
  Cloudflare **DNS-only (grey cloud)** — Cloudflare cannot proxy UDP, and a proxied record breaks
  every allocation with no error a client can interpret. The consequence is that the origin IP,
  which the proxied records hide, is now published. Accepted for staging; revisit before
  production.
- **The coturn shared secret is visible in `docker inspect` and the host process list (C3c).**
  It is passed as `--static-auth-secret=` on coturn's command line because **coturn performs no
  variable expansion in its config file** — a `${VAR}` there is taken literally, which would have
  made the secret a publicly guessable constant and the relay an open proxy. The command-line
  form is the fix; the exposure is the accepted cost, and it sits inside an existing trust
  boundary (the same value is already in `.env.production` on that box, and docker socket access
  there is already root-equivalent). See `docs/runbook/turn.md`.
- **`pyproject.toml`'s `precision = 1` comment describes a rounding rule coverage.py does not
  appear to follow.** The comment says the fail-under check rounds the measured total to
  `precision` decimals before comparing it to `fail_under`. Measured empirically 2026-09-06: a
  total of 97.76%, which the report *displays* as `97.8%`, still failed a `fail_under = 97.8`
  gate. The backend floor therefore stayed at 97.7 through C3c rather than ratcheting. The
  comment will mislead the next person raising the floor — establish the real rule and rewrite it.

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

- **The inactive colour's WebSocket hostname has no TLS certificate (C3c) — smaller than first
  thought.** Traefik issues via Let's Encrypt's HTTP challenge when a router first appears, so
  while blue was active `ws-green-staging` failed TLS verification and `ws-blue-staging` answered
  healthy. **The predicted outage on switching colours did not materialise:** the 2026-09-06
  colour flip to green was checked immediately afterwards and `ws-green-staging` already served
  `{"status":"healthy"}` over a valid certificate, with the handshake refusing a bad token 4401 as
  designed. ACME completed inside the deploy's own window. Left open because it is unproven under
  a slower ACME or a rate-limited issuance, and because the first flip to a *never-before-active*
  colour is the risky case — but do not plan work around an outage that has not been observed.

- **A coturn config-only change does not restart the running relay (C3c).** `ship.sh` runs
  `docker compose up -d ... coturn`; the config arrives by `scp` as a bind-mounted file, so the
  service definition is unchanged and Compose leaves the container running with the OLD config.
  Hit for real on 2026-09-06: the `log-file=stdout` fix reached the VPS but did nothing until
  coturn was restarted by hand. Either add an explicit `restart coturn` to the deploy when the
  config changes, or hash the config into the service definition so Compose notices.

- **Sentry may capture a capability token and TURN credential as stack-frame locals (C3c).**
  `backend/config/settings/base.py` calls `sentry_sdk.init()` without
  `include_local_variables=False`. The default `EventScrubber` scrubs frame variables by NAME,
  and `secret`/`token` are on its denylist, but `credential`, `servers` (a tuple of `IceServer`
  whose `repr` carries the credential) and `grant` are not. Any 500 raised after those locals are
  bound ships them to Sentry in full. Only live once `SENTRY_DSN` is set (currently empty in
  `.env.production.example`). One-line fix (`include_local_variables=False`), logged rather than
  applied in this phase.

- **There is no `docs/architecture/scheduling.md`, and D9 asks for one every phase.** `identity`,
  `billing` and `curriculum` each have an architecture doc; `scheduling` — now the largest module
  in the codebase, spanning C0 matching inputs, C1 matching, C2 booking + quota, C3a rooms, C3b
  signaling and C3c TURN — has none. Each of those phases quietly skipped the "arch doc updated"
  line of the Definition of Done. Writing it is a phase-sized piece of work in its own right and
  must not be bolted onto whichever phase notices next: a doc covering only the latest slice
  would misrepresent the module more than its absence does. The operational half is covered by
  `docs/runbook/signaling.md` and `docs/runbook/turn.md`; what is missing is the module's own
  structure, boundaries and data model.

- **Nothing ever ends a video room (C3a).** `end_room` is on the provider `Protocol` and
  implemented by the fake, but has no caller. Cancelling or completing a session leaves its
  `Room` ACTIVE forever, and `Room.Status.ENDED` has no production path at all — it is reachable
  only from a test. Harmless while a room is a string; a real provider leaks a provisioned room
  per lesson, which is a cost and a security surface. C3b or C3d.
- **`Room.provider` is stored but never read (C3a).** The field exists so a room created under
  one adapter stays readable after the setting changes, but `join_session` mints the URL with the
  *currently configured* provider regardless, and there is no registry mapping the stored short
  name back to a class. Flip `DJANGO_VIDEO_PROVIDER` with an ACTIVE room row and the new provider
  is asked for a URL to the old provider's room. Either add the routing or delete the field's
  promise.
- **The join endpoint has no throttle (C3a).** `SessionJoinView` carries only `IsAuthenticated`,
  while the project already has scoped-throttle infrastructure (`DEFAULT_THROTTLE_RATES`). A
  participant can mint unlimited grants. Add a scope before a real provider makes each mint an
  upstream API call.
- **The C3a e2e does not cover "a parent sees no Join control".** The spec lists it; it shipped
  covered at API level (403 against a real `ParentStudent` row) and at component level only.
  `seed_e2e` creates no parent↔student link, so the flow would be vacuous without seed work.

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

- **The CI cost model (ADR-0038) has never met an invoice.** Every dollar figure in
  `docs/superpowers/specs/2026-09-08-ci-cost-optimization-design.md` is run-count times
  measured per-job minutes times the published per-minute rate — the billing API needs
  `admin:org`, which this project's token does not have. Read one real month's Actions bill
  and correct the spec against it.
- **The artifact-miss path in the CI cost guard is unproven on a real push (ADR-0038).** A
  push whose tree has no recorded `verified-tree-<hash>` artifact should re-run the full
  suite, but that has only been checked mechanically (a `gh api` query against a name that
  does not exist returns 0), never end to end on a real `push` event. The next code change
  that merges more than 7 days after going green, or after `master` moves underneath its PR,
  will exercise it on its own — or force it deliberately by deleting the artifact before
  merging (`docs/runbook/ci.md`).
- **Dependabot PRs now report green with nothing tested (ADR-0038).** The seven gate jobs and
  `deploy-staging` all skip for `github.actor == 'dependabot[bot]'` rather than failing at
  checkout as before — cheaper and no less honest about what was tested, but GitHub counts a
  skipped required check as satisfied, so this would look mergeable if branch protection is
  ever enabled. Three real Dependabot PRs are open: #182 (`setup-python` 5→7), #183
  (`upload-artifact` 4→7), #184 (`setup-node` 6→7). `ci.yml` pins `upload-artifact@v4`, so
  #183 is a real version upgrade this repo hasn't taken — review it deliberately rather than
  merging on a green tick that verified nothing.
- **Staging carries throwaway fixtures from the Phase B and C live checks.** Moved here from
  `STATE.md` when it was trimmed 303 → 71 lines on 2026-09-08 — the accounts, ids and
  credentials below are live artefacts on a shared environment, and losing the record does not
  remove them, it just means the next person meets them with no context.
  - **C3d call-check accounts:** `c3d.student@example.com` / `c3d.teacher@example.com`,
    password `KaleemC3d!2026`, with a matched Arabic assignment and a recurring slot. **Session
    id 3 is a permanently joinable lesson** — it was repositioned to `now` on 2026-09-07 09:20
    so a live check could reach the Lobby, and nothing has moved it back. Clear on the next
    staging DB reset, or reuse for a future call check rather than rebuilding the fixture.
  - **Billing click-through accounts**, all password `KaleemStaging!2026`:
    `billing.clickthrough@` (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus
    two older `*.smoke@` users. Clear on the next staging DB reset.
  - **One throwaway `CallDiagnostic` row**, written by the 2026-09-07 live check: session 3,
    `autoplay-blocked`, a synthetic iPhone-Safari `User-Agent` and hand-built redacted stats.
    Evidence the diagnostics pipeline works, not real user data. Delete on the next staging DB
    reset, or leave it — the 90-day purge job takes it on 2026-12-06 either way.
- **The session UI redesign's class-string unit tests are weak proxies for real layout
  (`SessionCard.test.tsx`, `CallStage.test.tsx`/`SelfView.test.tsx`, `Lobby.layout.test.tsx`).**
  They assert things like `toHaveClass("sm:flex-row")` or a logical-property regex match, which
  proves the string is present, not that anything reflows, reorders or mirrors under RTL. jsdom
  has no layout engine, so nothing about actual media-query behaviour can be exercised at the
  unit level at all. The only real evidence is the session-ui-redesign e2e flows added in Task
  16, and those run in Chromium only — no coverage of any other browser or of viewport sizes the
  flows don't hit.
- **The session-ui-redesign e2e flows ran against the dev-server/HMR topology, not CI's
  build-then-preview topology.** Task 16 executed them locally against `docker-compose` +
  `pnpm dev`, not the `pnpm build` + `pnpm preview` pair CI uses. Unlikely to matter for
  Tailwind-class-driven layout, but it is asserted rather than verified — this project has
  already hit a case (C3d's `call.spec.ts`) where a flow passed locally and could never have
  passed in CI because the two environments differed in a way nobody had checked. CI's own run
  on this branch is the actual proof; watch it rather than assuming the local result carries over.

- **Headset auto-takeover depends on `groupId`, which iOS Safari may not populate (C3e-b).** The
  device-swap rule only adopts a newly-arrived default when the in-use track and the candidate both
  report a `groupId` and the two differ — deliberately failing closed, since the alternative
  interrupted working calls on every unrelated `devicechange`. But `track.getSettings().groupId` is
  not guaranteed on Safari, the browser this phase exists for. If Safari omits it, auto-takeover
  silently never fires there and the Lobby picker is the only route. Unverifiable here: no Apple
  device. Watch whether `device-lost` rows ever arrive from Safari user agents.
- **The `100vh` guard scans two directories, not the whole tree (C3e-b).** `viewport-units.test.ts`
  walks `src/routes` and `src/features/call`. `src/features/shell/AppShell.tsx` and
  `src/ui/auth-layout.tsx` also establish page height and sit outside that scan — both correct
  today. The "a container nobody pointed the check at" failure is narrowed, not eliminated; the
  root container that defeated the original fix was exactly this class.

- **The deploy's file sync now downloads its own binary, unchecksummed.** `appleboy/scp-action`
  v1 is a composite action: instead of running a pinned Docker image, it `curl`s the `drone-scp`
  binary onto the runner at deploy time (default v1.8.0, GitHub releases, no checksum). The action
  tag is pinned, the thing it fetches is not. This is the step that carries `turnserver.conf` to
  the VPS, so a compromised or substituted binary is a path to an unfenced relay. Closing it means
  either pinning `version:` and verifying a hash, or vendoring the binary — neither is a 15-second
  change, and the same exposure exists in `appleboy/ssh-action`, which is built the same way.

- **A signaling socket that never opens and never closes leaves the room saying "Connecting…"
  forever (C3d).** `useSignaling` only begins counting failures from a close event, so it reaches
  `MAX_RECONNECT_ATTEMPTS` and the `lost` state only if the socket *opened and then dropped*. A
  relay that is unreachable from the start — DNS gone, certificate rejected, a silently blackholed
  connection — produces no `onclose`, so nothing ever surfaces. The other half of this finding (a
  socket that opens and later dies) IS handled, with copy and a retry control. Closing this needs a
  connect-timeout with a chosen value and a test; it was deliberately not bolted on untested during
  the C3d fix wave.
- **Retrying a failed connection silently reverts the chosen camera and microphone (C3d).**
  `RoomPage.handleRetryConnection` calls `localMedia.retry()`, which re-acquires with
  `DEFAULT_CONSTRAINTS` rather than the `deviceId` the person picked in the lobby. So someone who
  chose their good camera, hit a connection failure and clicked "Try again" gets the default one
  back with no indication. Only reachable now that the retry path and the device wiring both exist.
  Fix: have `retry()` reuse the current selection.

- **Signaling reads only the first `Sec-WebSocket-Protocol` header line (C3c).**
  `signaling/app.py` uses `headers.get(...)`, which returns the first occurrence. A client that
  sends the offer as two repeated header lines — semantically equivalent to one comma-joined line
  under RFC 7230 — would have its token silently dropped and be refused. It fails **closed**, so
  this is not an auth bypass, and it is unreachable today: browsers and Starlette's `TestClient`
  both comma-join. Worth a `getlist()` or at least a one-line comment recording the assumption
  before any non-browser client exists.
- **A reversed subprotocol offer is treated as no offer (C3c).** `[token, kaleem.signaling.v1]`
  fails the `offered[0] != SUBPROTOCOL` check, so the refusal selects no subprotocol and the
  browser sees a generic handshake error instead of close code 4401. Theoretical — kaleem's own
  provider documents and constructs the fixed `[SUBPROTOCOL, token]` order.
- **`stuns:` URLs would be given a TURN credential (C3c).** `providers/turn.py` splits STUN from
  TURN with `startswith("stun:")`, so a `stuns:` entry falls into the TURN bucket and is handed a
  credential it does not need. Unreachable today: `DJANGO_TURN_URLS` has no `stuns:` entry and
  C3c ships no TLS listener at all. Fix it together with the `turns:` work above.
- **`.env.production.example` had a stale comment referring to `WS_DOMAIN` (C3c), now doubly
  stale.** It used to say the variable "was retired and replaced by
  `WS_BLUE_DOMAIN`/`WS_GREEN_DOMAIN`" — backwards as of ADR-0037, which collapsed signaling back
  to a single shared `WS_DOMAIN` and retired the per-colour pair instead. Fixed as part of the
  shared-signaling change; flagging here in case any other doc still has the C3c-era phrasing.

- **On a phone, the session card's Join stretches full-width but Cancel does not.** Verified on
  staging 2026-09-08 at 390x844: the actions container stacks correctly (96px tall vs 44px in a
  row at 1280px), but `JoinButton` carries `w-full sm:w-auto` while `CancelSessionDialog`'s
  trigger has no width class, so it renders 81px wide under a 324px-wide Join. Reads as
  unbalanced rather than deliberate. Either give Cancel the same treatment or drop it from Join.
  Cosmetic only — no test can see it, which is why it took a human-style look to find.

- **`GET /api/v1/scheduling/slots/` and `/quota/` return 404, not 403, for a student with no
  subscription.** Both routes exist (confirmed against the deployed URLconf), so the 404 is the
  view expressing a business state as "not found". Every schedule page load for such a student
  logs two console errors, which is noise in its own right and a red herring for anyone
  debugging a real routing problem later. Pre-existing, unrelated to the session UI redesign;
  observed 2026-09-08. Adjacent to the entry above about these queries firing for the wrong
  audience.

- **Changing `WS_DOMAIN` on the VPS strands any `ACTIVE` `Room` (ADR-0037).** `Room.signaling_url`
  is pinned at creation and `_ensure_room` reuses an `ACTIVE` row forever, so an operator who edits
  `WS_DOMAIN` without first ending active rooms leaves those sessions permanently unjoinable —
  same failure class ADR-0037 fixed for deploys, reopened for this one operator action. Documented
  as a required step in `docs/runbook/signaling.md`, not fixed in code: a recurring deploy-time
  room-ending job is exactly the "treat the symptom on a schedule" design ADR-0037 rejected.

- **`mypy` is red on `config/settings/local.py:61` and nothing notices.** `LOGGING["handlers"]["console"]["formatter"] = "verbose"` — mypy types `LOGGING` as `object`, so the subscript errors. Pre-existing (present at HEAD before Phase C3b's fix wave), and harmless only because **mypy runs in neither `ci.yml` nor pre-commit nor `just lint`** — it is a manual command. Either fix the annotation and put mypy in the merge path, or stop calling it a gate.

- **`docs/runbook/deploy.md` still calls the deploy script `scripts/deploy.sh`.** The
  actual file in the `infra` submodule is `scripts/ship.sh`; the doc's command examples
  are stale and will fail if copy-pasted.
- **The C3a e2e is time-bombed on seed age.** `seed_e2e_matching` puts the joinable session at
  `now`, and its window closes 75 minutes later. A suite run long after seeding would find the
  button still enabled but the POST returning 409. Fine in CI, which seeds immediately.
- **`availability.spec.ts` failed once in local e2e (2026-09-05), then passed on a clean re-run.**
  The failing run overlapped a manual browser session signed in as `e2e.teacher` against the same
  database, which is the likely cause rather than a defect in the spec — but it is unproven, and a
  shared-account suite has no isolation to fall back on. Watch for it in CI.
- **The transactional-test reseed fixture is a hand-maintained mirror of two data migrations.**
  `reseed_after_transactional_flush` restores the rows that a `transaction=True` test truncates.
  It has a loud tripwire on the subject count, but a *third* data migration would need adding by
  hand and nothing in CI enforces that.
- **`RoomAdmin` blocks adding but not deleting.** `readonly_fields` makes the change form inert
  and `has_add_permission` returns False, but staff can still delete rooms, and no test covers
  the read-only intent.
- **The 409 copy on a closed room says "not open yet".** `isOutsideJoinWindowError` maps every
  409 to the not-yet-open message, so leaving the schedule open past a lesson's end and clicking
  Join tells the user the room has not opened when it has closed. The client knows `starts_at`
  and `duration_minutes` and could pick the right copy without a machine-readable error code.

### Phase C2 (booking + quota) — deferred findings

Logged 2026-09-05 from C2's task reviews, its browser pass and its final whole-branch review.
None blocks the phase; each was reviewed and consciously deferred.

**Blocks launch — read this one before touching billing:**

- **`Session.cycle_end` is matched by exact `DateTimeField` equality, so a mid-cycle rewrite of
  `current_period_end` would silently zero a student's usage.** `_consumed` filters
  `cycle_end=cycle_end`. Four billing paths write `current_period_end`
  (`_apply_subscription_updated` ×2, `cancel_subscription`, `_reconcile_one`). If any stores a
  value differing by even one second *within a cycle a student is already inside*, every session
  already generated stops counting, `used` drops to 0, and the next nightly run generates up to a
  full second allowance — eight lessons on a four-lesson plan. A renewal producing a new period
  end is correct and desired; the dangerous case is a **mid-cycle plan change with proration**,
  which C2 does not ship. **The test that would settle it:** mutate a live subscription's
  `current_period_end` mid-cycle and assert generation still cannot exceed the limit. It would
  fail today. Fix by keying the cycle on a tolerance or a derived id rather than an exact instant.

**The C2 scoping cluster — one root cause, three symptoms:**

- `claim_slot(actor, weekday, start_time)` carries **no parameter naming the student or the
  subject**. Consequently: a student with two subjects cannot book at all (refused loudly rather
  than guessing which subject a lesson belongs to); a **parent cannot claim or end** a weekly time
  or see a quota counter; and `GET /slots/` had to be narrowed to students. Adding that parameter
  is the single fix for all three.

**The rest:**

- **A future `end_assignment` will strand an ACTIVE slot.** Generation filters on an ACTIVE
  assignment, so an ended one stops generating — but its slot stays ACTIVE and keeps the teacher's
  time blocked by `unique_active_teacher_slot` forever. Unreachable today (nothing writes
  `TeacherAssignment.Status.ENDED`); a trap for whoever adds that path.
- **The concurrent-claim 409 is reasoned, not tested.** The delivered test is sequential; the lock
  argument is sound, but nothing would catch `select_for_update` being removed. Same shape as C1's
  untested accept race — both want a `TransactionTestCase` with two threads.
- **A Family plan's per-child allowance holds by construction but has no two-sibling test.**
- **Dialog styling is now inconsistent within one feature.** `ClaimSlotCard` uses
  `w-full max-w-sm`; `SessionList` and billing's `CancelSubscriptionDialog` still use
  `w-[min(90vw,24rem)]` with transform centring. Unify all three. Related: **no `overlay`/scrim
  token exists**, so `bg-black/40` is hardcoded in several dialogs.
- **`claim_slot` duplicates `slot_options`' fitting and conflict computation** rather than reusing
  it — fewer queries, two places to keep in step.
- **`isNoActiveSlotError` is byte-identical to `isNoEntitlementError`**, justified by semantic
  distinctness; they could silently diverge if either endpoint's status changes.
- **`NotFoundError("Recurring slot", request.user.id)`** echoes the *user* id where a slot id is
  implied, and it reaches a user-visible 404 body.
- **The multi-subject 400 detail renders the server's raw English string**, unlocalised — matching
  the existing claim-mutation pattern. Wants an i18n pass.
- **Feature naming diverges across repos:** the backend puts booking inside `scheduling`; the
  dashboard adds `features/booking/` beside an existing `features/scheduling/`.
- Smaller: a teacher-and-parent sees their own name echoed on rows they teach; the seed prints
  "Opened 2 request(s)" though one is immediately accepted; a tautological fixture assertion; e2e
  name assertions use `.first()`; the inside-24h cancellation copy is unit-tested but never
  verified in a browser; sequenced queries show two consecutive spinners.


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
- The room route (C3d) has two `<h1>`s at once during the Lobby state: its own `sr-only`
  "Lesson room" plus `Lobby.tsx`'s visible "Get ready for your lesson". Demote `Lobby`'s to
  `<h2>` once something touches that file again.
- **A rejected `sender.replaceTrack()` is swallowed, not reported (C3e-b).** The rejection is
  now caught (an unhandled rejection would fail `call.spec.ts`'s `pageerror` listener on a
  lesson that is still running), but nothing is recorded: no diagnostic code fits, and the
  vocabulary is deliberately closed (adding one needs a backend enum change and would fail the
  e2e contract test that pins the client's code list to the backend's). Accepted: a failed swap
  leaves the previously negotiated track in place — degraded, not broken — and narrower than the
  swap failing to happen at all, which is what the fix's own test proves does not occur.
- **A microphone-only device swap also re-acquires video, so plugging in a headset briefly
  blinks the camera (C3e-b).** The hot-swap path re-runs `getUserMedia` for both kinds even
  when only one changed. Cosmetic — the camera track is the same track afterwards — the
  correctness half (the microphone actually swaps) is handled.
- **The e2e gate cannot see the relay path (C3d).** `call.spec.ts`'s two flows run with no
  coturn in CI, so they only prove host-candidate peer-to-peer connectivity with fake media.
  The relay path (real NAT traversal, real audio/video) is covered by C3c's one-time live
  verification on staging, not by anything that runs on every merge. See the D3 table row in
  `CLAUDE.md` and `docs/runbook/video-call.md`.
- **`call.spec.ts`'s `pageerror` assertion is a stopgap, not a durable guard (C3d).** It only
  catches the single-offerer regression because nothing currently `.catch`es the rejection
  `sendOffer`/`sendAnswer` throw on misuse (both are fire-and-forget IIFEs). A future tidy-up
  that adds a `.catch` anywhere in that chain would silently blind this assertion with no edit
  to the spec itself to flag the coverage change. The durable pin is the unit-level call-count
  tests in `usePeerConnection.test.ts`; treat the e2e `pageerror` check as a bonus, not the
  guard.

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

- **A teacher-only account page always fires a forbidden request for student subjects.**
  `SubjectsCard` calls `useTeacherSubjects()` and `useStudentSubjects()` unconditionally —
  hooks cannot be conditional, and `audience` only picks which result is *rendered*. So a
  user with no `student` profile still issues `GET curriculum/me/student-subjects/`, gets a
  403, and logs a console error on every visit to `/account`. Confirmed on staging
  2026-09-06 with a teacher-only account. Harmless — the server refuses correctly, which is
  the point — but it is a wasted round trip on every load and a red herring for anyone
  debugging a real 403. Fix is `enabled:` on the two queries, keyed off the audience.

- **The dashboard unit suite flakes: jsdom intermittently crashes creating a Window.**
  Roughly 1 run in 4 on a loaded machine, `vitest` reports an unhandled
  `SyntaxError: Invalid or unexpected token` from `jsdom/living/interfaces.js`
  `installInterfaces` -> `createWindow`, one test *file* is dropped from the run, and the
  process exits non-zero with every test that did run passing. The counts move between runs
  (782, 779, 778 on the same tree). **It is not caused by the session UI redesign** —
  confirmed 2026-09-07 by running the suite four times on the pre-branch base `00f8581`,
  where run 3 dropped a file the same way (96/97 files, 718 tests). It predates the branch
  and is invisible until you read the file count rather than the pass count. This is a
  merge gate, so a spurious red costs a re-run every time it fires; worth pinning the
  jsdom/vitest pair or capping `poolOptions` concurrency and seeing if it stops.

- **A user with no full name is greeted "Assalamu alaikum," and gets a blank account menu.**
  The home heading interpolates an empty `full_name` and leaves the comma stranded, and the
  header's account-menu trigger renders no visible text at all (its `aria-label` is intact,
  so this is visual, not an a11y failure). Registration does not require a name and nothing
  backfills one, so this is the default state for every account created through the API or
  the admin, not an edge case. Confirmed on staging 2026-09-06. Wants a fallback — the
  local-part of the email, or a nameless greeting — decided once and used in both places.
