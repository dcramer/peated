## ADDED Requirements

### Requirement: Bottle production location uses assigned distilleries

The system SHALL match a bottle to a country or region only through an assigned producing distillery in that location. Brand and bottler addresses MUST NOT establish production location.

#### Scenario: Distillery establishes origin

- **WHEN** a bottle has an assigned distillery in a location
- **THEN** the bottle is included in that location's bottle results, category summary, and stored bottle total

#### Scenario: Brand or bottler does not establish origin

- **WHEN** a bottle has a brand or bottler in a location but no assigned distillery there
- **THEN** the bottle is excluded from that location's bottle results, category summary, and stored bottle total

#### Scenario: Bottle has several production locations

- **WHEN** a bottle has assigned distilleries in more than one location
- **THEN** the bottle can appear in each matching location

### Requirement: Location bottle queries

The bottle list API SHALL support country and region production-location filters. A region slug filter MUST be scoped by its country.

#### Scenario: Browse country bottles

- **WHEN** a client lists bottles for a country
- **THEN** the API returns only active bottles produced by a distillery in that country

#### Scenario: Browse region bottles

- **WHEN** a client lists bottles for a region and its country
- **THEN** the API returns only active bottles produced by a distillery in that region

### Requirement: Location category summaries

The system SHALL provide country and region bottle counts grouped by category using the production-location rule.

#### Scenario: View category distribution

- **WHEN** a location has active bottles with known categories
- **THEN** the response contains each category count and a total count for the location

#### Scenario: Location has no categorized bottles

- **WHEN** a location has no active bottles with known categories
- **THEN** the response contains an empty result and a zero total count

### Requirement: Country catalog detail page

The country detail page SHALL provide Overview, Bottles, Distillers, and Regions sections while preserving the existing country root and regions URLs.

#### Scenario: View country overview

- **WHEN** a visitor opens a country root URL
- **THEN** the page shows catalog facts, available category data, a country visual, available production rules, latest releases, distilleries, and available leading regions
- **AND** available category data appears in the side column
- **AND** leading regions use the same shared location preview card as the homepage
- **AND** each leading region card includes a location visual

#### Scenario: Browse country collections

- **WHEN** a visitor selects Bottles, Distillers, or Regions
- **THEN** the page shows the selected country-scoped collection under the same detail header and tabs

### Requirement: Region catalog detail page

The region detail page SHALL provide Overview, Bottles, and Distillers sections while preserving the existing region root URL.

#### Scenario: View region overview

- **WHEN** a visitor opens a region root URL
- **THEN** the page shows catalog facts, available category data, a location visual, latest releases, distilleries, and other regions in the same country
- **AND** available category data appears in the side column

#### Scenario: Country has no other regions

- **WHEN** a visitor opens the only region with bottle data in a country
- **THEN** the page omits the other-regions section

#### Scenario: Browse region collections

- **WHEN** a visitor selects Bottles or Distillers
- **THEN** the page shows the selected region-scoped collection under the same detail header and tabs

### Requirement: Missing optional overview data

Location overviews SHALL omit optional widgets that have no data and SHALL retain zero-valued catalog facts.

#### Scenario: View a location with little information

- **WHEN** a location has no category, summary, region, latest-release, or distillery data
- **THEN** the page omits those widgets and still shows its zero bottle and distillery facts
