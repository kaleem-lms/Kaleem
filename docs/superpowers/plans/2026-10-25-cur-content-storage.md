---
spec: docs/superpowers/specs/2026-10-25-cur-content-storage-design.md
status: approved
---

# Plan: cur-content-storage

The unit touches three repos: `backend` (code), `infra` (the env example) and meta (the
ADR and `docs/architecture/content.md`). The branch is `feat/cur-content-storage` in all
three.

- Backend worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-cur-content-storage`.
- Infra worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/infra-cur-content-storage`.
- Meta worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-cur-content-storage`.

Create each one as conductor-runbook section 1 describes. The backend base must contain
`a7b7c97` or later.

- **Migration:** `content/0001_initial` (new table only).
- **Dependency change:** yes, `django-storages[s3]`. The conductor allocates it as
  backend's one dependency-changing unit, and a new gate image is built (runbook
  section 7).
- **Floor:** no edit (`dec-floor-ownership`).
- **ADR:** 0062.
- **Approval:** the owner approved the spec on 2026-10-25, with one change (decision 10):
  production starts without the credentials and runs "not configured".

## Steps

1. [ ] **Dependency and gate image.**
   - Add `django-storages[s3]>=1.14,<2.0` to `requirements/base.txt`, with a one-line
     comment on the upper bound, like `stripe`'s.
   - The `Dockerfile` does not change: with the variables absent production still
     imports, so `collectstatic` needs no placeholders (decision 10).
   - Run `backend-gate.sh` once to print the new key, which exits 3. Ask the conductor
     for the heavy slot, then build `kaleem-gate:<key>` from the worktree (runbook
     section 7).
   - **Check:** a focused run of `tests/test_local_settings.py` passes on the new image.

2. [ ] **Red: settings.** Write `tests/settings/test_uploads_storage.py`, in the style of
   `test_sentry.py`: monkeypatch the env, pop `config.settings.*` and import.
   - `test_base_uploads_alias_is_local_filesystem_at_media_root`. It also checks that
     `default` and `staticfiles` are unchanged.
   - `test_production_uploads_alias_is_private_s3_with_signed_urls`. It asserts the
     exact `OPTIONS` dict from the spec.
   - `test_production_without_upload_variables_is_not_configured`. Alias is
     `NotConfiguredStorage`, `default` and `staticfiles` unchanged, never the filesystem.
   - `test_production_with_some_upload_variables_refuses_to_start`. Parametrize it over
     the four names; the message names the missing ones and carries no value.
   - `test_signed_url_is_regional_short_lived_and_forces_attachment`. Build `S3Storage`
     from production's options and call `.url(key, parameters=...)`. Signing needs no
     network. Assert the host `<bucket>.s3.eu-central-1.amazonaws.com`,
     `X-Amz-Expires=300`, `response-content-disposition` and `response-content-type`.

   Fake credentials must not start with `AKIA`: gitleaks matches that shape, and the
   key's shape is not what is under test. The three `_required_env` helpers need no
   change: the variables are optional.

   **Green:**
   - `STORAGES` in `base.py`.
   - `kaleem/content/storage.py` with `LocalUploadsStorage(FileSystemStorage)`, whose
     `url(name, parameters=None, expire=None, http_method=None)` returns
     `super().url(name)`.
   - `STORAGES["uploads"]` override in `production.py`, in both modes.
   - `NotConfiguredStorage` in `content/storage.py`.
   - `StorageNotConfigured` in `platform/exceptions.py`, mapped to 503 in
     `platform/drf.py` (a platform test pins the status and `error_code`).

3. [ ] **Red: model and services.** Write `kaleem/content/tests/conftest.py`, with an
   autouse fixture that applies `override_settings(STORAGES={..., "uploads": local at
   tmp_path})`. Then write `kaleem/content/tests/test_services.py`:
   - `test_upload_round_trips_bytes_and_metadata`
   - `test_key_is_random_and_names_nothing`. The key matches `^u/[0-9a-f]{32}$`, and
     neither the filename nor `str(owner.pk)` is in it.
   - `test_unknown_kind_is_a_value_error`
   - `test_failed_insert_removes_the_written_object`. Monkeypatch
     `UserUpload.objects.create` to raise. The storage must then be empty.
   - `test_get_upload_returns_info_and_unknown_id_is_not_found`. Check the
     `NotFoundError` and that `.code == "not_found"`.
   - `test_download_url_carries_rfc5987_arabic_filename_and_type`. Use a stub storage
     that records the `parameters` it receives. The filename is `واجب.pdf`.
   - `test_delete_removes_row_now_and_object_on_commit`. Use
     `django_capture_on_commit_callbacks(execute=False)`: the object is still present
     before the callbacks run and gone after them.
   - `test_rolled_back_delete_keeps_the_object`. Use `transaction=True` and raise inside
     `atomic()`.
   - `test_delete_unknown_id_is_not_found`
   - Not configured, one test each: `upload_user_file` raises and writes no row;
     `download_url` and `delete_upload` raise; `get_upload` still works.

   **Green:**
   - `models.py` (`UserUpload`, fields exactly as in the spec).
   - `makemigrations content` gives `0001_initial`.
   - `services.py` (`UploadKind`, `UploadInfo` and the four functions).

4. [ ] **Red: personal-data hooks.** Write `kaleem/content/tests/test_personal_data.py`:
   - `test_hooks_honour_contract`, which calls
     `assert_hooks_honour_contract("content.uploads", seed=..., make_user=...,
     assert_erased=no rows)`;
   - `test_erase_deletes_objects_after_commit`;
   - `test_erase_runs_late_so_consumers_clear_references_first`, which checks
     `order == 900`;
   - `test_export_is_metadata_only_in_id_order`, which checks there is no `key` and no
     URL;
   - not configured: erase raises and deletes no row when the user has rows, and is a
     no-op when the user has none.

   **Green:** `kaleem/content/personal_data.py` (`NAME`, `MODELS =
   ["content.UserUpload"]`, `export_uploads`, `erase_uploads`, `register()`), plus
   `ContentConfig.ready()`, copying assessment's pattern.

   **Check:** `tests/test_personal_data_hooks_cover_every_model.py` is green with no edit.

5. [ ] **Red: `check_upload_storage`.** Write
   `kaleem/content/tests/test_check_upload_storage.py`:
   - default mode exits 0 and leaves nothing behind;
   - `--keep` prints a `canary/` key that still exists afterwards;
   - `--existing <key>` reads and deletes it;
   - an unknown `--existing` key exits non-zero and says "read";
   - a parametrized failure at each step (write, read, fetch, delete) exits non-zero and
     names that step;
   - the HTTPS fetch runs only for an absolute `https` URL, using a stubbed opener;
   - not configured: exits non-zero and says "not configured".

   Use `call_command`, and `CommandError` for non-zero exits. **Green:**
   `kaleem/content/management/commands/check_upload_storage.py`.

5b. [ ] **Startup warning.** `test_apps.py`: `ready()` logs exactly one `WARNING` when
   the alias is `NotConfiguredStorage`, none otherwise, and the record names no value.

6. [ ] **Catalog.**
   - Run `makemessages -l ar` for `kaleem/content`, which creates
     `kaleem/content/locale/ar/LC_MESSAGES/django.po`.
   - Translate `File` (msgctxt `error resource`) as `الملف`. This is a draft entry under
     `hg-arabic-review`, like the others.
   - Add the platform catalog entry for the `StorageNotConfigured` message.
   - **Check:** `tests/test_translation_catalogs.py` and
     `tests/test_error_messages_are_translatable.py` are green.

7. [ ] **Full backend gate.** Run `backend-gate.sh <backend worktree>`, which covers
   migrate, `makemigrations --check`, pytest with coverage, ruff, format, lint-imports
   and mypy.
   - Content's two import contracts stay as they are.
   - mypy: `ignore_missing_imports` already covers the `storages` and boto3 imports. If
     mypy complains about the `url()` override signature, match `FileSystemStorage.url`
     plus keyword-only extras. Do not add an `ignore`.

8. [ ] **Mutation checks.** For each regression test, revert its fix, see it fail red,
   then restore it:
   - `querystring_expire` set to 3600, which turns the signed-URL test red;
   - `ResponseContentDisposition` dropped, which turns the Arabic-filename test red;
   - the object delete moved out of `on_commit`, which turns the rollback test red;
   - the cleanup in `upload_user_file` removed, which turns the failed-insert test red;
   - `order=900` removed, which turns the order test red;
   - the 503 mapping removed, which turns the platform mapping test red;
   - `NotConfiguredStorage` replaced by the filesystem backend in production, which
     turns the not-configured settings test red;
   - the service-level guard removed, which turns the no-row-written test red;
   - the uuid in the key replaced with `original_name`, which turns the key test red.

   Record each failure line in the hand-back block.

9. [ ] **Infra.** In `.env.production.example`, add a commented-out block with the four
   names and placeholder values `CHANGE_ME`. The comment says what each name is, that each
   environment has its own bucket and key, and that the names are not `AWS_*` on
   purpose. Make no compose change. Commit `docs(env): upload storage variables`.

10. [ ] **Meta docs.**
    - `docs/adr/0062-storage-and-file-serving.md` covers the spec's decisions 1 to 4 and
      7, with the alternatives: a VPS volume, MinIO, presigned browser PUT, serving
      through kaleem's domain and one bucket with prefixes.
    - `docs/architecture/content.md` covers the public API, the alias, the access rule,
      the bucket and IAM setup (linking the spec), the hook order and the canary
      command.
    - Commit `docs: ADR and content architecture for upload storage`.

11. [ ] **Hand-back.**
    - Merge `origin/main` into the branch (never rebase) and re-run step 7.
    - Run `gitleaks-range.sh` over `origin/main..HEAD` in backend and infra.
    - Run the floor-untouched grep.
    - Write the hand-back block. Its `needs:` line is: migration `content/0001` and the
      dependency change. The `DJANGO_UPLOADS_*` variables are deferred to the
      setup-and-deployment step and block nothing.

12. [ ] **Staging (conductor, at the setup-and-deployment step).** After the four
    variables are set, run the colour-flip check in the spec's test plan. Close-out:
    - the D3 row ("`content` — storage: ❌ by design");
    - the spec closed;
    - a journal line.

## Risks

- **The variables are missing at merge.** Expected: production runs not configured, the
  deploy is healthy, and uploads answer 503 until the setup step. A half-set group fails
  the deploy at import, on purpose.
- **A consumer ships before the variables are set.** Its upload endpoint answers 503
  `storage_not_configured`. Consumers' specs should name that as the state of the world
  until the setup step.
- **IAM is too tight in a way tests cannot see.** For example, an SDK call that needs
  `s3:ListBucket`. `file_overwrite=True` avoids the existence check (verified in
  django-storages 1.14.6). The staging canary is the real proof. If it fails on
  permissions, escalate to the owner. Never widen the policy in the repo.
- **A django-storages or boto3 release changes URL signing.** The upper bound and the
  signed-URL test pin the behaviour. The weekly gate-image rebuild and CI resolve
  versions fresh.
- **Gitleaks matches test fixtures.** Use no `AKIA…` or 40-character secret-shaped
  literals.
- **Orphan objects** appear when a caller's outer transaction rolls back. They are
  unreachable and accepted, and `cur-content-retention` sweeps them (spec decision 8).

## Verification

- Steps 2 to 6 are each red first, then green on a focused `backend-gate.sh <wt> <test>`
  run.
- The full gate in step 7 is green: coverage at or above the floor from CI, and
  lint-imports and mypy clean.
- The mutation checks in step 8 are recorded.
- The gitleaks ranges come back CLEAN.
- The staging colour-flip check passes on a real flip. That check is this unit's
  definition of done.
