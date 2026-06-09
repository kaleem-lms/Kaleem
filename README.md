# kaleem

An LMS for teaching non-Arabic speakers Islamic sciences (Quran, Tafsir, Arabic language).

## Quick start

```bash
git clone --recursive <repo-url>
cd kaleem
just setup
just dev
```

- Backend API: http://localhost:8000
- Dashboard: http://localhost:5173
- Marketing: http://localhost:4321
- Mailpit: http://localhost:8025
- Django Admin: http://localhost:8000/admin/

## Project structure

| Directory | Purpose |
| --- | --- |
| `backend/` | Django + DRF modular monolith (submodule) |
| `dashboard/` | React + TanStack authenticated app (submodule) |
| `marketing/` | Astro marketing site (submodule) |
| `infra/` | Docker, nginx, monitoring (submodule) |
| `docs/` | Specs, ADRs, architecture, developer guide |

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Local setup](docs/developer-guide/local-setup.md)
- [Full rebuild roadmap](docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md)
- [Current state](STATE.md)

## Commands

Run `just` to see all available commands.
