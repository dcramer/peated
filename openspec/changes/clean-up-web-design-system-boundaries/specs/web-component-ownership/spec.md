## ADDED Requirements

### Requirement: Render-only design-system boundary

The web design-system tree SHALL contain visual foundations, reusable components, and render-only compositions. Files in this tree MUST receive product state through values, callbacks, links, or component slots and MUST NOT own API access, authentication state, mutations, server actions, or application navigation.

#### Scenario: Reusable component renders product state

- **WHEN** a route uses a shared design-system component
- **THEN** the route or feature adapter supplies all runtime state and actions through the component contract

#### Scenario: Runtime dependency is needed

- **WHEN** a component requires an API client, query hook, auth hook, server action, or Next navigation hook
- **THEN** that component is owned by the route or a narrowly named web feature outside the design-system tree

### Requirement: Narrow feature ownership

The web app SHALL keep route-only components beside their App Router owner and SHALL keep runtime behavior shared by several routes in a semantic feature folder.

#### Scenario: One route owns a component

- **WHEN** a component is used by one route family
- **THEN** its implementation lives beside that route family

#### Scenario: Several routes share behavior

- **WHEN** several route families use the same runtime behavior
- **THEN** one semantic feature module owns that behavior without copying it

### Requirement: Stable route and interface behavior

The ownership cleanup SHALL preserve public URLs, data contracts, and visible interface behavior.

#### Scenario: Main route group is renamed

- **WHEN** the completed migration route group receives its permanent name
- **THEN** the App Router exposes the same public paths as before the rename

### Requirement: Intentional shared export surface

The shared component barrel SHALL export only components and types intended for use outside their implementation module.

#### Scenario: Export has no external consumer

- **WHEN** a runtime export is used only inside its defining module or its Storybook story
- **THEN** the barrel no longer exposes that export to product code
