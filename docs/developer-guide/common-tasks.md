# Common Tasks

## Add a new backend module

```bash
just new-module <name>
```

Then:
1. Add `"kaleem.<name>"` to `LOCAL_APPS` in `backend/config/settings/base.py`
2. Add import-linter contracts in `backend/pyproject.toml`
3. Create `docs/architecture/<name>.md`
4. Run `just check-boundaries` to verify

## Add a new API endpoint

1. Add the view to `<module>/api/views.py`
2. Add the serializer to `<module>/api/serializers.py`
3. Register the viewset in `backend/config/api_router.py`
4. Write tests in `<module>/tests/`

## Add a new model

1. Add the model to `<module>/models.py`
2. Run `cd backend && python manage.py makemigrations`
3. Run `cd backend && python manage.py migrate`
4. Update `docs/architecture/<module>.md`

## Run migrations

```bash
just migrate
```

## Add a dashboard string or an authed route

See [i18n.md](i18n.md): English and Arabic keys together, all six Arabic plural forms, and a
route-list entry for every new authed route.
