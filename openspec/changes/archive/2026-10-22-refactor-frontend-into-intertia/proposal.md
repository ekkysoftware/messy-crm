# Proposal

## Why

The dashboard UI is a Django template plus one 154-line vanilla-JS closure that
concatenates HTML strings, reads data from `json_script` blocks and a `data-*`
element, and rebuilds markup on every interaction. There is no build tooling
and no component model: every UI change means editing escaped strings in
`crm/static/crm/dashboard.js`, with no types, no components, and no way to grow
the screen beyond one file.

This change moves the frontend into an Inertia.js application so page state
comes from server props, UI lives in typed React components, and assets are
built by Vite. The Django layering introduced earlier (`forms.py`,
`services.py`, `selectors.py`) stays the source of business behaviour.

## What Changes

- Add the Python dependencies with `uv`: `inertia-django` (2.0.0, which
  includes Inertia v3 protocol support and tests) and `django-vite` (asset tag
  and manifest integration).
- Configure Django for Inertia: add the `inertia` app, `InertiaMiddleware`,
  `INERTIA_LAYOUT`, `INERTIA_VERSION`, and `DJANGO_VITE` settings.
- Replace `crm/templates/crm/dashboard.html` with a minimal Inertia root
  template (`crm/templates/crm/app.html`) that contains only the Vite entry
  point and the `{% block inertia %}` mount point.
- Change `crm_screen` to return an Inertia page (`crm/Dashboard` component)
  with structured props (`contacts`, `selected`, `filters`, `summary`,
  `statusChoices`) instead of `json_script` blocks and a `data-*` element.
- **BREAKING** Replace the single `POST /` + `action` dispatch with explicit
  command endpoints: `POST /contacts/`, `PATCH /contacts/<pk>/status/`,
  `POST /contacts/<pk>/notes/`, `DELETE /contacts/<pk>/`. Successful writes
  redirect back to the dashboard; validation failures redirect back with
  one-shot `errors` props consumed by Inertia forms.
- **BREAKING** The dashboard HTML no longer contains contact data or
  server-rendered markup; the screen is rendered by the Inertia client. HTML
  scrapers and template-content assertions must read page props (or drive the
  client) instead.
- Create a bun-managed frontend application in `frontend/`: React 19 +
  TypeScript + Vite + `@inertiajs/react` 3, with `src/app.tsx`, a
  `pages/crm/Dashboard.tsx`, presentational components for stats, toolbar, contact
  list, detail, and the three forms, plus the dashboard CSS imported through
  Vite so it is bundled and hashed.
- Build frontend assets into `frontend/dist/` (git-ignored except a committed
  `.gitkeep`) and mount that directory through `STATICFILES_DIRS`, so
  `django-vite` serves them in both dev (HMR on port 5173) and production
  (hashed manifest assets).
- Remove `crm/static/crm/dashboard.js`, `crm/static/crm/dashboard.css`, the
  rest of the `crm/static/crm/` directory, and `crm/templates/crm/dashboard.html`
  once their behaviour has moved.
- Rewrite the Django tests that assert rendered HTML so they assert Inertia
  component/props instead, and add frontend unit tests (Vitest) for the
  formatting/validation glue.
- Keep CSV export as a plain Django download (`/export/`) — it is not an
  Inertia visit.

## Capabilities

### New Capabilities

- `crm-screen`: delivering the CRM dashboard page through Inertia and
  exposing the read model (filtered contact list, selected contact with
  activity, summary statistics) plus the CSV export download.
- `crm-contact-commands`: the write side of the screen — creating a contact,
  changing status, adding a note, deleting a contact — including the
  validation rules, activity logging, and the redirect/error contract the
  Inertia forms rely on.

### Modified Capabilities

None. No capability specs exist yet under `openspec/specs/`; both capabilities
are introduced by this change.

## Impact

- **Code**: `messycrm/settings.py`, `messycrm/urls.py` (if routing changes),
  `crm/views.py`, new `crm/middleware.py` (one-shot error flash), new
  `crm/pages.py` (page-prop assembly) or equivalent, `crm/urls.py`,
  `crm/templates/crm/app.html` (new), `crm/tests/` (split out of `crm/tests.py`, assertions rewritten),
  plus the new `frontend/` application (including its ignored `dist/` build
  output and committed `.gitkeep`). Removals: `crm/templates/crm/dashboard.html`,
  `crm/static/crm/dashboard.js`, `crm/static/crm/dashboard.css`, and the rest
  of `crm/static/crm/`.
- **APIs/URLs**: `crm` (dashboard) and `export_contacts` keep their paths;
  new command URLs are added and the old `POST /` contract with an `action`
  field is removed. Dashboard transport changes from HTML to Inertia page
  JSON/XHR after the first load.
- **Dependencies**: `inertia-django`, `django-vite` (uv); React 19, React DOM,
  `@inertiajs/react` 3, Vite, `@vitejs/plugin-react`, TypeScript, Vitest and
  testing-library (bun).
- **Verification/tooling**: `uv run python manage.py test` must stay green
  (rewritten where assertions were HTML-specific); `bun run build` and
  `bun run test` must pass; first-load still renders the page without
  JavaScript errors only after hydration (no SSR).
- **Out of scope**: SSR (`INERTIA_SSR_ENABLED` stays off), `useHttp`/optimistic
  updates, visual redesign, pagination, authentication, model or migration
  changes, and the `.env`/Docker/`dj-database-url` work hinted at in `.env`.
