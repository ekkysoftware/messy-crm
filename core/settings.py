import os
from pathlib import Path

import dj_database_url
from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment first (Docker/CI), then `.env`, then the local development default.
SECRET_KEY = config("DJANGO_SECRET_KEY", default="interview-exercise-only")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="*", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("DJANGO_CSRF_TRUSTED_ORIGINS", default="", cast=Csv())
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "inertia",
    "django_vite",
    "crm",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves collectstatic output in production (DEBUG=False); no-op in dev.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "inertia.middleware.InertiaMiddleware",
    "crm.middleware.ShareInertiaErrorsMiddleware",
]
ROOT_URLCONF = "core.urls"
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
            ]
        },
    }
]
WSGI_APPLICATION = "core.wsgi.application"
# `DATABASE_URL` is read from the environment only (Docker Compose sets it),
# so local runs and tests keep using SQLite unless it is exported explicitly.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
        conn_health_checks=True,
    )
}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Inertia.js + Vite -------------------------------------------------------

# Vite writes its bundle here; Django serves the same directory as static files.
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
VITE_MANIFEST = FRONTEND_DIST / ".vite" / "manifest.json"
STATICFILES_DIRS = [("crm", FRONTEND_DIST)]


DJANGO_VITE = {
    "default": {
        "dev_mode": DEBUG,
        "dev_server_port": 5173,
        "static_url_prefix": "crm",
        "manifest_path": VITE_MANIFEST,
    }
}

INERTIA_LAYOUT = "app.html"
INERTIA_SSR_ENABLED = False
# Busts stale Inertia pages whenever a new bundle is built; "dev" before the
# first `bun run build`.
# `INERTIA_VERSION` must be identical across instances of a deployment, mtime is
# only a local fallback: set it from the release id (e.g. the commit SHA) in prod.
INERTIA_VERSION = os.environ.get("INERTIA_VERSION") or (
    str(int(VITE_MANIFEST.stat().st_mtime)) if VITE_MANIFEST.exists() else "dev"
)

# `collectstatic` target for deployment; WhiteNoise serves it in production while
# `DEBUG=False`, and staticfiles/nginx serves it in front of the app otherwise.
STATIC_ROOT = BASE_DIR / "staticfiles"

# Vite filenames are content-hashed (`app--_S4osaR.js`), so they are immutable.
WHITENOISE_MAX_AGE = 60 * 60 * 24 * 365
WHITENOISE_IMMUTABLE_FILE_TEST = r"/assets/.*-[A-Za-z0-9_-]{8}\."
