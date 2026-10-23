# Spec Delta

## Purpose

Deliver the single-page CRM dashboard — filtered contact list, selected contact detail, pipeline summary, and CSV export — as a page payload that the client renders.

## ADDED Requirements

### Requirement: Dashboard is delivered as a page payload

The dashboard route SHALL render a named page component with the screen's data as props. The first HTML response MUST embed the page payload for hydration; subsequent visits from the client MUST receive the same payload as JSON without a full document.

#### Scenario: First load embeds the page payload
- **WHEN** a browser requests the dashboard without the client's Inertia request header
- **THEN** the response is HTML containing the embedded page payload (component name, props, URL, version) and the client entry point

#### Scenario: Client visit returns JSON
- **WHEN** the client requests the dashboard with the Inertia request header
- **THEN** the response is JSON with the page component and props, and no surrounding HTML document

### Requirement: Contact list honours search and status filters

The dashboard SHALL expose the contact list ordered by most recently updated, filtered by an optional free-text query and an optional status.

#### Scenario: Query matches several fields
- **WHEN** the dashboard is requested with `q=Altogether`
- **THEN** only contacts whose name, email, company, or owner contains that text are included

#### Scenario: Status filter narrows the list
- **WHEN** the dashboard is requested with `status=lead`
- **THEN** only contacts with that status are included

#### Scenario: No match yields an empty list
- **WHEN** the filters match no contacts
- **THEN** the page props contain an empty contact list and no selected contact

### Requirement: One contact is selected and detailed

The dashboard SHALL include a selected contact with its details and its 20 most recent activities. When the requested contact does not exist or no contact is requested, the first contact in the filtered list MUST be selected.

#### Scenario: Explicit selection
- **WHEN** the dashboard is requested with `contact=<id>` for a listed contact
- **THEN** that contact is returned as selected with its details and activities

#### Scenario: Fallback to first contact
- **WHEN** no contact id is supplied, or the supplied id does not match a contact
- **THEN** the first contact of the filtered list is returned as selected

#### Scenario: Activities are bounded and formatted
- **WHEN** the selected contact has more than 20 activities
- **THEN** only the 20 most recent are returned, newest first, each with kind, body, author, and a `DD Mon YYYY HH:MM` timestamp

### Requirement: Dashboard summary reports totals and per-status counts

The page props SHALL include the total contact count, the summed pipeline value, and a count for every status choice, including statuses with zero contacts. Empty data MUST report zero rather than null.

#### Scenario: Summary reflects stored contacts
- **WHEN** contacts exist with values and statuses
- **THEN** the summary reports the contact count, the summed value, and a count per status choice

#### Scenario: Empty database
- **WHEN** no contacts exist
- **THEN** the summary reports zero total, zero pipeline, and zero for every status choice

### Requirement: Contact navigation preserves the current filters

Each contact row SHALL carry a URL that selects that contact while retaining the active query and status. Values containing reserved or non-ASCII characters MUST round-trip unchanged.

#### Scenario: Special characters in the query
- **WHEN** the query contains spaces, `&`, `#`, or non-ASCII characters
- **THEN** the generated selection URL decodes back to the original query value

### Requirement: Status choices are available to the client

The page props SHALL expose every status as an ordered value/label pair so the client can render identical options in filters and forms without duplicating the list.

#### Scenario: Choices match the model
- **WHEN** the dashboard is rendered
- **THEN** the status choices in the props match the model's declared statuses, in declaration order

### Requirement: CSV export lists all contacts

The export route SHALL return a CSV download of every contact, ordered by name, with a fixed header row and one row per contact.

#### Scenario: Export content
- **WHEN** the export route is requested
- **THEN** the response is a CSV attachment with the header `Name,Email,Company,Phone,Status,Owner,Value` and one row per stored contact

#### Scenario: Export is independent of filters
- **WHEN** the dashboard is filtered and the export link is followed
- **THEN** all contacts are exported, not only the filtered ones
