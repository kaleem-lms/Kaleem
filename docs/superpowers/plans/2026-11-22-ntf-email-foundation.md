---
spec: docs/superpowers/specs/2026-11-22-ntf-email-foundation-design.md
status: draft
---

Worktrees:

- `kaleem-worktrees/backend-ntf-email-foundation` on `feat/ntf-email-foundation`, created
  from backend `origin/main` as runbook section 1 says;
- `kaleem-worktrees/meta-ntf-email-foundation`, where this plan lives.

The rules for every step:

- Gates run only through `_tools/backend-gate.sh`.
- Every step starts with a failing test (D3).
- Every regression test is mutation-checked: revert the fix and watch it go red.
- Floors are not touched (dec-floor-ownership).
- No migration, no dependency change and no new import-linter edge. If any of them turns
  out to be needed, that is scope growth: stop and escalate.

Paths are under `backend/` unless a step says otherwise. `P` is `kaleem/platform` and `N`
is `kaleem/notifications`.

## Steps

1. [x] **Typed errors and settings.** Write the tests first:
   - `P/tests/test_exceptions.py`:
     - `test_email_not_configured_code` (`email_not_configured`)
     - `test_recipient_suppressed_code` (`recipient_suppressed`)
   - `tests/settings/test_email_delivery.py`, which reloads `config.settings.production` as
     `test_uploads_storage.py` does:
     - `test_all_three_smtp_variables_configure_delivery_and_the_channel`
     - `test_none_set_is_not_configured_and_channel_none`
     - `test_some_set_is_not_configured_and_does_not_raise`
     - `test_support_email_defaults_and_reads_env`
   - `tests/test_email_suppressed_domains.py`, at the repo root:
     - `test_suppressed_domains_match_the_domains_kaleem_mints`, which compares against
       `staging_pool.POOL_DOMAIN` and identity's `PLACEHOLDER_DOMAIN`. It lives at the
       root because `kaleem.platform.tests` is inside the platform contract's source, and
       an identity import there would break the contract.

   Then add `EmailNotConfigured` and `RecipientSuppressed` to `P/exceptions.py`, the three
   base settings, the conditional `NOTIFICATIONS_EMAIL_CHANNEL` and the derivation in
   `production.py`.

   In the existing `N/tests/test_notify.py::test_unconfigured_channel_marks_failed_and_logs_error`,
   set `settings.NOTIFICATIONS_EMAIL_CHANNEL = None` explicitly. Its default is no longer
   `None`.

2. [x] **Startup warning.** Write `P/tests/test_apps.py` first:
   - `test_warns_once_naming_variables_when_not_configured` (no value appears in the message)
   - `test_silent_when_configured`

   Then add `PlatformConfig.warn_if_not_configured()`, modelled on `ContentConfig`'s.

3. [x] **Layout and render.** Write `P/tests/test_email_render.py` first. Each case is
   parametrised over `en` and `ar` where the spec says so:
   - `test_lang_and_dir_per_language`
   - `test_arabic_copy_and_wordmark_in_both_parts`
   - `test_lazy_context_resolves_in_given_language_not_active`
   - `test_datetime_renders_in_given_zone`
   - `test_html_escapes_text_does_not`
   - `test_subject_is_one_line`
   - `test_no_remote_resources`
   - `test_colour_pairs_meet_4_5_to_1`
   - `test_default_headers`
   - `test_list_unsubscribe_only_when_given`
   - `test_one_click_adds_post_header`

   Then write `P/email.py` (`RenderedEmail`, `ListUnsubscribe`, `EMAIL_COLOURS` and
   `render_email`) and add the templates:
   - `P/templates/platform/email/layout.txt` and `layout.html`, with a header block, a
     content block and a footer;
   - `P/templates/platform/email/sample.{subject.txt,txt,html}`.

   Mutation check: drop the `translation.override` and the Arabic tests must go red.

