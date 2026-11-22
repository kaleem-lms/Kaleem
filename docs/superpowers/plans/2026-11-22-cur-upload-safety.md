---
spec: docs/superpowers/specs/2026-11-22-cur-upload-safety-design.md
status: approved
---

Repos: `backend` (worktree `kaleem-worktrees/backend-cur-upload-safety`, branch
`feat/cur-upload-safety`, made as runbook §1 says) and `meta`, for this plan, the spec and the
architecture doc. The work is backend only: no migration, no route, no dashboard.

**This is a dependency-changing unit** (it adds `pillow`). `backend-gate.sh` exits 3 until a gate
image exists for the new requirements hash. The conductor allocates the build, which takes a
heavy slot (runbook §7), before step 2's first gate run.

Files:

| File | Change |
| --- | --- |
| `requirements/base.txt` | add `pillow`, upper-bounded at the next major, with a comment in the `stripe` style |
| `kaleem/content/policy.py` | new: the families, the caps, the kind → families table, the pixel limit, the quota |
| `kaleem/content/sniff.py` | new: signature checks, from bytes to a family and a content type, or `None` |
| `kaleem/content/images.py` | new: the Pillow re-encode |
| `kaleem/content/naming.py` | new: `clean_name(original, ext)` |
| `kaleem/content/throttling.py` | new: `UploadThrottle(UserRateThrottle)`, `scope = "upload"` |
| `kaleem/content/services.py` | `UploadRefused`; the checks wired into `upload_user_file`; `content_type` parameter removed; `UploadThrottle` re-exported |
| `config/settings/base.py`, `config/settings/local.py` | the `"upload"` rate, 60/hour, and the 1000/hour override with the usual comment |
| `kaleem/content/locale/ar/LC_MESSAGES/django.po` | the four messages |
| `kaleem/content/tests/test_{sniff,images,naming,policy,services,throttling}.py` | tests, written first |
| meta `docs/architecture/content.md` | the policy table, the new signature and the throttle |

## Steps

Each step is red first, then green. The failing test is committed with its fix.

1. [ ] **Dependency.** Add `pillow` to `requirements/base.txt`. Take the current major from
   `pip index versions pillow` and bound it below the next. The conductor builds the gate
   image. Check: `python -c "import PIL"` runs in the image, and `pip-audit` on
   `requirements/production.txt` is clean (CI).
2. [ ] **Sniffing**, `test_sniff.py` first. Build the fixtures in a helper,
   `tests/files.py`:
   - JPEG, PNG and WebP written by Pillow;
   - a minimal PDF that starts `%PDF-1.7\n`;
   - an MP3 with an ID3v2 header, and one that starts on a frame sync (`0xFF 0xFB`);
   - an M4A whose `ftyp` box has major brand `M4A `, and one with major `mp42` that lists `M4A `
     among its compatible brands;
   - negatives: MP4 video (`ftyp isom` with only `isom`/`avc1` brands), HTML, SVG, GIF89a,
     a PDF signature at offset 10, an empty file, three bytes.

   Assert `sniff(file) -> (family, content_type) | None`. Assert the file position is restored
   afterwards. The function reads at most the first 4 KiB.
3. [ ] **Policy**, `test_policy.py`. Every `UploadKind` has a row; a test fails when a kind is
   added without one. Each kind's families are as the spec's table says. Caps are in bytes.
4. [ ] **Re-encode**, `test_images.py`:
   - A JPEG with EXIF (GPS plus Orientation=6) comes back with no EXIF, and its width and
     height are swapped.
   - A PNG with a `tEXt` chunk comes back with none, its alpha intact.
   - A CMYK JPEG comes back as RGB JPEG.
   - An image over 30 MP fails with `too_large`, before `load()`. Assert with a mock on
     `Image.Image.load` that it is not called.
   - A truncated JPEG raises `unreadable`.
   - An animated WebP raises `type_not_allowed`.
   - `Image.MAX_IMAGE_PIXELS` is left alone; the limit is our own check, made before
     decoding.
5. [ ] **Names**, `test_naming.py`. The spec's name cases, plus a name containing a quote, which
   still round-trips through `download_url`'s RFC 5987 encoding.
