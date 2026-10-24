# Student Saathi – Backend

Django 5 + Django Ninja API for tracking student attendance and academic performance.
API-first: the OpenAPI spec at `/api/v1/openapi.json` is the contract for the frontend.

## Layout

```
config/            settings (base / dev / prod), urls, wsgi/asgi
apps/accounts      custom User (roles), StudentProfile, FacultyProfile, auth services
apps/academics     departments, sections (subjects/enrollments/assignments in Phase 2)
apps/attendance    (Phase 3)
apps/assessments   (Phase 4)
apps/analytics     (Phase 5)
api/               central NinjaAPI, auth + role helpers, error format, pagination
tests/
```

## Setup

Python 3.12+ (developed on 3.13).

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                # macOS/Linux: cp .env.example .env
python manage.py migrate
python manage.py createsuperuser      # superusers automatically get role ADMIN
```

The database defaults to SQLite. Set `DATABASE_URL=postgres://user:pass@host:5432/db` in `.env`
to use Postgres (the code avoids SQLite-only behaviour).

## Run

```powershell
python manage.py runserver
```

- API base: <http://localhost:8000/api/v1/>
- Interactive docs: <http://localhost:8000/api/v1/docs>
- OpenAPI JSON: <http://localhost:8000/api/v1/openapi.json>

Settings modules: `config.settings.dev` (default for `manage.py` and pytest) and
`config.settings.prod` (default for wsgi/asgi; requires `SECRET_KEY` and `ALLOWED_HOSTS`).
Override with `DJANGO_SETTINGS_MODULE`.

## Test and lint

```powershell
pytest
ruff check .
ruff format --check .
```

## API conventions

- JSON is snake_case, dates are ISO-8601.
- Auth: `POST /auth/login` → `{access, refresh, user}`; send `Authorization: Bearer <access>`.
  `POST /auth/refresh` exchanges a refresh token for a new access token.
- Errors always look like `{"error": {"code": "...", "message": "...", "details": ...}}`.
  Status codes: 401 not authenticated, 403 wrong role, 404, 409, 422 validation (details = field errors).
- List endpoints are paginated with `?page=1&page_size=20` and return
  `{items, count, page, page_size, total_pages}` (max page size configurable via
  `PAGINATION_MAX_PAGE_SIZE`).
- Protect an endpoint with `auth=require_role("FACULTY")` (from `api.auth`); everything is
  authenticated by default, public endpoints opt out with `auth=None`.
