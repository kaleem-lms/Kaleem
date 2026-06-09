# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- Frontend deploy gap: the pipeline is backend-only. `deploy-staging` builds/ships only
  the backend image; `infra/docker-compose.production.yml` has no service for the React
  dashboard SPA or the Astro marketing site; neither has a Dockerfile, and `marketing`
  has no CI job. dashboard CI only lints + builds (never deploys). Needs a short spec/ADR
  before Phase B ships UI: how to build + serve the SPA and marketing site behind Traefik
  (static build → object storage/CDN or an nginx container), with host routes + env
  injection. (No identity UI exists yet, so nothing is missing in production today.)
- Two throwaway smoke-test users linger in the staging DB (`stg.smoke@example.com`,
  `ses.smoke@example.com`). Clear via Django admin or on the next staging DB reset.

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
