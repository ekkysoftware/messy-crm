# Proposal

## Why

`crm/views.py:crm_screen` is a single 104-line function that mixes request
parsing, four command handlers, validation, business logic, ORM reads and
writes, serialization, and presentation preparation. The project README asks
for a maintainability improvement that **does not break current behaviour**,
so the goal is to separate responsibilities and remove the unsafe/manual
patterns that will bite the next engineer, while keeping the HTTP contract and
rendered screen identical.

## What Changes

- Extract the write-side commands (`add_contact`, `change_status`, `add_note`,
  `delete_contact`) into a `crm/services.py` module of plain functions that own
  their own `transaction.atomic()` blocks.
- Extract the read-side queries (filtered contact list, selected contact with
  activity, dashboard aggregates) into `crm/selectors.py`.
- Introduce Django `Form` classes in `crm/forms.py` for contact creation, status
  change, and note creation so validation moves out of the view, preserving the
  current acceptance rules (blank name rejected, unknown status coerced to
  `lead`, blank note ignored).
- Reduce the view to request dispatch plus context assembly; no business logic.
- Replace manual query-string building in `_return_url` with
  `urllib.parse.urlencode` + `reverse`, fixing unsafe characters in `q`.
- Remove the per-status `COUNT` loop (`orm-nplusone` class) in favour of a
  single `values("status").annotate(Count("id"))` query.
- Split the tangled inline JavaScript/CSS into static `crm/dashboard.css` and a
  readable `crm/dashboard.js`, leaving markup and behaviour unchanged.
- Add regression tests that pin current behaviour and query counts before the
  refactor, so the refactor is provably behaviour-preserving.
- No new dependencies, no schema/migration changes, and **no breaking changes**
  to URLs, request/response shape, or the rendered UI.

## Capabilities

### New Capabilities

None. This is a pure behaviour-preserving refactor: the externally observable
behaviour of the CRM screen and CSV export does not change, so no spec delta is
created. The change declares `skip_specs: true` in `.openspec.yaml`. The
existing `crm/tests.py` suite is the behavioural contract and will be expanded
to lock the behaviour down.

### Modified Capabilities

None.

## Impact

- **Code**: `crm/views.py` (slimmed), new `crm/services.py`, `crm/selectors.py`,
  `crm/forms.py`, `crm/tests.py` (expanded), `crm/static/crm/dashboard.js`,
  new `crm/static/crm/dashboard.css`, `crm/templates/crm/dashboard.html`
  (static asset wiring only).
- **APIs/URLs**: unchanged (`crm`, `export_contacts` names and paths).
- **Data**: no model or migration changes; no change to stored data.
- **Dependencies**: none added or removed.
- **Out of scope**: auth/permissions, settings hardening (`SECRET_KEY`,
  `DEBUG`, `ALLOWED_HOSTS`), pagination, UUID URL exposure, and any new feature
  or visual redesign. These are noted as follow-ups, not part of this refactor.
