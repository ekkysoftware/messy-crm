# crm-dashboard-client-state Specification

## Purpose

Define how the dashboard client holds server state: one cache seeded from the page payload, view-scoped entries, honest in-flight write state, and writes that still travel as the existing Inertia visits — so the client data layer can grow without changing the server contract.

## Requirements

### Requirement: Dashboard data renders from one payload-seeded cache

The dashboard client SHALL keep the contacts, selected contact, summary, filters, and status choices in a single client-side cache that is seeded from the page payload. Rendering the dashboard MUST NOT request that data a second time, and the rendered result MUST match the payload it was given.

#### Scenario: First render makes no extra request

- **WHEN** the dashboard mounts with a page payload
- **THEN** no request is made for contacts, summary, filters, or status choices beyond the page load that produced the payload

#### Scenario: An in-app visit reseeds the cache

- **WHEN** the user navigates within the dashboard and the client receives a new page payload
- **THEN** the cached view reflects the new payload's contacts, selected contact, summary, filters, and status choices

#### Scenario: Rendered output matches the payload

- **WHEN** the dashboard renders from a payload with contacts, a selected contact, a summary, and status choices
- **THEN** the rendered list, detail panel, statistics, and filter options are the ones described by that payload

### Requirement: Cached views are scoped to the active dashboard view

Each distinct combination of search text, status filter, and selected contact SHALL be its own cache entry. Once a view is cached, the client MUST NOT refetch it on its own — no polling, no refetch on window focus, and no refetch on reconnect.

#### Scenario: Different filters use different entries

- **WHEN** the dashboard is viewed with a search text and then with a different search or status filter
- **THEN** each view renders the contacts and summary belonging to its own filters, not the other view's data

#### Scenario: No autonomous refresh

- **WHEN** the dashboard is idle, regains focus, or reconnects after a network drop
- **THEN** the client issues no request to refresh the dashboard

#### Scenario: A retained view can be rendered again

- **WHEN** a previously visited view is rendered again while its cache entry is still retained
- **THEN** the client renders that view's cached data instead of requesting it again

### Requirement: The client cache lives only for the current document

The cache SHALL exist in memory for the life of the loaded document. A full page load MUST
start with an empty cache, and the client MUST NOT write cached dashboard data to browser
storage.

#### Scenario: Full load starts empty

- **WHEN** the dashboard document is loaded from the server
- **THEN** the cache is populated only from that load's payload

#### Scenario: Nothing is persisted

- **WHEN** the dashboard has been used and cached views exist
- **THEN** no dashboard payload is written to `localStorage` or `sessionStorage`

### Requirement: Writes remain the existing Inertia visits

Every create, status change, note, and delete SHALL be issued as the same Inertia visit to the
same endpoint with the same payload and the active filters. The client MUST NOT call those
endpoints through any other transport.

#### Scenario: Requests are unchanged

- **WHEN** the user creates a contact, changes a status, adds a note, or deletes a contact
- **THEN** the visit uses the same method, URL, and field payload as before, including the active search and status filters

#### Scenario: Redirect is still followed

- **WHEN** a write visit succeeds and the server redirects to the dashboard
- **THEN** the client renders the dashboard from the redirect's page payload

### Requirement: An in-flight write is single and visible

While a write visit is in flight, the control that started it MUST be disabled and further
submissions of that action MUST NOT start another visit. The control MUST become available
again when the visit settles, whether it succeeds or fails.

#### Scenario: Control is disabled while pending

- **WHEN** a write visit has started and has not settled
- **THEN** the submitting control is disabled

#### Scenario: Repeated activation starts one visit

- **WHEN** the user activates a write control twice before the first visit settles
- **THEN** only one visit is issued

#### Scenario: Control recovers after settling

- **WHEN** the visit succeeds, fails validation, or errors
- **THEN** the submitting control is enabled again

### Requirement: A completed write repaints from its response payload

After a write visit finishes, the dashboard SHALL render the view described by the resulting
page payload. The client MUST NOT keep displaying the pre-write cached entry for that view.

#### Scenario: Deleted contact is gone

- **WHEN** a contact is deleted successfully and the dashboard returns without a selection
- **THEN** the rendered list no longer contains that contact and the detail panel shows no selection

#### Scenario: Created or updated contact is selected

- **WHEN** a create, status change, or note succeeds for a contact
- **THEN** the dashboard renders that contact as selected with the updated details and activities

#### Scenario: A stale view is not resurrected

- **WHEN** the post-write payload describes the same filters as an earlier cached view
- **THEN** the client renders the post-write payload, not the earlier cached copy

### Requirement: Cached views change only after the server confirms a write

The client MUST NOT modify a cached view in anticipation of a write. Pending writes leave the
rendered view untouched until the server's response arrives.

#### Scenario: No optimistic removal

- **WHEN** a delete is in flight
- **THEN** the contact is still listed until the redirect's payload is rendered

#### Scenario: Rejected write leaves the view as it was

- **WHEN** a write is rejected and the dashboard returns with validation errors
- **THEN** the previously rendered contacts and selection are still shown

### Requirement: Feedback stays payload-driven

The cache layer MUST NOT invent user feedback. Success confirmations and validation errors
SHALL continue to be displayed only from the page payload's flash data and shared errors.

#### Scenario: Pending write shows no confirmation

- **WHEN** a write is in flight
- **THEN** no success confirmation is displayed

#### Scenario: Errors come only from the payload

- **WHEN** a write is rejected
- **THEN** the displayed field error is the one carried by the page payload, and no client-generated error or confirmation is added
