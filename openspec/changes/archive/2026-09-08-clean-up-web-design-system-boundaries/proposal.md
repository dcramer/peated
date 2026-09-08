## Why

The web design system now owns live API queries, authentication, navigation, and route adapters. This conflicts with its documented render-only boundary and makes reusable visual components depend on product runtime concerns.

## What Changes

- Keep visual foundations, reusable controls, and render-only compositions in the design-system folders.
- Move API-, authentication-, mutation-, and navigation-aware components to their owning route or web feature.
- Remove the vague `designSystem/product` category and update imports to the new owners.
- Narrow the design-system barrel to components and types that have real consumers.
- Remove completed migration naming and guidance after the final route cutover.
- Preserve all public routes, data contracts, and visible behavior.
- Do not add behavior tests as part of this change.

## Capabilities

### New Capabilities

- `web-component-ownership`: Defines the boundary between reusable visual components and route- or feature-owned product behavior.

### Modified Capabilities

None.

## Impact

- Affects `apps/web/src/components/designSystem`, shared web components, and App Router route groups.
- Updates web design-system guidance and import paths.
- Does not change server APIs, persisted data, public URLs, or dependencies.
