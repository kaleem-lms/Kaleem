---
name: asm-ui-primitives
phase: v1 (wave 1, brand stream)
modules: [design-system]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Add two primitives to the dashboard's `src/ui/` layer: `Textarea` and `RatingInput`.
Neither exists today. A `git grep` of dashboard `origin/main` (e61e23e) finds no
`<textarea>` and no rating control anywhere in `src/`. Two later units need them:
`asm-teacher-report-ui` (the report's free-text fields and the rating of the student) and
`asm-ratings` (the student side's rate control). Building them here, token-styled and
shown on `/design-preview`, puts them under the gates that already sweep that page before
any feature uses them. Those gates are the jsdom axe sweep, the real-browser axe and
contrast run, and the 24x24 target-size sweep.

Decision ids: none of the unit's own. Approval follows `dec-spec-approval`, and floors
follow `dec-floor-ownership`.

## Decisions taken in this spec

- **`Textarea` is a native `<textarea>` and copies `Input`'s recipe.** The border is
  `--input`, the form-control boundary the contrast manifest asserts at 3:1 or better on
  background and card. The text is 16px below `sm` (so iOS does not zoom on focus) and
  14px from `sm` up. It uses the same `aria-invalid` treatment as `Input`, so `<Field>`
  drives it unchanged. Three things differ from `Input`, each for a reason:
  - **`text-start`**, not `Input`'s `rtl:text-right`. `Select` already moved to the
    logical form, and the physical form is the older one.
  - **`resize-y` only.** Horizontal resize lets a user drag the field wider than a 320px
    viewport (SC 1.4.10).
  - **A `surface` prop**, the same as `Select`'s. The report form will sit inside a
    `Card`, and a `--background` focus offset there draws a halo in the wrong colour.

  The minimum height is `min-h-24` (96px), and `rows` defaults to 4.
- **`RatingInput` is a radio group, built on Radix `RadioGroup`.** It uses the same base as
  `RadioCardGroup`. A rating is one choice out of N, so `radiogroup`/`radio` is the
  correct pattern, and arrow keys, roving focus and checked state come with it. Each item
  is a `<button role="radio">`, so `e2e/touch-targets.spec.ts` already selects it through
  its `button` selector. No e2e selector changes.
  - **The API:** `label`, `value: number | null`, `onValueChange(n: number)`, `max`
    (default 5), plus optional `required`, `error`, `disabled`, `name`, `dir`, `surface`
    and `className`. It is a controlled component, so react-hook-form drives it through
    `Controller`. `null` means not rated yet, and then no radio is checked.
  - **It renders its own visible label, required asterisk and `FormError`.** It is not
    wrapped in `<Field>`, because `<label for>` cannot point at a `radiogroup`. This is the
    approach `RadioCardGroup` takes for its label. With `error` set, the group gets
    `aria-invalid` and `aria-describedby` pointing at the error text. With `required`, it
    gets `aria-required`.
  - **Each star is a 44x44 target** (`size-11`) holding a 24px icon. Five stars take
    220px, which fits a 320px viewport.
  - **Each radio's accessible name is "*n* of *max*",** from a new locale key
    `common.ratingOption`: EN "{{value}} of {{max}}", AR "{{value}} من {{max}}". The
    numbers are formatted with `Intl.NumberFormat` in the active language, as
    `formatRelative` and `PlanList` already do. The star icon is `aria-hidden`.
  - **Colours come from tokens the manifest already asserts.** Every star up to the value
    is filled (fill and stroke both `--primary`). Every star after it is an outline in
    `--input`. The manifest asserts both against `background` and `card` at 3:1 or better
    in both themes (SC 1.4.11), so no token release is needed. For the same reason
    `surface` is narrowed to `"background" | "card"`. It does not use `text-primary`:
    `check-colors.mjs` rejects that as a surface colour used as text. The star is drawn
    with the fill and stroke utilities instead.
  - **Arrow keys follow the reading direction.** Without a Radix `DirectionProvider`,
    Radix roving focus treats every group as LTR. This was confirmed in
    `@radix-ui/react-roving-focus` 1.1.12 (`getDirectionAwareKey`). The app mounts no such
    provider, so under Arabic, ArrowRight would move to the next star, which sits to the
    *left*. `RatingInput` passes `dir` to Radix explicitly: the `dir` prop when given,
    otherwise the active locale under the rule `DirectionProvider` uses (`RTL_LOCALES`).
    `/design-preview` passes `dir` because its RTL panels set direction on a `<div>`, not
    on the document. The same defect in `RadioCardGroup` is out of scope (D10) and goes
    to `ISSUES.md`.

## User flow

There is no new product behaviour. The only page that renders either primitive is
`/design-preview`, which is a static, unauthenticated render of primitives. In each of its
four theme x direction panels, a reviewer sees these specimens:

- a `Textarea` in a `Field` with text in it, one with an error, and a disabled one;
- a `RatingInput` at 3 of 5; one with nothing selected, marked required, with an error;
  and a disabled one.

Clicking a star selects it and fills every star up to it. Tab enters the group and the
arrow keys move within it, mirrored under RTL. A disabled group ignores both.

## Data model delta

None. No backend change and no migration.

## API delta

None.

## Frontend

- **Routes:** no new route. `/design-preview` renders the new specimens in
  `src/routes/-pages/DesignPreviewPage.tsx`. The programme entry names
  `design-preview.tsx`, but `rch-dashboard-code-splitting` moved the page body into
  `-pages/`.
- **Files:**
  - new: `src/ui/textarea.tsx` with its test
  - new: `src/ui/rating-input.tsx` with its test
  - changed: `src/ui/index.ts` exports `Textarea`, `RatingInput` and the
    `RatingInputProps` type
  - changed: the two locale files gain `common.ratingOption`
  - changed: `DesignPreviewPage.tsx` and the barrel list in `design-preview.test.tsx`
- **States:** default, filled (`Textarea`) or rated (`RatingInput`), error, required and
  disabled. Neither primitive has loading or empty states.
- **API calls:** none.
- **Personal data (ADR-0023):** none. No personal data is collected, stored, retained or
  shown.
- **Expand/contract:** not applicable. There is no schema change, no API change and no
  cookie change.

## Module boundaries

The primitives belong to the dashboard design system (`src/ui/`). They import only `@/lib`
(`cn`, `i18n`), `radix-ui` and `lucide-react`, all of which are already dependencies. No
dependency is added, and there is no backend.

## Out of scope

- Any assessment screen, form, schema or API. Those belong to `asm-teacher-report-ui`
  and `asm-ratings`.
- A read-only stars display or an average card (`asm-ratings`).
- Hover preview of a pending rating, half stars, and clearing a rating once it is set.
- A character counter on `Textarea`. Native `maxLength` passes through.
- Fixing `RadioCardGroup`'s RTL arrow keys or mounting a root Radix `DirectionProvider`.
  These go to `ISSUES.md`.
- New e2e specs. The existing preview sweeps pick both primitives up.

## Test plan

- **Unit tests (vitest + jsdom + jest-axe):**
  - `Textarea`:
    - It can be labelled and keeps multi-line text.
    - It carries the `Input` recipe, `text-start`, `resize-y` and `min-h-24`.
    - Inside `<Field>`, an error sets `aria-invalid` and `aria-describedby`, and
      `required` sets `aria-required`.
    - `ref` reaches the element, which react-hook-form's `register` needs.
    - `surface` picks the focus offset.
    - It passes axe.
  - `RatingInput`:
    - It renders a named radiogroup with `max` radios, each named "n of max".
    - With `null`, nothing is checked. With 3, the third radio is checked and exactly the
      first three stars are filled.
    - A click reports a **number**.
    - ArrowRight raises the value under LTR. ArrowLeft raises it under `dir="rtl"`, and
      also under the Arabic locale with no `dir` prop.
    - `required` sets `aria-required` and shows an `aria-hidden` asterisk.
    - `error` sets `aria-invalid`, `aria-describedby` and a `role=alert` message.
    - When disabled, it reports nothing.
    - Each item has a 44px target.
    - Arabic names use Arabic-Indic digits.
    - It passes axe with and without an error.
  - **Mutation checks** (revert the change, see the test go red):
    - the RTL `dir` pass-through;
    - the fill rule ("up to the value", not "equal to it");
    - the number coercion in `onValueChange`.
- **The existing sweeps over `/design-preview`, which the specimens join automatically:**
  - jsdom axe across all four modes;
  - the barrel-coverage test (it fails until both primitives are previewed);
  - real-browser axe with colour contrast;
  - the 24x24 hit-test at 1280 and 430px.
- **e2e:** no new flow. The D3 rows "design-system — rendered contrast" and
  "design-system — target size" already cover every primitive on the page. Expected
  added time is under 2s. The plan includes one local mutation check showing that the
  target sweep reaches the stars.

## Open questions

None. None of the unit's own decisions are open. The rating scale default of 5 matches
the roadmap's `stars` (`rate_teacher(..., stars, ...)`), and `max` stays a prop in case
`asm-module-foundation` constrains the scale differently.
