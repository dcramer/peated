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
