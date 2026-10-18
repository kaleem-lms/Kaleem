---
name: lb-known-wcag-gaps
phase: v1 (wave 2, brand stream)
modules: [design-system, scheduling]
status: draft
created: 2026-10-18
closed: null
---

## Goal

This unit closes two accessibility gaps that `ISSUES.md` already lists.

1. **A `secondary` button has no visible edge against the page.** In light theme,
   `--secondary` (sand.100) on `--background` (sand.50) measures **1.09:1**. In dark, it
   measures 1.75:1. `Button variant="secondary"` has no border, so the control has no edge
   that marks it out from the page. SC 1.4.11 asks for 3:1. axe does not catch this,
   because its contrast rule checks text only.
2. **The availability editor's error is not linked to its field.** The `ISSUES.md` entry
   names `StudentPreferencesCard`, but that entry is stale. The card now holds only the
   teacher-gender radio group, which cannot be invalid. The time rows moved to
   `WeeklyAvailabilityEditor`'s `InlineEditor`
   (`dashboard/src/features/scheduling/components/WeeklyAvailabilityEditor.tsx`). There,
   "end time must be after start time" and "overlaps …" render as a sibling
   `<p role="alert">`. Neither `Select` gets `aria-invalid` or `aria-describedby`. The
   rest of the entry is already fixed: the `SELECT_CLASS` string became the `Select`
   primitive, and the "required times" message is gone, because a native select always
   has a value. A grep of `dashboard/src` at `origin/main` finds no other unlinked
   error text. Every other form goes through `Field`, which already links its errors.

Part 1 ships as `@kaleem/tokens` **v0.2.4** in one three-repo landing with the meta pin
(G3). The tag comes from tokens `main` before the brand pipeline merges (see the programme's
serialization point for tokens releases). Part 2 is dashboard-only.

## Decisions taken in this spec

- **We add a border, not a darker fill.** We measured the alternative. For `--secondary`
  to reach 3:1 on the light page it would have to be sand.500, and then
  `--secondary-foreground` (ink.900) on it measures 4.09:1. That fails the button's own
  label pair at 4.5. It would also repaint every other `bg-secondary` surface: avatars,
  meter tracks, empty-state badges, the availability wells and the bento tiles. That is
  about fifteen surfaces, and repainting them is a palette decision for the brand work
  (v0.3.0), not a fix.
- **We add a new semantic token, `control-border`, rather than reusing `--input`.** Light
  is sand.500 and dark is ink.500. These are the same steps as `--input` today, so a
  secondary button and a form field read with the same weight. The token is still
  separate for two reasons. `--input` is documented and asserted as the *form-field*
  boundary, and v0.3.0 may retune the two independently. A pair of its own also gives the
  manifest a label that names the button, so a regression reports what broke. Measured:
  light 3.04:1 on background and 3.29:1 on card and popover; dark 5.29:1 and 4.14:1.
- **We use `border`, not `ring-1 ring-inset`.** `focusRing()` draws focus with `ring-*`.
  A resting ring would share those properties and make the focus ring inset, which breaks
  the SC 2.4.11 offset. A 1px border keeps the 40/44/48px heights (`border-box`) and adds
  2px of width.
- **The editor's error stays until the next Add, as it does today.** For "end before
  start", only the end select gets `aria-invalid`, because the end time is what the
  message is about. For an overlap, both selects get it, because the range as a whole
  clashes. Both selects point at the message through `aria-describedby`, using an id from
  `useId`. We change *how* the error is announced and marked, not when it appears.

## User flow

There is no new behaviour.

- A secondary button (Accept on a match offer, Choose file, and others) now shows a thin
  edge in both themes. Its label, fill, hover and focus do not change.
- A teacher or student adds a time range that ends before it starts. The end select turns
  red and its accessible description reads the message, so a screen reader announces the
  message when focus is on the field, not only when the message first appears. If the
  range overlaps another, both selects turn red. Cancelling or adding a valid range clears
  both.

## Data model delta

None. No backend change, no migration.

## API delta

None.

## Frontend

