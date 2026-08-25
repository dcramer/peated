## Why

Peated's Pass/Sip/Savor rating is intentionally approachable, but experienced users need a more precise way to record and compare whisky evaluations. Adding a Peated-defined 100-point system provides that precision while preserving the meaning and aggregates of the simple system and keeping community ratings distinct from imported critic reviews.

## What Changes

- Add an optional integer 0-100 score to user tastings as an alternative to Pass/Sip/Savor.
- Publish one Peated scoring rubric with stable score bands and guidance that applies to every community advanced rating.
- Add a persisted user preference that chooses the default rating input for new tastings while allowing an explicit choice in the tasting workflow.
- Store, aggregate, sort, filter, and display advanced community scores independently from simple ratings and external critic scores.
- Scope advanced aggregates to exact Bottles and their BottleGroups so release-sensitive evaluations remain visible alongside family-level context.
- Add a public ratings-methodology page, inline scoring guidance, and explicit OpenAPI descriptions.
- Rewrite the existing internal rating documentation around the implemented coexistence model and remove stale or contradictory migration guidance.

## Capabilities

### New Capabilities

- `advanced-ratings`: Uniform community 100-point scoring, user preferences, independent aggregates, input/display behavior, and public methodology.

### Modified Capabilities

None.

## Impact

- Database schema and generated migrations for tastings, users, Bottles, and BottleGroups.
- Tasting, user, Bottle, and BottleGroup API schemas, serializers, mutations, and aggregate maintenance.
- Tasting forms, settings, tasting displays, exact-Bottle and release-family summaries, filtering, and sorting in the web app.
- Public web content, OpenAPI field documentation, and internal rating architecture/feature documentation.
- Targeted server and web tests for validation, preference behavior, aggregate separation, BottleGroup scope, and rating UI behavior.
