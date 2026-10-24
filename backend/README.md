# Student Saathi: Backend

Django 5 + Django Ninja API for student attendance, marks and assignments.

## Setup (Windows PowerShell; use `source .venv/bin/activate` on macOS/Linux)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py createsuperuser        # optional: or load the demo data below
```

## Run

```powershell
python manage.py runserver
```

- API base: <http://localhost:8000/api/v1/>
- OpenAPI docs: <http://localhost:8000/api/v1/docs>
- OpenAPI JSON (for client generation): <http://localhost:8000/api/v1/openapi.json>
- Django admin: <http://localhost:8000/admin/>

The frontend's dev origin must be in `CORS_ALLOWED_ORIGINS` (the default allows `http://localhost:5173` and
`http://localhost:3000`).

## Test and lint

```powershell
pytest
ruff check .
```

The tests use a fast password hasher and write uploaded files to a throwaway temp folder, never to `backend/media`.

## Configuration (`.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `DEBUG` | `True` (dev) | Prod settings force `False` |
| `SECRET_KEY` | dev-only key | **Required** in prod |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | **Required** in prod |
| `DATABASE_URL` | `sqlite:///db.sqlite3` | Use `postgres://user:pw@host:5432/db` for Postgres |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma separated |
| `TIME_ZONE` | `Asia/Kolkata` | The one zone the app speaks; datetimes are stored in UTC |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `30` / `7` | |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | `20` / `100` | |
| `ASSIGNMENT_MAX_UPLOAD_MB` | `10` | Largest file a student may submit |

Settings modules: `config.settings.dev` (default for `manage.py` and pytest), `config.settings.prod`
(default for WSGI/ASGI). Postgres needs `pip install psycopg[binary]`.

Analytics rules are configurable (all optional):

| Variable | Default | Notes |
| --- | --- | --- |
| `ATTENDANCE_THRESHOLD_PERCENT` | `75` | Below this: `LOW_ATTENDANCE`; also the target for "classes needed" |
| `ATTENDANCE_WARNING_UPPER_PERCENT` | `80` | `[threshold, this)` raises `ATTENDANCE_WARNING` |
| `ATTENDANCE_LATE_COUNTS_AS_PRESENT` | `True` | `False` treats LATE as absent |
| `ATTENDANCE_EXCUSED_POLICY` | `EXCLUDE` | `EXCLUDE` (out of the denominator), `PRESENT` or `ABSENT` |
| `PASS_MARK_PERCENT` | `40` | Average score below this: `FAILING_SUBJECT` |
| `SHARP_DROP_POINTS` | `15` | Drop between the last two graded items (strictly greater) |

## Demo data

```powershell
python manage.py seed_demo           # 1 admin, 3 faculty, 2 sections, 30 students, 5 subjects, ~6 weeks of data
python manage.py seed_demo --reset   # replace the previously seeded demo data (touches nothing else)
```

All demo passwords are `demo1234`. Usernames: `admin`, `faculty1`-`faculty3`, `student01`-`student30`.
At-risk students: `student03` (low attendance), `student18` (attendance warning), `student07` (failing),
`student12` (sharp score drop), `student25` (low attendance + failing).

Each class also gets three assignments with a realistic mix: work handed in early, near the deadline, late (hours to
days) and never; graded work with feedback; one strict (no late work) assignment; and one still upcoming. The
submitted files are tiny valid PDFs generated in code. They are written under `backend/media/` (git-ignored), and
`seed_demo --reset` deletes the previous demo files along with the rows. To clear everything by hand, delete
`backend/media/` and `backend/db.sqlite3`, then run `migrate` and `seed_demo` again.

## Endpoints (all under `/api/v1`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| Academics (admin writes) | `/subjects`, `/sections`, `/enrollments` (+ `POST /enrollments/bulk`), `/teaching-assignments`, `GET /faculty/me/classes` |
| Admin lookups | `GET /admin/overview`, `GET /admin/faculty?search=`, `GET /admin/students?search=&section_id=` |
| Attendance | `POST/GET /attendance/sessions`, `GET /attendance/sessions/{id}`, `PUT /attendance/sessions/{id}/records` |
| Assessments | `/assessments` CRUD, `GET/PUT /assessments/{id}/marks` |
| Assignments (faculty/admin) | `POST/GET /assignments`, `GET/PUT/DELETE /assignments/{id}`, `GET /assignments/{id}/submissions`, `PUT /assignments/{id}/submissions/{student_id}/grade`, `GET /assignments/{id}/export` |
| Assignments (student) | `GET /students/me/assignments?status=&subject=`, `POST/DELETE /assignments/{id}/submission` (multipart: `file`, `note`) |
| Assignment files | `GET /assignments/{id}/submissions/{student_id}/file` (the submitting student, the owning faculty, or an admin) |
| Analytics | `GET /students/me/dashboard`, `GET /faculty/classes/{id}/summary`, `.../students`, `.../export?type=attendance\|marks` |

