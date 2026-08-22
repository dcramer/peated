## Why

Peated only indexes the newest Whiskyfun articles from its RSS feed. Whiskyfun
has more than 22,000 reviews in public archive pages dating to 2002, so most of
its useful review history is absent.

## What Changes

- Continue Whiskyfun archive discovery across successful daily runs.
- Keep the current RSS check on every run so new reviews still arrive.
- Import one historical archive page per run and preserve each daily entry's
  public anchor, title, and publication date.
- Keep existing request spacing, quotas, robots checks, parsing, matching, and
  ingestion.
- Stop historical discovery when the public archive ends.

## Capabilities

### New Capabilities

- `whiskyfun-review-history`: Bounded, resumable collection of older Whiskyfun
  reviews without delaying current review collection.

### Modified Capabilities

None.

## Impact

- Changes the Whiskyfun cursor and adapter behavior.
- Enables the existing cursor continuation option for Whiskyfun.
- Adds focused adapter, registry, and operating-document coverage.
