# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- Staging DB has inconsistent migration history (`account.0001` applied before its
  dependency `identity.0001`), which blocks the `migrate` step of every deploy. Reset
  the staging `kaleem` database (pre-launch, no real data) and re-deploy. Long-term:
  the production/staging deploy assumes a fresh DB orders `identity` (the custom
  `AUTH_USER_MODEL`) before `account` (allauth) — any environment seeded before
  identity existed will hit this.

## Soon (next month or two)

- Dev email goes nowhere useful: `config.settings.local` uses the console `EmailBackend`,
  so allauth verification links print to the django container's stdout while the
  `mailpit` service in `docker-compose.local.yml` sits idle. Either point local
  `EMAIL_BACKEND` at mailpit's SMTP (`mailpit:1025`) or drop mailpit from the compose
  file. (Found during the Phase A smoke test — had to scrape links from `docker logs`.)

## Someday / Won't fix

(empty)
