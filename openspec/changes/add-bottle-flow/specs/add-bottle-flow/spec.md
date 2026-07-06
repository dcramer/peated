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

#### Scenario: Existing target already in Library

- **WHEN** the resolver identifies a bottle or release that is already saved in the user's Library for that exact target
- **THEN** the system shows the Library action as In Library
- **AND** the Library action is disabled while Log Tasting and View Bottle remain available

#### Scenario: No bottle resolved

- **WHEN** the resolver cannot identify a usable bottle match
- **THEN** the system lets the user search again, start over, or create a bottle when creation is allowed

#### Scenario: Create proposal resolved

- **WHEN** photo identification proposes creating a bottle or release
- **THEN** the system shows proposed bottle or release fields before the user can create the target

#### Scenario: Scan resolves source identity before catalog action

- **WHEN** photo identification can read enough label detail to identify the bottle and release or bottling
- **THEN** the resolver treats that bottle and release identity as the primary result
- **AND** the system uses Peated catalog data to decide whether the target already exists or needs to be created
- **AND** the system does not route to manual search merely because an existing catalog row is missing non-target-defining attributes

#### Scenario: One-click scan outcome

- **WHEN** photo identification identifies a bottle and release or bottling with enough confidence for an existing match or create proposal
- **THEN** the resolver offers the corresponding one-click confirmation path for Add to Library or creation
- **AND** manual search is reserved for cases where the bottle and release or bottling identity remains unresolved or ambiguous

#### Scenario: Review policy audit for scan outcome

- **WHEN** classifier evals prove the agent selected the correct scan outcome
- **AND** deterministic review policy still downgrades the result away from one-click confirmation
- **THEN** the review policy gate is audited for removal or narrowing
- **AND** the system keeps only invalid-state, unknown-target, direct-field-conflict, non-whisky, and explicit automation-cap checks

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
- **THEN** the system shows an Added to Library state with the saved bottle or release

#### Scenario: Library scan image save

- **WHEN** the user adds a resolved bottle or release to Library from a scan with a pending image
- **THEN** the system saves the scan image as the Library entry image without requiring a second confirmation step

#### Scenario: Add another bottle

- **WHEN** the user chooses Add Another Bottle from the Added to Library state
- **THEN** the system clears resolver state and starts a fresh Add Bottle flow

#### Scenario: View Library

- **WHEN** the user chooses View Library from the Added to Library state
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

#### Scenario: Promotion not approved

- **WHEN** the user creates a bottle or release from a scan without approving catalog image promotion
- **THEN** the system does not save the scan image as a public bottle or release image

#### Scenario: Catalog image copy fails after creation

- **WHEN** the user approves catalog image promotion and the bottle or release is created
- **AND** the catalog image copy fails
- **THEN** the system returns the created bottle or release
- **AND** the system surfaces a partial-success warning that the public image was not saved

### Requirement: Existing tasting deep links

The system SHALL preserve existing bottle-scoped tasting deep links while user-facing copy changes to Log Tasting.

#### Scenario: Bottle-scoped tasting route

- **WHEN** a user opens an existing bottle-scoped tasting route
- **THEN** the system continues to render the tasting form for that bottle

#### Scenario: Bottle-scoped tasting copy

- **WHEN** the bottle-scoped tasting route renders visible tasting copy
- **THEN** the copy uses Log Tasting
