## Why

Peated only indexes the newest WhiskyNotes archive pages. WhiskyNotes has about
4,985 review articles, so most of its useful review history is absent.

## What Changes

- Continue WhiskyNotes archive discovery across successful daily runs.
- Refresh the current archive page on every run so new reviews still arrive.
- Limit each run to a small number of historical pages and keep existing
  request spacing, quotas, robots checks, parsing, matching, and ingestion.
- Stop historical discovery when the public archive ends.

## Capabilities

### New Capabilities

- `historical-review-imports`: Bounded, resumable collection of older review
  articles without delaying current review collection.

### Modified Capabilities

None.

## Impact

- Changes the scraper source definition and run creation lifecycle so an
  opted-in source can continue from its last successful cursor.
- Changes the WhiskyNotes cursor and adapter behavior.
- Enables the existing WhiskyNotes source to run once per day.
- Adds focused lifecycle, adapter, registry, and operating-document coverage.
