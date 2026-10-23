# Tasks

## 1. Python dependencies and Inertia bootstrap

- [x] 1.1 Add the server adapter and asset integration with `uv add inertia-django django-vite`; verify `uv run python -c "import inertia, django_vite"` succeeds and `pyproject.toml`/`uv.lock` show both packages.
- [x] 1.2 Configure `messycrm/settings.py`: add `inertia` and `django_vite` to `INSTALLED_APPS`, register `inertia.middleware.InertiaMiddleware` after `CsrfViewMiddleware` (the `ShareInertiaErrorsMiddleware` slot is left for task 4.2, which creates it), and set `INERTIA_LAYOUT`, `INERTIA_SSR_ENABLED = False`, manifest-based `INERTIA_VERSION`, `STATICFILES_DIRS = [("crm", BASE_DIR / "frontend" / "dist")]`, and the `DJANGO_VITE` block from design.md; verify `uv run python manage.py check` passes.
- [x] 1.3 Create the Inertia root template `crm/templates/crm/app.html` with `{% vite_hmr_client %}`, `{% vite_react_refresh %}`, `{% vite_asset 'src/app.tsx' %}`, and `{% block inertia %}` in `<body>`; verify `uv run python manage.py shell -c "from django.template.loader import get_template; get_template('crm/app.html')"` renders without `TemplateSyntaxError`.

## 2. Frontend application scaffold

- [x] 2.1 Create `frontend/package.json` with React 19, `@inertiajs/react@^3`, Vite, `@vitejs/plugin-react`, TypeScript, Vitest, jsdom, and testing-library; run `bun install` and commit `frontend/bun.lock`; verify `bun pm ls --cwd frontend` lists React 19 and `@inertiajs/react` 3.
- [x] 2.2 Add `frontend/vite.config.ts` (`base: '/static/crm/'`, default `build.outDir` = `frontend/dist`, `build.manifest: true`, `build.emptyOutDir: true`, `server.port: 5173`), `tsconfig.json` (TSX, `strict`, bundler resolution), and `vitest.config.ts`; commit `frontend/dist/.gitkeep` and git-ignore `frontend/dist/*` so `staticfiles.W004` never fires (the `build` script re-creates the file after `emptyOutDir` clears it); verify `bun run --cwd frontend build` emits `frontend/dist/.vite/manifest.json` and hashed assets, and `uv run python manage.py check` reports no `staticfiles` warnings.
- [x] 2.3 Create `frontend/src/app.tsx` (manual `resolve` via `import.meta.glob`, adapter auto-mount without a `setup` callback, `http.xsrfCookieName: 'csrftoken'`, `http.xsrfHeaderName: 'X-CSRFToken'`), `src/types.ts` (prop types + `InertiaConfig.sharedPageProps` augmentation), and a minimal `src/pages/crm/Dashboard.tsx` (the component name `crm/Dashboard` is a path under `pages/`); verify `bun run --cwd frontend build` succeeds and `bun run --cwd frontend typecheck` reports no type errors.
- [x] 2.4 Move the dashboard CSS into `frontend/src/styles/app.css`, import it from `app.tsx`, and add the `formatCurrency` helper (activity timestamps stay server-formatted per the `crm-screen` spec); verify the build emits a CSS asset in `frontend/dist/assets/` and Vitest covers `test/lib/format.test.ts` (`bun run --cwd frontend test` green).

## 3. Read model as page props

- [x] 3.1 Create `crm/pages.py:dashboard_props(request)` that builds `contacts` (with `selected` and server-generated `url`), `selected` (with its 20 most recent activities as `{kind, body, createdBy, createdAt}`), `filters`, `summary` (`total`, `pipeline`, `statusCounts`), and `statusChoices` (errors stay a shared prop from the middleware), reusing `crm/selectors.py`; verify with props-level Django tests for search, status filter, explicit and fallback selection, empty state, and summary values.
- [x] 3.2 Switch `crm_screen` to return `render(request, "crm/Dashboard", dashboard_props(request))` and drop the old template context; verify with `InertiaTestCase` that the component is `crm/Dashboard`, an `X-Inertia` request returns JSON, a first load returns the root HTML with the embedded page payload, and the first load sets the `csrftoken` cookie.
- [x] 3.3 Split `crm/tests.py` into a `crm/tests/` package, one module per concern: `test_screen.py`, `test_commands.py`, `test_urls.py`, `test_template.py`, `test_queries.py`, `test_export.py`; verify `uv run python manage.py test crm` reports the same 17 tests, all green.
- [x] 3.4 Rewrite the template/DOM assertions in `crm/tests/test_template.py` and `crm/tests/test_urls.py` to assert page props, payload embedding, and the Vite entry script; verify `uv run python manage.py test crm` is green.
- [x] 3.5 Keep the query-count guarantee: verify a fresh dashboard GET still runs 5 queries and the count does not grow with contact count (`DashboardQueryCountTests` unchanged and green).

