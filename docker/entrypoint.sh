#!/bin/sh
set -e

# Compose starts the web container only after Postgres reports healthy, so the
# schema can be applied on boot. Set RUN_MIGRATIONS=false to skip it.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    python manage.py migrate --noinput
fi

exec "$@"
