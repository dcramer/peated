## Why

The web app has page-local Tailwind styles, one dark palette, and no shared visual contract for the new Peated direction. A reviewable design system will let contributors build consistent interfaces and validate each visual decision before the redesign reaches product screens.

## What Changes

- Add an authoritative `DESIGN.md` for the Peated visual language and interface rules.
- Add StyleX compilation and semantic design tokens for system-driven light and dark themes.
- Add the selected display, reading, and data typefaces with shared base styles.
- Add Storybook as the internal workshop for foundations and components at desktop and mobile widths.
- Add small React components for repeated interface and Peated domain patterns.
- Migrate product screens in reviewable slices while legacy Tailwind styles continue to support surfaces that have not moved yet.
- Remove obsolete styling infrastructure only after its consumers have migrated.

## Capabilities

### New Capabilities

- `web-design-system`: Defines the shared visual foundations, system theme behavior, component contracts, preview surface, and incremental migration rules for the Peated web app.

### Modified Capabilities

None.

## Impact

- Affects `apps/web`, `packages/design`, and web-facing documentation.
- Adds StyleX and Storybook build dependencies.
- Keeps existing routes and API contracts unchanged during the component migration.
- Requires visual QA at desktop and mobile widths for each reviewed slice.
