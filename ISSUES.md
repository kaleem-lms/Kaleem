# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- allauth 65.x deprecation warnings in test output: `ACCOUNT_AUTHENTICATION_METHOD`, `ACCOUNT_EMAIL_REQUIRED`, `ACCOUNT_USERNAME_REQUIRED` are deprecated in favour of `ACCOUNT_LOGIN_METHODS = {"email"}` and `ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]` (in `backend/config/settings/base.py`). Still functional; migrate the keys to silence warnings. Spotted 2026-06-08 during Phase A Step 4.

- Backend `just migrate` / `seed` / `shell` recipes run `manage.py` locally without `DJANGO_SETTINGS_MODULE`; the default `config.settings` (`config/settings/__init__.py`) is empty, so they fail outside Docker. Fix: set `DJANGO_SETTINGS_MODULE=config.settings.local` in those recipes, or have `manage.py` default to `config.settings.local`. (Tests are unaffected — pytest passes `--ds=config.settings.test`.) Spotted 2026-06-08 during Phase A.
- Backend had an uncommitted WIP edit (`config/urls.py`) giving health routes trailing slashes (`/health/live/`) without updating `platform` tests, which broke the baseline suite. Stashed to `git stash` in the backend submodule on 2026-06-08 to get a green baseline for Phase A. Decide: discard, or finish it properly (add trailing slashes + update tests to match, which is the more REST-idiomatic choice).

## Soon (next month or two)

(empty)

## Someday / Won't fix

(empty)
