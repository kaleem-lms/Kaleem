---
name: ntf-recipient-locale-tz
phase: v1 (wave 2, i18n stream)
modules: [identity, i18n]
status: approved
created: 2026-10-19
closed: null
---

## Goal

Give every account a stored language and a time zone the user can change, so that work
done outside a request (email, reminders) knows which language and zone to use for the
person it is sent to.

Today the dashboard keeps its language in `localStorage` only (`kaleem-locale`), and the
server never stores it. `User.timezone` exists (`CharField`, default `"UTC"`), but only
the availability editors write it (`scheduling.services` calls
`identity.services.set_timezone`). A parent has no way to set one. A notification unit
needs both values for a user with no request in hand. `ntf-email-foundation` and
`ntf-core` depend on this unit for that reason.

This unit adds:

1. `User.language`: the language the user last picked, or blank when they never picked
   one.
2. The dashboard saves a language choice to the account, and a new browser adopts the
   account's language after sign-in.
3. A "Language and time zone" card on `/account`, shown to every role and to staff.
4. `identity.services.get_recipient_locale(s)`: the read that notification units call.

Grounded in backend `origin/main` 2f13d53, dashboard `origin/main` f76677b and meta
`origin/master` dea0b4e.

## User flow

**The rule: this device's own choice wins, and the account seeds a device that has none.**

- **Choosing a language while signed in.** The user switches with the top-bar toggle, or
  with the language control in the new `/account` card. The UI switches at once, as it does
  today. The choice is saved on this device and sent to the account (`PATCH /identity/me/`).
  If the save fails, the UI stays in the chosen language and a toast says the language
  could not be saved to the account.
- **A new browser or device.** The user signs in on a browser that holds no language
  choice. Once `/identity/me/` loads, the dashboard switches to the account's language and
  records it on that device. If the account has no language, nothing changes.
- **A device that already chose.** A browser that holds a choice keeps it after sign-in and
  writes nothing to the account. Only an explicit choice writes. This keeps a stale
  device from overwriting a newer choice made elsewhere. It also keeps Playwright specs
  that put `kaleem-locale` in storage from changing shared accounts.
- **Before sign-in.** The toggle on `/login` and `/register` changes only this device.
  `POST /identity/register/` records the negotiated request language (the dashboard sends
  it as `Accept-Language` since `rch-i18n-server-strings`). The register form also sends
  the browser's time zone (`Intl…resolvedOptions().timeZone`), so a new account starts in
  its owner's zone and not in UTC.
- **Time zone.** The card shows the account's zone with its offset, using the existing
  `TimezoneBar`, which offers search and "Use device time zone". Choosing a zone saves it at
  once. On success the card shows the new zone, and the student availability panel on the
  same page refetches, because both show the same field. An unknown zone shows the server's
  field error under the picker. The card states what the zone governs: emails and
  reminders, and the availability grid. Dashboard times keep following this device's
  clock. That is unchanged, and other units own it.

Only an explicit change writes `kaleem-locale`. Today `DirectionProvider` writes it on
every render, so after any visit every browser looks as if it had chosen. That would stop
a device that never chose from adopting the account's language. The first render of a
device with no choice no longer writes the key. Every later change still writes it.

## Data model delta

`identity.User` gains one field:

```
language = CharField(max_length=8, blank=True, default="", db_default="")
           # "" = never chosen; otherwise a code from settings.LANGUAGES ("en", "ar")
```

Migration `identity/0009_user_language` adds the column, so the previous release's
inserts still get `""` (`db_default`). No other change: `timezone` already exists.

**Personal data (ADR-0023).** *What:* a language code and an IANA zone name for each
account. Child accounts are included. A parent-created child gets `""` and `UTC` until
the child or the parent sets them. *Why:* to send each person mail and reminders in their
own language and zone. *How long:* the account's lifetime, deleted with the row.
*Who sees it:* the user (`/account`, `GET /me/`, the data export) and staff (Django
admin). Both are added to `identity.personal_data.export_account` (`timezone` is already
there). Neither value is logged.

**Expand/contract.** Additive only: a defaulted column and new response keys. The
previous dashboard bundle ignores the extra `me` keys and never sends the new `PATCH` or
register fields. No contract step follows.

## API delta

No new endpoints.

| Endpoint | Change |
| --- | --- |
| `GET /identity/me/` (and the `PATCH`, login responses that return `Me`) | adds `language` (`""`, `"en"` or `"ar"`) and `timezone` |
| `PATCH /identity/me/` | accepts optional `language` (choice `en`/`ar`; blank refused) and `timezone` (IANA name). Both go through `services.set_language` / `services.set_timezone`. A bad value gives 400 `{field: [msg], error_code: "validation_error"}` |
| `POST /identity/register/` | accepts optional `timezone`, validated the same way. The language comes from the request, not the body. Absent or unsupported means `""` |

`LoginView` returns `_me_payload`, so the same keys appear there.

## Frontend

No new route. `/account` (every role, and staff) gains one card.

