## ADDED Requirements

### Requirement: Library entries can store optional bottle status

The system SHALL allow each Library collection bottle entry to have an optional bottle status of `sealed`, `open`, or `empty`.

#### Scenario: New entry without status

- **WHEN** a user adds a bottle to their Library without providing a status
- **THEN** the Library entry status is unset

#### Scenario: New entry with status

- **WHEN** a user adds a bottle to their Library with status `sealed`
- **THEN** the Library entry stores status `sealed`

#### Scenario: Status is entry-specific

- **WHEN** two users have the same bottle in their Libraries with different statuses
- **THEN** each user's Library entry retains its own status independently

### Requirement: Collection bottle API exposes status

The system SHALL include Library bottle status in collection bottle API responses and SHALL represent unset status as `null`.

#### Scenario: Serialized Library entry with status

- **WHEN** a Library entry with status `open` is returned from a collection bottle API
- **THEN** the response includes `status: "open"`

#### Scenario: Serialized Library entry without status

- **WHEN** a Library entry has no status set
- **THEN** the response includes `status: null`

### Requirement: Library owner can update status

The system SHALL allow the Library owner to set or clear a Library entry's bottle status.

#### Scenario: Set status

- **WHEN** the Library owner sets a Library entry status to `empty`
- **THEN** the entry stores status `empty`
- **THEN** the API returns the updated collection bottle entry

#### Scenario: Clear status

- **WHEN** the Library owner clears a Library entry's status
- **THEN** the entry status becomes unset
- **THEN** the API returns the updated collection bottle entry with `status: null`

#### Scenario: Reject updates by non-owner

- **WHEN** a user attempts to update another user's Library entry status
- **THEN** the system rejects the update

### Requirement: Library list can filter by status

The system SHALL allow Library list results to be filtered by `sealed`, `open`, `empty`, or unset status.

#### Scenario: Filter sealed entries

- **WHEN** a Library list request filters by status `sealed`
- **THEN** only Library entries with status `sealed` are returned

#### Scenario: Filter unset entries

- **WHEN** a Library list request filters by unset status
- **THEN** only Library entries with no status set are returned

#### Scenario: No status filter

- **WHEN** a Library list request omits a status filter
- **THEN** entries are returned regardless of status

### Requirement: Library UI exposes status controls

The Library UI SHALL show owner-editable status controls for the signed-in user's Library entries and passive status display for other users' Library entries.

#### Scenario: Owner sees inline controls

- **WHEN** the signed-in user views their own Library
- **THEN** each Library row provides controls to set status to `Sealed`, `Open`, or `Empty`

#### Scenario: Viewer sees passive status

- **WHEN** a user views another user's Library entry with status `sealed`
- **THEN** the row displays a passive `Sealed` status label

#### Scenario: Unset status is visually quiet

- **WHEN** a Library entry has no status set
- **THEN** the normal row display does not show a prominent status badge

### Requirement: Add-to-Library flow offers optional status chips

The add-to-Library confirmation UI SHALL offer optional quick chips for setting status after a bottle is added to Library.

#### Scenario: User skips quick status

- **WHEN** a user adds a bottle to Library and does not choose a status chip
- **THEN** the Library entry status remains unset

#### Scenario: User chooses quick status

- **WHEN** a user adds a bottle to Library and chooses `Open`
- **THEN** the Library entry status is set to `open`
