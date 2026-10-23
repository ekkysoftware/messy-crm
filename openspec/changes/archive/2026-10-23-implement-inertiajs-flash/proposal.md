# Proposal

## Why

Successful write commands on the dashboard currently redirect with no confirmation: the
list and detail panel change, but the only explicit feedback channel is the validation
error banner. Users get no acknowledgement that a create, status change, note, or delete
was applied. Django's messages framework is already installed and inertia-django already
serialises queued messages into one-shot page flash data, but nothing emits or renders it.

## What Changes

- Successful create, status-change, note, and delete commands publish a level-tagged
  success message through Django's messages framework. Rejected commands publish nothing
  and keep the existing `props.errors` contract.
- The dashboard renders the page's flash messages as auto-dismissing toasts in a fixed
  top-right stack, with a CSS class per level (`success`, `info`, `warning`, `error`).
- The client reads flash from the top-level page key (`usePage().flash.messages`), never
  from props, and tolerates a missing/empty flash payload.
- Flash messages are typed through the existing `InertiaConfig` augmentation, and the
  frontend `usePage` test mock gains a default `flash` value.
- Existing behaviour is preserved: filters and selection are still restored by the
  redirect, validation errors still appear once via shared props, and no route or response
  shape other than the added `flash` key changes.
- Presentation: a top-right, auto-dismissing toast stack. Dismissal is presentational only —
  it clears the rendered copy, not the page payload — and the next visit still replaces the
  flash data, preserving the documented one-shot semantic.

## Capabilities

### New Capabilities

- `crm-flash-messages`: one-shot success notifications emitted by write commands and their
  rendering on the dashboard, including level mapping and consumption semantics.

### Modified Capabilities

None. The command endpoints keep their existing redirect-and-error behaviour, and the
dashboard's existing props contract (contacts, selection, filters, summary, status choices,
errors) is unchanged.

## Impact

- `crm/views.py`: emit messages after successful service calls.
- `crm/tests/test_commands.py`, `crm/tests/test_screen.py`: assert flash payloads, their
  absence on failure, and their one-shot consumption.
- `frontend/src/pages/crm/Dashboard.tsx`: mount the toast region.
- `frontend/src/components/Toast.tsx` (new), `frontend/src/styles/app.css`: toast stack,
  auto-dismiss behaviour, and level styling.
- `frontend/src/types.ts`: type `flashDataType`.
- `frontend/test/mocks/inertia.tsx`, `frontend/test/pages/Dashboard.test.tsx`: default flash
  in the mock and coverage for rendered, empty, and missing flash.
- No new dependencies, routes, migrations, or breaking changes.
