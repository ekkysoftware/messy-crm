# Design

## Context

See `proposal.md` for motivation and the two capability deltas
(`specs/crm-screen/spec.md`, `specs/crm-contact-commands/spec.md`) for the
behavioural contract.

Current state that constrains the approach:

- `crm_screen` renders `crm/templates/crm/dashboard.html`, which embeds
  `contacts_json`/`detail_json` via `json_script` plus a `data-*` element;
  `crm/static/crm/dashboard.js` reads those and rebuilds markup with string
  concatenation (per-row `url` values are built server-side by
  `_return_url`).
- `crm/forms.py`, `crm/services.py`, and `crm/selectors.py` already own
  validation, transactions, and reads. The refactor must not move business
  logic into views or into the client.
- Writes are currently a single `POST /` with an `action` discriminator.
- Django 5.2.18 on Python 3.14.4, deps managed by `uv` (`pyproject.toml`,
  `uv.lock`, `src/messy_crm`).
- No JS toolchain: the frontend is only the hand-written
  `crm/static/crm/dashboard.{js,css}` pair.
- `python manage.py test` is green with 17 tests, some of which assert
  server-rendered HTML (`id="contacts-data"`, `data-q=...`, contact names).

## Goals / Non-Goals

**Goals:**

- A typed React component tree under `frontend/` that renders entirely from
  Inertia page props, with the existing CSS preserved as imported stylesheet.
- Server-driven routing and state: no client-side business rules, no REST
  endpoints invented beyond the command URLs.
- One build pipeline (Vite) with working HMR in dev and hashed assets in
  production, wired into Django through `django-vite`.
- Tests that keep pinning observable behaviour after the transport changes,
  and that run without a browser.

**Non-Goals:**

- SSR (`INERTIA_SSR_ENABLED = False`); first paint is the HTML shell plus the
  client bundle.
- Inertia v3-optional features: `useHttp`, optimistic updates, prefetching,
  layout props, infinite scroll, `<Form>` component. Forms use `useForm`.
- Client-side routing for anything but the dashboard (export stays a plain
  link and full download).
- Visual redesign; the CSS is ported, not rewritten.
- Auth/permissions, pagination, model/migration changes, Docker/env work.

## Decisions

### 1. Inertia v3 client on React 19, `inertia-django` 2.0.0 server

`@inertiajs/react@^3` requires React 19, and the newest `inertia-django`
release (2.0.0) already implements the v3 server protocol: it ships
`inertia/tests/test_v3_protocol.py`, `test_v3_compatibility.py`, and a
Playwright harness pinned to `@inertiajs/vue3@^3.6.1`, and its middleware
documents `useHttp`/v3 behaviour. Crucially, v3's built-in XHR client accepts
`http: { xsrfCookieName: 'csrftoken', xsrfHeaderName: 'X-CSRFToken' }`, which
matches Django's CSRF cookie/header; with the v2 client we would need axios
configuration to bridge Laravel's `XSRF-TOKEN` convention.

*Alternatives considered:* `@inertiajs/react@2` + axios XSRF shim (more moving
parts, older adapter surface); Vue 3 (the adapter's own harness is Vue-based,
but the repo's skills and conventions are React-oriented); Laravel (out of the
question — this is a Django app).

### 2. Vite + `django-vite`, bun as package manager

`frontend/` becomes a self-contained Vite app: `bun install`, `bun run dev`,
`bun run build`, `bun run test`. `vite.config.ts` keeps Vite's default output
directory (`frontend/dist`) and sets `base: '/static/crm/'`,
`build.manifest: true`, `build.emptyOutDir: true`, and `server.port: 5173`.
Django mounts that directory as static and reads the manifest through
`django-vite` 3.x:

```python
STATICFILES_DIRS = [("crm", BASE_DIR / "frontend" / "dist")]
STATIC_ROOT = BASE_DIR / "staticfiles"          # collectstatic target

DJANGO_VITE = {
    "default": {
        "dev_mode": DEBUG,
        "dev_server_port": 5173,
        "static_url_prefix": "crm",
        "manifest_path": BASE_DIR / "frontend" / "dist" / ".vite" / "manifest.json",
    }
}
```

