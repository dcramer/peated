## Purpose

Define how people create Bottles and supply Bottle images through one safe workflow.

## Requirements

### Requirement: Bottle flow entry point

The system SHALL expose `/addBottle` as the shared flow for identifying a bottle before choosing a follow-up action.

#### Scenario: Open generic bottle flow

- **WHEN** an authenticated user opens `/addBottle`
- **THEN** the system displays a flow that lets the user scan a bottle label or search for a bottle
- **AND** the flow title is Find a bottle

#### Scenario: Manual catalog form is Add a bottle

- **WHEN** a user needs to manually create a catalog bottle
- **THEN** the system routes the user to an Add a bottle form separate from the shared resolver

### Requirement: Bottle resolver outcomes

The system SHALL resolve scan, search, and manual creation paths into a bottle target before performing Library or tasting actions.

#### Scenario: Existing bottle resolved

- **WHEN** the resolver identifies an existing bottle or release
- **THEN** the system shows actions to Add to Library, Log a tasting, and View bottle

#### Scenario: Existing target already in Library

- **WHEN** the resolver identifies a bottle or release that is already saved in the user's Library for that exact target
- **THEN** the system shows the Library action as In Library
- **AND** the Library action is disabled while Log a tasting and View bottle remain available

#### Scenario: No bottle resolved

- **WHEN** the resolver cannot identify a usable bottle match
- **THEN** the system lets the user search again, start over, or create a bottle when creation is allowed

#### Scenario: Create proposal resolved

- **WHEN** photo identification proposes creating a bottle or release
- **THEN** the system shows proposed bottle or release fields
- **AND** the system offers Add to Library, Log a tasting, and Add a bottle actions
- **AND** each selected action creates or reuses the proposed target before continuing

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

#### Scenario: Deterministic SMWS code handling

- **WHEN** photo identification reads an SMWS exact-cask code such as `95.71`
- **THEN** the classifier may use that code as a deterministic bottle identity anchor
- **AND** the classifier may derive rough distillery/category from the curated SMWS code table when available
- **AND** the resolver preserves any visible or extracted SMWS title in the create proposal display name
- **AND** the system does not generalize this deterministic rule to non-SMWS single-cask, barrel, batch, private-selection, brand-prefix, or retailer-title patterns

### Requirement: Intent-aware actions

The system SHALL support intent parameters that prioritize a follow-up action without removing other valid actions.

#### Scenario: Library intent

- **WHEN** the bottle flow runs with Library intent and resolves an existing bottle
- **THEN** Add to Library is the primary action
- **AND** the flow title is Add to your Library

#### Scenario: Tasting intent

- **WHEN** the bottle flow runs with tasting intent and resolves an existing bottle
- **THEN** Log a tasting is the primary action
- **AND** the flow title is Log a tasting

#### Scenario: Catalog intent

- **WHEN** the bottle flow runs with catalog intent and resolves an existing bottle
- **THEN** View bottle is the primary action because the bottle is already in Peated
- **AND** the flow title is Add a bottle

#### Scenario: Catalog intent needs a new bottle

- **WHEN** the bottle flow runs with catalog intent and resolves an approved create proposal
- **THEN** Add a bottle is the primary action

#### Scenario: Choose intent

- **WHEN** the bottle flow runs without a specific intent
- **THEN** the system allows the user to choose among Add to Library, Log a tasting, and View bottle when applicable
- **AND** the flow does not present one outcome as the user's stated intent

### Requirement: Library add confirmation

The system SHALL show a terminal confirmation state after adding a bottle or release to Library from the bottle flow.

#### Scenario: Added to Library

- **WHEN** the user adds a resolved bottle or release to Library
- **THEN** the system shows an Added to Library state with the saved bottle or release

#### Scenario: Library scan image save

- **WHEN** the user adds a resolved bottle or release to Library from a scan with a pending image
- **THEN** the system saves the scan image as the Library entry image without requiring a second confirmation step

#### Scenario: Add another to Library

- **WHEN** the user chooses Add another to Library from the Added to Library state
- **THEN** the system clears resolver state and starts a fresh Library-intent bottle flow

#### Scenario: View Library

- **WHEN** the user chooses View Library from the Added to Library state
- **THEN** the system routes to the user's Library page

### Requirement: Log a tasting language

The system SHALL use Log a tasting for user-facing tasting actions and titles in this flow and related navigation.

#### Scenario: Tasting action copy

- **WHEN** the system renders a user-facing action that starts a tasting form
- **THEN** the visible action text uses Log a tasting instead of Add Tasting or Record Tasting

#### Scenario: Tasting form title

- **WHEN** the system renders the tasting form for a new tasting
- **THEN** the visible title uses Log a tasting

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

The system SHALL preserve existing bottle-scoped tasting deep links while user-facing copy changes to Log a tasting.

#### Scenario: Bottle-scoped tasting route

- **WHEN** a user opens an existing bottle-scoped tasting route
- **THEN** the system continues to render the tasting form for that bottle

#### Scenario: Bottle-scoped tasting copy

- **WHEN** the bottle-scoped tasting route renders visible tasting copy
- **THEN** the copy uses Log a tasting

### Requirement: Existing Bottle review during manual creation

The system SHALL surface advisory existing Bottle candidates while preserving
manual Bottle creation as the member's primary task.

#### Scenario: Unseen candidates appear during entry

- **WHEN** the manual creation matcher returns one or more Bottle ids the member has not reviewed in the current form session
- **THEN** the form shows a compact review notice without leaving the current numbered step
- **AND** the notice count includes only unseen Bottle ids

#### Scenario: Reviewed candidates repeat or reorder

- **WHEN** matcher results contain only Bottle ids the member already reviewed in the current form session
- **THEN** the form does not ask the member to review them again
- **AND** changes to result ordering do not make those Bottles unseen

#### Scenario: New candidate appears after review

- **WHEN** a later matcher result contains a Bottle id that was not in a completed review
- **THEN** the form identifies that Bottle as new
- **AND** offers review again using only unseen candidates

#### Scenario: Final creation has unseen candidates

- **WHEN** the member reaches the final manual creation action with unseen candidates
- **THEN** the system requires candidate review before creating the Bottle
- **AND** the review is an unnumbered view that preserves the final numbered step and all entered data

#### Scenario: Compare the draft with existing Bottles

- **WHEN** candidate review opens
- **THEN** the system keeps the draft Bottle visible
- **AND** lists only unseen existing Bottles using the standard Bottle identity row
- **AND** lets the member use an existing Bottle or add the draft as a new Bottle

#### Scenario: Matcher receives the Bottle draft

- **WHEN** Bottle facts change during manual creation
- **THEN** the matcher receives the normalized Bottle draft
- **AND** the server decides which facts affect candidate discovery and ranking

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
