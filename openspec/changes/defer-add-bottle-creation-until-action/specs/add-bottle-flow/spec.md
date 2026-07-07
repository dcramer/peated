## ADDED Requirements

### Requirement: Create proposals are preview-only before terminal action

The system SHALL keep missing-target create proposals as non-persistent Add
Bottle resolver results until the user chooses a terminal action.

#### Scenario: Create proposal displayed without persistence

- **WHEN** photo identification or catalog resolution determines that Peated
  does not have the identified bottle or release yet
- **THEN** the Add Bottle resolver displays the proposed target without creating
  a catalog bottle or release
- **AND** no catalog creation request is sent before the user chooses Add to
  Library, Log Tasting, or Create Bottle

#### Scenario: Create proposal abandoned

- **WHEN** the Add Bottle resolver displays a create proposal
- **AND** the user starts over, searches again, navigates away, or dismisses the
  flow before choosing a terminal action
- **THEN** the system does not create a catalog bottle or release for that
  proposal

### Requirement: Create proposal actions

The system SHALL render action-specific terminal choices for missing-target
create proposals instead of requiring a separate create-then-choose step.

#### Scenario: Existing target actions

- **WHEN** the Add Bottle resolver identifies an existing bottle or release
- **THEN** the system shows Add to Library, Log Tasting, and View Bottle actions
- **AND** View Bottle routes to the existing bottle or release without issuing a
  catalog creation request

#### Scenario: Missing target actions

- **WHEN** the Add Bottle resolver identifies a missing bottle or release as a
  create proposal
- **THEN** the system shows Add to Library, Log Tasting, and Create Bottle
  actions
- **AND** the system does not show a generic Create Bottle confirmation that
  leads to a second outcome chooser

#### Scenario: Create Bottle action

- **WHEN** the user chooses Create Bottle for a create proposal
- **THEN** the system creates the proposed catalog bottle or release
- **AND** the system routes to the created bottle or release detail page

#### Scenario: Add to Library action for missing target

- **WHEN** the user chooses Add to Library for a create proposal
- **THEN** the system creates the proposed catalog bottle or release
- **AND** the system saves that exact target to the user's Library
- **AND** the system shows the Added to Library terminal state without showing a
  second outcome chooser

#### Scenario: Log Tasting action for missing target

- **WHEN** the user chooses Log Tasting for a create proposal
- **THEN** the system creates the proposed catalog bottle or release
- **AND** the system opens the Log Tasting form for that exact target without
  showing a second outcome chooser

### Requirement: Action-time existing target reuse

The system SHALL treat action-time duplicate discovery as an existing target and
continue the user's selected action without creating a duplicate catalog entry.

#### Scenario: Duplicate discovered during Create Bottle

- **WHEN** the user chooses Create Bottle for a create proposal
- **AND** the catalog creation request determines that the proposed target
  already exists
- **THEN** the system routes to the existing bottle or release detail page
- **AND** the system does not create a duplicate catalog bottle or release

#### Scenario: Duplicate discovered during Add to Library

- **WHEN** the user chooses Add to Library for a create proposal
- **AND** the catalog creation request determines that the proposed target
  already exists
- **THEN** the system saves the existing exact target to the user's Library
- **AND** the system shows the Added to Library terminal state for that existing
  target
- **AND** the system does not create a duplicate catalog bottle or release

#### Scenario: Duplicate discovered during Log Tasting

- **WHEN** the user chooses Log Tasting for a create proposal
- **AND** the catalog creation request determines that the proposed target
  already exists
- **THEN** the system opens the Log Tasting form for the existing exact target
- **AND** the system does not create a duplicate catalog bottle or release
