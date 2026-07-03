## ADDED Requirements

### Requirement: Add Bottle entry point

The system SHALL expose `/addBottle` as the user-facing Add Bottle flow for identifying a bottle before choosing a follow-up action.

#### Scenario: Open Add Bottle

- **WHEN** an authenticated user opens `/addBottle`
- **THEN** the system displays a flow that lets the user scan a bottle label or search for a bottle

#### Scenario: Manual catalog form is Create Bottle

- **WHEN** a user needs to manually create a catalog bottle
- **THEN** the system routes the user to a Create Bottle form separate from the top-level Add Bottle flow

### Requirement: Bottle resolver outcomes

The system SHALL resolve scan, search, and manual creation paths into a bottle target before performing Library or tasting actions.

#### Scenario: Existing bottle resolved

- **WHEN** the resolver identifies an existing bottle or release
- **THEN** the system shows actions to Add to Library, Log Tasting, and View Bottle

#### Scenario: No bottle resolved

- **WHEN** the resolver cannot identify a usable bottle match
- **THEN** the system lets the user search again, start over, or create a bottle when creation is allowed

#### Scenario: Create proposal resolved

- **WHEN** photo identification proposes creating a bottle or release
- **THEN** the system shows proposed bottle or release fields before the user can create the target

### Requirement: Intent-aware actions

The system SHALL support intent parameters that prioritize a follow-up action without removing other valid actions.

#### Scenario: Library intent

- **WHEN** the Add Bottle flow runs with Library intent and resolves an existing bottle
- **THEN** Add to Library is the primary action

#### Scenario: Tasting intent

- **WHEN** the Add Bottle flow runs with tasting intent and resolves an existing bottle
- **THEN** Log Tasting is the primary action

#### Scenario: Choose intent

- **WHEN** the Add Bottle flow runs without a specific intent
- **THEN** the system allows the user to choose among Add to Library, Log Tasting, and View Bottle when applicable

### Requirement: Library add confirmation

The system SHALL show a terminal confirmation state after adding a bottle or release to Library from the Add Bottle flow.

#### Scenario: Added to Library

- **WHEN** the user adds a resolved bottle or release to Library
- **THEN** the system shows an Added to Library confirmation with the saved bottle or release

#### Scenario: Library scan image choice

- **WHEN** the user adds a resolved bottle or release to Library from a scan with a pending image
- **THEN** the system lets the user explicitly choose whether to save the scan as the Library image
- **AND** the system explains that the saved image applies only to the Library entry and not to tasting or public bottle images

#### Scenario: Add another bottle

- **WHEN** the user chooses Add Another Bottle from the Added to Library confirmation
- **THEN** the system clears resolver state and starts a fresh Add Bottle flow

#### Scenario: View Library

- **WHEN** the user chooses View Library from the Added to Library confirmation
- **THEN** the system routes to the user's Library page

### Requirement: Log Tasting language

The system SHALL use Log Tasting for user-facing tasting actions and titles in this flow and related navigation.

#### Scenario: Tasting action copy

- **WHEN** the system renders a user-facing action that starts a tasting form
- **THEN** the visible action text uses Log Tasting instead of Add Tasting or Record Tasting

#### Scenario: Tasting form title

- **WHEN** the system renders the tasting form for a new tasting
- **THEN** the visible title uses Log Tasting

### Requirement: Catalog image approval during creation

The system SHALL require explicit user approval before a scan image is saved as the public image for a newly created catalog bottle or release.

#### Scenario: Bottle image approval

- **WHEN** the user creates a bottle from a scan and policy allows catalog image promotion
- **THEN** the system offers a Set as Bottle Image control explaining that the photo will be shown as the public image for the new bottle

#### Scenario: Release image approval

- **WHEN** the user creates a release from a scan and policy allows release image promotion
- **THEN** the system offers a Set as Release Image control explaining that the photo will be shown as the public image for the new release

#### Scenario: Promotion not allowed

- **WHEN** catalog image promotion policy does not allow using the scan image
- **THEN** the system does not save the scan image as a public bottle or release image

### Requirement: Existing tasting deep links

The system SHALL preserve existing bottle-scoped tasting deep links while user-facing copy changes to Log Tasting.

#### Scenario: Bottle-scoped tasting route

- **WHEN** a user opens an existing bottle-scoped tasting route
- **THEN** the system continues to render the tasting form for that bottle

#### Scenario: Bottle-scoped tasting copy

- **WHEN** the bottle-scoped tasting route renders visible tasting copy
- **THEN** the copy uses Log Tasting
