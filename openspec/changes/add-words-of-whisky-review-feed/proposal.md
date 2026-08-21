## Why

Peated needs more current critic reviews to make Bottle pages useful. Words of
Whisky publishes frequent scored reviews with exact dates and many
multi-bottle articles.

## What Changes

- Add Words of Whisky as a scheduled external-review source.
- Discover only the current review articles shown on its public homepage.
- Extract article metadata and each scored Bottle review with source-specific
  code.
- Send only each Bottle's tasting notes through the existing transient summary
  boundary.
- Use the shared Bottle matcher, review sink, request controls, robots
  enforcement, and publication policy.

## Capabilities

### New Capabilities

- `external-review-feeds`: Bounded ingestion of current editorial review feeds
  through source-specific adapters and the shared external-review boundary.

### Modified Capabilities

None.

## Impact

- Adds one external-site definition and one native scraper adapter.
- Adds fixture-backed parser and runtime registration tests.
- Adds no database schema, API, model, or UI changes.
