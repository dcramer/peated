## Why

Peated needs broader American whiskey coverage on Bottle pages. The Whiskey
Reviewer publishes frequent scored reviews and exposes a small current-review
list on its public homepage.

## What Changes

- Add The Whiskey Reviewer as a scheduled external-review source.
- Discover only the five current articles in the homepage Recent Reviews list.
- Extract canonical links, writers, dates, Bottle names, and letter grades with
  source-specific code.
- Send only tasting-note paragraphs through the existing transient summary
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