Dev mode follows `DEBUG`: `True` uses the Vite dev server, `False` reads
the built manifest. With `static_url_prefix = "crm"`, dev assets resolve to
`http://localhost:5173/static/crm/src/app.tsx` and production assets to
`/static/crm/assets/app-<hash>.js`.

**Why output lives in `frontend/dist` and not the app's static directory:**
generated files belong next to the project that generates them, Vite's default
needs no `outDir` override, and `emptyOutDir` can never touch hand-written
assets. After the legacy CSS/JS are deleted, `crm/static/` would otherwise exist
only to hold build output. The cost is that `STATICFILES_DIRS` must point at an
existing directory, so a committed `frontend/dist/.gitkeep` (with
`frontend/dist/*` ignored) keeps `staticfiles.W004` out of `manage.py check`. If
`crm` is ever packaged as a reusable Django app, app-local
`crm/static/...` becomes the right home instead.

The root template uses `{% vite_hmr_client %}`, `{% vite_react_refresh %}`,
and `{% vite_asset 'src/app.tsx' %}`. The adapter's own README recommends
`django-vite`, and it saves hand-writing a manifest parser.

*Alternatives considered:* app-static output `crm/static/crm/dist/` (no static
config, but build artifacts inside the Python source tree and an empty
`crm/static/` left behind); a repo-root `static/` directory (a top-level
directory used by one build tool, with no hand-written assets to justify it);
a ~40-line custom `{% vite_asset %}` template tag (transparent but
re-implements dev/prod asset resolution); `@inertiajs/vite` (the v3 plugin's
examples assume `laravel-vite-plugin` for serving and its auto-mount/SSR
wiring, which we do not want while SSR is off).

### 3. Page props built in one place; camelCase at the JS boundary

`crm/pages.py` exposes `dashboard_props(request)` returning the
full prop dict. `crm_screen` and the create command's error path both use it,
so a rendered dashboard is identical regardless of how it was produced.
Props (camelCase, since this is the client contract):
`contacts[]`, `selected` (object or null), `filters {q, status}`,
`summary {total, pipeline, statusCounts}`, `statusChoices [{value,label}]`,
`errors {field: message}` is deliberately *not* a page prop: `inertia-django`
merges page props over shared props (`{**request.inertia, **self.props}`), so a
page-level `errors` key would shadow the middleware's one-shot value.

Each contact keeps the server-built `url` (from `urlencode` + `reverse`) so the
selection links stay safe for special characters and the existing encoding
test keeps its meaning. Decimal values are cast to `float` exactly as today.

*Alternatives considered:* snake_case props to avoid mapping (leaks Python
naming into TypeScript); building row URLs in the client with `URLSearchParams`
(pushes a server concern into the UI and drops the encoding guarantee).

### 4. Explicit command routes with real HTTP methods

```
GET    /                      crm_screen            -> page "crm/Dashboard"
POST   /contacts/             create_contact
PATCH  /contacts/<pk>/status/ change_status
POST   /contacts/<pk>/notes/  add_note
DELETE /contacts/<pk>/        delete_contact
GET    /export/               export_contacts (unchanged)
```

`useForm` submits with `post`/`patch`/`delete`; Inertia sends the real method,
so no `_method` override is needed. `InertiaMiddleware` upgrades PUT/PATCH/
DELETE redirects to 303, which the client follows as a GET. The dashboard
`q`/`status` filters travel as query parameters on the command URLs (or in the
form payload) and are reproduced by the redirect target from `_return_url`.

*Alternatives considered:* keeping `POST /` with an `action` field (least code
churn, but keeps the dispatch grabbing bag and gives every command the same
URL); one `/contacts/<pk>/` view switching on method (PATCH and DELETE in one
function — fewer URLs but muddier intent than separate status/notes paths).

### 5. Validation errors via one-shot session flash, surfaced as props

On a rejected command the view stores `{"field": "message"}` under
`request.session["inertia_errors"]` and redirects to the dashboard.
`crm/middleware.py:ShareInertiaErrorsMiddleware` (registered right after
`inertia.middleware.InertiaMiddleware`) pops that key before the view runs and
calls `inertia.share.share(request, errors=errors)`, so the prop is present on
the next page response only.

