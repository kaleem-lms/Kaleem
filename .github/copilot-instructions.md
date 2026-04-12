# kaleem — Copilot Instructions

This is a modular-monolith LMS. Key rules:

1. No module may import another module's models. Use `<module>/services.py` public API.
2. CSRF middleware is ENABLED. Never disable it.
3. Every feature needs a spec in docs/superpowers/specs/ BEFORE any code.
4. TDD: write failing test first, then code.
5. Business logic goes in services.py, never on models.
6. Full roadmap: docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md
7. Current state: see STATE.md
