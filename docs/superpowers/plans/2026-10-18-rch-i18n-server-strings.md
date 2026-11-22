---
spec: docs/superpowers/specs/2026-10-18-rch-i18n-server-strings-design.md
status: draft
---

Worktrees: `backend-rch-i18n-server-strings` and `dashboard-rch-i18n-server-strings`, each
on `feat/rch-i18n-server-strings` (runbook section 1), plus this meta worktree. Gates run
only through `_tools/backend-gate.sh` and `_tools/dashboard-gate.sh`. Every step writes its
failing test first.

**Conductor allocations needed before step 1.** This unit needs:

- the **Dockerfile / gate-image slot**: the image gains the `gettext` apt package, so
  `backend-gate.sh` exits 3 until the conductor builds the new `kaleem-gate:<hash>`;
- an **ADR number**;
- the **meta CI slot** for the `ci.yml` change.

The shared files are `backend/kaleem/platform/drf.py` and `backend/Dockerfile`.

## Steps

### Backend

1. [ ] **gettext in the image, and test-time compilation.**
   - In `Dockerfile`, add `gettext` to the base stage's apt list.
   - In the production stage, run `django-admin compilemessages` from `/app` before
     `collectstatic`. Without settings, it finds the app `locale/` dirs. If it does not,
     use the same build-only env as `collectstatic` with `manage.py`. Nothing may swallow
     its error.
   - Add `*.mo` to `.gitignore`.
   - In a new root `conftest.py` (there is none today; only per-app ones), add a session
     fixture that compiles every app catalog once
     (`call_command("compilemessages", locale=["ar"])`, skipped when each `.mo` is newer
     than its `.po`).
   - Test first: `tests/test_translation_catalogs.py::test_every_app_with_gettext_has_an_ar_catalog`.
     It is red until step 3 adds the first catalog.

2. [ ] **`error_code` in the handler** (`kaleem/platform/drf.py`).
   - Test first, in `platform/tests/test_drf.py`:
     - `test_kaleem_error_body_carries_error_code[<each subtype>]`;
     - `test_field_error_carries_validation_error_code`;
     - `test_drf_validation_error_code_is_validation_error`;
     - `test_drf_exception_carries_default_code[not_authenticated|throttled|not_found]`;
     - `test_list_body_is_left_untouched`;
     - `test_unhandled_exception_still_defers`.
   - Update the 3 exact-body asserts in `test_drf.py`. Grep for other exact `== {"detail"`
     and `== {"<field>": [` asserts, about 10 in all, and update them.
   - Mutation check: drop the key from one branch, and see red.

3. [ ] **Platform message templates** (`kaleem/platform/exceptions.py`). Use gettext
   templates with named placeholders: `%(resource)s`, `%(identifier)s`, `%(action)s`,
   `%(service)s`.
   - Test first, in a new `platform/tests/test_exceptions.py`:
     - `test_english_messages_are_unchanged` pins today's four exact strings;
     - `test_messages_are_arabic_under_ar`.
   - Run `django-admin makemessages -l ar --no-location` in `kaleem/platform`, then write
     the `msgstr`s.
   - Mutation check: an English template typo turns the first test red.

4. [ ] **Completeness check** (`tests/test_translation_catalogs.py`).
   - Add `test_no_untranslated_or_fuzzy_entries`. It parses
     `msgfmt --check --statistics -o /dev/null` per `.po`.
   - Add `test_catalogs_match_the_source`. It copies each app to `tmp_path`, runs
     `makemessages -l ar --no-location` there, then runs the statistics check.
   - Mutation checks:
     - blank one `msgstr`: red;
     - mark one entry fuzzy: red;
     - add an untranslated `_()` call to a module: red.

5. [ ] **AST guard** (`tests/test_error_messages_are_translatable.py`). It walks `kaleem/**`
   (non-test files). For each `raise` of `ValidationError`, `ConflictError`, `NotFoundError`,
   `PermissionDeniedError`, `ExternalServiceError` or `serializers.ValidationError`, the
   first argument must be a gettext-family call, or that call `%` a dict.
   - Commit it red: it lists the unconverted sites.
   - Steps 6-9 make it green, one module per step.
   - Mutation check: revert one converted site, and see red.

6. [ ] **identity.**
   - Wrap its 29 raise sites and the 4 `serializers.ValidationError`s.
   - Add `error_code` to the two literal `Response` bodies (`views.py:150` and `:204`).
   - Create the catalog.
   - Tests first:
     - `test_login_unverified_has_code_and_arabic_message`;
     - `test_invalid_credentials_arabic_under_ar`;
     - `test_bad_verify_key_has_code`.
   - `Unknown gender: %(gender)s` keeps `repr()` in the value.

7. [ ] **scheduling** (47 sites). Same as step 6, plus subject names:
   - add `SubjectNameField(serializers.CharField)` in `scheduling/api/fields.py`, whose
     `to_representation` calls `curriculum_services.subject_display_name`;
   - use it for the 5 `subject_name` fields in `matching_serializers.py` and
     `booking_serializers.py`.

   Depends on step 8's function: do step 8's service part first, or merge the two steps.
   Tests first, in `ar`: one each for offers, match requests and sessions.

