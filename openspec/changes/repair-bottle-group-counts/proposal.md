## Why

`BottleGroup.totalBottles` is saved because Bottle lists use it to show and sort related releases. Normal creation, deletion, and merge paths update it today, but there is no production repair for old wrong totals, and Bottle deletion takes group and Bottle locks in the opposite order from the shared group statistics code.

## What Changes

- Make active Bottle rows in a BottleGroup the documented source of truth for its Bottle total.
- Keep the total correct in the existing creation, deletion, and merge transactions; ordinary Bottle field updates do not change group membership.
- Make Bottle deletion lock its BottleGroup before its member Bottles, matching the other group write paths.
- Add an independent check and one-group-at-a-time repair to the existing admin Bottle-count action.
- Cover creation, updates, deletion, merges, concurrent repair, and invalid groups with integration tests.

## Capabilities

### New Capabilities

- `bottle-group-bottle-counts`: Correct, repairable BottleGroup Bottle totals derived from active member Bottles.

### Modified Capabilities

None.

## Impact

- BottleGroup statistics ownership and tests.
- Bottle deletion lock order and tests.
- The existing admin Bottle-count repair route and Maintenance page copy.
- Worker registration and tests for the BottleGroup repair job.
- No schema migration, CLI command, new admin control, public API change, or runtime dependency.
