## Why

External reviews show a score and link but do not show what the reviewer said.
A short generated clip will make each review useful before the reader follows
the link to the publisher.

## What Changes

- Let review scrapers pass the text for each Bottle review to the shared review
  import.
- Add one function that sends review text to a low-cost model and returns one
  short clip or `null`.
- Store and return the clip with the external review.
- Show the clip on Bottle review cards and in the community feed.
- Keep review ingestion successful when clip generation fails.
- Add one global setting that can stop clip generation when cost or broken
  output requires it.
- Remove stale source-specific model permission language from the active
  external review indexing change.

## Capabilities

### New Capabilities

- `external-review-clips`: Generate, store, and show one short clip for a
  scraped external review without making clip generation required for review
  ingestion.

### Modified Capabilities

None.

## Impact

- Changes the scraper result, database, API, and review cards.
- Adds one model call with fixed input and output limits to each scraped review.
- Updates review adapters to pass the text they already inspect while parsing.
- Requires a generated database change.
