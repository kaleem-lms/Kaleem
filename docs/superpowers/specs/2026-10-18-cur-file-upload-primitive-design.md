---
name: cur-file-upload-primitive
phase: v1 (wave 1, brand stream)
modules: [design-system]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Three v1 units need to upload a file from the dashboard: `cur-resources-library`,
`cur-profile-photo` and `msg-attachments`. Two of them also show a person as a picture
or as initials. The dashboard has neither piece today. `src/ui` has no upload control
and no avatar. The only initials logic is `initialsFor`, a private function in
`src/features/call/ParticipantTile.tsx`.

This unit adds three things to `src/ui`, so each consumer builds on them instead of
writing its own:

- an accessible `FileUpload` that shows progress and lets the user retry;
- an `Avatar` that shows an image, or the person's initials when there is no image;
- a shared `initials()` helper that both `Avatar` and the call tile use.

Each one is rendered on `/design-preview`. This unit ships no endpoint, sends no data and
changes no product page.

Base at writing: dashboard `origin/main` `e61e23e`, meta `master` `3577c3e`.

## Decisions taken in this spec

- **The upload is transport-agnostic.** `FileUpload` takes
  `upload(file, { onProgress, signal }) => Promise<T>` from the consumer. The consumer
  calls `src/lib/api.ts`, which is axios with `withCredentials` and the CSRF header
  already set, like this:
  `api.post(url, form, { onUploadProgress: e => onProgress(e.progress ?? null), signal })`.
  This keeps CSRF and the endpoint inside the module that owns the endpoint. No new
  transport is written.
- **Checks in the browser are a convenience, not a control.** `accept` and `maxBytes`
  refuse an obviously wrong file before any bytes are sent. The server decides what is
  allowed: the type allowlist and the caps belong to `cur-upload-safety`, under
  `dec-cur-file-policy`. A consumer passes values that mirror that policy and does not
  invent its own.
- **An upload starts as soon as the file is picked.** Each file becomes one row in a
  list. A row is in one of four states:
  - `uploading`: shows the progress, or an indeterminate state until the first progress
    event arrives;
  - `failed`: shows the message, with **Retry** and **Dismiss**;
  - `refused`: the browser-side check failed. It shows a reason and **Dismiss**, but no
    Retry, because a retry would fail again;
  - `done`.
  **Cancel**, while uploading, aborts the request and removes the row. Removing a file
  that has already uploaded is the consumer's job, because it is a server delete.
- **Retry sends the same `File` again** with a fresh `AbortController`. The `File` stays
  in memory only while its row exists.
- **Progress uses the existing `Meter` with `role="progressbar"`.** Its comment already
  reserves that role for a task moving toward completion. Progress values are not
  announced one by one. A single polite live region announces "uploaded" and "could not
  be uploaded" once per file.
- **The picker is a real `<input type="file" hidden>` behind a `Button`.** The button is
  the only tab stop. A drop zone accepts dragged files as well, as an alternative to the
  button (SC 2.5.7). It never replaces the button. A dropped file passes through the
  same `accept` match, because a drop bypasses the input's `accept` attribute.
- **Focus never falls to `<body>`.**
  - After Retry, focus moves to that row's Cancel.
  - After Cancel or Dismiss, focus returns to the choose button.
- **`Avatar` wraps Radix `Avatar`**, which ships in the `radix-ui` package the dashboard
  already uses, so there is no new dependency.
  - The fallback is the initials. When the name is empty, it is the `UserRound` icon,
    the same rule the call tile uses.
  - By default the root is `role="img"` with `aria-label={name}`.
  - With `decorative`, the root is `aria-hidden` instead. Use that when the name is
    already written next to the avatar.
  - Sizes: `sm` 32px, `md` 40px, `lg` 56px and `xl` 80px. `xl` is the call tile's
    `size-20`.
- **`initials()` moves out of the call feature, and changes in one way.**
  - It now counts grapheme clusters (`Intl.Segmenter`) rather than UTF-16 units. A name
    whose letters carry Arabic harakat, or that starts with a character outside the
    Basic Multilingual Plane, no longer splits a character in half.
  - Plain Latin and Arabic names give exactly the result they give today, and the call
    tile's existing tests prove it.
  - Two Arabic initials render joined, as they do in the call tile today. This unit
    keeps that.

## User flow

No end user sees a change, apart from the grapheme fix above in the call tile. The
reviewer flow on `/design-preview` (no login) is:

1. The new **Avatar** section shows every size with a name, plus one empty-name avatar
   that falls back to the icon. All four theme × direction panels show it.
2. The new **File upload** section shows four static rows, one per state (uploading at
   40%, failed, refused, done). It also shows one live `FileUpload`. The live one's fake
   upload fails the first attempt on purpose, so that Retry can be exercised. A caption
   says so.
3. A keyboard user tabs to **Choose file** and presses Enter. The native picker opens.
   After a file is picked:
   - a progress bar names the file;
   - the first attempt fails, and the row shows the message, Retry and Dismiss;
   - Retry starts a second attempt, which succeeds;
   - the live region says the file was uploaded.
4. Error cases:
   - A file over `maxBytes`, or a dropped file that `accept` does not match, becomes a
     `refused` row and is never sent.
   - Cancel during an upload aborts it and leaves no error behind.
   - A result that settles after Cancel is ignored.

## Data model delta

None. No backend change, no migration.

## API delta

None. Consumers bring their own endpoints.

## Personal data (ADR-0023)

- **What:**
  - `Avatar` renders a name, and an image URL, that its caller already holds.
  - `FileUpload` holds the picked `File` objects in browser memory.
