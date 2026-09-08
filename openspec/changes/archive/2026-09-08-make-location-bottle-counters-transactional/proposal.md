## Why

Country and Region Bottle totals are still recalculated by delayed jobs. A missed or delayed job can leave public location lists wrong, and each recount searches a growing part of the Bottle catalog.

## What Changes

- Update `Country.totalBottles` and `Region.totalBottles` in the same transaction that changes a Bottle's active Distillery links.
- Count a Bottle once per Country or Region even when it has several producing Distilleries in the same location.
- Keep location totals correct when a Distillery's Country or Region changes.
- Add an admin-started repair for existing wrong location totals that can run while Bottle and Entity edits continue.
- Stop the Country and Region statistics jobs from recalculating Bottle totals while leaving their Distillery totals unchanged.
- Cover creation, deletion, relationship updates, Bottle merges, Entity merges, Distillery location changes, and concurrent writes.

## Capabilities

### New Capabilities

- `location-bottle-counters`: Correct Country and Region Bottle totals derived from active Bottle-to-Distillery links.

### Modified Capabilities

None.

## Impact

- Bottle creation, editing, deletion, and merge transactions.
- Distillery location updates and Entity merges.
- Country and Region statistics workers.
- Server count helpers, the existing admin Bottle-count repair action, worker jobs, and integration tests.
- No public API shape changes, migration, or new runtime dependency.
