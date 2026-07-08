## ADDED Requirements

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