Why not return a 422 page response: `InertiaResponse.page_data()` sets
`url` to `request.get_full_path()`, so a 422 from `POST /contacts/` would move
the client's URL to `/contacts/` and a refresh would hit a method-less GET of a
write endpoint. Redirect-back keeps the dashboard URL authoritative and
matches the framework's normal post-redirect-get shape.

*Alternatives considered:* 422 with page props (bad URL, needs `preserveUrl`
hacks); `django.contrib.messages` (maps to Inertia `flash`, not to the
`errors` prop that `useForm` reads); client-only validation (would duplicate
`ContactCreateForm` rules).

### 6. Frontend structure

```
frontend/
  package.json, bun.lock, tsconfig.json, vite.config.ts, vitest.config.ts
  dist/                   Vite output (ignored; only .gitkeep is committed)
  src/
    app.tsx                 createInertiaApp + resolve via import.meta.glob
    types.ts                PageProps and shared prop types
    styles/app.css          the existing dashboard CSS, imported by app.tsx
    lib/format.ts           currency + timestamp formatting helpers
    pages/crm/Dashboard.tsx layout of the screen (name = path under pages/)
    components/StatsRow.tsx, Toolbar.tsx, ContactList.tsx, ContactRow.tsx,
               ContactDetail.tsx, NewContactForm.tsx, StatusForm.tsx,
               NoteForm.tsx, DeleteContactButton.tsx
  test/                   Vitest specs mirroring src/ (+ setup.ts)
```

`app.tsx` uses manual `resolve`/`setup` (documented v3 path) because the
`@inertiajs/vite` auto-resolution plugin is not used; it also passes the
Django CSRF names to `createInertiaApp`:

```tsx
createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx')
    const loadPage = pages[`./pages/${name}.tsx`]

    if (!loadPage) throw new Error(`Unknown Inertia page: ${name}`)

    return (await loadPage()).default
  },
  http: { xsrfCookieName: 'csrftoken', xsrfHeaderName: 'X-CSRFToken' },
})
```

No `setup` callback is passed: the React adapter mounts into the root element
itself (`createRoot`, or `hydrateRoot` when the server marked the element), so
the entry point only has to resolve pages. The resolver returns the component,
not the module object — `ComponentResolver` accepts `Promise<ReactComponent>`,
while a promise of `{ default }` is not part of the union.

`types.ts` declares the prop shapes and augments `InertiaConfig`
(`sharedPageProps`) from `@inertiajs/core`, so `usePage().props` is typed.

### 7. Root template and settings

New `crm/templates/crm/app.html` is `INERTIA_LAYOUT`: doctype, `<title>`,
`{% vite_hmr_client %}`, `{% vite_react_refresh %}`, `{% vite_asset 'src/app.tsx' %}`,
and `{% block inertia %}{% endblock %}` in `<body>`. Settings additions:
`"inertia"` and `"django_vite"` in `INSTALLED_APPS`, `InertiaMiddleware` after
`CsrfViewMiddleware`, `INERTIA_LAYOUT = "crm/app.html"`, `INERTIA_SSR_ENABLED = False`,
`INERTIA_VERSION` from the environment (release id) with the built manifest's
mtime as a local fallback, so a new build invalidates stale page versions and
every instance of a release reports the same version, and
`STATICFILES_DIRS = [("crm", BASE_DIR / "frontend" / "dist")]` so the same
directory is served by Django in both modes.

### 8. Test strategy

Django tests keep being the behavioural contract, but assert props instead of
HTML using `inertia.test.InertiaTestCase` (`self.inertia` sends
`X-Inertia: true`; `self.props()`, `self.component()`, `self.assertComponentUsed`).
`self.client` stays for first-load HTML and export. Query-count coverage stays
at the current cap (5 queries for a fresh dashboard); a validation-follow test
may see one extra session read and asserts that explicitly.

Tests are a package, one module per concern, instead of the single
`crm/tests.py`: `crm/tests/test_screen.py` (read props), `test_commands.py`
(write endpoints and validation rules), `test_urls.py` (selection/redirect URL
contract), `test_template.py` (first-load document), `test_queries.py` (query
cap), `test_export.py` (CSV), with `crm/tests/support.py` for shared fixtures
once more than one module needs them.

