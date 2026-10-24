# Proposal

## Why

Every value the dashboard renders — contacts, selection, summary, filters — arrives as an Inertia page payload and is threaded down as component props. Writes are Inertia visits whose only client-side state is each form's internal `processing` flag. The client therefore has no single place that owns server state: pending state, cache reuse, and any future derived view must be rebuilt per component, and the only way to add data that is not a page prop would be
another ad-hoc fetch path beside Inertia.

TanStack Query gives the frontend one explicit server-state cache and one mutation primitive, while Inertia keeps ownership of transport, redirects, and the URL. The goal is a durable client state layer, not new user-visible behavior.

## What Changes

- Add `@tanstack/react-query` v5 to `frontend/` (`package.json` + `bun.lock`).
- Mount one module-scope `QueryClient` above the Inertia app through
  `createInertiaApp({ withApp })`, with conservative defaults: no retries, no refetch on focus/reconnect, no polling. Inertia remains the only thing that talks to Django.
- Add a dashboard query hook that **hydrates** its cache entry from the current page payload and reads the view from that entry. Cache keys describe the active view: query, status filter, and selected contact.
- Add mutation hooks for create, status change, note, and delete that wrap the existing `router.post` / `router.patch` / `router.delete` visits in promises, expose `isPending`, and mark dashboard cache entries stale when a visit finishes. No optimistic updates: the redirect's payload is authoritative.
- Convert `NewContactForm`, `StatusForm`, and `NoteForm` from Inertia `<Form>` to native forms driven by the mutation hooks, preserving field names, filter forwarding, reset-on-success, one-shot error display, and disabled-while-pending.
- `Toolbar` reads its current filters from the dashboard query and keeps the search draft in local state; submitting filters stays an Inertia `router.get` navigation, not a mutation.
- `DeleteContactButton` deletes through the mutation hook; confirmation behavior is unchanged.
- `Dashboard` renders from the query cache and keeps flash toasts and shared validation errors exactly as they are.
- Add a query-aware test render helper (fresh `QueryClient` per test) and update the Inertia mock and the tests for the touched components.
- **No backend change**: no route, view, form, payload, serializer, or migration is touched, and no new HTTP endpoint is introduced. User-visible behavior is unchanged.
## Capabilities

### New Capabilities

- `crm-dashboard-client-state`: how the dashboard client holds server state — cache seeding from the page payload, view-scoped cache entries, in-flight write state, and the rule that writes still travel as Inertia visits — so the data layer can grow without changing the server contract.

### Modified Capabilities

None. `crm-screen`, `crm-contact-commands`, and `crm-flash-messages` describe HTTP and payload behavior that this change leaves compatible: the same routes, redirects, props, flash data, and one-shot errors. This change only reworks how the client keeps that payload in memory.

## Impact

- `frontend/package.json`, `frontend/bun.lock` — add `@tanstack/react-query` (v5).
- `frontend/src/app.tsx` — wrap the Inertia app in `QueryClientProvider`.
- New client modules: a module-scope query client, dashboard query keys + hydration hook, and contact mutation hooks (under `frontend/src/`).
- `frontend/src/pages/crm/Dashboard.tsx` and `frontend/src/components/{Toolbar,NewContactForm,StatusForm,NoteForm,DeleteContactButton}.tsx`.
- Unchanged: `StatsRow`, `ContactList`, `ContactRow`, `ContactDetail`, `Toast`, `src/types.ts`, `src/lib/format.ts`, `src/styles/app.css`, all of `crm/` and `messycrm/`, and the Vite/Django build wiring.
- Tests: `frontend/test/` gains a query-aware render helper; existing tests for the six touched components are updated, plus new coverage for cache hydration and pending state.
- No new runtime requests beyond the Inertia visits that already happen, no persistence to `localStorage`/`sessionStorage`, and no devtools in the bundle.
