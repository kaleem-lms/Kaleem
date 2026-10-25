# content — architecture

Durable, private storage for the files people upload, and a small Python API to use it.
Today that is one table, four service functions, one storage alias, the personal-data hooks
and one operator command. There is **no HTTP route and no screen**: each consumer
(`cur-profile-photo`, `cur-resources-library`, `msg-attachments`) adds its own endpoint and
its own access check.

Spec: `docs/superpowers/specs/2026-10-25-cur-content-storage-design.md` · ADR-0062 (storage
and file serving) · ADR-0049 (the edges to curriculum) · ADR-0048 (export and erase hooks).

## Data model

```mermaid
erDiagram
    User ||--o{ UserUpload : "owns"
    UserUpload }o--|| OBJECT : "key"
```

- **UserUpload** — `owner` (FK to the user model, `PROTECT`, `related_name="+"`), `kind`
  (an `UploadKind` value, plain text), `key` (unique, `u/<uuid4 hex>`), `original_name`,
  `content_type`, `size`, `created_at`. The FK is `PROTECT` so a row, and its object, goes
  only through `delete_upload` or the erase hook, never as a silent cascade.

`key` is a `CharField`, not a `FileField`: a `FileField` resolves its storage once at
import, so tests could not move it onto a temporary directory and production could not tell
"configured" from "not configured" at call time. Kinds are a code enum, so adding one needs
no migration.

## Public API (`kaleem/content/services.py`)

| Call | What it does |
| --- | --- |
| `upload_user_file(owner, kind, file, original_name, content_type)` | Writes the object, then the row. Removes the object if the insert fails. `ValueError` for an unknown kind. |
| `get_upload(id)` | `UploadInfo` (a frozen dataclass; never the model). |
| `download_url(id)` | A signed URL, 300 seconds, `attachment` disposition, the stored type. |
| `delete_upload(id)` | Deletes the row now and the object once the transaction commits. |

An unknown id raises `NotFoundError("File", id)` (code `not_found`, with an Arabic catalog
entry). Deleting an already-deleted id is the same not-found.

**The access rule.** `content` never decides who may read a file. `download_url`,
`get_upload` and `delete_upload` trust their caller, and every consumer checks access
(chat membership, the teaching link, ownership) first. Its own spec states the check.
`content` imports only `kaleem.platform` and calls `identity.services` if it must; it
imports no business module's models, and its two import contracts are unchanged.

## The storage alias

`STORAGES["uploads"]` is read at call time. It has three shapes:

| Environment | Backend |
| --- | --- |
| local, test, CI (`base.py`) | `LocalUploadsStorage`, the filesystem under `MEDIA_ROOT`; `url()` accepts and ignores the signing parameters and returns `/media/<key>`, served only with `DEBUG` on |
| production, all four `DJANGO_UPLOADS_*` set | `S3Storage`: private bucket, `s3v4`, virtual-hosted addressing, `querystring_auth`, `querystring_expire=300`, no ACLs, `file_overwrite=True` |
| production, none set | `NotConfiguredStorage`: every operation raises `StorageNotConfigured` |

`StorageNotConfigured` lives in `kaleem.platform.exceptions` (the exception handler cannot
import `content`) and maps to **503** with `error_code` `storage_not_configured`. The
services call `require_storage()` before touching the database, so an unconfigured
deployment writes no row and deletes no row. `get_upload` and the export hook read only the
database and keep working.

Production **never** falls back to the disk, because a file written to a container's disk is
lost at the next colour flip. `ContentConfig.ready()` logs one warning per process when the
alias is `NotConfiguredStorage`; it names the variables and no value. Setting only some of
the four stops the deploy at import (`ImproperlyConfigured`).

Keys are random server-side, so the backend skips the existence check
(`file_overwrite=True`), which would otherwise need the list permission the application key
deliberately lacks.

## Bucket and IAM setup

Deferred to the setup-and-deployment step. Per environment, one bucket and one IAM user; the
exact settings (Block Public Access, bucket-owner-enforced, SSE-S3, versioning, the 30-day
lifecycle rule, the deny-insecure-transport policy, and the four-action inline IAM policy)
are in the spec's "Owner setup" section. The application key has no list and no version
actions, so a leak cannot permanently destroy stored files.

## Personal data (`content.uploads`)

- **Export** — metadata only: kind, original name, content type, size and creation time, in
  id order. No key and no URL (a URL is not deterministic; a key is internal). Delivering the
  bytes is the export unit's job.
- **Erase** — deletes the user's rows and, on commit, their objects. Registered with
  `order=900`, so a consumer whose rows point at an upload runs its erase hook first. With no
  store configured it raises instead of deleting rows it could not delete objects for (and
  does nothing for a user with no rows).
- A failed object delete is logged and skipped, never raised: the row is already gone, and a
  surviving object is an unreachable orphan that `cur-content-retention` sweeps.
- Retention: the row and object live until a consumer deletes them or the user is erased; a
  non-current version stays in the bucket for up to 30 days (`dec-cur-retention`).

## Operator command

`manage.py check_upload_storage` writes a random canary under `canary/`, reads it back,
fetches its signed URL when that is an absolute `https` URL, and deletes it. Any failure
exits non-zero and names the step (`write`, `read`, `url`, `fetch`, `delete`); with no store
it exits non-zero saying "not configured". `--keep` leaves the canary and prints its key;
`--existing <key>` checks and deletes one an earlier run kept. Run with `--keep` before a
deploy and `--existing` after the colour flip to prove a file survives.

## Not here

Any endpoint, permission check, type or size validation, quota or EXIF strip
(`cur-upload-safety` and the consumers); retention purges and the orphan sweep
(`cur-content-retention`); the offsite copy and restore drill (`cur-media-backup`); serving
through kaleem's domain or a CDN. A Content-Security-Policy `img-src` entry for the bucket
origin is owed by `cur-profile-photo` if a CSP sets `img-src` before it ships.
