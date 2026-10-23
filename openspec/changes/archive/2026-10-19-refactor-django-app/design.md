# Design

## Context

See `proposal.md` for motivation. The relevant current state, observed by
reading the code:

- `crm/views.py:crm_screen` handles GET and POST in one function. POST
  branches on `action` and performs validation, ORM writes, activity logging,
  and redirects; GET performs filtering, selection, serialization to plain
  dicts, and aggregate queries.
- `_return_url()` concatenates query values with `q.replace(" ", "+")`, so
  characters such as `&`, `=`, `#`, and non-ASCII are not encoded.
- `status_counts` issues one `COUNT` query per status choice (four queries for
  four choices).
- The selected contact already uses `prefetch_related("activities")`, and the
  detail slices the prefetched list in Python to 20 items.
- `crm/templates/crm/dashboard.html` emits data through `json_script` and a
  `data-*` element; `crm/static/crm/dashboard.js` builds all markup, CSS, and
  behaviour from a minified single closure.
- The Django app has no forms, services, or selectors modules.

Constraints: behaviour must not change (README), the exercise is small and
timeboxed, and there must be no new dependencies or schema migrations.

## Goals / Non-Goals

**Goals:**

- Give each responsibility a named home: `forms.py` (validation), `services.py`
  (writes/transactions), `selectors.py` (reads), `views.py` (HTTP dispatch).
- Remove the two concrete correctness/maintainability defects (manual query
  string, per-status count loop) without changing the external contract.
- Make the frontend asset split so CSS and behaviour are readable and reusable
  while the DOM contract stays identical.
- Prove behaviour preservation with characterization tests run before and
  after each step.

**Non-Goals:**

- No model or migration changes; no new DB index in this pass.
- No change to URL names, request fields, response payload shape, JSON keys,
  `json_script` element ids, or the `data-*` attributes the JS reads.
- No new features, auth, pagination, or visual redesign.
- No settings/security hardening (tracked as a follow-up, separately scoped).
- No move to class-based views or DRF.

## Decisions

### 1. Layer the write path into `crm/services.py`

Plain functions (`create_contact`, `change_status`, `add_note`,
`delete_contact`) take primitive/model arguments and own their
`transaction.atomic()` boundary. This follows `arch-services-layer`: the
create-contact flow writes both a `Contact` and its initial `Activity`, so it
must be atomic and must not live in the view.

*Alternative considered:* `model-fat-models` methods on `Contact`. Rejected
because the create flow spans two models and transaction management reads more
clearly at the service boundary for this size of app. A future change can move
a single-model rule onto the model without affecting the view.

### 2. Layer the read path into `crm/selectors.py`

Functions (`get_contacts(query, status)`, `get_selected_contact(id)`,
`get_dashboard_summary()`) encapsulate the `Q` filters, `prefetch_related`, and
aggregates. This follows `arch-selectors` and keeps `.filter().annotate()` out
of the view.

### 3. Validate with Django `Form` classes in `crm/forms.py`

`ContactCreateForm`, `StatusChangeForm`, and `NoteForm` move field parsing and
validation out of the view (`api-drf-serializers` principle, applied to
non-DRF code). The forms must reproduce today's acceptance rules exactly:

- Blank `name` fails and surfaces the existing error message.
- `value` that fails `Decimal` parsing becomes `0`.
- A status not in `Contact.STATUS_CHOICES` is coerced to `lead` rather than
  rejected.
- A blank note is ignored (no `Activity` created) and still redirects.

`StatusChangeForm` with a `ChoiceField` naturally enforces the valid-status
rule and turns the current "silently ignore invalid status" into a clean
no-write path; the redirect behaviour is retained.

*Alternative considered:* keep inline `if` validation. Rejected: it is the
main reason the view is unreadable, and forms are the idiomatic Django tool.

### 4. Keep a function-based view for the dashboard

Per `views-fbv-vs-cbv`, FBVs win for distinct procedural endpoints. The
dashboard is a multi-command dispatcher, not a generic list/detail/create
pattern, so a CBV would add indirection without benefit. The view becomes a
small dispatcher over `forms` + `services` and a context builder over
`selectors`.

### 5. Replace manual query-string building

Use `urllib.parse.urlencode` for the query values and `reverse("crm")` for the
path. This keeps `q`, `status`, and `contact` semantics but correctly encodes
all values. The exported `_return_url` helper remains available for redirects
and per-row links so GET rendering is unchanged.

### 6. Replace the per-status count loop with one aggregate

Use a single
`Contact.objects.values("status").annotate(count=Count("id"))` query and build
the `{key: count}` map in Python, defaulting absent statuses to `0`. The four
`status_counts` numbers and the `total`/`pipeline` values are unchanged. This
addresses the `orm-nplusone` class of defect.

*Note:* `prefetch_related("activities")` is already present, and the selector
keeps slicing in Python to 20 for the detail payload so ordering matches
today; we do not switch to a sliced `Prefetch`, which could reorder ties.

### 7. Extract frontend assets without changing the DOM contract

Move the inline `<style>` string into `crm/static/crm/dashboard.css` and split
the closure in `dashboard.js` into small named functions (load payload, render
stats, render list, render detail, escape). The template keeps the same
`json_script` ids and `server-data` attributes, and loads the new stylesheet
with `{% static %}` in `<head>`. Behaviour and markup stay identical; only
readability and asset separation change.

## Risks / Trade-offs

- **[A validation edge case changes subtly]** → Write characterization tests
  for every acceptance rule in Decision 3 (blank name, bad decimal, unknown
  status, blank note) and run them against the *unrefactored* view first, so
  the rules are pinned before moving code.
- **[`urlencode` output differs from `replace(" ", "+")` for some inputs]** →
  The new encoding is the correct behaviour and produces the same result for
  the currently tested inputs; add a test with `&`, `#`, and spaces in `q` to
  lock the fixed behaviour.
- **[Splitting JS/CSS breaks load order or element lookup]** → Keep the
  `json_script`/`data-*` contract byte-for-byte and add a dashboard render test
  asserting the template still references the expected element ids/assets.
- **[Transaction wrapping changes failure behaviour]** → Current code has no
  explicit transaction; wrapping create+activity is strictly safer and does
  not change the success path. Verify with the existing create-contact test.
- **[Refactor drifts into feature work]** → Non-Goals and the timebox keep the
  change to moves plus the two named fixes.

## Migration Plan

1. Land the characterization tests first and confirm green on the current code
   (`python manage.py test`).
2. Refactor in the ordered task groups, running the suite after each group.
3. Rollback for any group is a `git revert` of that group's commit; there are no
   data migrations and no deploy-time state, so rollback is code-only.
4. Verify with `python manage.py check` and `python manage.py test`, and a
   manual smoke run of search, status change, note, create, delete, and export.

## Open Questions

- Whether to add a database index on `Contact.status` (and/or `updated_at`) for
  the filtered list. Deferred: it requires a model change and migration, has no
  observable behaviour change, and is measurable only at larger data volumes.
  Can be a separate change if profiling shows a need.
