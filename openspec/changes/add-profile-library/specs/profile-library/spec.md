## ADDED Requirements

### Requirement: Reserved saved collection aliases

The system SHALL support reserved saved-collection aliases where `default` resolves to the user's Favorites collection and `library` resolves to the user's Library collection.

#### Scenario: Favorites alias resolves to Default backing collection

- **WHEN** a caller lists, creates, or deletes collection bottles with collection alias `default`
- **THEN** the system uses the requested user's Favorites backing collection named `Default`

#### Scenario: Library alias resolves to Library backing collection

- **WHEN** a caller lists, creates, or deletes collection bottles with collection alias `library`
- **THEN** the system uses the requested user's Library backing collection named `Library`

#### Scenario: Reserved aliases are independent

- **WHEN** a bottle is saved to the user's Favorites collection
- **THEN** the bottle MUST NOT be treated as saved to the user's Library collection unless it is also saved to `library`

#### Scenario: Custom collection IDs remain supported

- **WHEN** a caller uses a numeric collection identifier
- **THEN** the system resolves the collection by ID with the same ownership and visibility rules as before

### Requirement: Library collection write behavior

The system SHALL allow authenticated users who accepted the terms of service to add and remove bottles and releases from their own Library collection.

#### Scenario: Add bottle to Library

- **WHEN** an authenticated user adds a bottle with collection alias `library`
- **THEN** the bottle is present in that user's Library collection

#### Scenario: Add specific release to Library

- **WHEN** an authenticated user adds a bottle release with collection alias `library`
- **THEN** that release entry is present in that user's Library collection

#### Scenario: Remove bottle from Library

- **WHEN** an authenticated user removes a bottle with collection alias `library`
- **THEN** the matching bottle entry is removed from that user's Library collection

#### Scenario: Cannot modify another user's Library

- **WHEN** an authenticated user attempts to add to or remove from another user's Library collection
- **THEN** the system rejects the request with an authorization error

### Requirement: Profile Library tab

The system SHALL expose a Library tab on visible user profiles that lists bottles saved to the user's Library collection.

#### Scenario: View public profile Library

- **WHEN** a visitor opens a visible user's Library profile tab
- **THEN** the system displays the bottles from that user's Library collection with pagination support

#### Scenario: Empty Library

- **WHEN** a visible user's Library collection has no bottles
- **THEN** the system displays an empty state for Library

#### Scenario: Private profile Library

- **WHEN** a visitor cannot view a user's private profile
- **THEN** the system does not expose that user's Library bottle list

### Requirement: Favorites remain profile-visible

The system SHALL keep Favorites available on profiles using the existing Favorites URL and behavior while backing it with the reserved `default` collection alias.

#### Scenario: View profile Favorites

- **WHEN** a visitor opens a visible user's Favorites profile tab
- **THEN** the system displays bottles from that user's Favorites collection resolved through the `default` alias

#### Scenario: Existing Favorites route compatibility

- **WHEN** a caller uses the existing Favorites page or collection bottle API with collection alias `default`
- **THEN** the system continues to return Favorites data

### Requirement: Distinct save actions

The system SHALL provide separate bottle save actions for Favorites and Library with distinct icons, labels, and active states.

#### Scenario: Favorite action uses Favorites collection

- **WHEN** a user toggles the Favorites action on a bottle or release
- **THEN** the system adds or removes that bottle or release from collection alias `default`

#### Scenario: Library action uses Library collection

- **WHEN** a user toggles the Library action on a bottle or release
- **THEN** the system adds or removes that bottle or release from collection alias `library`

#### Scenario: Unauthenticated save action

- **WHEN** a signed-out visitor activates either save action
- **THEN** the system directs the visitor to authenticate before saving
