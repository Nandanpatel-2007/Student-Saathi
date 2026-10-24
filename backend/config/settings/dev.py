from .base import *

DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env("SECRET_KEY", default="dev-insecure-key-do-not-use-in-production")
