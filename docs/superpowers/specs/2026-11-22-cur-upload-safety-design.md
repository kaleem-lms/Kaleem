---
name: cur-upload-safety
phase: v1 (wave 3, content stream)
modules: [content]
status: approved
created: 2026-11-22
closed: null
---

## Goal

Every file that reaches the `uploads` store goes through `content.services.upload_user_file`
(ADR-0062 decision 1). Today that function stores whatever it is given, under the content type
its caller names. This unit puts the upload checks on that one path, so no consumer
(`cur-resources-library`, `cur-profile-photo`, `msg-attachments`, `adm-teacher-application`)
can skip them or get them wrong:

1. **An allowlist per kind, by sniffed type.** The type comes from the file's own bytes. The
   name the browser sent and the type it declared are not used.
2. **A size cap per type, and a storage quota per owner.**
3. **Images are re-encoded.** The pixels are decoded and written to a new file, so EXIF and
   every other metadata block (location, device, capture time) are not stored.
4. **A safe download name.** The extension always matches the sniffed type.
5. **A scoped upload throttle** that consumers' upload endpoints apply, with its `local.py`
   e2e override.

The policy is `dec-cur-file-policy`: PDF, images, MP3/M4A, with caps and a quota. Video is
shared as a link, never uploaded.

Publication: per ADR-0045 §4 this spec and its plan are made public with the code, after it
deploys.

## The policy

These numbers were approved by the owner with this spec on 2026-11-22, unchanged. They live as constants in
`kaleem/content/policy.py`, so changing one later is a one-line PR.

| Family | Accepted when the bytes are | Stored as | Size cap |
| --- | --- | --- | --- |
| image | JPEG, PNG or WebP, one frame, at most 30 megapixels | `image/jpeg`, `image/png`, `image/webp` (same format, re-encoded) | 10 MB as received |
| pdf | PDF (`%PDF-` at offset 0) | `application/pdf` | 20 MB |
| audio | MP3 (an ID3 tag or an MPEG audio frame header), or M4A (an `ftyp` box whose major or compatible brands include `M4A `) | `audio/mpeg`, `audio/mp4` | 30 MB |

| Kind | Families |
| --- | --- |
| `profile_photo` | image |
| `resource` | pdf, image, audio |
| `message_attachment` | image, pdf |

- **Quota:** 1 GiB stored per owner, across all kinds. It counts the stored size, after a
  re-encode.
- **Throttle:** scope `upload`, 60 requests per hour per signed-in user. `local.py` raises it to
  1000/hour for the e2e suite. `base.py` keeps the real value, and tests check the real value
  with `override_settings`.
- **Not accepted:** anything else, including GIF, HEIC, SVG, animated PNG/WebP and every video
  format. A consumer whose own decision differs (`dec-msg-attachments`) changes its kind's row in
  its own spec.

## User flow

There is no screen in this unit. A consumer's upload endpoint calls `upload_user_file`, and the
person sees one of these outcomes:

1. **Accepted.** The file is stored and recorded. An image is stored re-encoded, with no
   metadata. `content_type` is the sniffed type, `size` is the stored size, and `original_name`
   is the cleaned name.
