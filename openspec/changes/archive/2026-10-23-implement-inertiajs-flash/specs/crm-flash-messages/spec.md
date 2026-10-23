# Spec Delta

## Purpose

Give users explicit, one-shot confirmation that a dashboard write action succeeded, without
turning transient acknowledgements into persistent page data.

## ADDED Requirements

### Requirement: Successful write commands publish a confirmation message

Each successful write command — create contact, change status, add note, delete contact —
SHALL queue exactly one success-level message describing the action. The message MUST be
emitted only after the write has been applied.

#### Scenario: Contact creation
- **WHEN** a contact named `New Person` is created successfully
- **THEN** the next page payload contains a single success message reading `Created New Person`

#### Scenario: Status change
- **WHEN** a contact's status is changed to `qualified` successfully
- **THEN** the next page payload contains a single success message reading `Status changed to qualified`

#### Scenario: Note added
- **WHEN** a note containing text is added successfully
- **THEN** the next page payload contains a single success message reading `Note added`

#### Scenario: Contact deleted
- **WHEN** a contact is deleted successfully
- **THEN** the next page payload contains a single success message reading `Contact deleted`

### Requirement: Rejected write commands publish no confirmation

A command that fails validation or targets a missing contact SHALL NOT queue any
confirmation message; only the existing validation error contract applies.

#### Scenario: Blank name
- **WHEN** a create request with a blank name is rejected
- **THEN** the next page payload contains no confirmation message and still reports `Name is required`

#### Scenario: Unknown contact
- **WHEN** a status change, note, or delete targets an id that does not exist
- **THEN** the request fails as before and no confirmation message is queued

### Requirement: Confirmations travel as flash data, not page props

A confirmation SHALL be delivered as top-level `flash` data on the page payload, outside
`props`, and MUST be consumed by that one response so a later page load no longer carries it.

#### Scenario: Delivered outside props
- **WHEN** a successful command redirects and the dashboard renders
- **THEN** the page payload has the confirmation under `flash` and `props` is unchanged

#### Scenario: Consumed once
- **WHEN** the dashboard is loaded again after the response that displayed the confirmation
- **THEN** the new payload carries no confirmation

#### Scenario: Present on a partial reload
- **WHEN** the redirect response is rendered for a partial reload limited to a subset of props
- **THEN** the confirmation is still delivered

### Requirement: Dashboard displays flash messages

The dashboard SHALL render every message in the page's flash data as a toast in a fixed
stack anchored to the top-right of the viewport, preserving the order the messages were
queued.

#### Scenario: Message text is visible
- **WHEN** the page carries a success message reading `Contact deleted`
- **THEN** the dashboard displays that text as a toast

#### Scenario: Multiple messages keep their order
- **WHEN** the page carries more than one flash message
- **THEN** the dashboard displays all of them as a stack in queued order

### Requirement: Toasts dismiss themselves

Each toast SHALL disappear automatically after a short, bounded delay without user action.
Dismissal MUST only clear the rendered copy: a re-render that does not produce new page
data MUST NOT bring a dismissed message back.

#### Scenario: Automatic dismissal
- **WHEN** a toast has been visible for the configured delay
- **THEN** it is removed from the dashboard

#### Scenario: Visible until the delay elapses
- **WHEN** less than the configured delay has passed since the toast appeared
- **THEN** the toast is still visible

#### Scenario: A re-render does not restore dismissed toasts
- **WHEN** the dashboard re-renders with unchanged flash data after a toast has dismissed
- **THEN** the dismissed toast stays gone

### Requirement: Flash levels convey urgency

Each rendered message SHALL carry its level so that success and informational messages are
announced politely and warnings and errors assertively, with styling that distinguishes them.

#### Scenario: Success message
- **WHEN** a success-level message is rendered
- **THEN** it is visually distinct and announced as a non-interrupting status

#### Scenario: Error message
- **WHEN** an error-level message is rendered
- **THEN** it is visually distinct and announced as an alert

### Requirement: Dashboard renders without flash data

The dashboard SHALL render normally when the page payload has no flash data or an empty
message list, displaying no flash banner and raising no client error.

#### Scenario: Flash key absent
- **WHEN** the page payload has no `flash` entry
- **THEN** the dashboard renders with no flash banner

#### Scenario: Empty message list
- **WHEN** the page payload has an empty flash message list
- **THEN** the dashboard renders with no flash banner

### Requirement: Flash messages do not replace validation errors

Confirmation and validation feedback SHALL stay separate: a response MUST NOT present a
success confirmation alongside field errors for the same submission.

#### Scenario: Rejected submission shows only errors
- **WHEN** a create submission is rejected for a blank name
- **THEN** the dashboard shows the `Name is required` error and no success banner
