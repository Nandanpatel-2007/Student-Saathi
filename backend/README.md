# Student Saathi — Backend

Django 5 + Django Ninja API for student attendance and academic performance tracking.

## Setup (Windows PowerShell; use `source .venv/bin/activate` on macOS/Linux)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py createsuperuser
```

## Run

```powershell
python manage.py runserver
```

- API base: <http://localhost:8000/api/v1/>
- OpenAPI docs: <http://localhost:8000/api/v1/docs>
- OpenAPI JSON (for client generation): <http://localhost:8000/api/v1/openapi.json>
- Django admin: <http://localhost:8000/admin/>

## Test and lint

```powershell
pytest
ruff check .
```

## Configuration (`.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `DEBUG` | `True` (dev) | Prod settings force `False` |
| `SECRET_KEY` | dev-only key | **Required** in prod |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | **Required** in prod |
| `DATABASE_URL` | `sqlite:///db.sqlite3` | Use `postgres://user:pw@host:5432/db` for Postgres |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma separated |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `30` / `7` | |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | `20` / `100` | |

Settings modules: `config.settings.dev` (default for `manage.py` and pytest), `config.settings.prod` (default for WSGI/ASGI).
Postgres needs `pip install psycopg[binary]`.

## Conventions

- **Roles:** `STUDENT`, `FACULTY`, `ADMIN` (`apps.accounts.models.Role`). Guard endpoints with
  `auth=require_role(Role.FACULTY)` or `auth=jwt_auth` from `api/auth.py`.
- **Errors:** every non-2xx response is `{"error": {"code", "message", "details": [{"field", "message"}]}}`.
- **Pagination:** list endpoints use `@paginate(StandardPagination)` and return
  `{"items", "count", "page", "page_size", "total_pages"}`; query params `page`, `page_size`.
- **Layout:** business logic in `apps/<app>/services.py`; routers stay thin.

## Auth endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{username, password}` | `{access, refresh, user: {id, name, role}}` |
| POST | `/auth/refresh` | `{refresh}` | `{access}` |
| GET | `/auth/me` | — (Bearer token) | `{id, name, role}` |