Frontend tests use Vitest + jsdom + `@testing-library/react` for components
fed with props (no Inertia app), plus pure-function tests for currency
formatting and error rendering. Specs live in `frontend/test/`, mirroring the
`src/` tree (`test/lib/format.test.ts`, `test/components/*.test.tsx`,
`test/pages/Dashboard.test.tsx`), so source directories stay production-only;
`test/app.test.ts` boots `app.tsx` with `createInertiaApp` mocked and exercises the
resolver, so a page name that no longer matches its file fails the suite;
`tsconfig.json` includes both `src` and `test` so tests are typechecked. No Playwright/e2e: it would need browser
downloads and a running dev server for a 45-minute exercise.

## Risks / Trade-offs

- **Dev-server URL mismatch** (`static_url_prefix: "crm"` + `base:
  '/static/crm/'`) → verify both `bun run build` with `dev_mode=False` and
  `bun run dev` with `DEBUG=True` in the same task; if dev URLs 404, align
  `base` and prefix before moving on.
- **`STATICFILES_DIRS` pointing at an unbuilt directory** raises
  `staticfiles.W004` on every `manage.py check`/test run → commit
  `frontend/dist/.gitkeep` and git-ignore the rest of the directory. Vite's
  `emptyOutDir` deletes that file on every build, so the `build` script ends
  with `touch dist/.gitkeep` to keep the working tree clean.
- **Manifest mtime is not a deployment-wide version** (per-container mtimes
  differ, causing 409 loops between instances) → `INERTIA_VERSION` is read
  from the environment in production and mtime is only a local fallback.
- **Built mode looks identical to dev mode when `DEBUG=True`** because
  `dev_mode` follows `DEBUG` → the README documents the `DEBUG=False` +
  `collectstatic`/`--insecure` path, and that `runserver` serves no static
  files in that mode.
- **`inertia-django` 2.0.0 raises the Django floor to 5.2** (declared
  `django>=5.2`) → already running 5.2.18; `uv add` records the constraint.
  Note this in the README so the 4.2 claim disappears.
- **Session read on error-follow requests** changes query counts subtly → keep
  the cap assertion on a fresh GET and assert the redirect-follow case
  separately.
- **`errors` leaking into typed props for every page** → keep it optional
  (`errors?: Record<string,string>`) and always default to `{}` in
  `dashboard_props`.
- **CSRF failures** if the cookie is not present on a cold first load →
  `InertiaMiddleware` calls `get_token()`; add a test asserting the
  `csrftoken` cookie on a first-load dashboard response.
- **Bundle is ESM/modern-only (ES2022)** → acceptable for this app; no legacy
  plugin, documented in README.
- **Deleting the old JS/CSS/template is irreversible in-session** →
  do it only after the Inertia page renders and tests pass; rollback is
  `git revert` of the final task's commit.
- **`bun` availability** on the developer machine → already installed (1.4.3);
  README documents `bun install`/`bun run build` as prerequisites.

## Migration Plan

1. Add Python deps (`uv add inertia-django django-vite`), settings, root
   template, and middleware — app still serves the old template, so nothing
   breaks yet.
2. Scaffold `frontend/` (bun, Vite, React 19, TS, Inertia client) and port the
   component tree + CSS, rendering from a static fixture first.
3. Switch `crm_screen` to `render(request, "crm/Dashboard", dashboard_props(...))`
   and add the command routes; verify props in tests while the old template is
   still present.
4. Remove `crm/templates/crm/dashboard.html`, `crm/static/crm/dashboard.js`,
   `crm/static/crm/dashboard.css`, and the rest of `crm/static/crm/`; update
   `README.md` run instructions
   (`uv sync`, `bun install`, two terminals for dev, `bun run build` for prod).
5. Full verification: `uv run python manage.py test`, `bun run test`,
   `bun run build`, then `manage.py runserver` smoke test of every action.

Rollback: steps 1–3 are additive; the destructive step (4) is a single revert.
