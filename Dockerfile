# syntax=docker/dockerfile:1

# --- Frontend bundle (Vite/React) -------------------------------------------
FROM oven/bun:1-alpine AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# --- Python dependencies (uv) ------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS backend
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# --- Runtime -----------------------------------------------------------------
FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app

RUN useradd --create-home --uid 1000 app

COPY --from=backend /app/.venv /app/.venv
COPY manage.py ./
COPY core ./core
COPY crm ./crm
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# collectstatic needs only settings + the built manifest, never the database.
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && python manage.py collectstatic --noinput \
    && chown -R app:app /app/staticfiles

USER app
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["gunicorn", "core.wsgi", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
