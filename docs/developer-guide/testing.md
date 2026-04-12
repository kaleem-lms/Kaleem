# Testing Guide

## Running tests

```bash
just test           # all tests (backend + frontend + boundaries)
just test-backend   # backend only
just test-frontend  # frontend only (type check in Phase 0)
```

## TDD workflow (D3)

1. Write the failing test
2. Run it — verify it fails with the expected error
3. Write the minimal code to make it pass
4. Run it — verify it passes
5. Refactor if needed, tests still passing
6. Commit

## Coverage targets

- Services/models: >= 80%
- identity module specifically: >= 90%
- Views/serializers: best effort, no hard target
