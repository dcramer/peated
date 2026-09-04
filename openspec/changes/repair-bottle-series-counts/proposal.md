## Why

`BottleSeries.numReleases` is saved because search and BottleSeries pages use it for fast sorting and display. Several Bottle and merge paths recount it separately, which repeats the rule and makes concurrent changes and old wrong totals harder to handle safely.

## What Changes

- Make active Bottle rows assigned to a BottleSeries the documented source of truth for its release total.
- Put normal release-total changes in one small owner used by Bottle creation, deletion, series changes, Bottle merges, BottleSeries merges, and Entity merges.
- Update only the affected BottleSeries rows in the same transaction as the Bottle changes.
- Add an independent check and one-series-at-a-time repair to the existing admin Bottle-count action.
- Cover additions, deletions, series changes, merges, concurrent writes, and old wrong totals with integration tests.

## Capabilities

### New Capabilities

- `bottle-series-release-counts`: Correct, repairable BottleSeries release totals derived from active Bottles.

### Modified Capabilities

None.

## Impact

- Bottle creation, update, deletion, and merge code.
- BottleSeries and Entity merge code.
- The existing admin Bottle-count repair route.
- Worker registration and tests for the BottleSeries repair job.
- No schema migration, CLI command, new admin control, public API change, or runtime dependency.