Every list is paginated (`page`, `page_size`; max 100). Every error is
`{"error": {"code", "message", "details": [{"field", "message"}]}}`.

## Rules worth knowing

**Attendance and scores**

- Attendance %: `LATE` counts as present; `EXCUSED` is excluded from the denominator (both configurable).
- **Average score** (`average_score_pct`) = the mean of `marks_obtained / max_marks * 100` over the student's graded
  items in that subject and section. Every item counts equally (there is no weightage). Items not graded yet are
  ignored; an item the student was absent for counts as 0; nothing graded means `null`. Graded assignment marks are
  graded items too (`marks / the assignment's max marks`); a submission nobody has graded yet is ignored.
- **Class averages** are the mean of the students' own values, ignoring `null`s: `class_avg_score_pct` for marks and
  `class_avg_attendance_pct` for attendance. Students only ever receive these aggregates, never other students' data.
  Faculty rows carry `diff_from_class_attendance` / `diff_from_class_score` (percentage points, `+` = above average).
- There is no rank or percentile. The student dashboard also returns `average_score_overall`.
- Alerts: `FAILING_SUBJECT` when the average score is below `PASS_MARK_PERCENT`; `SHARP_DROP` when the latest of the
  last two graded items fell by strictly more than `SHARP_DROP_POINTS` (absences are skipped; items are ordered by
  date, using an assignment's due date). Alerts are computed on every read; there is no background job.

**Assignments and timing**

- Timing is **derived, never stored**: `offset_seconds = submitted_at - due_at` (negative = before the deadline) and
  `timing` is `ON_TIME` up to and including the deadline, otherwise `LATE`. Editing `due_at` therefore re-evaluates
  every existing submission. `submitted_at` is set by the server on every (re)submission; the client cannot send it.
- Status per student: `NOT_SUBMITTED`, `SUBMITTED`, `LATE` (submitted late, not graded), `GRADED`, and
  `OVERDUE_MISSING` (nothing submitted after the deadline). A graded late submission is `GRADED` with `timing: LATE`.
- A due date sent without an offset is read as IST. Datetimes are stored in UTC and returned as ISO 8601.
- A student may replace or withdraw their submission until it is graded (then `409`). If `allow_late_submissions` is
  false, any upload after the deadline is refused with `409`.
- Uploads: PDF, DOC(X), PPT(X), XLS(X), TXT, PNG, JPG/JPEG and ZIP, up to `ASSIGNMENT_MAX_UPLOAD_MB`. A file is
  accepted only if its extension, declared content type and leading bytes agree; empty files are refused. The stored
  name is random (`media/assignments/<assignment id>/<uuid>.<ext>`); the original name is kept separately and used for
  the download. There is no public media URL: files are only served by the authenticated download endpoint. The
  old file is deleted when a submission is replaced or withdrawn, and when its assignment is deleted.

**Other**

- `student_id` / `faculty_id` in request bodies are profile ids (`StudentProfile`, `FacultyProfile`).
- "Assignment" in the API paths means the new homework feature. A *teaching assignment* (`/teaching-assignments`,
  the `assignment_id` in `/faculty/classes/{assignment_id}/...`) is the link between a faculty member, a subject
  and a section.

## Conventions

- **Roles:** `STUDENT`, `FACULTY`, `ADMIN` (`apps.accounts.models.Role`). Guard endpoints with
  `auth=require_role(Role.FACULTY)` or `auth=jwt_auth` from `api/auth.py`.
- **Errors:** raise `HttpError` / `DetailedHttpError` from services; handlers in `api/errors.py` produce the envelope.
- **Pagination:** list endpoints use `@paginate(StandardPagination)`.
- **Layout:** business logic in `apps/<app>/services.py` (pure rules in `analytics/services.py` and
  `assignments/rules.py`); routers stay thin.
- **Queries:** list and report endpoints use a fixed number of queries; tests assert it.

## Auth endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{username, password}` | `{access, refresh, user: {id, name, role}}` |
| POST | `/auth/refresh` | `{refresh}` | `{access}` |
| GET | `/auth/me` | none (Bearer token) | `{id, name, role}` |
