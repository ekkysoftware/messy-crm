# Tasks

## 1. Dependency and app-wide provider

- [x] 1.1 In `frontend/`, add `@tanstack/react-query` v5 with bun and commit `package.json` + `bun.lock`; verify `bun pm ls @tanstack/react-query` reports a 5.x version, the import type-checks, and `bun run build` still succeeds
- [x] 1.2 Add `frontend/src/lib/queryClient.ts` exporting one module-scope `QueryClient` with `staleTime: Infinity`, `gcTime: 5 minutes`, `retry: false`, `refetchOnMount/WindowFocus/Reconnect: false`, and mutations `retry: false`; verify a unit test in `frontend/test/lib/queryClient.test.ts` asserts every default so a future change is visible
- [x] 1.3 Wrap the Inertia app with `QueryClientProvider` through `createInertiaApp({ withApp })` in `frontend/src/app.tsx`, leaving the resolver and CSRF `http` options untouched; verify `bun run typecheck` passes and the existing `test/app.test.ts` resolver tests still pass

## 2. Dashboard query cache and hydration

- [x] 2.1 Add `frontend/src/lib/queryKeys.ts` with a dashboard root key and a per-view key of `q`, `status`, and selected contact id (`selected?.id ?? null`); verify unit tests show distinct keys for different filters and for a selected contact versus no selection
- [x] 2.2 Add `frontend/src/queries/useDashboardView.ts` that seeds `initialData` from the current page props, returns the cached view, and syncs a changed payload for the same key in a `useLayoutEffect` using the stored `source` reference so repeated calls do not loop; verify tests cover first mount, a same-key payload update, and a different key without any network call
- [x] 2.3 Convert `frontend/src/pages/crm/Dashboard.tsx` to render from `useDashboardView()` while passing the same `contacts`, `selected`, `summary`, `filters`, and `statusChoices` props to the existing children; verify no presentational component file changes and all existing `Dashboard` assertions pass
- [x] 2.4 Verify the cache is memory-only: a test spies on `localStorage.setItem` and `sessionStorage.setItem`, renders a hydrated dashboard, and expects neither to be called, and a second test with a fresh `QueryClient` renders only from its own payload

## 3. Write mutations

- [x] 3.1 Add `frontend/src/mutations/visitToPromise.ts` that settles when Inertia reports `onFinish` or `onCancel` and never rejects on `onError`; verify unit tests resolve for finish, resolve for cancel, and remain pending until a callback fires
- [x] 3.2 Add `frontend/src/mutations/useContactMutations.ts` with create, status, note, and delete hooks that pass the active `q`/`status` filters, expose `isPending`, and call `invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' })` on success; verify unit tests assert the exact router method, URL, and payload for each hook and the invalidation call
- [x] 3.3 Convert `frontend/src/components/DeleteContactButton.tsx` to the delete mutation, keeping the `window.confirm` gate; verify tests cover confirmation refusal (no visit), filters on the delete payload, disabled state while pending, and a double click producing exactly one visit
- [x] 3.4 Convert `frontend/src/components/NewContactForm.tsx`, `StatusForm.tsx`, and `NoteForm.tsx` to native `onSubmit` handlers driven by the mutation hooks, preserving input names, filter forwarding, `resetOnSuccess` behavior after a completed visit, `usePage().props.errors` display, and the disabled submit button; verify `test/components/forms.test.tsx` uses the `@inertiajs/react` mock plus the query render helper and covers payload, reset, error, and pending cases
- [x] 3.5 Convert `frontend/src/components/Toolbar.tsx` to read its filters from `useDashboardView()` while keeping the draft in local state and submitting `router.get('/', params, { preserveState: true, preserveScroll: true, replace: true })`; verify `test/components/Toolbar.test.tsx` still asserts the navigation arguments, empty-filter omission, and the export link

## 4. State-contract integration coverage

- [x] 4.1 Add `frontend/test/render.tsx` that renders with a fresh `QueryClient` per test and can seed a dashboard view; migrate the tests for the components touched in this change to it and verify the full suite passes with no cross-test cache leakage
- [x] 4.2 Add integration tests for a completed write repainting from its payload: delete removes the row and clears the selection, create/status/note render the affected contact as selected, and a post-write payload with the same filters replaces the earlier cached copy rather than resurrecting it; verify each scenario fails if hydration from the new payload is removed
- [x] 4.3 Add tests for the no-optimism and payload-only feedback rules: during a pending delete the contact is still listed, a pending write shows no confirmation, and a rejected write shows only the `usePage().props.errors` message; verify the assertions fail if an optimistic cache write or a client-generated toast is introduced
- [x] 4.4 Run the full frontend gates — `cd frontend && bun run test && bun run typecheck && bun run build` — and confirm `dist/.vite/manifest.json` still resolves `src/app.tsx`; also run `uv run python manage.py test` to confirm the untouched backend suite is green

## Workflow follow-up

- Archive the change after review of the planning artifacts and the merged frontend work.
- Verify the archived capability under `openspec/specs/crm-dashboard-client-state/` matches the shipped client state layer.
