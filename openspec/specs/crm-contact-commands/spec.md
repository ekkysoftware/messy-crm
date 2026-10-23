# crm-contact-commands Specification

## Purpose

Apply contact write actions from the dashboard — create, change status, add note, delete — with validation, activity logging, and the redirect/error contract the screen relies on.

## Requirements

### Requirement: Each write action has its own endpoint

The system SHALL expose separate command endpoints for creating a contact, changing a contact's status, adding a note, and deleting a contact. Each successful command MUST redirect to the dashboard as a GET.

#### Scenario: Successful command URL set
- **WHEN** the client submits a create, status change, note, or delete
- **THEN** the matching endpoint accepts it and responds with a redirect to the dashboard

#### Scenario: Removed action-dispatch contract
- **WHEN** a client posts the legacy `action` field to the dashboard root
- **THEN** no write is performed

### Requirement: Creating a contact requires a name

A create request SHALL persist a contact along with an initial system activity recording the creation. A blank name MUST be rejected without persisting anything.

#### Scenario: Valid creation
- **WHEN** a contact is created with a name and optional email, company, owner, phone, value, and status
- **THEN** the contact is stored and a `system` activity reading `Contact created` is stored for it

#### Scenario: Blank name
- **WHEN** a create request has a blank or missing name
- **THEN** no contact is stored and the dashboard reports the error `Name is required`

### Requirement: Create input is coerced to the documented rules

Unparsable or empty values SHALL be stored as zero, and an unrecognised status MUST be stored as `lead` rather than rejected.

#### Scenario: Unparsable value
- **WHEN** a contact is created with a non-numeric value
- **THEN** the stored value is `0`

#### Scenario: Unknown status
- **WHEN** a contact is created with a status that is not a declared choice
- **THEN** the stored status is `lead`

### Requirement: Changing status records the transition

Changing a contact's status SHALL store the new status and append a status activity describing the transition from the previous value to the new value.

#### Scenario: Successful transition
- **WHEN** a `lead` contact's status is changed to `qualified`
- **THEN** the contact's status is `qualified` and an activity of kind `status` reads `Status changed from lead to qualified`

#### Scenario: Invalid status value
- **WHEN** a status change requests a value that is not a declared choice
- **THEN** no status change is stored and the dashboard reports the validation error

### Requirement: Notes are only recorded when they contain text

Adding a note SHALL create a note activity when the submitted body contains non-whitespace text, and MUST create nothing when the body is blank or whitespace only.

#### Scenario: Note with text
- **WHEN** a note body of `Called customer` is submitted
- **THEN** an activity of kind `note` with that body is stored for the contact

#### Scenario: Whitespace-only note
- **WHEN** a note body is empty or contains only spaces
- **THEN** no activity is stored

### Requirement: Deleting a contact removes it and its history

A delete request SHALL remove the contact and its activities, then return the dashboard with no contact selected.

#### Scenario: Delete existing contact
- **WHEN** a delete is submitted for an existing contact
- **THEN** the contact and its activities no longer exist and the dashboard has no selected contact

#### Scenario: Delete unknown contact
- **WHEN** a delete is submitted for an id that does not exist
- **THEN** the request responds with not found and nothing is deleted

### Requirement: Write commands are atomic

A command that writes a contact and an activity MUST apply both or neither, so a failure never leaves a contact without its recorded history.

#### Scenario: Failure rolls back both writes
- **WHEN** the activity write fails while creating or changing a contact
- **THEN** the contact row is not created or updated either

### Requirement: Validation errors reach the form once

A rejected command SHALL redirect back to the dashboard and attach the field errors to the next page payload only, so the form can display them and a later reload no longer shows them.

#### Scenario: Errors appear after redirect
- **WHEN** a rejected command redirects to the dashboard
- **THEN** the next page payload contains an `errors` entry for the offending field

#### Scenario: Errors are consumed once
- **WHEN** the dashboard is loaded again after the error-displaying response
- **THEN** the payload no longer contains those errors

### Requirement: Writes return the dashboard to the same view

After a write, the dashboard SHALL restore the query and status filters that were active, and select the affected contact except after deletion.

#### Scenario: Filters survive a write
- **WHEN** a status change is submitted while a query and status filter are active
- **THEN** the resulting dashboard shows the same query and status filter

#### Scenario: Selection after write
- **WHEN** a create or update succeeds for a contact
- **THEN** that contact is the selected contact in the resulting dashboard
