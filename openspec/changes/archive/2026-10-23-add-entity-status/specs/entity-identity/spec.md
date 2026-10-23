## ADDED Requirements

### Requirement: Current Entity status

The system SHALL allow an Entity to have one optional current status. It SHALL allow `active` for every Entity kind, `mothballed` only for a Distillery, `closed` for a Distillery, Bottler, or Company, and `discontinued` only for a Brand. An Entity without a supported current status SHALL store null.

#### Scenario: Active Brand

- **WHEN** a moderator records an active Brand
- **THEN** the Entity stores and returns `active`

#### Scenario: Mothballed Distillery

- **WHEN** a moderator records a mothballed Distillery
- **THEN** the Entity stores and returns `mothballed`

#### Scenario: Discontinued Brand

- **WHEN** a moderator records a discontinued Brand
- **THEN** the Entity stores and returns `discontinued`

#### Scenario: Unknown status

- **WHEN** Peated does not know an Entity's current status
- **THEN** the Entity stores and returns null

#### Scenario: Status does not match kind

- **WHEN** a create or update would give an Entity a status that is not allowed for its kind
- **THEN** the system rejects the write without changing the Entity

#### Scenario: Kind changes

- **WHEN** a moderator changes an Entity kind while keeping a status that is not allowed for the new kind
- **THEN** the system rejects the write until the moderator selects an allowed status or clears it

### Requirement: Entity status in public reads

The system SHALL return Entity status in Entity details and lists, show a known status on the Entity page, and allow Entity lists to filter by status.

#### Scenario: Show known status

- **WHEN** a person opens an Entity with a known status
- **THEN** the Entity page shows that status as a detail

#### Scenario: Hide unknown status

- **WHEN** a person opens an Entity without a known status
- **THEN** the Entity page does not show a status placeholder

#### Scenario: Filter Entities by status

- **WHEN** a caller filters an Entity list by one supported status
- **THEN** every returned Entity has that status

### Requirement: Entity location records origin

The system SHALL use Entity country, region, address, and coordinates for the place the Entity comes from. A Distillery location SHALL identify its production site. Entity location MUST NOT be replaced with a later headquarters or office.

#### Scenario: Brand origin differs from headquarters

- **WHEN** a Brand began in one place and now has headquarters or offices elsewhere
- **THEN** the Brand location remains the place it comes from

#### Scenario: Distillery production site

- **WHEN** a Distillery has a known production site
- **THEN** its location identifies that site

#### Scenario: Owner is elsewhere

- **WHEN** an Entity's owner is located elsewhere
- **THEN** the owned Entity location does not change to the owner's location
