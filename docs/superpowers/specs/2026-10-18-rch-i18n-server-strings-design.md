---
name: rch-i18n-server-strings
phase: v1 (wave 1, i18n stream)
modules: [platform, identity, billing, scheduling, curriculum, assessment]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Make the text the API writes follow the dashboard's language, and give every error a code
that does not change when its text is translated. Today the backend has no translation
catalog. Every message our own code writes is an English literal: about 100 `raise`
sites across five modules, plus 6 literal messages in identity. Subject names are stored
English rows. The dashboard keeps its language in `localStorage`, and never sends it to
the server. Django and DRF already ship Arabic catalogs, and `LocaleMiddleware` is already
installed. So their own messages follow the **browser's** `Accept-Language`, not the
dashboard toggle. In one UI, one message can be English and the next Arabic.

The dashboard also branches on English text once: `LoginForm` matches `"not verified"`. A
translated message would break that check without any error.

This unit adds:

1. **Language negotiation.** The dashboard sends `Accept-Language: <its locale>` on every
   API call. The backend keeps `LocaleMiddleware` and adds nothing.
2. **Stable codes.** Every error body the exception handler writes gets an `error_code`.
3. **gettext for our messages.** Every error message and every seeded subject name goes
   through gettext. Each app has its own catalog (`kaleem/<app>/locale/ar/LC_MESSAGES/django.po`).
4. **A completeness check.** A test fails when a msgid has an empty Arabic `msgstr`, is
   fuzzy, or is in the source but missing from the catalog.
5. **Build-time compilation.** `.mo` files are compiled in the image build and never
   committed.
6. **An ADR, "API text contract"** (number allocated by the conductor), recording 1-5.

English output does not change, byte for byte. The text changes only when a client asks
for `ar`.

Closes ISSUES.md "The multi-subject 400 detail renders the server's raw English string".

Grounded in backend `origin/main` b6eaa60, dashboard `origin/main` 60371ee and meta
`origin/master` 765b6ce.

## User flow

- A user switches the dashboard to Arabic. Subject names on `/account` (both cards), in
  match offers, in match requests and in the schedule become Arabic, without a reload. The
  toggle invalidates the cached queries, so they refetch with the new header.
- In Arabic, a server error becomes Arabic: a wrong password, a booking 400 detail (`ClaimSlotCard`
  shows `detail`) or a refused action. This covers our own messages and Django's or DRF's,
  because the header now carries the dashboard's language and not the browser's.
- An unverified user logs in, in either language, and sees the "not verified" panel.
  `LoginForm` checks `error_code === "email_not_verified"`, not the message text.
- An admin adds a fourth subject. It shows its stored name in every language until a
  catalog entry ships. This is accepted (see the ADR). The seeded three are covered by a
  test.

## Data model delta

None. No migration. **Personal data (ADR-0023): none.** The language comes from a request
header. It is not stored, logged or tied to a user. **Expand/contract:** no schema change.
The API change is additive, a new `error_code` key, and is accepted by the previous
bundle. That bundle's `parseApiError` files any unknown key as a field error, and no form
renders an `error_code` field, so the code shows nowhere. The key is named `error_code`
and not `code` for this reason: `AcceptInviteCard` reads `fieldErrors.code` (the invite
code field), so in an old tab a top-level `code` would appear under that input.

One degradation is accepted. An old tab left open across the deploy, in a browser whose
own language is Arabic, gets the not-verified message in Arabic. Its English substring
match then misses, and the message shows as a plain server error instead of the panel.
Reloading fixes it.

## API delta

No new endpoints. Changed for every `/api/v1/` response that comes from an error:

| Body today | Body after |
| --- | --- |
| `{"detail": "<en>"}` (`KaleemError`, no field) | `{"detail": "<localized>", "error_code": "<code>"}` |
| `{"<field>": ["<en>"]}` (`KaleemError` with a field) | `{"<field>": ["<localized>"], "error_code": "validation_error"}` |
| DRF dict bodies (serializer, auth, throttle, 404) | the same, plus `error_code` |
| DRF list body (a bare `ValidationError([...])`) | unchanged, no code (there is no dict to extend) |
| identity login, unverified: `{"non_field_errors": [...]}` | the same, plus `"error_code": "email_not_verified"` |
| identity verify-email, bad key | the same, plus `"error_code": "invalid_verification_key"` |

The code vocabulary is `KaleemError.code` (`not_found`, `permission_denied`, `conflict`,
`validation_error`, `external_service_error`). For DRF exceptions it is `exc.default_code`,
except that DRF's `invalid` becomes `validation_error`, so there is one name. Codes are
snake_case and are never renamed. A more specific code is added only when a client needs to
branch on it. `error_code` is a reserved key, and no serializer field may use that name.

Subject names: `GET /curriculum/subjects/` `name`, and the `subject_name` of the five
scheduling serializers (offers, assignments, match requests, slots, sessions), become
`pgettext("subject name", <stored name>)`. Slugs do not change.

Language: `LocaleMiddleware` resolves `Accept-Language` against `LANGUAGES` (`en`, `ar`).
Anything else falls back to `en`. Responses already carry `Content-Language` and
`Vary: Accept-Language`. `Accept-Language` with a value of `en` or `ar` is a CORS-safelisted
header, so no CORS setting changes. The e2e flow below proves this across the subdomain
boundary.

## Frontend

No routes, components or copy keys change.