2. **Refused, 400.** Nothing is written, neither the object nor the row. The body is
   `{"detail": <message in the request's language>, "error_code": <code>}`:

   | `error_code` | When | Message (English; Arabic entry in `content`'s catalog) |
   | --- | --- | --- |
   | `upload_type_not_allowed` | the bytes are no family this kind allows, or are an animated image | "This type of file can't be uploaded here." |
   | `upload_too_large` | over the family's cap, or an image over the pixel limit | "This file is too large. The limit is %(limit)s." |
   | `upload_quota_exceeded` | the stored file would take the owner past the quota | "You have used all of your file storage. Delete some files and try again." |
   | `upload_unreadable` | the bytes claim to be an image but it cannot be decoded | "This file is damaged or can't be read." |
3. **Throttled, 429**, `error_code` `throttled` (DRF's), with `Retry-After`.
4. **Storage not set up, 503**, `error_code` `storage_not_configured`. This is unchanged
   (ADR-0062 decision 9). It is checked first, before the file is read and before the quota
   query, so a deployment without a bucket still touches nothing.

`%(limit)s` is the cap in whole megabytes, formatted in the active locale.

## Data model delta

None, and no migration. The existing columns now mean more:

- `content_type`: always the sniffed type, never the caller's.
- `size`: the bytes actually stored.
- `original_name`: cleaned before it is saved.
  - Only the last path segment is kept.
  - Control characters, `/` and `\` are removed.
  - The final extension becomes the canonical one for the sniffed type (`.jpg`, `.png`,
    `.webp`, `.pdf`, `.mp3`, `.m4a`). It is replaced when it differs, and appended when there
    is none.
  - The result is cut to 255 characters with the extension kept, or is `file.<ext>` when
    nothing is left.

The quota is a `Sum("size")` over the owner's rows. It uses the existing `owner` index.

## API delta

No HTTP route; `content` still has none (ADR-0062 decision 3). The Python API changes:

- `upload_user_file(*, owner, kind, file, original_name) -> UploadInfo`. The `content_type`
  parameter is **removed**: the type is sniffed. On `origin/main` the function has no caller
  outside `content`'s own tests, so the change breaks no caller.
- `UploadRefused(ValidationError)`: one exception carrying one of the four codes above. It
  subclasses `kaleem.platform.exceptions.ValidationError` with no `field`, so the existing
  exception handler maps it to 400 and passes its own `error_code` through. `platform` is not
  changed.
- `UploadThrottle`: a `ScopedRateThrottle` with `scope = "upload"`, exported from
  `content.services`. Each consumer's upload view lists it in `throttle_classes`, and each
  consumer's spec says so.

## Frontend

None in this unit. The dashboard's `FileUpload` primitive (`cur-file-upload-primitive`) already
shows the server's message. Each consumer mirrors this policy in its `accept` and `maxBytes`,
which are a convenience, not the control. Consumers branch on `error_code` alone.

## Module boundaries

- Owned by `content`. Nothing new is imported across modules, and both of content's import
  contracts are unchanged. Consumers already reach `content.services` only.
- One new dependency, `pillow`, upper-bounded at the next major like `stripe`. Its manylinux
  wheel needs no system library, so `backend/Dockerfile` does not change. Type sniffing is a
  short module of signature checks in `content`, with no `libmagic`.
- **Personal data (ADR-0023):** no new data is stored. Image metadata, which can hold a
  location, a device and a capture time (children's photos included), is removed before
  storage. Retention, export and erase are unchanged (`cur-content-storage`'s hooks). Who can
  see a file is unchanged: the consumer's check.
- **Expand/contract:** no schema change, no route, and nothing the previous dashboard bundle
  calls.

## Out of scope

- Any endpoint, access check or screen. Those belong to the consumers.
- Video files (links only, `dec-cur-file-policy`), HEIC, GIF and SVG.
- An endpoint that publishes the policy to the dashboard. A consumer may add one.
- Orphan sweeps and retention (`cur-content-retention`).

## Test plan

Backend only, in `kaleem/content/tests/`. The fixtures are real files built in the test: Pillow
writes the images, and the PDF, MP3 and M4A headers have their real byte layout. No fixture is a
stub that only starts with a magic string.

- **Accepted:** each family × each kind that allows it stores the object and the row, with the
  sniffed `content_type`.
- **Type:** a PNG declared as a PDF is stored as `image/png`. A PDF is refused as a
  `profile_photo`. An HTML file, an SVG, a GIF, an MP4 video (`ftyp isom`, no `M4A ` brand) and
  an empty file are each `upload_type_not_allowed`, and nothing is written.
- **Size:** a file one byte over its cap is refused and one at the cap is accepted, for each
  family. An image over 30 MP, which is small on disk but large in pixels, is `upload_too_large`
  before it is decoded in full.
- **Quota:** a file that would cross 1 GiB is refused. Exactly reaching it is accepted.
  Another owner's files do not count. The re-encoded size is what counts. Tests patch the quota
  constant to a small number.
- **Re-encode:** a JPEG with EXIF GPS and an orientation tag is stored with no EXIF, upright
  (the orientation is applied, then dropped). A PNG `tEXt` chunk is gone. A truncated JPEG is
  `upload_unreadable`. An animated WebP is `upload_type_not_allowed`.
- **Name:** `../../x.html` with PDF bytes becomes `x.pdf`. Arabic names survive. A name with a
  control character or no extension is cleaned. A 300-character name is cut with its extension
  kept.
- **Ordering:** with storage not configured, an invalid file still gets the 503, and no query
  runs. A refused file leaves the store's directory empty and no row.
- **Throttle:** a minimal `APIView` in the test with `UploadThrottle`, at a real rate set by
  `override_settings`. The (n+1)th request is a 429 with `Retry-After`, and a second user is not
  throttled. A settings test asserts `base.py`'s 60/hour and `local.py`'s override.
- **i18n:** each code's message has an Arabic entry. The test renders each one under `ar`.
- Mutation checks: revert each control (the sniff, the cap, the quota, the re-encode, the name
  cleaning) and see its test go red.

e2e: none in this unit, because there is no route to drive. The refusal flow (a disallowed type
and an oversize file are refused) arrives with `cur-resources-library`, which merges only after
this unit (its `merge_after`).

## Open questions

None. The owner approved this spec on 2026-11-22 with the numbers in "The policy" unchanged: the
caps, the 30 MP limit, the 1 GiB quota and 60/hour. Children's photos and new refusal behaviour
are why the owner approves this spec (`dec-spec-approval`).
