from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
SECRET_KEY = env("SECRET_KEY")  # required in production
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")  # required in production

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
SECURE_CONTENT_TYPE_NOSNIFF = True