| File | Change |
| --- | --- |
| `src/lib/api.ts` | a request interceptor sets `Accept-Language` from a module-level locale, plus an exported `setApiLocale(l)`. It must not import `@/lib/i18n`: `e2e/call-diagnostics.spec.ts` imports this file under plain Node, where the `@/` alias and JSON imports do not resolve (see the existing comment in the file) |
| `src/lib/locale-sync.ts` (new) | `installLocaleSync(i18n, queryClient)`: calls `setApiLocale(i18n.language)` immediately and on `languageChanged`. On a change it also calls `queryClient.invalidateQueries()`. Returns an unsubscribe function |
| `src/main.tsx` | calls `installLocaleSync` once, before render |
| `src/features/identity/api.ts` | `parseApiError` puts `error_code` into a new `code?: string` field and never into `fieldErrors` |
| `src/features/identity/components/LoginForm.tsx` | the not-verified branch checks `parsed.code === "email_not_verified"` |

## Module boundaries

- **platform** owns the contract: `exceptions.py` builds its message templates with
  gettext, and `drf.py` adds `error_code`. Its own catalog holds the templates. No new
  import edge.
- **curriculum** gains `services.subject_display_name(name: str) -> str` and the
  `pgettext_lazy("subject name", …)` markers for the seeded names. **scheduling** already
  calls `curriculum.services` (ADR-0033), so its serializer field uses that function and no
  contract widens. Services keep returning stored names: `scheduling/rooms.py` passes one
  to the video provider, and a later notification unit translates under the recipient's
  locale.
- **identity, billing, scheduling, assessment and curriculum** wrap their own messages and
  hold their own catalogs.
- Interpolated messages use named placeholders only, never f-strings inside gettext (ruff
  `INT` is already selected). Fragments that are interpolated, such as a resource noun or
  an action phrase, use `pgettext_lazy` with the context `"error resource"`,
  `"error action"` or `"error service"`, plus a `# Translators:` comment. Arabic `msgstr`
  follows dec-cur-terminology: a booked occurrence is a session.

## Out of scope

- Email and notification copy (`ntf-*` units, D-ntf-template-ownership), and the recipient's
  locale outside a request (`ntf-recipient-locale-tz`).
  Until that unit lands, account mail rendered inside a request (registration,
  resend-verification, adding an address) is pinned to English: `CeleryAccountAdapter`
  renders it under `LANGUAGE_CODE`, because the request's language would otherwise wrap
  allauth's own Arabic subject, greeting and sign-off around our English body.
- Zod messages on the client (`lb-zod-i18n`), and the Arabic copy pass on `common.json`
  (`rch-i18n-arabic-copy-review`).
- Django admin text and `message_user` strings (staff-only), allauth's own pages, and
  signaling close reasons.
- A per-row translated subject name (a `name_ar` column). The gettext route was chosen by
  the programme. The ADR records the cost: a new subject's translation needs a deploy.
- Sorting subjects by their localized name. `Subject.Meta.ordering` stays `["name"]`.

## Test plan

**Backend (pytest, through the gate):**

- `platform/tests/test_drf.py`: every `KaleemError` subtype's body carries its
  `error_code`. A field error carries it beside the field. DRF `ValidationError`,
  `NotAuthenticated`, `Throttled` and `NotFound` carry their codes. A list body stays
  untouched. A 500 still defers (the handler returns `None`).
- `platform/tests/test_exceptions.py`: the English messages of `NotFoundError` (with and
  without an id), `PermissionDeniedError` and `ExternalServiceError` stay byte-identical
  to today's. Under `translation.override("ar")` each one is Arabic.
- `tests/test_translation_catalogs.py`, the CI check: (a) every app whose source calls
  gettext has an `ar` `django.po`; (b) `msgfmt --check --statistics` reports no untranslated
  and no fuzzy entry; (c) re-extracting each app into a temporary copy finds no msgid the
  committed catalog lacks.
- `tests/test_error_messages_are_translatable.py`: an AST walk over every non-test module.
  The message argument of each `raise` of a platform exception or a DRF
  `serializers.ValidationError` must be a gettext-family call, or that call `%` a dict.
- `curriculum/tests/test_api.py`: the subject list in `ar` is Arabic and in `en` is
  unchanged. Every seeded subject has an Arabic translation. A subject added in the test
  falls back to its stored name.
- `scheduling` tests: in `ar`, `subject_name` is Arabic in one response per serializer
  family (offers, match requests, sessions).
- `identity` tests: unverified login returns `email_not_verified` and an Arabic message in
  `ar`. Invalid credentials are Arabic in `ar`. A bad verify key returns
  `invalid_verification_key`.

**Dashboard (vitest):**

- `api.test.ts`: the request header follows `setApiLocale`.
- `locale-sync.test.ts`: the header is set on install, changes on `languageChanged`, and
  queries are invalidated. Nothing happens after unsubscribe.
- `identity/api.test.ts`: `error_code` lands in `code` and not in `fieldErrors`. A real
  `code` field error still lands in `fieldErrors.code`.
- `LoginForm.test.tsx`: an Arabic not-verified body with the code shows the panel.

Each regression test is mutation-checked: revert its fix and watch it fail.

**e2e (Playwright, `e2e/server-strings.spec.ts`, 2 flows, budget 20 s):**

1. A teacher in Arabic sees three Arabic-script subject names on `/account` (no
   `Quran`/`Tafsir`/`Arabic`). After switching to English, `Quran` is back, without a
   reload.
2. In Arabic, `/login` with an unknown address (`uniqueEmail`, so no pool account is
   touched) shows an Arabic-script server error, not `Invalid credentials.`. The request is
   a real cross-subdomain POST with CSRF.

**Not covered, said plainly:** the e2e flows assert Arabic script, not the exact wording.
The wording is the owner's (hg-arabic-review). No e2e flow drives the unverified-login
code, because it needs an unverified account. The vitest and pytest tests above cover
both halves of that path.

## Open questions

None blocking. Owner gate: **hg-arabic-review** reviews every new Arabic `msgstr`. It
includes the religious terms in the subject names (Quran, Tafsir). The gate holds spec
closure, not merge.
