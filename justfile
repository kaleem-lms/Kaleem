# justfile — kaleem task runner
# Run `just` to see all available commands.

default:
    @just --list

# ─── Setup ────────────────────────────────────────────────────

# Clone submodules, build images, run migrations + seed (all in Docker)
setup:
    git submodule update --init --recursive
    @echo "Building images…"
    HOST_UID=$(id -u) HOST_GID=$(id -g) GH_TOKEN="${GH_TOKEN:-$(gh auth token)}" docker compose -f docker-compose.local.yml build
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml up -d postgres redis
    @echo "Waiting for Postgres…"
    sleep 3
    just migrate
    just seed
    @echo "Setup complete. Run 'just dev'."

# ─── Development ──────────────────────────────────────────────

# Bring up the entire stack in Docker, behind Traefik. Ctrl-C stops it.
dev:
    HOST_UID=$(id -u) HOST_GID=$(id -g) GH_TOKEN="${GH_TOKEN:-$(gh auth token)}" docker compose -f docker-compose.local.yml up

# Bring up the stack detached
dev-backend:
    HOST_UID=$(id -u) HOST_GID=$(id -g) GH_TOKEN="${GH_TOKEN:-$(gh auth token)}" docker compose -f docker-compose.local.yml up -d

# Rebuild images (after dependency or Dockerfile changes)
rebuild:
    HOST_UID=$(id -u) HOST_GID=$(id -g) GH_TOKEN="${GH_TOKEN:-$(gh auth token)}" docker compose -f docker-compose.local.yml build

# Tail logs for one service, e.g. `just logs dashboard`
logs service:
    docker compose -f docker-compose.local.yml logs -f {{service}}

# Stop the backend stack
stop:
    docker compose -f docker-compose.local.yml down

# ─── Testing ──────────────────────────────────────────────────

# Run all tests (backend + frontend + boundary linter)
test: test-backend test-frontend check-boundaries

# Backend tests (in container)
test-backend:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm \
      -e DATABASE_URL=postgres://kaleem:kaleem@postgres:5432/kaleem \
      django pytest -v --cov=kaleem --cov-report=term-missing

# Frontend type check (in container)
test-frontend:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm dashboard pnpm tsc --noEmit

# Escape hatch: run backend tests on the host (uses local .venv)
test-backend-host:
    cd backend && DATABASE_URL=postgres://kaleem:kaleem@localhost:5432/kaleem pytest -v --cov=kaleem --cov-report=term-missing

# ─── Linting ──────────────────────────────────────────────────

# Run all linters
lint: lint-backend lint-frontend check-boundaries

lint-backend:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django sh -euc 'ruff check . && ruff format --check .'

lint-frontend:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm dashboard pnpm dlx @biomejs/biome check .

check-boundaries:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django lint-imports

# ─── Database ─────────────────────────────────────────────────

# Run Django migrations (inside the django container)
migrate:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django python manage.py migrate

# Open Django shell (inside the django container)
shell:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django python manage.py shell_plus 2>/dev/null \
      || HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django python manage.py shell

# Reset DB and load seed data
seed:
    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.local.yml run --rm django python manage.py seed basic

# ─── Infrastructure ───────────────────────────────────────────

# Deploy to staging (placeholder)
deploy:
    @echo "Deploy runbook: see docs/runbook/deploy.md"

# Scaffold a new backend module
new-module name:
    @echo "Creating module kaleem/{{name}}..."
    mkdir -p backend/kaleem/{{name}}/{api,tests}
    touch backend/kaleem/{{name}}/__init__.py
    touch backend/kaleem/{{name}}/apps.py
    touch backend/kaleem/{{name}}/models.py
    touch backend/kaleem/{{name}}/services.py
    touch backend/kaleem/{{name}}/api/__init__.py
    touch backend/kaleem/{{name}}/api/serializers.py
    touch backend/kaleem/{{name}}/api/views.py
    touch backend/kaleem/{{name}}/tests/__init__.py
    @echo "Module scaffolded. Remember to:"
    @echo "  1. Add 'kaleem.{{name}}' to LOCAL_APPS in settings"
    @echo "  2. Add import-linter contracts in pyproject.toml"
    @echo "  3. Create docs/architecture/{{name}}.md"
