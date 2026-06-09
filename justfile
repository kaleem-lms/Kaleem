# justfile — kaleem task runner
# Run `just` to see all available commands.

default:
    @just --list

# ─── Setup ────────────────────────────────────────────────────

# Clone submodules, install deps, create DBs, seed data
setup:
    git submodule update --init --recursive
    docker compose -f docker-compose.local.yml up -d postgres redis
    @echo "Waiting for Postgres..."
    sleep 3
    cd backend && pip install -r requirements/local.txt
    cd backend && DJANGO_SETTINGS_MODULE=config.settings.local DJANGO_READ_DOT_ENV_FILE=True python manage.py migrate
    cd dashboard && pnpm install
    cd marketing && pnpm install
    @echo "Setup complete. Run 'just dev' to start."

# ─── Development ──────────────────────────────────────────────

# Bring up everything locally (backend in Docker + dashboard & marketing)
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    # Backend runs detached; frontends run in the foreground. Ctrl-C stops the
    # frontends — the backend stack keeps running (use `just stop` to halt it).
    docker compose -f docker-compose.local.yml up -d
    echo "Backend up: Django :8000 · Mailpit :8025. Starting frontends (Ctrl-C to stop)…"
    trap 'kill 0' EXIT
    (cd dashboard && pnpm dev) &
    (cd marketing && pnpm dev) &
    wait

# Bring up only the backend stack (Docker), detached
dev-backend:
    docker compose -f docker-compose.local.yml up -d

# Run only the dashboard dev server (Vite → http://localhost:5173)
dashboard:
    cd dashboard && pnpm dev

# Run only the marketing dev server (Astro → http://localhost:4321)
marketing:
    cd marketing && pnpm dev

# Stop the backend stack
stop:
    docker compose -f docker-compose.local.yml down

# ─── Testing ──────────────────────────────────────────────────

# Run all tests (backend + frontend + boundary linter)
test: test-backend test-frontend check-boundaries

# Run backend tests
test-backend:
    cd backend && DATABASE_URL=postgres://kaleem:kaleem@localhost:5432/kaleem pytest -v --cov=kaleem --cov-report=term-missing

# Run frontend type check
test-frontend:
    cd dashboard && pnpm tsc --noEmit

# ─── Linting ──────────────────────────────────────────────────

# Run all linters
lint: lint-backend lint-frontend check-boundaries

# Lint backend (ruff + mypy)
lint-backend:
    cd backend && ruff check .
    cd backend && ruff format --check .

# Lint frontend (biome)
lint-frontend:
    cd dashboard && pnpm dlx @biomejs/biome check .

# Check module boundary contracts
check-boundaries:
    cd backend && lint-imports

# ─── Database ─────────────────────────────────────────────────

# Run Django migrations
migrate:
    cd backend && DJANGO_SETTINGS_MODULE=config.settings.local DJANGO_READ_DOT_ENV_FILE=True python manage.py migrate

# Open Django shell
shell:
    cd backend && DJANGO_SETTINGS_MODULE=config.settings.local DJANGO_READ_DOT_ENV_FILE=True python manage.py shell_plus 2>/dev/null || cd backend && DJANGO_SETTINGS_MODULE=config.settings.local DJANGO_READ_DOT_ENV_FILE=True python manage.py shell

# Reset DB and load seed data
seed:
    cd backend && DJANGO_SETTINGS_MODULE=config.settings.local DJANGO_READ_DOT_ENV_FILE=True python manage.py seed basic

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