## 4. Command endpoints and error contract

- [x] 4.1 Add routes `POST /contacts/`, `PATCH /contacts/<pk>/status/`, `POST /contacts/<pk>/notes/`, `DELETE /contacts/<pk>/` and implement the views on top of `crm/forms.py` and `crm/services.py`, redirecting with `_return_url`; verify command tests for create, status change, note, delete, and 404 on unknown ids.
- [x] 4.2 Create `crm/middleware.py:ShareInertiaErrorsMiddleware` that pops `request.session["inertia_errors"]` and calls `inertia.share.share(request, errors=...)`, register it in `MIDDLEWARE` after `inertia.middleware.InertiaMiddleware`, and make rejected create/status commands store first-error messages before redirecting; verify tests that errors appear in the next payload and are absent on a later load, and that a fresh dashboard still reports `errors == {}`.
- [x] 4.3 Remove the legacy `POST /` + `action` dispatch; verify a POST to the dashboard root performs no write (test) and `uv run python manage.py test crm` stays green.
- [x] 4.4 Verify the filter/selection contract survives writes (query and status restored after each command; created/updated contact selected; nothing selected after delete) with dedicated tests.

## 5. React components and forms

- [x] 5.1 Build `StatsRow`, `Toolbar`, `ContactList`, and `ContactRow` to render from props, using `router.get` for the search/status submit and Inertia `<Link preserveScroll>` for row selection; verify `test/components/ContactRow.test.tsx` and `test/components/Toolbar.test.tsx` cover escaped values, the selected row marker, and the router call made on submit.
- [x] 5.2 Build `ContactDetail` with the activity list (kind pill, body, formatted timestamp) and the empty state; verify `test/components/ContactDetail.test.tsx` covers detail fields, the 20-item activity rendering, and the "Select a contact." state.
- [x] 5.3 Build `NewContactForm`, `StatusForm`, and `NoteForm` with `useForm` against the new endpoints, displaying `form.errors` and disabling submit while `form.processing`; verify `test/components/forms.test.tsx` (with `@inertiajs/react` mocked) cover payload shape, error display, and processing state.
- [x] 5.4 Build `DeleteContactButton` with a confirmation step using `router.delete`; verify `test/components/DeleteContactButton.test.tsx` shows cancel performs no request and confirm sends the delete.
- [x] 5.5 Compose everything in `pages/crm/Dashboard.tsx` (top bar, error banner, stats, toolbar, grid) and verify `test/pages/Dashboard.test.tsx` renders the page with full fixture props and shows contacts, detail, and stats.

## 6. Remove the legacy frontend and wire the run path

- [x] 6.1 Delete `crm/templates/crm/dashboard.html` and the whole `crm/static/crm/` directory (`dashboard.js`, `dashboard.css`, and the leftover `dist/`), after confirming no references remain (`rg "dashboard\.(js|css)|contacts_json|detail_json|server-data|crm-app|static/crm"`); verify `uv run python manage.py test` and `bun run --cwd frontend build` are green.
- [x] 6.2 Update `README.md` run instructions for the new stack (Python 3.14/`uv sync`, then `bun install` + `bun run dev` in `frontend/` alongside `manage.py runserver`, or `bun run build` for a production-style run) and drop the "no frontend build" claim; verify each documented command runs as written.
- [x] 6.3 Integration check with a built bundle and the dev server: confirm the first-load HTML embeds the page payload, an `X-Inertia` request returns JSON, the export link downloads CSV, and each of the four forms succeeds in the browser (`manage.py runserver` + manual smoke, or `curl` for the protocol checks).

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result and that `openspec/specs/crm-screen` and `openspec/specs/crm-contact-commands` carry the new requirements.
