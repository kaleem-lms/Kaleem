---
spec: docs/superpowers/specs/2026-10-18-lb-gdpr-data-export-design.md
status: approved
---

Worktrees: `backend-lb-gdpr-data-export` and `dashboard-lb-gdpr-data-export` on
`feat/lb-gdpr-data-export` (runbook section 1). No migration, no dependency change, no
env var. Never edit a coverage floor.

## Steps

### Backend (`kaleem-worktrees/backend-lb-gdpr-data-export`)

1. [x] **Export-only contract helper.** Tests first in
   `kaleem/platform/tests/test_personal_data_contract.py`: `assert_export_honours_contract`
   raises with `registered` for an export-less name (and passes with no erase hook),
   `export-json`, `export-deterministic`, `export-read-only` and `unseeded-user` on a bad
   hook, and passes on a good one. Then extract the export half of
   `assert_hooks_honour_contract` in `kaleem/platform/personal_data_contract.py` into the
   new function, called first by the pair helper. The existing contract tests stay green
   unchanged.
2. [x] **curriculum.subjects.** Test first `kaleem/curriculum/tests/test_personal_data.py`:
   the contract helper with a seed of one taught and one interest row, and an exact
   expected dict. Then `kaleem/curriculum/personal_data.py` and `ready()` in
   `kaleem/curriculum/apps.py` (import inside `ready()`, `# noqa: PLC0415`, as assessment).
3. [x] **billing.subscriptions.** Test first `kaleem/billing/tests/test_personal_data.py`:
   contract helper; expected dict for a customer, two subscriptions and one incident;
   asserts no `stripe_` key, no `detail`, `severity`, `occurrences` or `resolved_by`.
   Then `kaleem/billing/personal_data.py` and `ready()` in `kaleem/billing/apps.py`.
4. [x] **scheduling.lessons.** Test first `kaleem/scheduling/tests/test_personal_data.py`,
   reusing the module's conftest factories: a seed with the user as student AND as teacher
   (assignment, slot, two lessons, one cancelled by the user, a room, a decline, a
   diagnostic with `stats`, availability). Assert the contract helper; `role` and
   `counterpart_user_id` correct both ways; no counterpart name or email; no `stats`, no
   room `external_id`; `cancelled_by_me` true only for the user's own cancellation. Then
   `kaleem/scheduling/personal_data.py`, registered from the existing
   `SchedulingConfig.ready()` beside the teaching provider.
5. [x] **identity.account.** Test first `kaleem/identity/tests/test_personal_data.py`:
   contract helper; expected dict for a user with all three profiles, a child link, a
   parent link, an invite and two email addresses; no `password`, invite `code`, `notes`
   or `internal_notes`. Then `kaleem/identity/personal_data.py` and `ready()` in
   `kaleem/identity/apps.py`.
6. [x] **Coverage guard.** In `tests/test_personal_data_hooks_cover_every_model.py`: empty
   `PENDING_EXPORT`; add the three `NOT_PERSONAL` entries with reasons; rewrite
   `test_a_pending_app_whose_models_are_all_covered_is_stale` to pass its own
   `pending_export={"curriculum": "x"}` so it no longer leans on the live map. Red first:
   run the guard after emptying the map and before steps 2-5 land to see each uncovered
   model named.
7. [x] **Service.** Tests first in `kaleem/identity/tests/test_data_export.py`:
   `export_account_data` returns the envelope (`format`, `version == 1`, `generated_at`
   UTC ISO, `user_id`, `sections` equal to `export_user(user)`); wrong password raises
   `ValidationError(field="current_password")` and enqueues no email;
   success enqueues exactly one `send_email_message` with the `data_exported` body.
   `_send_email_security_alert` gets the `data_exported` branch; the unknown-action test
   still raises.
8. [x] **Endpoint.** Tests first in the same file through the API client:
   `POST identity/me/export/` 200 with `Content-Disposition` attachment and
   `Cache-Control: no-store`; every registered export hook name is a key of `sections`;
   the user's password hash is not a substring of the body; 400 shape on a wrong password;
   anonymous 401/403; 429 past a monkeypatched tiny `data-export` rate (the
   `test_diagnostics_api.py` pattern). Then `DataExportSerializer`, `DataExportView`
   (`ScopedRateThrottle`, `throttle_scope = "data-export"`, `extend_schema`), the
   `me/export/` URL, and `"data-export": "10/hour"` in `config/settings/base.py`
   `DEFAULT_THROTTLE_RATES`. One structured log line: user id, section names, byte size.
9. [x] **Seed check.** Assert in `kaleem/scheduling/tests/test_seed_e2e_matching.py` (or
   the existing seed test) that `e2e.booked` has at least one session, since the e2e flow
   depends on it. No seed change expected.

