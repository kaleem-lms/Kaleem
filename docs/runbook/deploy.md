# Deploy Runbook

## How deployment works

Deploys are triggered automatically when code is merged to `master`:

1. CI runs (lint, test, build)
2. If all pass, `deploy-staging` job builds a Docker image, pushes to GHCR, and SSHs into the staging VPS
3. On the VPS, `scripts/deploy.sh` runs a blue-green swap

## Manual deploy (if CI is down or you need to deploy a specific SHA)

```bash
ssh deploy@<staging-ip>
cd /opt/kaleem
echo "<ghcr-pat>" | docker login ghcr.io -u <username> --password-stdin
export DEPLOY_SHA=<git-sha-short>
bash scripts/deploy.sh $DEPLOY_SHA
```

## Rollback

Re-deploy the previous image SHA:

```bash
ssh deploy@<staging-ip>
cd /opt/kaleem
bash scripts/deploy.sh <previous-sha>
```

The previous SHA can be found in the GitHub Actions deploy log or in GHCR tags.

## First-time VPS setup

Before the first deploy, the VPS needs:

1. Docker + Docker Compose installed
2. `/opt/kaleem/` directory with `docker-compose.production.yml`, `traefik/`, `scripts/`, `.env.production`
3. GHCR login credentials
4. Firewall: ports 80, 443 open; 8080 (Traefik dashboard) restricted

```bash
mkdir -p /opt/kaleem/{traefik,scripts}
# Copy files from infra/ submodule to /opt/kaleem/
# Create .env.production from .env.production.example
# Start shared services first:
docker compose -f docker-compose.production.yml up -d traefik postgres redis
```

## Checking deploy status

```bash
ssh deploy@<staging-ip>
cat /opt/kaleem/.active-color
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl http://localhost:8000/health/ready
```

## Secrets (stored in GitHub repo settings)

| Secret | Purpose |
| --- | --- |
| `GHCR_PAT` | Push/pull Docker images |
| `STAGING_HOST` | VPS IP address |
| `STAGING_SSH_KEY` | SSH private key |
| `STAGING_USER` | SSH username |
