# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

(empty)

## Soon (next month or two)

- Deploy assumes a fresh DB. `migrate` orders `identity` (the custom `AUTH_USER_MODEL`)
  before `account` (allauth); any environment whose `account` migrations were applied
  before `identity` existed hits `InconsistentMigrationHistory` and the deploy aborts.
  Bit us once on staging (2026-06-10, fixed by recreating the DB). Production's first
  deploy must start from an empty DB, or include a documented repair step.
- Dev email goes nowhere useful: `config.settings.local` uses the console `EmailBackend`,
  so allauth verification links print to the django container's stdout while the
  `mailpit` service in `docker-compose.local.yml` sits idle. Either point local
  `EMAIL_BACKEND` at mailpit's SMTP (`mailpit:1025`) or drop mailpit from the compose
  file. (Found during the Phase A smoke test — had to scrape links from `docker logs`.)

## Someday / Won't fix

(empty)
