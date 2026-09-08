## Why

The main activity feeds currently show only tastings, while profile activity now surfaces grouped Library and Favorites additions. Main feeds should represent the same meaningful collection activity without turning bulk library imports into noisy timelines.

## What Changes

- Add a main activity feed API that returns a discriminated union of tasting and grouped collection-add entries.
- Reuse the profile feed's compact collection-add presentation for global, friends, and local activity pages.
- Apply the same visibility semantics as the existing tasting feed when selecting users for each main feed filter.
- Keep collection-add activity secondary and capped so tastings remain the dominant feed signal when present.
- Preserve the current local feed behavior unless and until a separate local-specific product rule is defined.

## Capabilities

### New Capabilities

- `main-activity-feed`: Main activity feed API, visibility-filtered activity composition, and web rendering for mixed tasting and collection-add entries.

### Modified Capabilities

## Impact

- Backend oRPC routes: add a top-level activity list route and wire it into the router.
- Backend activity composition: extract shared profile/main feed helpers so collection-add grouping and throttling are maintained in one place.
- Backend schemas: expose a generic activity entry schema compatible with the existing profile activity response shape.
- Web activity pages: switch global, friends, and local pages from `tastings.list` to the new mixed activity feed.
- Web components: make the mixed activity list reusable across profile and main feed surfaces.
- Tests: add integration coverage for visibility filters, grouped collection-add entries, secondary throttling, and anonymous/private behavior.