- **Why:** to show a person, and to allow a retry without picking the file again.
- **How long:** for as long as the component's row exists. Nothing goes to storage,
  cookies or the network, except through the consumer's own `upload` function.
- **Who sees it:** only the viewer of that page.

The preview's specimens use invented names and a generated in-memory file.

## Frontend

- **Routes:** no new routes. `/design-preview` gains two sections. It is public, has no
  data and serves every role.
- **New in `src/ui`, all exported from `src/ui/index.ts`:**
  - `initials.ts`: `initials(name)`.
  - `avatar.tsx`: `Avatar`.
  - `file-upload.tsx`: `FileUpload` and `FileUploadItem`. `FileUploadItem` is the
    presentational row, exported so the preview can render each state statically.
  - `format-bytes.ts`: `formatBytes(n, locale)`, built on `Intl.NumberFormat`'s byte
    units. It is internal and not exported.
- **Changed:**
  - `src/features/call/ParticipantTile.tsx` imports `initials` from `@/ui` and deletes
    `initialsFor`. The tile's circle markup stays as it is.
  - `src/routes/-pages/DesignPreviewPage.tsx` gains the two sections.
  - `src/locales/{en,ar}/common.json` gains an `upload.*` group:
    - choose, and choose-several;
    - the drop hint;
    - the uploading, uploaded, failed and generic-failure messages;
    - too large, and wrong type;
    - retry, cancel and dismiss. Each action's `aria-label` includes the file name and
      begins with the visible word (SC 2.5.3).
- **States:** idle, dragging over, and the four row states. Disabled means the button is
  disabled and drops are ignored.
- **Styling:** semantic token utilities only, and logical properties only. A file name
  gets `dir="auto"` and `truncate`, so a long Latin name inside an RTL panel neither
  reverses nor overflows. Row actions use `Button size="sm"`, which keeps a 44px target
  under ADR-0040.

## Module boundaries

Everything lives in the dashboard's `src/ui` design system. `features/call` already
imports `@/ui`, so the only new edge is `ParticipantTile` importing `initials`. There are
no backend modules and no events.

## Out of scope

- Any endpoint, storage, type sniffing, size policy or quota. Those are
  `cur-content-storage` and `cur-upload-safety`.
- Cropping or previewing an image before upload. `cur-profile-photo` can add it if its
  spec asks for it.
- Moving the call tile's circle, or the Lobby's icon circle, onto `Avatar`. That would
  move geometry the call e2e flows measure. Only the helper is shared here.
- Replacing the shell's `UserMenu` icon with an `Avatar`. That belongs to
  `cur-profile-photo`.
- Resumable or chunked uploads.

## Test plan

Unit tests (vitest + Testing Library + jest-axe), written first:

- **`initials`:**
  - "Fatima Ahmed" gives FA;
  - "Omar" gives OM;
  - a name with extra whitespace still works;
  - a three-part name uses the first and last parts;
  - an empty or whitespace-only name gives "";
  - "فاطمة أحمد" gives "فأ";
  - a single word with harakat gives two whole graphemes;
  - a name starting with a non-BMP character keeps the surrogate pair whole.
- **`Avatar`:**
  - shows the initials with no `src`;
  - shows the icon for an empty name;
  - is `role="img"` named after the person;
  - `decorative` hides it from the accessibility tree;
  - an image that loads replaces the fallback (with a stubbed `window.Image`);
  - an image that fails keeps the fallback.
- **`FileUpload`:**
  - picking a file calls `upload` once with that file;
  - the row is indeterminate until `onProgress(0.4)`, then the progress bar reads 40;
  - when `upload` resolves:
    - `onUploaded` gets the result;
    - the live region announces the upload once;
  - when `upload` rejects:
    - the default message is shown, or `describeError`'s message when one is given;
    - Retry calls `upload` again with the same `File` and a signal that is not aborted;
    - focus moves to Cancel;
  - Cancel:
    - aborts the signal;
    - removes the row;
    - a late rejection shows nothing;
    - focus returns to Choose;
  - Dismiss removes the row and returns focus;
  - an oversize file is refused without any call to `upload`;
  - a dropped file that does not match `accept` is refused, and a matching drop uploads;
  - unmounting aborts an upload that is still in flight;
  - the input's value is cleared after each pick, so the same file can be picked again;
  - when disabled, nothing uploads;
  - axe passes in the idle, uploading and failed states.
- **`formatBytes`:** 1536 gives "1.5 kB" in `en`, and the `ar` output uses the locale's
  digits.
- **`design-preview.test.tsx`:** "covers every @/ui export" lists the new exports, and
  the jsdom axe sweep stays green.
- **`ParticipantTile.test.tsx`:** unchanged and green. This is what proves the move kept
  the behaviour.

e2e, with a time budget of about 6 s:

- The existing preview sweeps pick up the new specimens with no edits:
  - `design-preview.spec.ts`: real-browser axe with contrast, in all four modes;
  - `touch-targets.spec.ts`: at 1280×900 and 430×932.
- One new flow, `e2e/file-upload.spec.ts`, at a 320×800 viewport:
  - Keyboard Enter on Choose raises a real `filechooser`.
  - A file with a 120-character name goes through progress, then failure, then Retry,
    then uploaded.
  - The upload section's `scrollWidth` does not exceed its `clientWidth`.

Every new regression test is mutation-checked.

## Open questions

None. No owner decision is needed. `dec-cur-file-policy` is resolved, and it sets the
values consumers pass, not this primitive. The Arabic strings are ordinary interface
words, not religious terminology. They go through the consumers' `hg-arabic-review` when
they first appear on a product page.
