## Why

Peated needs more current, independent Scotch coverage. Whisky Saga publishes
high-volume scored Scotch reviews, but Peated does not index them.

## What Changes

- Add Whisky Saga as a scheduled external-review source.
- Read at most 20 current Scotch articles from the public Scotland category.
- Store each article's canonical link, exact publication date, Bottle name,
  reviewer, and native 100-point score.
- Send only direct nose, taste, palate, and finish paragraphs through the
  existing transient summary boundary.
- Reuse the shared review sink, Bottle matcher, request controls, robots
  enforcement, and publication policy.

## Capabilities

### New Capabilities

- `external-review-feeds`: Bounded ingestion of current Whisky Saga Scotch
  reviews through the shared external-review boundary.

### Modified Capabilities

None.

## Impact

- Adds one external-site definition and one native scraper adapter.
- Adds fixture-backed parser and runtime registration tests.
- Adds no database schema, API, model, or UI changes.
