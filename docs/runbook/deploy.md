# Deploy Runbook

## How deployment works

Deploys are triggered automatically when code is merged to `master`:

1. CI runs (lint, test, build)
2. If all pass, the `deploy-staging` job builds the three images with `docker buildx` (a registry
   build cache at `ghcr.io/kaleem-lms/<image>:buildcache`, written only by this master-only job),
   pushes them to GHCR, syncs the infra config to the VPS and runs `scripts/ship.sh` there. The
   sync and the remote run use the runner's own OpenSSH (`tar | ssh`, then `ssh`) against a
   **pinned host key**; nothing is downloaded at deploy time.
3. On the VPS, `scripts/ship.sh` runs a blue-green swap
4. The `deploy-outcome` job runs after it on every master push, whatever happened, and goes red
   with "master is not on staging" unless staging has the commit (see below)

The synced files are `docker-compose.production.yml`, `scripts/ship.sh`, `scripts/deploy-lib.sh`
(sourced by `ship.sh`, so the two always travel together), `traefik/traefik.yml` and
`coturn/turnserver.conf`. `.env.production` is never synced.

## Manual deploy (if CI is down or you need to deploy a specific SHA)

```bash
ssh deploy@<staging-ip>
cd /opt/kaleem
echo "<ghcr-pat>" | docker login ghcr.io -u <username> --password-stdin
export DEPLOY_SHA=<git-sha-short>
bash scripts/ship.sh $DEPLOY_SHA
```

## Rollback

The host keeps the images of the last `KEEP_DEPLOYS` (default 5) deploys, and `ship.sh` records
each successful deploy's SHA in `/opt/kaleem/.deploy-history` (newest last). A rollback is a
deploy of an older SHA, and it needs no re-pull:

```bash
ssh deploy@<staging-ip>
cd /opt/kaleem
tail -5 .deploy-history          # newest last; the last line is what is live
bash scripts/ship.sh <previous-sha>
```

A rolled-back SHA moves to the end of the history. A SHA older than the last five may have been
removed from the host; `ship.sh` then pulls it from GHCR, which keeps every SHA tag.

## Image retention (what keeps the disk bounded)

`ship.sh` removes every `ghcr.io/kaleem-lms/*` image whose tag is a commit SHA unless that SHA is
one of the last `KEEP_DEPLOYS` recorded deploys, the SHA being deployed, or an image any container
(running or stopped) uses. It never touches another repository's image (traefik, postgres, redis,
coturn), an untagged image, or the `latest` and `buildcache` tags beyond dangling layers
(`docker image prune -f`, never `-a`). It runs at the **start** of every deploy as well as the end,
so a run of failed deploys cannot fill the disk. A removal that fails (an image in use, a race) is
logged and skipped, never fatal.

The log shows `Keeping: <shas>`, `Removed <n> superseded images` and, unchanged, the
`Disk now: <free> free (<n>% used)` line. Disk use is bounded by `KEEP_DEPLOYS`, not by how often
you merge. To keep more or fewer for one run: `KEEP_DEPLOYS=3 bash scripts/ship.sh <sha>`.

On a host with no `.deploy-history`, the first deploy records the image the live colour runs
before it prunes, so a rollback target survives.

## Which deploys did not happen: `deploy-outcome`

`deploy-staging` skips, without a signal, when any gate is red (a grey job among green ones). The
`deploy-outcome` job runs after it on every master push (`.github/scripts/deploy-outcome.sh`):

- staging deployed: green;
- a documentation-only push (`triage` reports `code=false`): green, with a notice that no deploy
  was expected;
- otherwise (a red gate, a failed deploy, a cancelled one, a failed `triage`, or a Dependabot push
  whose gates skip): **red, "master is not on staging"**, with each gate's result in the log and in
  the step summary.

A red `deploy-outcome` is not noise: master is not what staging runs. Fix the gate, or re-run the
workflow once it is green.

## The staging host key

The deploy trusts exactly one host key, committed in `.github/deploy/staging_known_hosts` as
`kaleem-staging ssh-ed25519 <key>` (the alias, never the address) and used with
`StrictHostKeyChecking=yes`. `.github/scripts/check-staging-host-key.sh` verifies the file's shape
on every PR. A mismatch fails the deploy at its first connection, before anything is synced.

If the VPS is rebuilt (or its host key regenerated) every deploy fails there until the file is
updated:

```bash
# On the VPS: the public key, and its fingerprint.
cat /etc/ssh/ssh_host_ed25519_key.pub
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
# Locally: confirm the fingerprint against one you already trust (your own known_hosts entry
# for the host from before the rebuild is NOT it; use the provider console or the rebuild log).
# Then replace the file's one line with:  kaleem-staging <type> <base64>   and open a PR.
```

## The deploy script's service lists

`ship.sh` names its shared services (step 4) and static frontends (step 10) once, as arrays at the
top; `bash scripts/ship.sh --list-services` prints them and touches nothing. Every compose service
outside a colour profile must be in that union, or it is never started and nothing says so (coturn
once went unstarted with every health check green). Checked twice: the `security` job fails a PR
that adds a service without adding it (`.github/scripts/check-shipsh-services.sh`), and `ship.sh`
refuses to start, before pulling, if the host's compose file disagrees.

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

### `.env.production` is hand-managed, and a missing variable rolls the deploy back

There is no `.env.production` in git. It is created by hand on this VPS and
edited by hand thereafter, so **a variable added to
`infra/.env.production.example` does not reach the server until someone copies
it across**. `ship.sh` health-gates the new colour and rolls back *all* of it
— including a perfectly healthy Django — if any one service fails to come up,
so a forgotten variable presents as "the whole deploy failed" rather than as
"one feature is off".

Before deploying a change that adds an environment variable, diff the two:

```bash
# On the VPS. Lists variable names present in the template but not in the
# live file — the ones that will take the next deploy down.
comm -23 \
  <(grep -oP '^[A-Z_]+(?==)' /opt/kaleem/.env.production.example | sort) \
  <(grep -oP '^[A-Z_]+(?==)' /opt/kaleem/.env.production | sort)
```

Variables added in Phase C3b (signaling / WebRTC) — all four are required, see
`docs/runbook/signaling.md`:

| Variable | Read by | Missing means |
| --- | --- | --- |
| `WS_DOMAIN` | `docker-compose.production.yml` | `${WS_DOMAIN:?WS_DOMAIN is required}` fails interpolation before anything starts; **deploy aborts immediately**, not a routing failure caught later by a health check |
| `DJANGO_SIGNALING_SECRET` | both `django-*` and `signaling-*` | signaling's health check 503s; **deploy rolls back** |
| `DJANGO_SIGNALING_URL` | `django-*` | `SignalingProvider` refuses to construct (`ImproperlyConfigured`) |
| `DJANGO_VIDEO_PROVIDER` | `django-*` | falls back to `FakeVideoProvider` — deploy succeeds, signaling is healthy, and **no lesson can reach it** |

## Checking deploy status

```bash
ssh deploy@<staging-ip>
cat /opt/kaleem/.active-color
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl http://localhost:8000/health/ready/
```

## Secrets (stored in GitHub repo settings)

| Secret | Purpose |
| --- | --- |
| `GHCR_PAT` | Push/pull Docker images |
| `STAGING_HOST` | VPS IP address |
| `STAGING_SSH_KEY` | SSH private key (written to a mode-600 file in `$RUNNER_TEMP` for the deploy step only) |
| `STAGING_USER` | SSH username |
