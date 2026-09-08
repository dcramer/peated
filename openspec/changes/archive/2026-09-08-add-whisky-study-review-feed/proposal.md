## Why

Peated needs more current, independent Scotch coverage. The Whisky Study
publishes structured single-Bottle Scotch reviews with dates and scores, but
Peated does not index them.

## What Changes

- Add The Whisky Study as a scheduled external-review source.
- Read at most 20 current articles from its public Scotch review index.
- Store each article's canonical link, publication date, Bottle name, reviewer,
  and native 100-point score.
- Send only direct nose, palate, taste, and finish sections through the existing
  transient summary boundary.
- Reuse the shared review sink, Bottle matcher, request controls, robots
  enforcement, and publication policy.

## Capabilities

### New Capabilities

- `external-review-feeds`: Bounded ingestion of current The Whisky Study Scotch
  reviews through the shared external-review boundary.

### Modified Capabilities

None.

## Impact

- Adds one external-site definition and one source-specific scraper adapter.
- Adds fixture-backed parser and runtime registration tests.
- Adds no database schema, API, model, or UI changes.