### Dashboard (`kaleem-worktrees/dashboard-lb-gdpr-data-export`)

10. [x] **Download helper.** Test first `src/lib/download.test.ts` (stub
    `URL.createObjectURL`/`revokeObjectURL`): `saveJson(data, filename)` clicks an anchor
    with that `download` name, pretty-prints the JSON and revokes the URL. Then
    `src/lib/download.ts`.
11. [x] **API + schema + mutation.** Tests first in `src/features/identity/api.test.ts`,
    `schemas.test.ts`, `queries.test.tsx`: `identityApi.exportData` posts to
    `identity/me/export/`; `dataExportSchema` requires `current_password`;
    `useExportData` is a mutation. Then `api.ts`, `schemas.ts`, `queries.ts`.
12. [x] **DataExportCard.** Test first
    `src/features/identity/components/DataExportCard.test.tsx`: opens the dialog; success
    calls `saveJson` with `kaleem-data-export-<date>.json` and shows the toast; 400 shows
    "Incorrect password." on the field; 429 shows `account.throttled`; axe clean. Then the
    component (existing `@/ui` dialog, field and button; tokens only; logical properties).
13. [x] **Account page + locales.** Update `src/routes/_authed/account.test.tsx` first (the
    card renders for every role), then `src/routes/_authed/-pages/Account.tsx` and the
    `account.export.*` keys in `src/locales/en/common.json` and `src/locales/ar/common.json`
    (parity and terminology tests must pass).
14. [x] **e2e.** `e2e/data-export.spec.ts`, two flows, budget 20 s:
    `booked` downloads via `page.waitForEvent("download")`, parses the saved file, and
    asserts `format`, `version`, that the section keys include every registered hook (a subset check; messaging joined after the first draft), its own email, at least one lesson,
    and no `pbkdf2_`/`argon2` substring; `student` with a wrong password sees the field
    error and no download fires (a listener that fails the test on `download`). Both
    accounts are used read-only; neither belongs to another spec's mutations.

### Close-out (handed to the conductor)

15. [ ] `docs/architecture/platform.md` (the export-only helper, the empty export pending
    list, the envelope), `docs/architecture/identity.md` (the endpoint), the CLAUDE.md D3
    row `identity — data export: 2 flows` stating what is not covered (the alert email's
    delivery, the parent-for-child path), spec status, journal line.

## Gates

- TDD loop: `_tools/backend-gate.sh <wt> <test file>`, `_tools/dashboard-gate.sh <wt> <test file>`.
- Before hand-back: both full gates (migrate, `makemigrations --check`, pytest with
  `--cov=kaleem --cov=signaling`, ruff, ruff format, lint-imports; tsc, lint,
  `test:coverage --maxWorkers=6`, build, built-colour check), then the runbook section 3
  checks and `gitleaks-range.sh` on each worktree.
- Mutation checks, each red then green: (a) add `"code"` to the invite export and see the
  identity test fail; (b) add the counterpart's email to an assignment and see the
  scheduling test fail; (c) drop the password check from the service and see the 400
  test fail; (d) remove `throttle_scope` and see the 429 test fail; (e) make one hook
  write and see `export-read-only` fire; (f) in the e2e flow, skip the password field and
  see it fail.
- e2e: optional in a port slot locally; CI is the authority. Read the CI log for the two
  new test names.

## Risks

- **Shared guard file.** `tests/test_personal_data_hooks_cover_every_model.py` is edited
  by every unit that adds a model. A curriculum or scheduling model landing first (for
  example cur-course-structure) must be covered by this unit's hook before merge; the
  freshness merge re-runs the guard, which names it. Fallback: extend the hook in the
  freshness step; never re-add a pending entry.
- **Shared settings file.** One line in `DEFAULT_THROTTLE_RATES`; trivial conflict with
  lb-gdpr-retention-jobs or rch-ratelimit-drf, resolved by keeping both.
- **Throttle in e2e.** Two requests per run, at most four with CI's one retry, against
  10/hour on fresh CI Redis. A local rerun inside the hour can hit 429; restart the slot's
  Redis.
- **Download in Playwright.** A Blob anchor download fires `download` in Chromium; if the
  event does not fire, fall back to asserting the response body from `waitForResponse`
  and say so in the spec header.
- **Owner changes the content rules at approval** (staff-only fields, third-party ids):
  only the per-hook dicts and their expected-dict tests change.
- **Size.** Synchronous build is fine for today's modules; an unbounded section is a
  later module's problem, noted in the spec.

## Verification

Each step's tests red then green; both full gates green; the six mutation checks; CI green
including the two new e2e flows; staging click-through per dec-d9-substitute on `/account`
(both themes, Arabic RTL, 320px), opening the downloaded file; Arabic strings batched to
hg-arabic-review before spec closure.
