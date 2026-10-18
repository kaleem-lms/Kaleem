---
number: 0058
title: API text contract
status: proposed
date: 2026-10-18
---

<!-- The number is provisional: the conductor allocates ADR numbers. Renumber on land. -->

## Context

The dashboard speaks English and Arabic and keeps its language in `localStorage`. The
backend had no translation catalog: about a hundred error messages across five modules
were English literals, and subject names are English rows. Django and DRF ship Arabic
catalogs and `LocaleMiddleware` is installed, but it resolves the language from the
browser's `Accept-Language`, and the dashboard never sent its own. So one Arabic page could
show an English message from our code and an Arabic one from Django, and flipping the
dashboard toggle changed neither.

The dashboard also branched on server text once (`LoginForm` matched the substring
`"not verified"`). A translated message would break that check without any error.

## Decision

1. **The language is negotiated with `Accept-Language`.** The dashboard sends its own locale
   on every API call, and a language switch invalidates the cached queries so what is on
   screen is re-requested in the new language. The backend keeps `LocaleMiddleware` and adds
   no setting, no cookie and no stored preference. The value is `en` or `ar`, both CORS
   safelisted, so no CORS configuration changes. Anything else falls back to `en`.
2. **Every error body written by the exception handler carries `error_code`.** It is the
   stable, untranslated name of the failure and is what a client branches on, never the
   message. For `KaleemError` it is `exc.code` (`not_found`, `permission_denied`,
   `conflict`, `validation_error`, `external_service_error`; a field error is always
   `validation_error`). For DRF exceptions it is `exc.default_code`, with DRF's `invalid`
   renamed `validation_error`. Two identity bodies written by hand also set a code:
   `email_not_verified` and `invalid_verification_key`. Codes are snake_case and are never
   renamed; a more specific code is added only when a client needs to branch on it. A list
   body (a bare `ValidationError([...])`) has no object to extend and is left alone.
   `error_code` is a reserved key: no serializer field may use it. It is not named `code`
   because `AcceptInviteCard` reads a field called `code`.
3. **Every message our own code writes goes through gettext.** Each app holds its own
   catalog, `kaleem/<app>/locale/ar/LC_MESSAGES/django.po`. Interpolated messages use named
   placeholders, never an f-string inside gettext. A fragment that is interpolated (a
   resource noun, an action phrase, a service name) uses `pgettext_lazy` with the context
   `error resource`, `error action` or `error service`. A message whose parts depend on a
   condition is written as whole sentences chosen by that condition, never a participle
   dropped into a template. The English text does not change by a byte.
4. **Subject names are gettext too.** `curriculum.services.subject_display_name` looks the
   stored name up under the context `subject name`; the serializers of curriculum and of
   scheduling call it, and services keep returning the stored name. A subject an admin adds
   shows its stored name until a catalog entry ships. That cost is accepted: a new
   subject's translation needs a deploy.
5. **Completeness is a test.** A test fails when an app whose source calls gettext has no
   Arabic catalog, when `msgfmt --check --statistics` reports an empty or fuzzy entry, and
   when re-extracting an app finds a message the committed catalog lacks. An AST test fails
   on any platform exception or DRF `serializers.ValidationError` whose message is not a
   gettext call, so a new untranslated message is a red build and not a silent English
   string.
6. **`.mo` files are built, never committed.** The image installs GNU gettext and runs
   `django-admin compilemessages` before `collectstatic`; the test session compiles stale
   catalogs once; the e2e job compiles before it starts the server. A missing `.mo` makes
   Django answer in English with no error, which is why the e2e flows run on a compiled
   tree.

## Alternatives considered

- **A `name_ar` column on `Subject`.** Admins could translate without a deploy, but it is a
  migration, an admin form change and a second source of truth per language. The
  programme chose the catalog; the deploy cost is recorded above.
- **Detecting the language from a cookie or a user setting.** It adds state, and the
  header already says what the page is showing. A stored preference is the notification
  units' concern (recipient locale outside a request).
- **Keeping the browser's `Accept-Language`.** The dashboard toggle and the browser setting
  disagree; the page should follow the toggle.
- **Branching on the message text.** What the dashboard did once. It is exactly what a
  translation breaks.
- **A single project-wide catalog.** One file everyone edits is the merge conflict this
  repo's module layout exists to avoid, and an app's catalog would not travel with the app.

## Consequences

- A client can rely on `error_code` across languages. Old bundles are unaffected: their
  `parseApiError` files an unknown key as a field error and no form renders it. One edge is
  accepted: an old tab left open across the deploy, in a browser whose own language is
  Arabic, gets the not-verified message in Arabic, misses its English substring match and
  shows a plain error until reloaded.
- Text we do not write is not covered: pydantic's own validation messages inside a report
  content error stay English, and a Django or DRF message exists in Arabic only to the
  extent those projects ship it.
- A new Arabic `msgstr` is a draft until the owner reviews it (`hg-arabic-review`),
  including the religious terms in the subject names.
- The test run resets the active language after each test, because `LocaleMiddleware`
  leaves the last request's language on the thread.
- The production image build gains the `gettext` apt package and one `RUN` step. A
  failing compile fails the build.
- Out of scope, each owned elsewhere: email and notification copy, Zod messages on the
  client, Django admin text, signaling close reasons, and sorting subjects by their
  translated name.
