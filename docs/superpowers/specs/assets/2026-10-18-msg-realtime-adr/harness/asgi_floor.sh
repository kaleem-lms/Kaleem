#!/usr/bin/env bash
# SPIKE R3 (option 3 floor): idle RSS of `uvicorn config.asgi:application`, the
# process a Channels deployment would start from. Runs inside the gate image on the gate compose's private network, with
# throwaway build-only values like the Dockerfile's collectstatic step. Channels
# itself is NOT installed (no dependency change), so this is a floor.
# usage: asgi_floor.sh <backend worktree>
set -euo pipefail
R=${KALEEM_WORKTREES:?directory holding _tools/backend-gate.compose.yml}
WT=$(realpath "${1:?worktree}")
H=$(cd "${WT}" && LC_ALL=C sha256sum Dockerfile requirements/*.txt | sha256sum | cut -c1-12)
export GATE_IMAGE="kaleem-gate:${H}" WT GATE_PROJECT="gate-asgi-floor-$$"
C="${R}/_tools/backend-gate.compose.yml"
trap 'docker compose -f "${C}" down -v --remove-orphans >/dev/null 2>&1 || true' EXIT
docker compose -f "${C}" run --rm \
  -e DJANGO_SETTINGS_MODULE=config.settings.production \
  -e DJANGO_SECRET_KEY=build-only-not-used-at-runtime -e DJANGO_ALLOWED_HOSTS=localhost \
  -e DJANGO_FRONTEND_URL=https://build-only.invalid \
  -e DJANGO_STRIPE_SECRET_KEY=build-only-not-a-real-key -e DJANGO_STRIPE_WEBHOOK_SECRET=build-only-not-a-real-secret \
  -e PYTHONDONTWRITEBYTECODE=1 gate sh -c '
    rss() { grep VmRSS /proc/$1/status | tr -s " " | cut -d" " -f2; }
    DJANGO_SETTINGS_MODULE=config.settings.test python manage.py migrate --noinput -v0
    uvicorn config.asgi:application --port 8001 --log-level warning & ASGI=$!
    sleep 8
    for i in 1 2 3 4 5; do
      python - <<PY
import urllib.request
for port in (8001,):
    try:
        urllib.request.urlopen(f"http://localhost:{port}/api/v1/identity/me/", timeout=5)
    except Exception as exc:
        pass
PY
    done
    echo "ASGI_IDLE_RSS_KB $(rss $ASGI)"
    kill $ASGI'
