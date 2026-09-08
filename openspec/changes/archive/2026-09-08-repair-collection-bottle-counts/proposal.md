## Why

`Collection.totalBottles` is saved for fast display, but its rule is spread across collection routes and Bottle merge code. Old wrong totals can also become negative when a user removes a Bottle, and the existing admin repair action does not check collections.

## What Changes

- Define a collection's Bottle total as its number of Bottle membership rows.
- Put normal count changes in one small owner used by collection add, remove, cleanup, and Bottle merge paths.
- Save membership and count changes in the same transaction without relying on the queue.
- Repair an old wrong total during a valid removal instead of blocking the user or saving a negative value.
- Add a one-collection-at-a-time repair job to the existing admin Bottle-count action.
- Cover additions, deletions, non-membership updates, Bottle merges, overlapping writes, and old wrong totals with integration tests.

## Capabilities

### New Capabilities

- `collection-bottle-counts`: Correct, repairable Collection Bottle totals derived from membership rows.

### Modified Capabilities

None.

## Impact

- Collection Bottle creation and deletion routes.
- Cleanup after a failed Collection Bottle image upload.
- Bottle merge handling for duplicate collection memberships.
- The existing admin Bottle-count repair route.
- Worker registration and tests for the Collection repair job.
- No schema migration, CLI command, new admin control, public API change, or runtime dependency.
