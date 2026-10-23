# Tasks

## 1. Characterization safety net

- [x] 1.1 Expand `crm/tests.py` to pin current screen behaviour: dashboard
      loads, search filters the list, status change writes a status `Activity`,
      note creation writes a note `Activity`, and delete removes the contact.
      Verify with `python manage.py test` against the **unrefactored** code
      (all green).
- [x] 1.2 Add tests for the add-contact acceptance rules: blank name renders
      `Name is required`; an unparsable `value` is stored as `0`; an unknown
      `new_status` is coerced to `lead`; a blank note creates no `Activity`.
      Verify each test fails if the rule is removed and passes on current code.
- [x] 1.3 Add a CSV export test asserting the header row and one data row per
      contact. Verify with `python manage.py test crm`.

## 2. Extract read/write/value layers

- [x] 2.1 Create `crm/selectors.py` with `get_contacts`, `get_selected_contact`,
      and `get_dashboard_summary`, moving the `Q` filters, `prefetch_related`,
      and aggregates out of the view. Verify `python manage.py test crm` stays
      green (no behaviour change yet).
- [x] 2.2 Create `crm/forms.py` with `ContactCreateForm`, `StatusChangeForm`,
      and `NoteForm` reproducing the rules pinned in task 1.2. Verify the
      add-contact and status tests from group 1 pass unchanged.
- [x] 2.3 Create `crm/services.py` with `create_contact`, `change_status`,
      `add_note`, and `delete_contact`, each wrapping its writes in
      `transaction.atomic()`. Verify the group 1 write-path tests pass.
- [x] 2.4 Reduce `crm_screen` to parse the request, dispatch POST `action` to
      the service/form layer, assemble context from the selector, and render.
      Verify `python manage.py test crm` and `python manage.py check` are green
      and the view no longer imports `csv`/`Decimal`/`Activity` for business
      logic.

## 3. Fix return-URL encoding

- [x] 3.1 Replace the manual `q.replace(" ", "+")` construction in `_return_url`
      with `urllib.parse.urlencode` plus `reverse("crm")`. Verify GET search,
      row selection, and after-action redirects still work via the existing
      tests.
- [x] 3.2 Add a test that a `q` containing spaces, `&`, `#`, and non-ASCII
      round-trips through the rendered row URL and the search field. Verify it
      passes after the change and would fail against the old concatenation.

## 4. Remove the per-status count loop

- [x] 4.1 Implement `status_counts` with a single
      `values("status").annotate(Count("id"))` query (defaulting absent
      statuses to `0`). Verify the rendered counts match the group 1 search
      fixtures.
- [x] 4.2 Add a `assertNumQueries` test for the dashboard request that caps
      the query count and does not scale with the number of status choices.
      Verify it passes and that adding a contact does not increase the
      dashboard count.

## 5. Split the frontend assets

- [x] 5.1 Move the inline CSS out of `dashboard.js` into
      `crm/static/crm/dashboard.css` and load it with `{% static %}` in the
      template `<head>`. Verify the dashboard renders with the same markup and
      the stylesheet loads (Django test client `assertContains` for the static
      path).
- [x] 5.2 Refactor `dashboard.js` into small named functions (payload load,
      escape, render stats, render list, render detail) without changing the
      `json_script` ids, `server-data` attributes, markup, or behaviour.
      Verify the template-render test from group 1 still passes and a manual
      smoke run shows no console errors.

## 6. Integration verification

- [x] 6.1 Run `python manage.py check` and the full `python manage.py test`
      suite; confirm all characterization tests from group 1 pass unchanged.
- [x] 6.2 Manually smoke-test search, select, change status, add note, add
      contact, delete, and CSV export against `runserver`, then review
      `git diff` to confirm the external contract changed only where the
      proposal says it does.

## Workflow follow-up

- Archive the change once review confirms behaviour preservation and the
  README acceptance criteria are met.
