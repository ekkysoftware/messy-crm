# Jellybean CRM — live refactoring exercise

This is a small, working Django CRM screen. It is intentionally messy and resembles a feature that grew quickly in production. Your task is **not** to rewrite everything. Improve it safely while using your preferred IDE and AI coding agent.

## Run it

Requirements: Python 3.14+, [uv](https://docs.astral.sh/uv/), and
[bun](https://bun.sh/). The app uses a local SQLite database; no database
server is needed.

Prepare the backend once:

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py seed_crm
```

Install the frontend dependencies once (and after `package.json` changes):

```bash
cd frontend && bun install && cd ..
```

### Development (hot reload)

The page is served by Django and rendered by the React client, so run two
processes side by side:

```bash
# terminal 1 — Vite dev server with HMR (http://localhost:5173)
cd frontend && bun run dev

# terminal 2 — Django (http://127.0.0.1:8000)
uv run python manage.py runserver
```

Open http://127.0.0.1:8000/, not port 5173: Django owns routing, props and
CSRF, while Vite only serves the JS/CSS modules. Editing a `.tsx` file updates
the browser without a reload; editing Django code reloads the server.

### Built assets (no HMR, production-style)

`django-vite` runs in dev mode while `DEBUG = True`, so switching to built
assets is just a matter of running with `DEBUG = False`. Build the bundle
first — no Vite process is involved afterwards:

```bash
cd frontend && bun install --frozen-lockfile && bun run build && cd ..
# set DEBUG = False in messycrm/settings.py
uv run python manage.py runserver --insecure
```

The page now references `/static/crm/assets/app-<hash>.js` and the hashed CSS
from `frontend/dist`. `--insecure` is only needed locally: with `DEBUG = False`
Django's `runserver` refuses to serve static files.

### Production notes

There is no Node/bun runtime in production — only build artifacts:

```bash
# deploy step
cd frontend && bun install --frozen-lockfile && bun run build && cd ..
INERTIA_VERSION="$(git rev-parse --short HEAD)" \
  uv run python manage.py collectstatic --noinput
```

- Run with `DEBUG = False`. `collectstatic` copies `frontend/dist` into
  `STATIC_ROOT` (`staticfiles/`), and your web server (nginx, a CDN, or
  WhiteNoise) serves it under `/static/`. Do not use `runserver` or
  `--insecure` in production.
- `INERTIA_VERSION` must be the same on every instance of a release; it is
  read from the environment when set, and falls back to the manifest mtime
  locally. A client with a stale version gets a 409 and does a full reload.
- `frontend/dist/assets/*` names are content-hashed, so they can be cached
  `immutable`; do not cache the HTML document.

Five sample contacts will be ready to explore; no login is required. You can
rerun `seed_crm` without duplicating the sample contacts. If port 8000 is busy,
use `uv run python manage.py runserver 8001` and open
http://127.0.0.1:8001/.

### Verify

```bash
uv run python manage.py check
uv run coverage run manage.py test   # Django suite under coverage
uv run coverage report               # terminal report (fails under 90%)
uv run coverage html                 # optional: htmlcov/index.html
cd frontend && bun run test           # Vitest: components and formatters
cd frontend && bun run typecheck
```

This setup is for local interview use. Local data lives in the ignored
`db.sqlite3` file, and the tests use a separate test database.

## CI/CD

Checks, the `development` -> `main` promotion, and the release flow are
documented in [docs/ci-cd.md](docs/ci-cd.md).

## OpenSpec

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) to plan changes. Install the CLI globally with npm (Node.js required):

```bash
npm install -g @fission-ai/openspec@latest
```

Then initialize OpenSpec in the project root:

```bash
openspec init
```

Planning artifacts live under `openspec/`. Once initialized, you can list and inspect changes with:

```bash
openspec list
openspec status --change <change-name>
```

## Timebox

45 minutes total. Spend the first 5 minutes inspecting and explaining your plan. Make one or more meaningful improvements, then verify them.

## Goal

Improve maintainability without breaking current behaviour. Choose the highest-value work you can finish. Examples include:

- Separate responsibilities in the Django code.
- Improve the frontend structure.
- Remove duplication or unsafe/manual URL handling.
- Improve validation, queries, tests or error handling.
- Introduce a clear pattern that future engineers can follow.

## Rules

- Use any AI coding agent you normally use. Screen-share your process.
- You may ask the interviewer questions and make reasonable assumptions.
- Keep the app runnable. Do not spend the session polishing visuals.
- Explain what you asked the agent to do, what you accepted/rejected, and why.
- Finish by showing the diff and running relevant tests.

We assess judgement, AI collaboration, code quality, verification and communication—not the amount of code changed.
