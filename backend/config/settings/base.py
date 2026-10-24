from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "ninja_jwt",
    "apps.accounts",
    "apps.academics",
    "apps.attendance",
    "apps.assessments",
    "apps.analytics",
    "apps.assignments",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Any dj-database-url style URL: sqlite:///db.sqlite3, postgres://user:pw@host:5432/db
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", default="Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://localhost:3000"],
)

# JWT (django-ninja-jwt)
NINJA_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Pagination (see api/pagination.py)
DEFAULT_PAGE_SIZE = env.int("DEFAULT_PAGE_SIZE", default=20)
MAX_PAGE_SIZE = env.int("MAX_PAGE_SIZE", default=100)

# Analytics (see apps/analytics/services.py)
ATTENDANCE_THRESHOLD_PERCENT = env.float("ATTENDANCE_THRESHOLD_PERCENT", default=75.0)
ATTENDANCE_WARNING_UPPER_PERCENT = env.float("ATTENDANCE_WARNING_UPPER_PERCENT", default=80.0)
# LATE counts as present when True; otherwise as absent.
ATTENDANCE_LATE_COUNTS_AS_PRESENT = env.bool("ATTENDANCE_LATE_COUNTS_AS_PRESENT", default=True)
# How EXCUSED is treated: EXCLUDE (dropped from the denominator), PRESENT, or ABSENT.
ATTENDANCE_EXCUSED_POLICY = env.str("ATTENDANCE_EXCUSED_POLICY", default="EXCLUDE").upper()
PASS_MARK_PERCENT = env.float("PASS_MARK_PERCENT", default=40.0)
SHARP_DROP_POINTS = env.float("SHARP_DROP_POINTS", default=15.0)

# Assignment uploads. Files live under MEDIA_ROOT and are only ever served through an
# authenticated endpoint; MEDIA_URL is deliberately left unset and no media route exists.
MEDIA_ROOT = BASE_DIR / "media"
ASSIGNMENT_MAX_UPLOAD_MB = env.int("ASSIGNMENT_MAX_UPLOAD_MB", default=10)
