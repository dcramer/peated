## Why

Peated needs more current critic reviews to make Bottle pages useful. Whiskyfun
publishes a high-volume public feed with exact dates, scores, reviewers, and
multi-bottle articles.

## What Changes

- Add Whiskyfun as a scheduled external-review source.
- Discover only the latest bounded set of articles from its public RSS feed.
- Extract article metadata and scored Bottle reviews with source-specific code.
- Send review prose only through the existing transient summary boundary.
- Use the shared Bottle matcher, review storage, request controls, robots
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
