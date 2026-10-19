---
spec: docs/superpowers/specs/2026-10-19-ntf-recipient-locale-tz-design.md
status: approved
---

Worktrees: `kaleem-worktrees/backend-ntf-recipient-locale-tz` and
`dashboard-ntf-recipient-locale-tz`, both on `feat/ntf-recipient-locale-tz` and both from
`origin/main` (runbook section 1). Gates run only through `_tools/*-gate.sh`. Every step
starts with a failing test (D3). Every regression test is mutation-checked: revert the fix
and watch it go red. Floors are not touched (dec-floor-ownership).

The backend lands first. The dashboard reads keys that the previous backend does not
send, and it degrades: no `language` means nothing is adopted.

## Steps

### Backend

1. [ ] **Model + migration.** Tests first, in `kaleem/identity/tests/test_models.py`:
   `test_language_defaults_to_blank` and `test_language_default_is_set_by_the_database`
   (a raw `INSERT INTO identity_user` without the column returns `''`, the same pattern as
   assessment's `test_hidden_default_is_set_by_the_database`). Then add
   `User.language = CharField(max_length=8, blank=True, default="", db_default="")` and
   `makemigrations identity` to create `0009_user_language`. The migration must contain only
   `AddField`.
2. [ ] **Services.** Tests first, added to `kaleem/identity/tests/test_timezone.py`:
   - `test_set_language_saves_a_supported_code`
   - `test_set_language_rejects_unsupported` (parametrised over `fr`, `""` and `en-us`; asserts `field == "language"`)
   - `test_recipient_locale_falls_back_to_english_when_blank`
   - `test_recipient_locale_returns_stored_values`
   - `test_recipient_locales_is_one_query` (`django_assert_num_queries(1)`)
   - `test_recipient_locales_skips_unknown_ids`

   Then add `set_language`, the `RecipientLocale` frozen dataclass,
   `get_recipient_locale` and `get_recipient_locales` to `identity/services.py`. The
   supported codes come from `settings.LANGUAGES`. Add the new msgid ("Unsupported
   language.") to `identity/locale/ar/LC_MESSAGES/django.po`, so
   `tests/test_translation_catalogs.py` stays green. The Arabic text is marked for
   hg-arabic-review.
3. [ ] **`/me/` read + write.** Tests first, in `test_api_auth.py`:
   - `test_me_includes_language_and_timezone`
   - `test_patch_me_sets_language`
   - `test_patch_me_rejects_unknown_language` (400, `language` key, `error_code`)
   - `test_patch_me_sets_timezone`
   - `test_patch_me_rejects_unknown_timezone`
   - `test_patch_me_with_full_name_only_leaves_language_untouched`

   Then change `MeUpdateSerializer`: add `language = ChoiceField(choices=[code for code, _
   in LANGUAGES], required=False)` and `timezone = CharField(max_length=64,
   required=False)`. `MeView.patch` routes those two through the services and keeps the
   `setattr` loop for `full_name` only. Add both keys to `_me_payload` and to
   `MeResponseSerializer`.
4. [ ] **Register.** Tests first:
   - `test_register_records_request_language` (`HTTP_ACCEPT_LANGUAGE="ar"` stores `ar`)
   - `test_register_without_header_records_english`
   - `test_register_stores_timezone`
   - `test_register_rejects_unknown_timezone`
   - `test_register_without_timezone_is_utc`

   Then add `RegisterSerializer.timezone` (optional), and give `register_user` the
   keyword arguments `language=""` and `timezone="UTC"`. It validates both through the same
   helpers. `RegisterView` passes `translation.get_language()`, reduced to its primary
   subtag and kept only if supported.
5. [ ] **Export + seed.** Tests first:
   - `test_personal_data.py`: the expected dict gains `"language"`.
   - `test_seed_e2e.py`: `test_locale_account_is_seeded` (`e2e.locale@kaleem.test`, parent, verified) and `test_seed_resets_language_and_locale_timezone` (dirty `ar` / `Asia/Tokyo` converge to `""` / `UTC`; for every other account only the language converges).

   Then add `LOCALE_EMAIL` to `seed_e2e.py`. `_account` sets `user.language = ""`, and the
   locale account also gets `timezone = "UTC"`. Update the success message count. Add
   `language` to `export_account`.
6. [ ] **Full backend gate:** `_tools/backend-gate.sh <wt>`. Expected: migrate,
   `makemigrations --check`, pytest with coverage, ruff, and `lint-imports` all green.

### Dashboard

7. [ ] **Storage only on an explicit change.** Tests first, in `src/lib/direction.test.tsx`:
   - `does not write kaleem-locale on first render when nothing is stored`
   - `writes kaleem-locale after a language change`
   - `keeps writing when a stored choice already exists`

   Then give `DirectionProvider` a first-run ref that skips the write only when storage
   held nothing. Wrap storage access in try/catch.
8. [ ] **Schema + API + mutation.** Tests first, in `api.test.ts` and `queries.test.tsx`:
   `updateMe` sends `{language}` and `{timezone}`; and
   `useSaveAccountPreferences sets the me cache and invalidates availability on a zone
   change`. Then add the `Me` optional fields, `AccountPreferencesInput`, the widened
   `updateMe`, and the hook.
9. [ ] **`AccountLocaleSync`.** Tests first, in `AccountLocaleSync.test.tsx`:
   - `adopts the account language when the device holds no choice`
   - `keeps the device choice when one is stored`
   - `does nothing when the account language is blank`
   - `PATCHes when the user switches to a different language`
   - `adopting does not PATCH`
   - `a failed save shows a toast`
   - `stops listening on unmount`

   Then write the component and mount it in `routes/_authed.tsx`, beside `<Outlet />`
   inside `AppShell`.
10. [ ] **`LocalePreferencesCard` + Account.** Tests first:
    - `LocalePreferencesCard.test.tsx`: `checks the current language`, `choosing Arabic switches i18n`, `choosing a zone PATCHes it`, `shows the server's timezone error`, `disables the control while saving`
    - `account.test.tsx`: `renders the language and time zone card for every role and staff`
    - `a11y.test.tsx`: the card passes axe

    Then build the card from `@/ui` primitives with tokens only and RTL-safe logical
    classes, add the `account.locale.*` keys to both catalogs, and render the card in
    `Account.tsx`.
11. [ ] **Register sends the zone.** Test first, in `RegisterForm.test.tsx`:
    `submits the browser time zone`, with `detectTimezone` mocked to `Africa/Cairo`. Then
    implement it.
12. [ ] **e2e.** Add the `locale` account to `e2e/accounts/identity.ts` and write
    `e2e/account-locale.spec.ts` with its two flows. Its header states what it does not
    prove. Flow 1 waits for the `PATCH /identity/me/` response before opening context B.
    Flow 2 waits for its `PATCH` before reloading. Run the mutation checks named in the
    spec. Grep the suite for any spec that clicks the language control while signed in;
    none exists at `f76677b`. Check that `arabic-sweep`, `server-strings` and
    `identity.spec`'s storage injection still pass, since all three rely on the
    device-wins rule.
13. [ ] **Full dashboard gate:** `_tools/dashboard-gate.sh <wt>` (tsc, lint,
    test:coverage, build, built-colour check). Optional local e2e in a port slot. CI
    decides.
14. [ ] **Hand-back** (runbook section 3): ancestry, a clean tree, `gitleaks-range.sh`
    run in both repos, the floor grep, and the mutation-check lines. Needs: migration
    `identity/0009`. No env var, no dependency change.

Close-out, done by the conductor (programme step 12): a D3 table row for
`identity — locale preferences`, ✅ 2 flows, with the save-failed toast and non-Chromium
browsers named as not covered. Also update `docs/architecture/identity.md` (the two new
reads and the device-wins rule) and add a journal line.

## Risks

- **A shared e2e account stuck in Arabic.** If any flow stores `ar` on a shared account,
  every later serial spec that signs in as that account in a fresh context adopts Arabic,
  and its English selectors fail. Mitigation: only explicit choices write, the new flows
  use a dedicated account, `seed_e2e` converges the language, and the flows restore
  English in `finally`. If a red run shows `lang="ar"` on another account, this is the
  first place to look.
- **The first-render storage change.** Users who never chose stop getting `en` written on
  their first render. Their effective language does not change: the default is still `en`.
  Only adoption behaviour changes.
- **The same field in two places for students.** The account card and the availability
  card both edit `User.timezone`. Invalidating the availability query keeps the two in
  step. The C6 unsaved-edit guard keeps a pending grid edit. Covered by step 8's test.
- **A migration collision.** The conductor owns identity migrations. If another unit
  lands `0009` first, the freshness step renumbers this one (no merge migrations).
- **Arabic copy.** The new keys and msgid ship with machine Arabic marked for
  hg-arabic-review. That gate holds spec closure, not the merge.

## Verification

- Steps 1–5: the focused backend gate run per step (`backend-gate.sh <wt>
  kaleem/identity/tests/...`), then step 6's full gate.
- Steps 7–11: the focused vitest run per file (`dashboard-gate.sh <wt> <file>`), then
  step 13's full gate.
- Step 12: the CI e2e log names both new tests as passed. A pass on rerun counts as a
  finding.
- Staging (programme step 11): an agent click-through on staging as a pool account, in
  both themes, in Arabic RTL and at 320px. Set Arabic and a zone, sign in from a fresh
  context, and see both kept.
