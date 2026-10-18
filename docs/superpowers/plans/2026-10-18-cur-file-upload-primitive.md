---
spec: docs/superpowers/specs/2026-10-18-cur-file-upload-primitive-design.md
status: draft
---

This unit is dashboard only. It has no backend, no migration and no dependency change:
Radix `Avatar` is already in `radix-ui`, and `Intl.Segmenter` is in TypeScript's
`ES2023` lib. It touches the shared file `src/ui/index.ts`; if another unit lands there
first, the conductor resolves the conflict at the freshness step.

- Worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-cur-file-upload-primitive`,
  branch `feat/cur-file-upload-primitive`, created from `origin/main` (`e61e23e`) exactly
  as runbook section 1 says. Then run `pnpm install --frozen-lockfile`.
- `G="/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh"` and
  `WT=<the worktree>`. The focused loop is `"${G}" "${WT}" <test file>`.

## Steps

### 1. `initials` (about 1 h)

1. [ ] Write `src/ui/initials.test.ts` with the eight cases in the spec's test plan.
   Run it. It must fail, because the module does not exist.
2. [ ] Write `src/ui/initials.ts`.
   - Split on `/\s+/`.
   - Take graphemes with `new Intl.Segmenter(undefined, { granularity: "grapheme" })`.
   - For one word, keep its first two graphemes. For several words, keep the first
     grapheme of the first word and the first of the last word.
   - Uppercase the result.
3. [ ] Export it from `src/ui/index.ts`. In `ParticipantTile.tsx`, replace
   `initialsFor` with `initials` from `@/ui` and delete the private function.
4. [ ] Run `initials.test.ts` and `src/features/call/ParticipantTile.test.tsx`. Both
   must be green, and the tile's tests stay unedited.
5. [ ] Mutation check: swap the segmenter for `.slice(0, 2)` and `[0]`. The harakat test
   and the non-BMP test must go red. Then restore.

### 2. `Avatar` (about 1.5 h)

6. [ ] Write `src/ui/avatar.test.tsx` with the six cases in the spec.
   - The installed `@radix-ui/react-avatar` 1.1.12 decides whether an image has loaded
     in two ways. It creates `new window.Image()`, reads `complete && naturalWidth > 0`,
     and listens for `load` and `error`.
   - For the image cases, stub `window.Image` with an `EventTarget` subclass. Its `src`
     setter sets `complete` and `naturalWidth`, then dispatches `load` or `error` on a
     microtask.
   - The tests must fail.
7. [ ] Write `src/ui/avatar.tsx`.
   - It renders `Avatar.Root`, `Avatar.Image` and `Avatar.Fallback`, with
     `size: sm | md | lg | xl` through `cva`.
   - It uses only the call tile's tokens: `bg-secondary`, `text-foreground`,
     `ring-border`.
   - With `decorative`, the root gets `aria-hidden`. Otherwise it gets `role="img"` and
     `aria-label`.
   - The `<img>` gets `alt=""`, because the root already carries the name.
   - Export it.
8. [ ] Green, then the mutation check: drop the `aria-label` and see the role test go
   red.

### 3. `formatBytes` and the locale strings (about 0.5 h)

9. [ ] Write `src/ui/format-bytes.test.ts` (the `en` and `ar` cases). Watch it fail,
   then write `src/ui/format-bytes.ts`. Pick the largest unit up to `megabyte` with
   `Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 })`.
10. [ ] Add the `upload.*` keys from the spec to `src/locales/en/common.json` and
    `src/locales/ar/common.json`, with the same keys in both.

### 4. `FileUploadItem` and `FileUpload` (about 4 h, split across two sessions)

11. [ ] Write `src/ui/file-upload.test.tsx` with every `FileUpload` case in the spec's
    test plan.
    - Drive picking with `userEvent.upload(input, file)`.
    - Drive a drop with `fireEvent.drop(zone, { dataTransfer: { files: [file] } })`.
    - Use a controllable fake for `upload`: each call returns a deferred promise, and
      the test keeps the call's `onProgress` and `signal`.
    - All of them must fail.
12. [ ] Write `FileUploadItem`, a presentational row.
    - It takes `state`, `name`, `size`, `progress | null`, `message`, and
      `onRetry`/`onCancel`/`onDismiss`.
    - It uses `Meter role="progressbar"` once progress is known, and `Spinner` before
      that.
    - The file name is `dir="auto"` with `truncate min-w-0`.
13. [ ] Write `FileUpload`.
    - **Props:**
      - `label`, `description`, `accept`, `maxBytes`, `multiple`, `disabled`;
      - `upload`, `onUploaded`, and `describeError`.
    - **Rows:** held in `useReducer`. Each row has an id from a counter, the `File`, its
      state and progress, and the current attempt's `AbortController`.
    - **Ignoring stale results:** every settle and every progress callback checks that
      its controller is still the row's current one. This is what makes "a late
      rejection after Cancel" a no-op.
    - **Unmount:** an effect cleanup aborts every controller.
    - **The live region:** one `role="status"` element. It sets text only on `done` and
      `failed`.
    - **Picking:** after each pick, reset `input.value = ""`.
    - **Focus:** keep refs to each row's Cancel and to the choose button, and move focus
      as the spec says, in an effect keyed on the reducer's last action.
14. [ ] Export `FileUpload` and `FileUploadItem`. Run the focused file until it is
    green.
15. [ ] Mutation checks, each reverted afterwards:
    - remove the controller check, and the late-rejection test goes red;
    - remove the `input.value` reset, and the re-pick test goes red;
    - remove the accept match on drop, and the drop-refusal test goes red;
    - remove the focus effect, and the focus test goes red.

### 5. Preview (about 1.5 h)

16. [ ] Edit `src/routes/design-preview.test.tsx`:
    - add `Avatar`, `FileUpload` and `FileUploadItem` to `rendered`;
    - add `initials` to `nonVisual`.
    Run it. "covers every @/ui export" must fail until the sections exist.
17. [ ] In `DesignPreviewPage.tsx`, add the `Avatar` section and the `File upload`
    section (four static `FileUploadItem`s, and one live `FileUpload` with a caption).
    - The live one uses `previewUpload`, a local fake that does three things:
      - it ticks `onProgress` 0.25 → 1 every 100 ms;
      - it rejects the first attempt per `File`, tracked in a `WeakSet`;
      - it honours `signal`.
    - The page's `useId`-based ids keep the four panels distinct.
18. [ ] Run `design-preview.test.tsx` until green, including the jsdom axe sweep.

### 6. e2e (about 1 h)

19. [ ] Write `e2e/file-upload.spec.ts`, one flow, with no login, inside the light-ltr
    panel:
    - Set the viewport to 320×800.
    - `page.waitForEvent("filechooser")` while pressing Enter on a focused Choose. Use
      `chooser.setFiles({ name: "<120 chars>.pdf", mimeType: "application/pdf",
      buffer })`.
    - Expect the progress bar named for the file, then the failure, then Retry, then the
      "uploaded" status.
    - Evaluate the section's `scrollWidth <= clientWidth`.
    - Optionally run it locally in an e2e port slot (runbook section 2). CI is the
      authority.
20. [ ] Mutation checks:
    - Break the button's `inputRef.current?.click()`. The flow times out on
      `filechooser`.
    - Drop `truncate`. The overflow assertion goes red.
    - Restore both.

### 7. Gates and hand-back

21. [ ] Run the full gate, `"${G}" "${WT}"`: tsc, lint, `test:coverage
    --maxWorkers=6`, build, and the built-CSS colour check.
    - Do not touch `vitest.config.ts` thresholds (`dec-floor-ownership`).
    - Tailwind v4 scans comments, so grep the built CSS for any class that only a
      comment names.
22. [ ] Commit with explicit paths, in Conventional Commits:
    - `feat(ui): initials helper shared with the call tile`;
    - `feat(ui): Avatar`;
    - `feat(ui): FileUpload with progress and retry`;
    - `test(e2e): file upload on the preview`.
    Use `PIP_CONFIG_FILE=/dev/null` and never `--no-verify`.
23. [ ] At landing, in the unit meta worktree: add the D3 table row in `CLAUDE.md`
    (`design-system`: file upload, one flow, with what it does not prove: no real
    endpoint and no iOS picker), and write the journal line.

## Risks

- **Radix's image-loading internals vary by version**, so the `window.Image` stub may
  not match. Fallback: assert the image path in the e2e flow with a `data:` SVG
  specimen. Do this only if the image cases cannot be unit-tested.
- **Picking a file on iOS cannot be verified in this project.** A programmatic `.click()`
  on a `hidden` file input is the pattern widely used in production. The first consumer's
  `hg-phone-pass` is where it gets a real device. This is stated, not claimed.
- **The touch-target sweep's selector (`button, a[href], …`) does not include
  `input[type=file]`.** That is correct here, because the input is `hidden` and the
  `Button` is the target.
- **A preview fake that relies on timers can make tests flaky.** The e2e flow waits on
  roles and text, never on durations. The unit tests use deferred promises, not fake
  timers.
- **Changing `ParticipantTile` changes call code.** It is one import plus one deletion,
  and the tile's own tests stand as they are. The geometry of the call e2e flows is
  untouched because the markup is untouched.
- **Coverage:** every new branch has a test. Any shortfall is the conductor's to measure
  in CI, and is never fixed by lowering a floor.

## Verification

- Each step's focused test goes red first and green after. Each mutation check is
  recorded in the hand-back.
- The full dashboard gate is green.
- In CI, the e2e log names `file-upload.spec.ts`, and `design-preview.spec.ts` and
  `touch-targets.spec.ts` are green with the new specimens.
- The D9 staging click-through on `/design-preview` covers both themes, Arabic RTL and
  320px (`dec-d9-substitute`).