4. [x] **Guarded send.** Write `P/tests/test_email_send.py` first:
   - `test_not_configured_raises_and_sends_nothing`
   - `test_suppressed_domain_raises_case_insensitive`
   - `test_exact_match_leaves_kaleem_test_and_notpool_alone`
   - `test_sent_message_is_multipart_text_first_with_headers`
   - `test_reply_to_is_support_email`

   Then add `send_email` and `is_delivery_configured`. Mutation check: make the match a
   suffix match (`endswith`) and the exact-match test must go red.

5. [x] **Platform task.** Write the new tests first, in `P/tests/test_email_tasks.py`:
   - `test_renders_and_sends_with_parsed_datetimes`
   - `test_not_configured_logged_error_not_retried`
   - `test_suppressed_logged_info_not_retried`
   - `test_transient_smtp_error_retried_then_raised`
   - `test_ignore_result_is_set`

   Then add `send_templated_email` to `P/tasks.py`. This file is shared: change only the
   new task, and leave `send_email_message` untouched.

6. [x] **Sample command.** Write `P/tests/test_send_sample_email_command.py` first:
   - `test_sends_sample_in_requested_language`
   - `test_not_configured_exits_nonzero_with_code`
   - `test_suppressed_address_refused`

   Then add `P/management/commands/send_sample_email.py`.

7. [x] **Notice template and adapter.** Write `N/tests/test_email_adapter.py` first:
   - `test_dispatch_enqueues_one_task_per_id`
   - `test_sends_in_recipient_language_and_zone` (set the user's `language="ar"` and
     `timezone="Asia/Riyadh"`)
   - `test_link_is_absolute_and_body_has_no_address_or_name`
   - `test_kind_body_template_included_when_present` (a template dir added with
     `override_settings`)
   - `test_generic_line_when_absent`
   - `test_records_sent`
   - `test_inactive_recipient_failed_recipient_inactive`
   - `test_suppressed_domain_failed_recipient_suppressed`
   - `test_refused_recipient_failed_recipient_refused` (`SMTPRecipientsRefused`)
   - `test_terminal_delivery_sends_nothing`
   - `test_held_lock_sends_nothing`
   - `test_no_log_line_contains_the_address` (caplog over every failure case)

   Then write `N/email.py` (`EmailChannelAdapter` and `send_delivery`) and
   `N/templates/notifications/email/notice.{subject.txt,txt,html}`, extending platform's
   layout. Mutation check: remove the lock and `test_held_lock_sends_nothing` must go red.

8. [x] **Tasks, retry and sweep.** Write `N/tests/test_email_tasks.py` first:
   - `test_transient_error_retried_then_failed_send_failed`
   - `test_sweep_reenqueues_pending_older_than_15_min`
   - `test_sweep_leaves_newer_pending_alone`
   - `test_sweep_expires_older_than_24h_delivery_expired`
   - `test_sweep_is_idempotent`
   - `test_sweep_has_no_beat_entry` (it is not in `CELERY_BEAT_SCHEDULE`)

   Then add `send_email_delivery` and `sweep_pending_email_deliveries` to `N/tasks.py`, and
   the internal stale-pending query to `N/channels.py`.

9. [x] **Catalogs.** Run `django-admin makemessages -l ar --no-location --ignore '*/tests/*'`
   in `P/` and in `N/`, then write draft Arabic for each new msgid. Mark the header
   "Drafts until reviewed (hg-arabic-review)", as the existing catalogs do. Then
   `tests/test_translation_catalogs.py` must pass.

10. [x] **Full gate and hand-back.**
    - Run `backend-gate.sh <wt>` in full: migrate, `makemigrations --check`, pytest with
      coverage, ruff, format, `lint-imports` and `mypy`.
    - Then run the runbook section 3 checks. Merge `origin/main` (never rebase) right before
      the hand-back.

