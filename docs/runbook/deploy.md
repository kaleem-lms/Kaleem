# Deploy Runbook

## Prerequisites
- SSH access to staging/production VPS
- Docker and Docker Compose installed on the VPS
- `.env.production` configured on the VPS

## Steps

1. SSH into the VPS
2. Pull latest images: `docker compose -f docker-compose.production.yml pull`
3. Run migrations: `docker compose -f docker-compose.production.yml exec django python manage.py migrate`
4. Restart services: `docker compose -f docker-compose.production.yml up -d`
5. Verify health: `curl http://localhost:8000/health/ready`
6. Check Sentry for new errors
7. Check Uptime Kuma for any downtime alerts

## Rollback

1. `docker compose -f docker-compose.production.yml down`
2. Tag the previous working image and re-deploy
3. Write an incident note in docs/runbook/incidents.md
