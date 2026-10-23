# Tasks

## 1. Queue confirmations on the server

- [x] 1.1 Queue a `messages.success(...)` in each successful branch of `crm/views.py` (`Created <name>`, `Status changed to <status>`, `Note added`, `Contact deleted`) after the service call returns; extend `crm/tests/test_commands.py` so each of the four commands asserts `self.page()["flash"]["messages"]` equals one success message with the expected text, and verify with `uv run python manage.py test crm.tests.test_commands`
- [x] 1.2 Add command tests proving rejected submissions and unknown-contact requests produce no flash entry (blank name, invalid status, delete of a missing id), and verify they pass alongside the existing error-prop assertions in `crm/tests/test_commands.py`
- [x] 1.3 Add tests that the confirmation is consumed once (a following `self.inertia.get(reverse("crm"))` page has no `flash` key) and is still delivered on a partial-reload request, and verify with `uv run python manage.py test crm.tests.test_commands`

## 2. Type and mock the flash payload

- [x] 2.1 Add `FlashLevel` and `FlashMessage` types plus a `flashDataType` entry to the `InertiaConfig` augmentation in `frontend/src/types.ts`, modelling `messages` as optional; verify with `bun run typecheck` from `frontend/`
- [x] 2.2 Give the `usePage` mock in `frontend/test/mocks/inertia.tsx` a default `flash: { messages: [] }` and update the `usePage.mockReturnValue` setup in `frontend/test/pages/Dashboard.test.tsx` to match; verify the existing suite still passes with `bun run test`

## 3. Render auto-dismissing toasts

- [x] 3.1 Create `frontend/src/components/Toast.tsx` that reads `usePage().flash?.messages ?? []`, renders each message in queued order, maps `success`/`info` to `role="status"` and `warning`/`error` to `role="alert"`, falls back to info styling for unknown levels, and removes each toast from local visible state after the configured delay while resetting that state on each page swap; replace `frontend/test/components/FlashMessages.test.tsx` with `frontend/test/components/Toast.test.tsx` covering text, order, roles, unknown level, no-flash/empty rendering, visible-before-delay, dismissed-after-delay, and no resurrection on re-render using `vi.useFakeTimers()`; verify with `bun run test -- Toast`
- [x] 3.2 Add `.toast-region` (fixed, top-right, below the header) plus `.toast`, `.toast-success`, `.toast-info`, `.toast-warning`, and `.toast-error` rules to `frontend/src/styles/app.css`, leaving `.error` untouched; verify the Toast test asserts the level class per message and the full suite passes with `bun run test`
- [x] 3.3 Mount `Toast` in `frontend/src/pages/crm/Dashboard.tsx` in place of `FlashMessages`; update `frontend/test/pages/Dashboard.test.tsx` so a flash message renders as a toast and a page with no `flash` or an empty list renders no toast and no error; verify with `bun run test -- Dashboard`

## 4. Integration verification

- [x] 4.1 Run the full backend and frontend checks — `uv run python manage.py test`, `uv run ruff check crm`, `bun run test`, and `bun run typecheck` from `frontend/` — and confirm all pass
- [x] 4.2 Smoke-test in the browser with `uv run python manage.py runserver` plus `bun run dev`: perform a create, status change, note, and delete, confirm each shows one toast in the top-right, confirm it disappears on its own, and confirm no toast is left after a reload

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived `crm-flash-messages` spec after archiving.
