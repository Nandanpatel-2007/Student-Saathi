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

Analytics rules are configurable (all optional):

| Variable | Default | Notes |
| --- | --- | --- |
| `ATTENDANCE_THRESHOLD_PERCENT` | `75` | Below this: `LOW_ATTENDANCE`; also the target for "classes needed" |
| `ATTENDANCE_WARNING_UPPER_PERCENT` | `80` | `[threshold, this)` raises `ATTENDANCE_WARNING` |
| `ATTENDANCE_LATE_COUNTS_AS_PRESENT` | `True` | `False` treats LATE as absent |
| `ATTENDANCE_EXCUSED_POLICY` | `EXCLUDE` | `EXCLUDE` (out of the denominator), `PRESENT` or `ABSENT` |
| `PASS_MARK_PERCENT` | `40` | Weighted score below this: `FAILING_SUBJECT` |
| `SHARP_DROP_POINTS` | `15` | Drop between the last two assessments (strictly greater) |

## Demo data

```powershell
python manage.py seed_demo           # 1 admin, 3 faculty, 2 sections, 30 students, 5 subjects, ~6 weeks of data
python manage.py seed_demo --reset   # replace previously seeded demo data (touches nothing else)
```

All demo passwords are `demo1234`. Usernames: `admin`, `faculty1`-`faculty3`, `student01`-`student30`.
At-risk students: `student03` (low attendance), `student18` (attendance warning), `student07` (failing),
`student12` (sharp score drop), `student25` (low attendance + failing).

## Endpoints (all under `/api/v1`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| Academics | `/subjects`, `/sections`, `/enrollments` (+ `POST /enrollments/bulk`), `/teaching-assignments`, `GET /faculty/me/classes` |
| Attendance | `POST/GET /attendance/sessions`, `GET /attendance/sessions/{id}`, `PUT /attendance/sessions/{id}/records` |
| Assessments | `/assessments` CRUD, `GET/PUT /assessments/{id}/marks` |
| Analytics | `GET /students/me/dashboard`, `GET /faculty/classes/{id}/summary`, `.../students`, `.../export?type=attendance\|marks` |

Business rules worth knowing:

- Attendance %: `LATE` counts as present; `EXCUSED` is excluded from the denominator (both configurable).
- Weighted score: only graded assessments count (pending ones are ignored, an absence scores 0), normalised by the
  weightage graded so far. Total weightage per teaching assignment (a subject taught to a section) is capped at 100.
- Alerts are computed on every read; there is no background job.
- `student_id` / `faculty_id` in request bodies are profile ids (`StudentProfile`, `FacultyProfile`).

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
