# ISSUES

Spotted-a-problem backlog. Write it here in 15 seconds, keep going (D10).

## Now (next 1-2 weeks)

(empty)

## Soon (next month or two)

- Dev email goes nowhere useful: `config.settings.local` uses the console `EmailBackend`,
  so allauth verification links print to the django container's stdout while the
  `mailpit` service in `docker-compose.local.yml` sits idle. Either point local
  `EMAIL_BACKEND` at mailpit's SMTP (`mailpit:1025`) or drop mailpit from the compose
  file. (Found during the Phase A smoke test — had to scrape links from `docker logs`.)

## Someday / Won't fix

(empty)
