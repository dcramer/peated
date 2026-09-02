## ADDED Requirements

### Requirement: Catalog detail pages use shared layout components

Catalog detail route layouts SHALL use shared headers, tabs, columns, facts, sections, and side content. Data loading, sign-in state, navigation, and search behavior remain in the route.

#### Scenario: Build a catalog detail route

- **WHEN** a maintainer builds a catalog detail page
- **THEN** route code owns page behavior and passes display values to the shared components

### Requirement: Storybook page example

Storybook SHALL include a static catalog detail example built from the page components used in production.

#### Scenario: Review the standard page

- **WHEN** a maintainer opens the Catalog Detail Page story
- **THEN** the story shows the standard header, tabs, main content, facts, sections, and side content

#### Scenario: Review a minimal page

- **WHEN** a maintainer opens the Minimal story
- **THEN** the story shows that optional sections and side content can be omitted without empty placeholders

### Requirement: Shared location preview cards

Country and region previews SHALL use one shared card component for their visual, name, bottle count, optional description, and link behavior.

#### Scenario: Show a region preview

- **WHEN** a page renders a region preview
- **THEN** the card shows the same visual structure as a country preview
- **AND** any map shows the region itself, not its parent country

#### Scenario: Region outline is unavailable

- **WHEN** a region has no verified outline
- **THEN** its preview omits the map and keeps its name, bottle count, and link
- **AND** demo examples follow the same rule

#### Scenario: Descriptions have different lengths

- **WHEN** location cards have short, long, or missing descriptions
- **THEN** all cards keep the same height on desktop and mobile
- **AND** descriptions show at most three lines with an ellipsis when needed
- **AND** opening a card provides the full location description