- **tokens:**
  - `src/color.{light,dark}.tokens.json`: add `control-border` with a `$description`.
  - `src/contrast-pairs.json`: add a `nonText` pair. It checks `control-border` on
    `background`, `card` and `popover`, minimum 3, SC 1.4.11, labelled "secondary button
    boundary".
  - `build.mjs`: add `control-border` to `BASE`. The emitter writes only listed names,
    so a token missing from the list is dropped silently. A new test closes that gap.
  - Regenerate `tokens.css` and `theme.css`.
  - Add one line to `README.md`'s 1.4.11 rule.
  - Set `package.json` to `0.2.4`, and tag `v0.2.4` on the merge commit.
- **dashboard:**
  - Re-pin `package.json` to `#v0.2.4`, with the lockfile written by pnpm 10.28.0.
  - `src/ui/button.tsx`: the `secondary` variant gets `border border-control-border`.
  - `src/ui/select.tsx`: add `Input`'s `aria-invalid:` recipe, so an invalid select is
    marked the same way as an invalid input.
  - `WeeklyAvailabilityEditor.tsx`: `InlineEditor` renders its error through `FormError`
    with a `useId` id and sets `aria-invalid` and `aria-describedby` on the right selects.
  - No route, role or API call changes.
- **marketing:** re-pin `package.json` and the lockfile to v0.2.4. No source uses
  `secondary`.
- **"Done" means:** an agent Playwright pass on staging (`dec-d9-substitute`) in light and
  dark, Arabic RTL and at 320px. It covers the secondary button on `/design-preview` and on
  a teacher's match offer, and the availability error on `/availability`.

## Module boundaries

The token and button work stays inside `design-system`. The editor fix stays inside the
dashboard's `scheduling` feature folder. There is no backend module, contract or event.
`tokens` stays dependency-free (ADR-0041).

## Personal data (ADR-0023)

None is collected, stored, shown or retained.

## Expand/contract

This change is safe in the blue-green window. It touches CSS and ARIA only. An old bundle
carries v0.2.3's variables and never references `--control-border`. The token is additive.

## Out of scope

- **`Button variant="outline"`.** It borders with `--border`, the decorative hairline at
  1.29:1, which is the same SC 1.4.11 question. It is not on the known-gaps list, and the
  fix would change the look of about 45 buttons. The conductor logs it in `ISSUES.md`
  (D10). Fixing it later is a one-class change onto `control-border`.
- `CallControlButton` (`bg-secondary/95` over video), which design-system v2 measured and
  left alone.
- Any change to `--secondary`'s fill, which belongs to the brand work (v0.3.0).
- Clearing the editor's error as the user edits.

## Test plan

1. **tokens (`node --test`):**
   - Every semantic colour key in each theme file, other than `overlay`, is emitted as
     `--<key>` in `tokens.css` and as `--color-<key>` in `theme.css`. This is red when the
     token is added to the JSON but not to `BASE`.
   - The `control-border` pair exists and passes in both themes.
   - Mutation check: aliasing the token to sand.300 turns the gate red.
2. **dashboard unit tests:**
   - `a11y.test.tsx`: the installed palette declares a 1.4.11 pair whose foreground is
     `control-border`. This is red on the v0.2.3 pin, so a half-done re-pin cannot pass.
   - `button.test.tsx`: the secondary variant carries `border-control-border`.
   - `select.test.tsx`: an `aria-invalid` select carries the invalid recipe.
   - `WeeklyAvailabilityEditor.test.tsx`, cases that are red on `origin/main`:
     - End before start: the end select has `aria-invalid="true"` and an accessible
       description matching the message, and the start select has neither.
     - Overlap: both selects are invalid and described.
     - After a valid Add, neither select is invalid.
3. **dashboard e2e (about 3 s added):**
   - `design-preview.spec.ts`, new flow: in each of the four mode panels, every secondary
     button has a solid border of at least 1px. That border's rendered colour measures at
     least 3:1 against the nearest opaque ancestor background. It is mutation-checked by
     removing the class.
   - `availability.spec.ts`, "refuses a range that ends before it starts": it also asserts
     that the end select is `aria-invalid` and `toHaveAccessibleDescription` of the
     message. It is mutation-checked.
   - These existing specs stay green: the contrast sweeps (`design-preview`, identity
     rendered contrast), `touch-targets`, `reflow` and `arabic-sweep`.
4. **G3** passes on the meta PR. Both pins, the tag and the gitlink agree on v0.2.4.

## Open questions

None. The programme entry settles border versus fill as "a token change", and the
measurement above rules out the fill.
