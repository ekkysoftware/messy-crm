#!/bin/sh
set -e

# Compose starts the web container only after Postgres reports healthy, so the
# schema can be applied on boot. Set RUN_MIGRATIONS=false to skip it.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    python manage.py migrate --noinput
fi

# Sample data is for development only. It is opt-in, so production never seeds
# demo contacts just because migrations ran.
if [ "${RUN_SEED_CRM:-false}" = "true" ]; then
    python manage.py seed_crm
fi

exec "$@"
