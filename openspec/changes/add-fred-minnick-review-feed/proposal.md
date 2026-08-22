## Why

Peated needs more independent American whiskey coverage on Bottle pages. Fred
Minnick publishes current editorial reviews, but his public reviews page is
empty and his main feed mixes reviews with a much larger news stream.

## What Changes

- Add Fred Minnick as a scheduled external-review source.
- Discover at most five recent single-Bottle reviews from the newest bounded
  public post sitemaps.
- Extract canonical links, explicit dates, Bottle names, and Fred Minnick as
  the reviewer with source-specific code.
- Keep native scores absent because current articles do not publish a stable
  score.
- Use the shared review sink, Bottle matcher, request controls, robots
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