6. [ ] **Service wiring**, `test_services.py`. Update the existing tests to the new signature
   (the `content_type` argument goes, and `BODY` becomes a real PDF). Then add, in this order:
   - not configured: still 503-first, with `django_assert_num_queries(0)`;
   - type refusals;
   - size refusals, at the cap and one over;
   - the quota, with `QUOTA_BYTES` patched small. It counts the stored size, and other owners'
     files do not count;
   - the stored image has no EXIF, read back from the store;
   - the name is cleaned;
   - every refusal leaves no row and an empty store directory.

   The order inside `upload_user_file`:
   1. kind (`ValueError`);
   2. `require_storage()`;
   3. sniff, then the kind's families;
   4. the size cap on the received bytes;
   5. re-encode an image;
   6. the quota, on the size to be stored;
   7. clean the name;
   8. save the object, then the row (the existing write path, unchanged).
7. [ ] **Error mapping.** Through a minimal `APIView` in the test that calls the service, each
   `UploadRefused` code reaches the client as 400 `{"detail", "error_code": <code>}`. Each
   message has an Arabic entry and renders under `ar` (the `.po` is compiled in the gate). The
   size message formats `%(limit)s`.
8. [ ] **Throttle**, `test_throttling.py`:
   - a minimal `APIView` with `UploadThrottle`, under
     `override_settings(REST_FRAMEWORK={... "upload": "2/hour"})`: the third request from a user
     is a 429 with `Retry-After`, and a second user gets a 200;
   - a settings test that `base.REST_FRAMEWORK` holds `upload: 60/hour`, and that
     `config.settings.local` overrides it to 1000/hour. It reads the module; it does not
     assume the override applies.
9. [ ] **Mutation checks**, recorded for the hand-back. With each fix reverted, its test goes
   red:
   - the sniff bypassed, using the declared type;
   - the cap check removed;
   - the quota check removed;
   - the re-encode skipped, storing the original bytes;
   - `clean_name` returning its input;
   - the pixel check moved after `load()`.
10. [ ] **Docs (meta).** Update `docs/architecture/content.md`: the policy, the new
    `upload_user_file` signature, `UploadRefused` and its codes, and `UploadThrottle`. Describe
    each control only.
11. [ ] **Gates and hand-back.** Run `backend-gate.sh` in full (migrate,
    `makemigrations --check`, which must report no changes, pytest with coverage, ruff,
    lint-imports), then `gitleaks-range.sh`. The local gate does not run mypy and CI does, so
    the new modules are fully annotated (Pillow ships its own types), and the conductor reads
    CI's mypy step. Merge `origin/main` (a merge, never a rebase), then
    run the gates again. Do not touch the coverage floor.

## e2e

None in this unit, because it has no route. D3's refusal flow (a disallowed type and an
oversize file) is written by `cur-resources-library` against its upload endpoint. That unit has
`merge_after: cur-upload-safety`. The D3 table gets no new row from this unit.

## Migrations

None. `makemigrations --check` in the full gate proves it.

## Risks

- **Pillow memory.** A 30 MP RGBA decode is about 120 MB in a gunicorn worker. The pixel check
  runs on the header, before any decode. If staging shows pressure, lower the pixel limit,
  which is a constant.
- **Real-world M4A and MP3 variety.** Some Android recorders write `mp42`/`isom` major brands.
  The compatible-brand rule covers the common case. A refused real file is a one-line policy
  change and a new fixture, never a looser rule.
- **Orientation.** Use `ImageOps.exif_transpose` before dropping EXIF, or portrait phone photos
  are stored sideways. Step 4 tests it.
- **The gate image.** A dependency change needs a new gate image (runbook §7), so this unit
  waits for a heavy slot. CI resolves the range fresh, and a drift between local and CI is
  settled by rebuilding, never by a floor.
- **Signature churn.** Removing `content_type` breaks any unit developing against the old
  signature. None exists on `origin/main` today. Before hand-back, check that
  `git grep upload_user_file origin/main` still finds only `content`.
- **Publication.** ADR-0045 §4: the conductor holds this plan and the spec out of a public meta
  PR until the backend change has deployed.

## Verification

- Per step: the named test file, red then green, through `backend-gate.sh <wt> <test path>`.
- Whole unit: the full backend gate green, every mutation check red when its fix is reverted,
  `makemigrations --check` clean, and import contracts kept with no edit to `pyproject.toml`.
- Staging: the backend deploys. With storage still not configured, any consumer upload answers
  503, which shows the new code changes nothing before the setup step. The live refusal check
  lands with `cur-resources-library`'s e2e and its staging click-through.
