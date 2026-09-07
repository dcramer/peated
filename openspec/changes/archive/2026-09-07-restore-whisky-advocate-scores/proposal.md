## Why

Whisky Advocate reviews imported before the article-model cutover retained their
100-point scores only in the legacy rating column. Current APIs, Bottle totals,
and review displays read native scores, so those reviews now appear unscored.

## What Changes

- Add an administrator-only, idempotent repair operation for legacy Whisky
  Advocate reviews.
- Copy preserved legacy scores into the native 100-point score fields without
  overwriting scores supplied by current imports.
- Queue summary refreshes for affected Bottles and report enough counts to
  verify the repair.
- Document the one-time production operation and remove the repair surface after
  production verification.

## Capabilities

### New Capabilities

- `legacy-external-review-score-repair`: Safely restore native Whisky Advocate
  scores from Peated's preserved legacy values and refresh affected summaries.

### Modified Capabilities

None.

## Impact

The change affects administrator API routes, external-review persistence,
Bottle summary job dispatch, integration tests, and the external-review
operations guide. It does not fetch publisher pages, change Bottle matches, or
change source publication and scheduling settings.