8. [ ] **curriculum** (3 sites).
   - Add `services.subject_display_name(name)` (`pgettext("subject name", name)`).
   - Add `pgettext_lazy("subject name", …)` markers for Quran, Tafsir and Arabic, with a
     `# Translators:` note that these are religious terms for hg-arabic-review.
   - `SubjectSerializer.name` uses the function.
   - Tests first:
     - `test_subjects_are_arabic_under_ar`;
     - `test_subjects_unchanged_in_en`;
     - `test_every_seeded_subject_has_an_arabic_name` (over the migration-seeded rows);
     - `test_unknown_subject_falls_back_to_stored_name`.

9. [ ] **billing** (13 sites) and **assessment** (10 sites).
   - Same pattern as step 6.
   - Turn `assessment/services.py:92,94` (`cannot be {what}`) into full sentences chosen
     from a dict, so no participle fragment is translated alone. The English output stays
     the same.
   - After this step the AST guard (step 5) is green.

10. [ ] **Full backend gate**: `backend-gate.sh <wt>`. Then complete the hand-back checks
    (runbook section 3).

### Dashboard

11. [ ] **`api.ts` header.**
    - Add `setApiLocale` and a request interceptor.
    - Test first, `src/lib/api.test.ts`: a mock adapter sees `Accept-Language: ar` after
      `setApiLocale("ar")`, and `en` by default.
    - Keep `api.ts` free of `@/` and JSON imports.
    - Mutation check: remove the interceptor, and see red.

12. [ ] **`locale-sync.ts`**, wired in `main.tsx`.
    - Tests first, `src/lib/locale-sync.test.ts`:
      - the header is set on install;
      - it follows `changeLanguage`;
      - `invalidateQueries` is called once per change;
      - nothing happens after unsubscribe.

13. [ ] **`parseApiError` and `LoginForm`.**
    - Tests first:
      - in `identity/api.test.ts`, `error_code` goes to `code` and not to `fieldErrors`,
        while a `code` field error still goes to `fieldErrors.code`;
      - in `LoginForm.test.tsx`, a body with `error_code: "email_not_verified"` and an
        Arabic message shows the not-verified panel.
    - Mutation check: restore the substring match, and see red.

14. [ ] **e2e** (`e2e/server-strings.spec.ts`, 2 flows as in the spec). Set Arabic with the
    sweep's `localStorage` init script. The optional local run uses e2e slot 1 or 2. CI is
    the authority. Then run the full gate: `dashboard-gate.sh <wt>`.

### Meta

15. [ ] **`ci.yml`.**
    - `backend-test`: before pytest, install `gettext` if `msgfmt` is missing.
    - `e2e`: run `python manage.py compilemessages` before `runserver`. Without it, staging
      would be Arabic and CI would be English.

16. [ ] **Docs.**
    - Write the ADR "API text contract": `Accept-Language`, `error_code` and its
      vocabulary, per-app catalogs and the completeness check, subject names through
      gettext with its fallback cost, and `.mo` built and not committed.
    - Add a "Server strings" section to `docs/developer-guide/i18n.md` (the `makemessages`
      command, and running `compilemessages` in the dev container).
    - Add the `error_code` row to `docs/architecture/platform.md` and
      `subject_display_name` to `curriculum.md`.
    - These go in the unit's meta PR. The CLAUDE.md D3 row and the ISSUES.md fix line are
      left to close-out (conductor, step 12).

## Migrations

None.

## Risks

- **`compilemessages` in the image build.** It might not find the app catalogs without
  settings, or it might walk into a vendored tree. Fallback: the build-only env plus
  `manage.py compilemessages --ignore`. Verify with `docker build --target production`
  locally and by `image-scan` in CI.
- **`.mo` missing at runtime.** The page then falls back to English, with no error. Guard:
  the e2e flows run on a compiled tree. After deploy, the staging click-through checks one
  Arabic error.
- **Test-time compilation races** if pytest ever runs in parallel workers. Today it does
  not. The fixture compiles only stale files, and the files are gitignored.
- **Old bundle across the blue-green window.** `error_code` lands harmlessly in an old
  bundle's `fieldErrors`. The not-verified edge case is accepted in the spec.
- **`invalidateQueries()` on toggle** refetches every active query. The availability
  editor's unsaved-edit guard already survives a refetch (C6 e2e), and a toggle is a rare
  user action.
- **The scale of the conversion** (about 100 sites). The AST guard makes a missed site a
  red test, not a silent English string. Steps are per module, so one can be reviewed at a
  time.
- **Arabic wording.** The `msgstr`s are drafts until hg-arabic-review. Religious terms are
  flagged in translator comments. Uncertain wording is batched to the owner, never guessed
  silently.

## Verification

- Every step's named test was red first and is green now. Each mutation check is recorded
  in the hand-back block.
- `backend-gate.sh` full rc=0, including `lint-imports` (no contract change) and ruff `INT`.
- `dashboard-gate.sh` full rc=0. The floors are not touched (dec-floor-ownership).
- CI: `backend-test`, `dashboard-*` and `e2e` (both new flows named in the log) are green.
  `image-scan` builds the production image with compiled catalogs.
- Staging (step 11, dec-d9-substitute): an agent click-through in Arabic, in both themes
  and at 320px. Subjects on `/account` are Arabic. A wrong-password login shows an Arabic
  error. Switching back to English restores English without a reload.
