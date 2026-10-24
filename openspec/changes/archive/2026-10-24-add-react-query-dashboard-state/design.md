# Design

## Context

See `proposal.md` — Why, and `specs/crm-dashboard-client-state/spec.md` for the behavior
contract. The current state that shapes this design:

- `frontend/src/app.tsx` calls `createInertiaApp({ resolve, http })` and lets Inertia create
  the React root. The installed `@inertiajs/react` (3.9) supports `withApp(app, { ssr, page })`
  in the auto-CSR path (confirmed in `node_modules/@inertiajs/react/dist/index.js`), which is
  the only wrapping hook that does not duplicate root creation.
- All server data arrives as page props built in `crm/pages.py`: `contacts`, `selected`,
  `filters: { q, status }`, `summary`, `statusChoices`. The selected contact's id is **not** in
  `filters`; it comes from the `contact` query parameter and is reflected by `selected?.id`
  (or `selected === null`).
- Writes in `crm/views.py` always answer with a **redirect** to the dashboard. Validation
  errors travel through `crm/middleware.py` as one-shot `props.errors`; confirmations travel as
  Inertia flash data. Inertia's `onError` fires only for 422-style protocol errors, **not** for
  a redirect that carries errors, so "visit finished" — not "no validation errors" — is the
  only reliable settle signal.
- `router.post/patch/delete` return `void`. Completion is observable only through visit
  callbacks (`onSuccess(page)`, `onError`, `onFinish`, `onCancel`). Inertia 3 also ships
  `router.optimistic`, which this change deliberately does not use.
- Presentational components (`StatsRow`, `ContactList`, `ContactRow`, `ContactDetail`,
  `Toast`) receive everything as props and are covered by tests that render them directly,
  with `@inertiajs/react` mocked and no provider.
- `frontend/package.json` has no query library; bun 1.4.3 owns `bun.lock`; Vitest + jsdom is
  the test environment.

## Goals / Non-Goals

**Goals:**

- One explicit owner of client-side server state, hydrated from the same payload the server
  already sends, so no new endpoint and no second fetch path appears.
- One mutation primitive that exposes honest pending state while keeping Inertia as the
  transport, redirect follower, and URL owner.
- Zero change to rendered behavior, Django code, payload shape, or the existing test suite's
  intent.

**Non-Goals:**

- Replacing Inertia with `fetch`/REST, or adding any JSON API.
- Optimistic updates, prefetching, polling, infinite scroll, or SSR.
- Persisting the cache (localStorage/sessionStorage), offline support, or cross-tab sync.
- React Query devtools in the bundle.
- Converting presentational components away from props.
- Changing flash, error, or redirect semantics.

## Decisions

### 1. Inertia stays the transport; the query cache is a mirror

The server payload remains authoritative. The cache exists to give components one place to
read server state from and mutations one place to invalidate. Concretely, query functions
never perform network I/O: they return the payload already captured from the current page.

Defaults on the single `QueryClient`:

- queries: `staleTime: Infinity`, `gcTime: 5 minutes`, `retry: false`, `refetchOnMount: false`,
  `refetchOnWindowFocus: false`, `refetchOnReconnect: false`
- mutations: `retry: false`

These defaults encode requirement "no autonomous refresh": nothing in the client may refresh
a dashboard view unless Inertia delivers a new payload.

**Alternatives rejected**

- *Fetch the dashboard JSON with `X-Inertia: true` from query functions.* This puts two
  clients on the same page payload, breaks history/partial-reload semantics, and creates a
  second path that the `crm-screen` contract does not describe.
- *Mutations only, reads stay raw props.* Smallest change, but leaves the cache empty and the
  proposal's hydration requirement unsatisfied.
- *Keep `router.delete` calls in components and add `useMutation` purely as a wrapper around a
  fake promise.* Loses the single settle/invalidation path; every component would re-implement
  it.

### 2. Provider mounted with `withApp`, not per page or via custom `setup`

`app.tsx` keeps its current resolver and CSRF options and adds:

```tsx
withApp: (app) => <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>
```

This places the provider above every page (the dashboard is the only page today), keeps
Inertia's own root creation and error handling intact, and keeps app startup testable. A
per-page provider would recreate a client on remount and hide the cache from future pages; a
custom `setup` would duplicate `createRoot` logic that Inertia already owns.

### 3. One hydration hook, one cache entry per dashboard view

`useDashboardView()` (name indicative) is the only reader/writer of dashboard data:

- **Key** — `['dashboard', { q, status, contact: selected?.id ?? null }]`. Selection is part of
  the view identity, so a delete that returns "same filters, no selection" produces a
  different key from the pre-delete view. This is what stops a stale entry being rendered after
  the redirect, without deleting other entries.
- **Value** — a single `{ view, source }` object, where `view` is the payload projection that
  components consume and `source` is the page-props object that produced it.
- **Seeding** — `initialData` from the current page props, so a new key renders correctly on
  its first commit instead of an empty frame.
- **Same-key refresh** — a `useLayoutEffect` compares `data.source` with the current props
  object and writes a new entry only when they differ. Because the comparison is by reference
  and Inertia hands every component the same page-props object, repeated calls are idempotent
  and cannot loop. Running in a layout effect means an updated payload (for example a new note)
  is painted before the browser shows the previous frame.
- **No structural sharing** — `structuralSharing: false` on this query. React Query otherwise
  returns the previous entry object when two payloads are deeply equal, which would keep
  `source` pinned to the old props and make the layout effect rewrite forever. The same-key
  payload test covers this.
