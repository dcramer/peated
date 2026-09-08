## Purpose

Define the profile Library, its saved-collection behavior, and its search and filters.

## Requirements

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

#### Scenario: Library status marker on bottle labels

- **GIVEN** an authenticated user has saved a bottle to Library
- **WHEN** the system renders bottle labels that show saved status markers
- **THEN** the label includes a filled monochrome Library marker that is distinct from the Favorites marker

#### Scenario: Unauthenticated save action

- **WHEN** a signed-out visitor activates either save action
- **THEN** the system directs the visitor to authenticate before saving

### Requirement: Filterable Profile Library

The system SHALL allow visible profile Library pages to be searched and filtered while keeping results scoped to the viewed user's Library collection.

#### Scenario: Search Library by bottle text

- **WHEN** a viewer searches a visible user's Library with a text query
- **THEN** the system returns only Library entries whose bottle matches the query

#### Scenario: Filter Library by brand

- **WHEN** a viewer filters a visible user's Library by brand
- **THEN** the system returns only Library entries whose bottle belongs to that brand

#### Scenario: Filter Library by distillery

- **WHEN** a viewer filters a visible user's Library by distillery
- **THEN** the system returns only Library entries whose bottle is associated with that distillery

#### Scenario: Combine Library filters

- **WHEN** a viewer applies text, brand, and distillery filters together
- **THEN** the system returns only Library entries that satisfy every active filter

#### Scenario: Filtered results remain Library scoped

- **WHEN** a matching bottle exists in the catalog but is not saved in the viewed user's Library
- **THEN** the system MUST NOT include that bottle in the filtered Library results

#### Scenario: Filter private Library

- **WHEN** a viewer cannot view a user's private profile
- **THEN** the system MUST NOT expose filtered or unfiltered Library results for that user

### Requirement: Library Filter URL State

The system SHALL store Library search and filter state in URL query parameters.

#### Scenario: Open filtered Library URL

- **WHEN** a viewer opens a Library URL with search or filter query parameters
- **THEN** the Library page applies those parameters to the initial result query

#### Scenario: Change Library filter

- **WHEN** a viewer changes the search text, brand filter, or distillery filter
- **THEN** the Library URL updates to reflect the active filters

#### Scenario: Reset pagination on filter change

- **WHEN** a viewer changes or clears any Library filter while a cursor parameter is present
- **THEN** the system removes or resets the cursor before querying filtered results

#### Scenario: Clear Library filters

- **WHEN** a viewer clears Library filters
- **THEN** the Library page removes the filter query parameters and shows the unfiltered Library list

### Requirement: Responsive Library Filter Controls

The system SHALL provide Library filter controls that are usable on both desktop and mobile viewports.

#### Scenario: Desktop filter controls

- **WHEN** a viewer opens the Library page on a desktop-width viewport
- **THEN** the page displays search, brand, distillery, and clear-filter controls above the Library table

#### Scenario: Mobile search visibility

- **WHEN** a viewer opens the Library page on a mobile-width viewport
- **THEN** the search control remains visible above the Library results

#### Scenario: Mobile secondary filters

- **WHEN** a viewer opens the Library page on a mobile-width viewport
- **THEN** the page presents brand and distillery controls as compact controls near search without horizontal overflow

#### Scenario: Mobile active filter visibility

- **WHEN** brand or distillery filters are active on a mobile-width viewport
- **THEN** the page displays the selected entity values in the filter controls so they can be recognized and cleared

#### Scenario: Filtered empty state

- **WHEN** active Library filters produce no matching entries
- **THEN** the page displays a filtered empty state with a way to clear the filters
