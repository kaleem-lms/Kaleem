---
number: 0062
title: Storage and file serving
status: accepted
date: 2026-10-25
---

## Context

Several v1 units store files people upload: profile photos (children's included),
teaching resources and chat attachments. Today a file has nowhere durable to go.
`MEDIA_ROOT` is a directory inside the container, there is no `STORAGES` setting and no
media volume, and `ship.sh` removes the old colour's containers on every deploy, so
anything written there is lost at the next colour flip.

Uploads carry personal data and some of it belongs to children. Where the bytes live,
who can fetch them and for how long are security controls, not plumbing. The owner chose
AWS S3 in an EU region on 2026-10-25 (`dec-cur-storage-provider`), in the AWS account that
already holds the SES setup. The owner also decided on 2026-10-25 that every credential is
deferred to a final setup-and-deployment step, so the code has to ship and run without
them.

## Decision

1. **The server stores and signs. The browser never writes to the bucket.** Bytes reach
   the bucket through the API: a consumer's endpoint hands the file to
   `content.services.upload_user_file`. The upload-safety checks (sniffed type, size
   caps, image re-encode) therefore sit on the only path into the bucket, the bucket
   needs no CORS rule, and the dashboard's `FileUpload` primitive keeps posting through
   `src/lib/api.ts`.
2. **Files are read through signed URLs on the provider's own domain.** A URL is
   `https://<bucket>.s3.<region>.amazonaws.com/<key>?X-Amz-...` and expires after 300
   seconds. The file is never on a `kaleem.academy` host, so a stored file cannot run
   script with access to kaleem's cookies. Every URL is signed with a
   `response-content-disposition: attachment` carrying the original name (RFC 5987, so
   Arabic names survive and a quote or line break is inert) and with the stored
   `response-content-type`. A navigation downloads the file instead of rendering it;
   `<img src>` ignores the disposition, so photos still show.
3. **`content` never decides who may read a file.** `download_url`, `get_upload` and
   `delete_upload` trust their caller. Each consumer checks access (chat membership, the
   teaching link, ownership) before calling, and each consumer's spec states its check.
   This keeps `content` a leaf that imports nothing beyond `identity` (ADR-0049).
4. **One storage alias, `uploads`, resolved at call time.** `STORAGES["uploads"]` is the
   filesystem in `base.py` (local, test, CI) and is replaced in `production.py`. The model
   stores the object key in a `CharField`, not a `FileField`, which would resolve its
   storage once at import. `default` and `staticfiles` keep their backends, and nothing
   personal may use `default`.
5. **Object keys are random and say nothing.** `u/<uuid4 hex>`: no user id, filename or
   kind in a key, a URL path or a provider log.
6. **One bucket and one IAM user per environment.** Staging and production share a
   server, so each has its own bucket and its own key in its own `.env.production`, and
   neither key can reach the other bucket. Separate buckets, not prefixes, so versioning,
   lifecycle and access are separate too.
7. **Least privilege.** The application key may put, get and delete objects and abort a
   multipart upload in its own bucket only. It may not list the bucket, read or delete
   old versions, or change a bucket setting. Old versions are removed by a 30-day
   lifecycle rule, so a leaked application key cannot permanently destroy stored files.
8. **Deletion is row first, object after commit.** `delete_upload` and the erase hook
   delete the row and delete the object in `transaction.on_commit`, so a rolled-back
   request never loses a file its row still points to. An insert that fails after the
   object was written removes the object again.
9. **Two modes; production never falls back to the disk.** With all four
   `DJANGO_UPLOADS_*` variables set, `uploads` is S3. With none set, it is
   `NotConfiguredStorage`: every operation raises `StorageNotConfigured`, which the API
   maps to **503** with `error_code` `storage_not_configured`, the process logs one
   warning at startup, and `check_upload_storage` exits non-zero saying "not configured".
   Some but not all of the four is a typing mistake and stops the deploy with
   `ImproperlyConfigured`, naming the missing variables and no value. The deploy is
   healthy in the unconfigured mode, because nothing in the readiness probe touches
   storage.

## Alternatives considered

- **A VPS volume (a Docker volume or bind mount).** It survives a colour flip, but not the
  loss of the host, and it is not backed up, versioned or encrypted unless we build that.
  It also makes the app servers stateful, which blocks a second host. Rejected as the
  default; it remains the shape of the local backend.
- **MinIO on the VPS.** S3-compatible and self-hosted, so it would keep data on our own
  machine, but it adds a service to run, patch and back up for a solo operator, and it
  shares the host's failure domain. Rejected for v1.
- **A presigned PUT from the browser.** Saves the API a hop for large files, but moves the
  size, type and re-encode checks out of our code (the bucket cannot sniff a file), needs a
  CORS rule, and leaves a window where an unchecked object exists. Rejected. A later unit
  may revisit it for video, with its own checks.
- **Serving files through kaleem's own domain (a proxy view or a CDN on `kaleem.academy`).**
  Lets us enforce access on every read, but puts attacker-supplied bytes on a host that
  shares cookies with the app, which is the hole decision 2 closes. It would also make the
  API carry every download. Rejected.
- **One bucket with a prefix per environment.** One thing to create, but versioning,
  lifecycle and the IAM policy would be shared, and a mistaken policy would expose both
  environments. Rejected (decision 6).
- **Falling back to the local disk when the variables are absent.** It would let a
  consumer demo work before the setup step, and it would silently lose every file at the
  next colour flip, which is the failure this decision exists to end. Rejected (decision
  9): a clear 503 is better than data that quietly disappears.

## Consequences

- Good: a file survives a colour flip, is encrypted at rest, is versioned, and is reachable
  only for five minutes through a URL we signed after our own access check. The bucket is
  never public.
- Good: the code ships and the deploy is healthy before any credential exists. Setting the
  four variables and redeploying switches the module on with no code change.
- Good: every consumer gets the same four calls and the same two failure shapes
  (`not_found`, `storage_not_configured`).
- Bad: every upload passes through the API, so large uploads cost API bandwidth and
  worker time. Accepted for v1's file sizes.
- Bad: a signed URL can be forwarded for up to five minutes, and `content` cannot revoke
  it. The short lifetime is the control.
- Bad: until the setup step, consumers' upload endpoints answer 503. Their specs should
  say so.
- Bad: S3 adds a dependency (`django-storages[s3]`, with boto3) and a provider that holds
  personal data. AWS is a sub-processor under its Data Processing Addendum; the public
  notice lists it (`lb-gdpr-governance-docs`).
- Follow-ups owned elsewhere: validation and quota (`cur-upload-safety`), the orphan sweep
  and retention purges (`cur-content-retention`), the offsite copy and restore drill
  (`cur-media-backup`).