11. [x] **Meta docs**, in the meta worktree:
    - Write the ADR amending ADR-0018 (number from the conductor). New mail renders in the
      worker under an explicit language and zone, through platform's layout. The send
      refuses when not configured and has no fallback. It covers the denylist,
      `List-Unsubscribe` and `ignore_result`. allauth's in-request render remains until
      `ntf-identity-emails-relayout`.
    - Write the "Email" section of `docs/architecture/platform.md` and the adapter in
      `docs/architecture/notifications.md`.
    - In `ISSUES.md`, mark the two entries "Seeded staging lessons will mail `.test`
      addresses" and "Senders should skip `is_active=False` recipients" fixed for the
      notification path. Identity's own sends follow in the relayout unit.
    - In the CLAUDE.md D3 table, add a row: `platform`/`notifications` email foundation,
      ❌ e2e by design, with unit tests in both locales and the first mailpit flow in
      `ntf-booking-notifications`.

12. [x] **Setup checklist.** Add these rows to
    `_ops/programme/setup-and-deployment-checklist.md`:
    - The SES SMTP credentials, the domain verification (SPF and DKIM DNS records) and the
      exit from the sandbox. The variables are `DJANGO_EMAIL_HOST`,
      `DJANGO_EMAIL_HOST_USER`, `DJANGO_EMAIL_HOST_PASSWORD` and
      `DJANGO_DEFAULT_FROM_EMAIL`.
    - A monitored support mailbox, set as `DJANGO_SUPPORT_EMAIL`. This is the launch gate
      from `D-ntf-support-contact`.
    - Then the check: run `manage.py send_sample_email <owner address> --language ar` and
      `--language en` on staging, and hold the `hg-mail-client-render` session on Gmail,
      Outlook and Android mail.

**`hg-vps-env`: the variable names for the conductor.** None must be added before the
merge. Every new read is optional with a default, so a missing variable cannot roll back the
deploy. The only new name is `DJANGO_SUPPORT_EMAIL`, which is optional; the staging default
stands. Delivery reads ADR-0016's existing names (`DJANGO_EMAIL_HOST`,
`DJANGO_EMAIL_HOST_USER`, `DJANGO_EMAIL_HOST_PASSWORD`). They are deferred to the setup step
and are never written by an agent.

**e2e (D3).** None, with a time budget of 0 s. No user action reaches this path until a
producer unit registers a kind. Both-locale unit tests stand in, as the programme entry says.

## Risks

- **Staging may already hold SMTP credentials.** In that case notification email becomes
  live on staging at the merge. That is harmless, because no kind is registered. The pool
  and erased domains are denylisted for the day producers land.
- **The "configured" test is a heuristic** (all three of host, user and password are set).
  An SMTP relay with no authentication would read as not configured. SES always needs
  credentials (ADR-0016), so this is accepted and the startup warning says so.
- **Sends are at-least-once.** A worker killed after the provider accepted a message but
  before `record_delivery_result` can cause one duplicate after the lock expires (10
  minutes) and the sweep runs (15 minutes). Accepted: a duplicate notice is better than a
  lost one, and the lock stops the common race.
- **The email colours are a copy of the token values.** Mail clients cannot read CSS
  variables. `inf-brand-email-header` reconciles them with the brand. If they drift, the
  contrast test still holds the floor.
- **Arabic copy is a draft** until `hg-arabic-review`. That gate holds spec closure, not the
  merge.
- **Client rendering is unproven** until `hg-mail-client-render`, which needs SES from the
  setup step. The spec lists exactly what is and is not covered.

## Verification

- Per step: the named tests go red first, then green, through
  `backend-gate.sh <wt> <test file>`. Each listed mutation check goes red with its fix
  reverted.
- Whole unit:
  - `backend-gate.sh <wt>` rc=0, with mypy and `lint-imports` clean;
  - `gitleaks-range.sh <wt> origin/main..HEAD` reports CLEAN;
  - the floor grep is empty;
  - after the deploy, the staging log shows the platform startup line, either the
    not-configured WARNING or nothing, which the conductor reads.
- `hg-mail-client-render` waits for the setup step.