- **Readers** — `Dashboard` calls the hook and passes the resolved `contacts`, `selected`,
  `summary`, `filters`, and `statusChoices` down exactly as today, so presentational
  components and their tests do not change. `Toolbar` reads filters and status choices from
  the same hook. The three forms keep their existing `filters` / `statusChoices` props
  contract, so their parents do not change; they consume the mutation hooks instead of
  reading the cache.

**Alternative rejected:** hydrate only in `Dashboard` and keep prop-drilling server state into
every child. That keeps the cache invisible to the components that need filters and makes the
cache purely decorative, so the first real consumer would bypass it.

### 4. Mutations are Inertia visits converted into promises

A small `visitToPromise` helper wraps a router call and settles when Inertia reports the visit
finished, so React Query can own `isPending`:

- resolve on `onFinish` (and `onCancel`, treating cancellation as a settled visit so the
  control cannot stay disabled)
- Inertia's `onError` is deliberately **not** used as a rejection path, because this backend
  reports validation as a redirect. Rejecting there would keep controls disabled after a
  rejected form.
- on a successful visit, mark the dashboard query root stale with
  `invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' })`. No refetch follows:
  query functions do not fetch and the client's refetch defaults are off. The fresh payload is
  what repaints the view.

Per-action hooks take the active filters as an argument, which keeps the cache out of the
mutation path and lets form components forward exactly the filters they were given.
Endpoint knowledge lives in one place:

| Hook | Visit | Payload |
| --- | --- | --- |
| create | `router.post('/contacts/')` | form fields + `q`, `status` |
| status | `router.patch('/contacts/:id/status/')` | `new_status` + `q`, `status` |
| note | `router.post('/contacts/:id/notes/')` | `note` + `q`, `status` |
| delete | `router.delete('/contacts/:id/', { data })` | `q`, `status` |

No optimistic updates. Inertia 3's `router.optimistic` is intentionally unused: requirement
"cached views change only after the server confirms a write" is cheaper to satisfy by simply
not writing, and a redirect makes optimistic rollback awkward.

### 5. Forms become native forms, with today's behavior preserved

`NewContactForm`, `StatusForm`, and `NoteForm` stop using Inertia's `<Form>` and instead submit
with `onSubmit` + `useMutation`. The conversion must preserve, not improve, current behavior:

- the same input names (`name`, `email`, `company`, `owner`, `phone`, `value`, `new_status`,
  `note`) and the same filter fields on the wire;
- the submit button disabled while the mutation is pending, and no second visit from repeated
  activation;
- the reset behavior of `resetOnSuccess`, which today resets after any completed visit —
  including a redirect that carries validation errors, because Inertia reports that as a
  success. Keeping that behavior avoids a silent UX change; a later change can make reset
  conditional if desired;
- field errors read from `usePage().props.errors`, the same shared one-shot errors the Inertia
  form slot received, and the Dashboard's error banner untouched;
- the status select still keyed on the contact id so it picks up a new status after a re-render.

### 6. Toolbar keeps navigation out of the mutation layer

Filter submission changes the URL and must produce a page payload, so it remains a `router.get`
visit with `preserveState`, `preserveScroll`, and `replace`. The Toolbar reads the active
filters from `useDashboardView()` to initialize its draft, and keeps the draft in local state —
form drafts and URL state are client state, not server state, and do not belong in the cache.

### 7. Testing strategy

- New `test/render.tsx` helper that renders with a fresh `QueryClient` per test
  (`retry: false`, `gcTime: Infinity`) and optionally seeds a dashboard entry.
- The Inertia mock gains nothing ad hoc: tests trigger visit callbacks (`onFinish`,
  `onSuccess`) on the mocked router so `visitToPromise` settles deterministically, then use
  `waitFor` for pending-state assertions.
- `forms.test.tsx` currently mocks `@inertiajs/core` while components import from
  `@inertiajs/react`; after conversion the mock target is consolidated to the React adapter so
  router and hooks share one mock surface.
- New coverage: hydration issues no extra request, keys differ per view, a post-write payload
  replaces the cached view, no optimistic removal, disabled/pending double activation, and no
  writes to browser storage.

## Risks / Trade-offs

- **Two owners of server state drift apart** → one writer rule (`useDashboardView` with the
  reference-compared layout effect), no network in query functions, and tests that assert the
  rendered view follows the payload after writes.
- **One frame of stale data on a same-key payload change** → seeding with `initialData` for new
  keys and a layout-effect sync for existing keys; verify visually at 1× CPU throttling.
- **Validation-is-a-redirect is easy to model wrongly** → `visitToPromise` resolves on
  `onFinish`, never on `onError`; a test asserts the submit control re-enables after a
  rejected form.
- **Bundle growth** (~12 KB gzipped for React Query) → no devtools, tree-shaken v5 imports;
  acceptable for a dashboard-only bundle.
- **Test mocks may hide missing hydration** → at least one test renders the real `Dashboard`
  through `useDashboardView` with no pre-seeded cache, so hydration itself is exercised.
- **Reset semantics look like a bug** → documented here and covered by the existing form tests;
  changing it would be a separate spec change.

## Migration Plan

1. Add the dependency and the provider (no behavior change), verify build and existing tests.
2. Add query keys and `useDashboardView`; switch `Dashboard` to render from it; verify tests.
3. Add `visitToPromise` and the mutation hooks; migrate `DeleteContactButton`, then the three
   forms, then `Toolbar`; update tests per component.
4. Run the full frontend suite, typecheck, and production build; no backend step, no data
   migration.

Rollback is a revert of the frontend commit: the Django side is untouched, and the built assets
in `frontend/dist/` are regenerated by the existing image build, so no runtime configuration
changes.

## Open Questions

None that would change the specs, approach, or task breakdown. Whether to add React Query
devtools locally is a later, isolated decision.
