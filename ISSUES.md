# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

- Dockerized django/celery can't reach Postgres: `backend/.env` sets
  `DATABASE_URL=...@localhost:5432...`, which is correct for host tooling
  (pytest, `just migrate`) but inside the container `localhost` is the container
  itself, not the `postgres` service — so `runserver` stays up but every
  DB-backed request (incl. `/health/ready/`) fails. Pre-existing; surfaced
  2026-06-09 while verifying the PG18 bump. Fix: override `DATABASE_URL` (host
  `postgres`) in the `django`/`celery_*` `environment:` blocks of
  `docker-compose.local.yml`, leaving `.env` localhost for host commands.

## Soon (next month or two)

(empty)

## Someday / Won't fix

(empty)
