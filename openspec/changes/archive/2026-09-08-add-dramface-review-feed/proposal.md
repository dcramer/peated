## Why

Peated needs more current critic reviews to make Bottle pages useful. Dramface
publishes frequent public reviews with exact dates, scores, writers, and
multi-bottle or multi-writer articles.

## What Changes

- Add Dramface as a scheduled external-review source.
- Discover only the latest bounded set of articles from its public review page.
- Extract article metadata and each scored Bottle review with source-specific
  code.
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
