---
spec: docs/superpowers/specs/2026-10-18-asm-ui-primitives-design.md
status: draft
---

## Where the work runs

| What | Value |
| --- | --- |
| Dashboard worktree | `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-asm-ui-primitives` |
| Branch | `feat/asm-ui-primitives`, created from dashboard `origin/main` (e61e23e at writing) |
| How the worktree is made | Runbook section 1, then `pnpm install --frozen-lockfile` |
| Meta worktree | `/home/abdulkhalek/Projects/kaleem-worktrees/meta-asm-ui-primitives` (this branch), for the arch doc and the `ISSUES.md` line |
| TDD loop | `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh "${WT}" <test path>` |

The unit has no dependency change, no migration, no backend change, no meta CI change and
no coverage-floor edit (`dec-floor-ownership`).

Write no Tailwind palette name and no `text-primary` in any comment or test string.
Tailwind scans comments and emits what it finds there, and `check-colors.mjs` scans
comments on purpose.

## Steps

1. [ ] **Textarea, red.** Write `src/ui/textarea.test.tsx` before the component exists.
   - Labelled through `<Label htmlFor>`, it keeps `"line one{Enter}line two"` as typed.
   - The class carries the `Input` recipe parts plus the parts that differ. Present:
     `border-input`, `text-base`, `sm:text-sm`, `text-start`, `resize-y`, `min-h-24`.
     Absent: `rtl:text-right`.
   - `rows` defaults to `4` and a caller can override it.
   - Inside `<Field error="…" required>`, it gets `aria-invalid="true"`,
     `aria-required="true"`, and an `aria-describedby` that resolves to the error text.
   - A `ref` object ends up holding the `HTMLTextAreaElement`.
   - With no `surface`, the class contains `focus-visible:ring-offset-background`. With
     `surface="card"`, it contains `focus-visible:ring-offset-card`.
   - It passes `axe` when labelled.

   Run it and see every case fail on the missing module.

2. [ ] **Textarea, green.** Write `src/ui/textarea.tsx`.
   - Use a function component typed `React.ComponentProps<"textarea">` plus `surface`, so
     React 19 passes `ref` as a prop. `Select` sets the precedent.
   - Combine, with `cn()`: `Input`'s base, hover and placeholder classes, then
     `focusRing(surface)`, the disabled classes, the `aria-invalid` pair, `text-start`,
     `resize-y` and `min-h-24`. `rows` defaults to 4.

3. [ ] **RatingInput, red.** Add `common.ratingOption` to the EN and AR locale files:
   EN `"{{value}} of {{max}}"`, AR `"{{value}} من {{max}}"`. Then write
   `src/ui/rating-input.test.tsx`, importing `@/lib/i18n`. It covers:
   - `getByRole("radiogroup", { name: "Rate the lesson" })` holds 5 radios named
     `1 of 5` … `5 of 5`. With `max={10}` there are 10.
   - **The fill rule.** With `value={null}`, no radio is checked. With `value={3}`,
     `3 of 5` is checked. The star `svg`s in items 1–3 carry `fill-primary` and items
     4–5 carry `fill-none`. An item exposes the star as its only `svg`.
   - **The number coercion.** A click on `4 of 5` calls `onValueChange` with the number
     `4`, asserted with `toHaveBeenCalledWith(4)` and `typeof === "number"`.
   - **LTR keys.** Focus the checked `3 of 5` and press ArrowRight: the callback gets 4.
   - **RTL keys.** With `dir="rtl"`, ArrowLeft from 3 gives 4. With no `dir` prop and
     `i18n.changeLanguage("ar")`, ArrowLeft from 3 also gives 4. Restore `en` in
     `afterEach`.
   - **Arabic names.** Under `ar`, the third radio is named `٣ من ٥`.
   - `required` sets `aria-required="true"` on the group and shows an `*` inside an
     `aria-hidden` span.
   - `error="Choose a rating"` sets `aria-invalid="true"` on the group, an
     `aria-describedby` that resolves to a `role="alert"` with that text.
   - When `disabled`, every radio is disabled and a click calls nothing.
   - Every radio's class contains `size-11`.
   - It passes `axe` once with a value and once with an error.

   Run it and see every case fail.

4. [ ] **RatingInput, green.** Write `src/ui/rating-input.tsx`.
   - The group label is visible: a `<span id>` with an `aria-hidden` asterisk, as `Field`
     renders it, wired with `aria-labelledby`.
   - Use `RadioGroup.Root` with these props:
     - `value={value == null ? "" : String(value)}`
     - `onValueChange={(v) => onValueChange(Number(v))}`
     - `dir={dir ?? (RTL_LOCALES.includes(i18n.language as Locale) ? "rtl" : "ltr")}`
     - `required`, `disabled`, `name`
     - `aria-invalid` and `aria-describedby` when an error is set
     - the classes `flex flex-wrap gap-1`
   - Render one `RadioGroup.Item` for each `n` in `1..max`:
     - `aria-label={t("ratingOption", { value: fmt(n), max: fmt(max) })}`, where `fmt`
       is `Intl.NumberFormat(i18n.language)`
     - the classes `size-11 inline-flex items-center justify-center rounded-md`,
       `hover:bg-muted`, `focusRing(surface)` and the disabled classes
   - Inside each item is a lucide `Star`, `aria-hidden`, at `size-6`. Its classes are
     `fill-primary stroke-primary` when `n <= (value ?? 0)`, and `fill-none stroke-input`
     otherwise.
   - Render `FormError` with `id={\`${groupId}-error\`}` when `error` is set.
   - Type `surface` as `Extract<FocusSurface, "background" | "card">`.