| File | Change |
| --- | --- |
| `src/features/identity/schemas.ts` | `Me` gains optional `language?: "" \| Locale` and `timezone?: string`. They are optional so the existing `Me` fixtures stay valid. New `AccountPreferencesInput`. |
| `src/features/identity/api.ts`, `queries.ts` | `updateMe` takes `ProfileEditInput \| AccountPreferencesInput`. New `useSaveAccountPreferences` sets the `me` cache, and on a time-zone change also invalidates the availability query. |
| `src/features/identity/components/AccountLocaleSync.tsx` (new) | Mounted once in `routes/_authed.tsx`. Adopts `me.language` when this device holds no choice. While mounted, listens for `languageChanged` and PATCHes when the new language differs from `me.language`. Shows a toast on failure. Renders nothing. |
| `src/features/identity/components/LocalePreferencesCard.tsx` (new) | A language radio group (English / العربية) bound to `i18n.language`, plus `TimezoneBar` bound to `me.timezone`. States: idle, saving (control disabled), and error (inline field error). |
| `src/lib/direction.tsx` | No longer writes `kaleem-locale` on the first render when nothing was stored. |
| `src/features/identity/components/RegisterForm.tsx` | Sends `timezone: detectTimezone()`. |
| `src/routes/_authed/-pages/Account.tsx` | Renders the card for every role. |
| `src/locales/{en,ar}/common.json` | New `account.locale.*` keys (title, language legend, zone note, save-failed toast). The Arabic copy is held for hg-arabic-review. |

Styles use tokens only. The radio group uses the existing `@/ui` primitives, with a 44px
target and full RTL.

## Module boundaries

identity owns everything here. The new public API in `identity/services.py`:

- `set_language(user, code)`. It raises `platform.exceptions.ValidationError(field="language")`
  for a code that is not in `settings.LANGUAGES`.
- `get_recipient_locale(user_id) -> RecipientLocale` and
  `get_recipient_locales(user_ids) -> dict[int, RecipientLocale]`. `RecipientLocale` is a
  frozen dataclass `(language, timezone)`. A blank language resolves to `"en"`, so a caller
  always gets a supported code.

No new import edge. `scheduling` keeps calling `set_timezone`. Notification units call
the two reads through `identity.services`, on edges `ntf-core` opens.

## Out of scope

- Showing dashboard times in the account's zone instead of the browser's (`SessionCard`
  etc.). Display stays browser-local (see `e2e/timezone.spec.ts`).
- Rendering any email in the recipient's language. `CeleryAccountAdapter` stays pinned to
  English. `ntf-email-foundation` and `ntf-identity-emails-relayout` own that.
- Picking a language for a child from the parent's family screens. A child's language
  stays `""` until the child chooses.
- Pushing a device's earlier choice up to the account on sign-in (see the rule above).
- More languages than `en`/`ar`.

## Test plan

Backend (pytest):
- `language` defaults to `""`. A raw `INSERT` without the column gets `""` (`db_default`).
- `set_language`: `ar` is saved. `fr` and `""` raise with `field == "language"`.
- `get_recipient_locale(s)`: blank resolves to `en`, a stored zone is returned as is, and
  the bulk read uses one query.
- `GET /me/` includes `language` and `timezone`.
- `PATCH /me/`: `{language: "ar"}` persists. `fr` gives 400 on `language` with
  `error_code`. A valid zone persists. `Mars/Phobos` gives 400 on `timezone`. `email` is
  still ignored (existing test).
- Register: `Accept-Language: ar` stores `ar`. No header stores `en` (the middleware
  default). `timezone: "Africa/Cairo"` is stored, a bad zone gives 400, and an absent
  one gives `UTC`.
- The export includes `language`. `seed_e2e` converges every account's language to `""`
  and seeds the new locale account (below).
- The Arabic catalog contains the new `set_language` message (the completeness test).

Dashboard (vitest):
- `DirectionProvider` does not write storage on the first render with nothing stored, and
  does write it after a change.
- `AccountLocaleSync` adopts the account's language with no stored choice and not with one.
  It does nothing for `""` and PATCHes on a change that differs. Adopting does not PATCH.
  A failed PATCH shows a toast.
- `LocalePreferencesCard`: shows the current language checked. Picking Arabic switches
  i18n. A zone change PATCHes `{timezone}`. A 400 shows the field error. Axe passes in
  `a11y.test.tsx`.
- `Account` renders the card for student, teacher, parent and staff. `RegisterForm`
  sends `timezone`.

e2e (Playwright, new `e2e/account-locale.spec.ts`, about 25 s). It runs on a new
dedicated account `e2e.locale@kaleem.test` (parent profile, seeded by `seed_e2e`, listed in
`e2e/accounts/identity.ts`). It is a dedicated account because the flow changes the
account's stored language, and in a serial suite that must not reach a shared account.
1. **Arabic persists across a new browser context.** In context A, sign in, choose
   العربية on `/account` and wait for the `PATCH` 200. Then open context B with empty
   storage, sign in through the real English form, and expect `<html lang="ar" dir="rtl">`
   with Arabic checked in the card.
2. **A time zone persists.** Pick a non-UTC zone (`Asia/Tokyo`) and wait for the `PATCH`.
   After a reload the card shows it. A context with a different `timezoneId` cannot make it
   pass by accident.
Each flow restores English / UTC in a `finally` block, and `seed_e2e` converges both.
Mutation checks: with adoption removed, flow 1 stays English. With the PATCH removed,
flow 2 shows UTC after the reload.

Not covered by e2e: the save-failed toast (vitest only), and any browser but Chromium.

## Open questions

None blocking. The device-wins rule above is the proposal this spec asks the owner to
approve (dec-spec-approval: new product behaviour; it stores a preference on child accounts).
