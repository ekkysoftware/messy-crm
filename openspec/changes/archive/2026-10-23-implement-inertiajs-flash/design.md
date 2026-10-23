# Design

## Context

See `proposal.md` for motivation and `specs/crm-flash-messages/spec.md` for the behavior
contract.

- The installed inertia-django 2.0 already turns Django messages into page flash data:
  `inertia/http.py` drains `get_messages()` per render into
  `page["flash"]["messages"]` as `{level, message}` entries, includes it on partial
  reloads, and omits the key entirely when nothing is queued. No new serialization code is
  needed — only queueing in the views.
- All four write views (`crm/views.py`) follow the same shape: build a Django form, call a
  transaction-owning service in `crm/services.py`, then `redirect(return_url(...))`.
  Validation failures call `flash_errors()` and redirect without writing.
- The dashboard component reads `usePage().props.errors`. The client app normalizes flash
  to `{}` only for the initial page (`@inertiajs/react` `App.ts` init); a later visit
  response without a `flash` key is assigned as-is, so `usePage().flash` can be
  `undefined` after any visit that carries no messages.
- The frontend has no toast infrastructure, a single page component, and SSR disabled
  (`INERTIA_SSR_ENABLED = False`). Styling is one plain CSS file with an existing `.error`
  banner idiom for validation errors.

## Goals / Non-Goals

**Goals:**

- Confirm each successful write exactly once, with level-tagged, accessible output.
- Present confirmations as a transient top-right toast stack that dismisses itself.
- Keep flash out of props and out of the read-model contract.
- Tolerate missing or empty flash on the client without new failure modes.
- Keep the existing validation-error transport and banner unchanged.
- Cover emission, consumption, rendering, ordering, and auto-dismissal with server and
  component tests.

**Non-Goals:**

- Manual dismiss buttons, pause-on-hover, or a persisted notification centre.
- Client-side flash (`router.flash`) or `onFlash` event plumbing in `app.tsx`.
- Moving validation errors to flash, or changing the `errors` prop contract.
- Localization of message copy.
- Persisting confirmations across reloads or history navigation.

## Decisions

**Queue messages in views, after the service returns.** Views already own HTTP/session
concerns and the redirect; services stay request-agnostic and transaction-scoped, so they
remain usable from management commands and tests. Alternative considered: injecting the
request into services (couples domain logic to sessions) or a post-save signal (implicit,
harder to test, fires per row rather than per command). `messages.success(...)` is called
only after the service returns, so a rolled-back write never announces success.

**Message copy is per command, with the status value as submitted.** `Created <name>`,
`Status changed to <value>`, `Note added`, `Contact deleted`. The status copy uses the raw
value (`qualified`) to match the activity log's own phrasing and to keep the assertion
deterministic; the label (`Qualified`) lives in props already for display contexts.
Alternative considered: reusing the activity body text, rejected because it would change
whenever activity copy changes and couples two independent contracts.

**Render a single `Toast` component inside `Dashboard`, as a fixed top-right overlay.** The
dashboard is the only page, so a local mount point keeps markup, CSS, and tests together and
renders in the same order the server queued messages. Alternatives considered: a global
listener in `app.tsx` using `router.on('flash')` (needs portal state and duplicates what
`page.flash` already carries), and inline banners in the page flow (chosen initially, then
replaced because the confirmations should not shift the dashboard layout or linger).

**Auto-dismiss with local state reset per page swap.** `Toast` seeds a local `visible` list
from `page.flash.messages` and starts one `setTimeout` per message (5 seconds, a module
constant). A timeout removes that message from `visible`; the page payload is never
mutated, so the server's one-shot flash data remains authoritative. The effect depends on
the `page` object identity, so every Inertia visit — including a partial reload — resets
the list to that visit's messages, while plain React re-renders do not resurrect dismissed
toasts.

Alternative considered: deriving a signature from message text as the effect dependency.
Rejected because repeating an action (two deletes, two contacts with the same name) produces
identical flash text, and a text signature would suppress the second confirmation. Page
identity is exactly "a new server payload arrived". Cleanup clears pending timers on
unmount and before each reset, so StrictMode's double-invoked effects and fast navigation
cannot leave timers behind.

**Roles follow level.** `success` and `info` render with `role="status"` (polite), `warning`
and `error` with `role="alert"` (assertive). Django `level_tag` already produces those four
names. Unknown levels fall back to info styling and polite announcement so a future level
cannot break rendering.

**No manual dismissal or pause control.** Auto-dismissal is bounded to 5 seconds, and the
toast text is announced once by its live-region role; the underlying activity log remains
the durable record, so nothing is lost if a reader misses it. A pause-on-hover control would
add focus-management and reduced-motion concerns beyond this change.

**Flash typing is optional at every level.** `InertiaConfig.flashDataType` is augmented with
`{ messages?: FlashMessage[] }` and `usePage().flash` is read as
`usePage().flash?.messages ?? []`, because the server omits the key when empty and the
client does not normalize visit responses. Alternative considered: assuming `flash` is
always present (works on first load, throws after the first visit without messages).

**Styling extends the existing banner idiom into a toast stack.** A fixed `.toast-region`
(top-right, below the 62px header, capped width, above page content) holds `.toast` items
with `.toast-success`, `.toast-info`, `.toast-warning`, `.toast-error` variants that reuse
the status colours of `.error`. `.error` itself is untouched, so validation errors keep
their in-flow banner. Alternatives considered: reusing `.error` for everything (loses level
distinction and placement) or adding a component library (out of scope, no dependencies).

## Risks / Trade-offs

- **`flash` is `undefined` after a visit without messages** → optional chaining plus a
  component test that renders with no `flash` and with an empty list; the mock also
  defaults to an empty list so unrelated tests stay honest.
- **Timers are hard to observe in tests** → the component test uses `vi.useFakeTimers()`,
  advances time inside `act`, and asserts both "still visible before the delay" and "gone
  after it", with real timers restored in teardown.
- **StrictMode double-invokes effects** → the effect clears its timers in cleanup and
  re-seeds from the same page payload, so the visible list converges without duplicates.
- **Auto-dismiss can remove text before a slow reader finishes** → 5-second delay, live
  region announcement, and the activity log as the durable record; no pause control by
  design (recorded as a non-goal).
- **A confirmation lingers in `page.flash` until the next visit** → accepted: the visual
  copy is dismissed locally, the server queue is consumed by the rendering response, and
  the next payload replaces the flash data.
- **Back-to-back submissions queue duplicate text** → each visit resets the stack, so both
  confirmations show; no deduplication, since collapsing them would hide a real second
  action.
- **Backend/frontend deploy skew** → the change is additive: an old client ignores the new
  flash key, and a new client tolerates its absence. Either deploy order is safe.

## Migration Plan

No schema or route changes. Ship backend and frontend together; if they must be staggered,
either order is compatible. Rollback is a revert of the message calls and the component —
no data cleanup required.