5. [ ] **Mutation-check steps 2 and 4.** Make each change, watch the named test go red,
   then revert it. Record each result in the hand-back.

   | Change | Test that must go red |
   | --- | --- |
   | Drop the `dir` prop on `RadioGroup.Root` | both RTL tests |
   | Fill with `n === value` instead of `n <= value` | the fill test |
   | Pass `v` without `Number()` | the coercion test |
   | Remove `resize-y` from `Textarea` | its class test |

   If the RTL test stays green with `dir` dropped, Radix's keyboard path is not reaching
   jsdom. In that case, replace the keyboard assertion with the `dir` attribute Radix
   renders on the group root. It must go red the same way.

6. [ ] **Barrel and preview, red then green.**
   - Export from `src/ui/index.ts`: `Textarea`, `RatingInput` and
     `type RatingInputProps`.
   - Run `src/routes/design-preview.test.tsx`. "covers every @/ui export" must fail and
     list `RatingInput` and `Textarea`.
   - Add both names to its `rendered` set, and `RatingInputProps` to `nonVisual`.
   - In `Specimens`, in "Form controls", add these specimens. Use `id(...)` ids and
     `useState` for the controlled ratings.
     - `Field` with a `Textarea` holding a two-line default value
       (label "Lesson notes")
     - `Field` with a `Textarea` and an error ("Add what was covered")
     - `Field` with a disabled `Textarea`
     - `RatingInput` "Rate the lesson" at 3
     - `RatingInput` "Rate the student" at `null`, `required`, with
       `error="Choose a rating"`
     - a disabled `RatingInput` at 4
   - Pass `dir={idPrefix.endsWith("rtl") ? "rtl" : "ltr"}` to each `RatingInput`,
     following the `formatRelative` specimen.
   - All three preview tests go green: the four modes, jsdom axe and barrel coverage.

7. [ ] **Full dashboard gate.** Run
   `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/dashboard-gate.sh "${WT}"`. It runs
   tsc, lint, `test:coverage --maxWorkers=6` (the floors in `vitest.config.ts` must
   hold, and are not edited), build, and `check-colors.mjs --built`. Then
   `grep -o 'fill-primary\|stroke-input\|fill-none' dist/assets/*.css` must show the
   utilities were emitted.

8. [ ] **e2e sweeps (optional slot 1 or 2; CI is the authority).** Follow runbook
   section 2, "e2e slot". Run `e2e/design-preview.spec.ts` and
   `e2e/touch-targets.spec.ts`; both must be green.
   - **Mutation check:** temporarily change the star items' `size-11` to `size-5`. The
     target sweep must go red and name the stars at both widths. Then revert.
   - If no slot is free, record that in the hand-back. CI runs both files, and the
     reviewer reads the e2e log for them.

9. [ ] **Commit in the dashboard worktree** with explicit paths, and with
   `PIP_CONFIG_FILE=/dev/null`:
   - `src/ui/textarea.tsx` and its test
   - `src/ui/rating-input.tsx` and its test
   - `src/ui/index.ts`
   - both locale files
   - `src/routes/-pages/DesignPreviewPage.tsx` and `src/routes/design-preview.test.tsx`

   Message: `feat(ui): Textarea and RatingInput primitives`.

10. [ ] **Meta docs, in the meta worktree.**
    - `docs/architecture/design-system.md`: add two rows to "The primitive layer" table.
      - `Textarea`: the native element; `resize-y` for 1.4.10; `surface`.
      - `RatingInput`: a radiogroup, not a slider; it passes `dir` because the app has no
        Radix direction provider; the colours use the asserted `primary` and `input`
        pairs only.
    - `ISSUES.md` gets one "Someday" line. Radix roving focus has no `DirectionProvider`,
      so `RadioCardGroup` arrow keys are mirrored wrong under Arabic. The fix is to mount
      Radix `DirectionProvider` in `main.tsx`. `RatingInput` works around it locally.
    - Commit message: `docs: design-system primitives table and RTL roving-focus issue`.

## Risks

- **Shared files.** `cur-session-wording` and other wave-1 dashboard units also edit the
  locale JSON. `inf-fraunces-display-font` touches the preview. The new key sits under
  `common`, which no other unit renames. At freshness the conductor resolves locales by
  script and re-runs step 6's tests.
- **jsdom may not drive Radix's arrow keys.** The fallback is in step 5. A test that
  cannot go red is not kept.
- **The Arabic digits rely on ICU.** Node 22 in CI and Node 24 on the host both ship
  full ICU, so `Intl.NumberFormat("ar")` gives `٣`. If CI disagrees, the test asserts
  the formatter's output instead of a literal. The behaviour does not change.
- **Arabic copy.** `"{{value}} من {{max}}"` is plain wording, not religious or legal text.
  The Arabic review gates of `asm-teacher-report-ui` and `asm-ratings` see it in context.
- **Contrast.** The stars use only pairs the manifest asserts (`primary` and `input` on
  `background` and `card`). Browser axe does not judge SVG fills, so this rests on the
  manifest and on the `surface` type narrowing.

## Verification

- **Steps 1–6:** each test file is red before its code and green after, and the
  mutation-check table is recorded.
- **Step 7:** the full dashboard gate is green with the floors untouched.
- **Step 8, or CI if no slot was free:** `design-preview.spec.ts` and
  `touch-targets.spec.ts` are green, and the target sweep goes red on a shrunken star.
- **D9:**
  - a click-through of `/design-preview` in both themes, Arabic RTL and 320px, under
    `dec-d9-substitute`;
  - the arch doc is updated;
  - staging deploys through the conductor's queue.
