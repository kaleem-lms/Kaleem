---
name: lb-zod-i18n
phase: v1 (wave 1, stream i18n)
modules: [dashboard: lib, identity, scheduling, billing, booking, curriculum, matching]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Every client-side validation message in the dashboard reads in the page's language. Today
they are English on an Arabic page (ISSUES.md, "Dashboard zod validation messages are not
i18n'd"): zod's own defaults ("Too small: expected string to have >=8 characters", "Invalid
email address") on every `zodResolver` form, and one hardcoded English refine message
(`registerSchema.birthdate`). This unit installs one i18next-driven zod error map so no schema
or form has to translate its own messages. Measured at dashboard `origin/main` 7338e08; re-checked at 80e4290
(2026-10-25: the six zod imports, the two schema `message:` strings and the 15 `zodResolver`
call sites are unchanged; curriculum's new schemas are response types only).

Where the messages come from today:

| File | zod at runtime? | User-visible messages |
| --- | --- | --- |
| `features/identity/schemas.ts` | yes: 14 `zodResolver` forms (login, register, forgot/reset password, account, family, invite) | zod defaults for `.min(1)`, `.min(8)`, `z.email()`, `z.enum`; the English birthdate refine |
| `features/identity/components/StudentPreferencesCard.tsx` (local schema) | yes | `z.enum` default (a radio group, so practically unreachable) |
| `features/scheduling/schemas.ts` | no (types only) | the refine's `message: "endAfterStart"` would render as the raw key if ever parsed |
| `features/{billing,booking,curriculum,matching}/schemas.ts` | no: response types, never `.parse()`d (ISSUES.md) | none today |
| `features/messaging/schemas.ts` | no zod at all | none |

The curriculum dialogs validate with react-hook-form `register(..., { validate })` and
already call `t()`; they are not zod and are untouched.

## User flow

1. A visitor on `/login` in Arabic presses "تسجيل الدخول" with both fields empty. Each field
   shows an Arabic "this field is required" message, linked by `aria-describedby` as today.
2. They type `x` in the email field and submit: an Arabic "enter a valid email address".
3. On `/register`, a 3-character password shows an Arabic "use at least 8 characters", the 8
   in the browser's default digits for Arabic (owner decision on Arabic digits: CLDR/browser
   default). A future birthdate shows the Arabic birthdate message.
4. In English the same cases read as plain sentences ("This field is required.", "Enter a
   valid email address.", "Use at least 8 characters.") instead of zod's developer wording.
   **This changes the English copy of every zod-validated field.**
5. Any zod issue the map does not name (a type mismatch, an unknown format) shows a generic
   "Check this value." in the page's language, never English on an Arabic page.

Error case: if the `validation` catalogue fails to download, the root loader swallows the
failure and the map returns nothing, so zod's English default shows (today's behaviour). The
app still renders.

## Data model delta

None. No migration.

## API delta

None. Server-side field errors (`parseApiError` → `setError`) are already localized by the
backend (ADR-0058) and are not touched.

## Frontend

All in `dashboard`; no route added.

- **`src/lib/zod.ts` (new).** Imports `z` from `zod`, installs
  `z.config({ customError: zodMessage })` and re-exports `z`. `zodMessage(issue)` maps an issue
  to a key in the `validation` namespace and returns `i18n.t(key, { ns: "validation", ... })`,
  or `undefined` when the namespace is not registered (zod then uses its default):

  | Issue | Key |
  | --- | --- |
  | `too_small`, string, `minimum` 1; `invalid_type` with `undefined` input; `invalid_format` with `""` input | `required` |
  | `too_small`, string, `minimum` > 1 | `tooShort` (plural, `count` = minimum) |
  | `invalid_format`, `format: "email"` | `invalidEmail` |
  | `invalid_value` (enum, literal) | `invalidOption` |
  | `custom` with `params.key` naming a known key | that key (`invalidBirthdate`, `endAfterStart`) |
  | anything else | `invalid` |

  Messages are resolved when validation runs, in the language active then. zod applies a
  schema-level `message`/`error` **before** the global map, so schemas carry no message
  strings: a refine names its key with `params: { key }`.
- **Every zod import goes through `@/lib/zod`.** The six schema files that import zod and
  `StudentPreferencesCard` switch `from "zod"` to `from "@/lib/zod"`, so the map is installed
  wherever zod is loaded and nowhere else. Importing it from `main.tsx` instead would put zod
  in the entry chunk. A source-scan test enforces both rules (no other `from "zod"` in shipped
  code; no `message:`/`error:` string in a `schemas.ts`).
- **`registerSchema.birthdate`** refine: `{ message: "Enter a valid birthdate." }` becomes
  `{ params: { key: "invalidBirthdate" } }`. **`scheduling/schemas.ts`** refine: `message:
  "endAfterStart"` becomes `params: { key: "endAfterStart" }`, path unchanged.
- **`validation` feature namespace** (owner decision: lazy catalogues; `common.json` does not
  grow). `src/locales/{en,ar}/validation.json`, one line in `FEATURE_CATALOGUES`
  (`src/lib/i18n-namespaces.ts`). Seven keys;
  `tooShort` is a plural family (`_one`/`_other` in English, all six forms in Arabic, `_zero`
  included) written `{{count, number}}` so i18next formats the digit with `Intl.NumberFormat`
  in the page's language. `endAfterStart` reuses the reviewed Arabic of
  `common:availability.endAfterStart` verbatim.
- **Loaded by the root route.** `__root.tsx` gains `loader: () =>
  loadNamespace("validation").catch(() => undefined)`. Forms live on public (`/login`,
  `/register`, password reset) and authed routes alike, and a per-route loader is a load
  someone forgets on the next form. The JSON is a dynamic import: it is not a
  `modulepreload`, so it does not count against the 580,000-byte initial-JS budget. The
  root loader line and `src/lib/zod.ts` are the only code added; `zod.ts` lands in whatever
  chunk zod already lives in.
- States: no new loading/empty/error state. `Field`/`FormError` render the message as today.

## Module boundaries

Dashboard only; `src/lib` is shared infrastructure, imported by feature `schemas.ts` files.
No backend module, no event, no import-linter contract.

## Personal data (ADR-0023)

None collected, stored or shown. Validation runs on input the forms already hold, in the
browser; no request is added.

## Expand/contract

Not applicable: no API, cookie or schema change. A tab holding the previous bundle keeps its
English messages until it reloads.

## Out of scope

- An error already on screen does **not** re-translate when the language is switched; it
  updates on the next validation (typing in the field, or submitting). The curriculum
  `validate: () => t(...)` forms behave the same. Recorded in ISSUES.md, not fixed here.
- Parsing API responses with the response schemas (ISSUES.md "never `.parse()`d").
- `max`, number, date and other issue kinds no current schema produces get the generic
  `invalid`, not bespoke copy.
- Server-side messages (ADR-0058, `rch-i18n-server-strings`).

## Test plan

- `src/lib/zod.test.ts`: each row of the mapping table in English and Arabic; `tooShort`
  digits equal `new Intl.NumberFormat("ar").format(8)` (computed, not hardcoded); the map
  returns `undefined` with the namespace unloaded, so zod's default shows; a schema-level
  message still wins (pins the precedence the design relies on).
- Source-scan guard: no shipped file but `src/lib/zod.ts` imports `"zod"`; no `schemas.ts`
  carries a `message:`/`error:` string. Proven red on in-test sample strings.
- Root loader: registers `validation` for both locales; a rejected load resolves.
- Component: `LoginForm` and `RegisterForm` in Arabic show the Arabic required / invalid
  email / too-short / birthdate messages; English shows the new English copy.
- Parity and terminology tests discover `validation.json` automatically and must pass.
- **e2e** `e2e/validation-i18n.spec.ts`, signed out, no fixtures, no request sent, budget
  about 10 s: `/login` in Arabic, empty submit shows the Arabic required message on both
  fields and no Latin letters in either message; `x` as the email shows the Arabic invalid
  email message; `/register` with a 3-character password shows the Arabic too-short message
  with the browser's Arabic digit. Mutation-checked: with the `z.config` line removed the spec
  is red. Not covered: Safari/iOS (no Apple device in this project).

## Open questions

None. Owner decisions applied: Arabic digits follow the CLDR/browser default; feature copy
goes in a lazy namespace, `common.json` does not grow. The Arabic copy goes through
`hg-arabic-review` in the wave batch; that gate holds spec closure, not the merge.
