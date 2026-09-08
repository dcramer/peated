## Why

Entity Bottle totals are recalculated through a delayed chain of queue jobs that can be dropped, repeated, or retained after completion. The totals must remain correct while supporting fast sorting as the catalog grows.

## What Changes

- Update each affected Entity's `totalBottles` in the same transaction that creates, edits, deletes, or merges a Bottle.
- Calculate changes from unique before-and-after Bottle relationships so an Entity linked in more than one role is counted once.
- Add an admin-started worker job that finds and repairs wrong counts from saved
  Bottle links while normal Bottle edits continue.
- Stop the normal Entity statistics worker from recalculating `totalBottles`; retain unrelated statistics work until it is migrated separately.
- Cover normal catalog operations and concurrent updates with integration tests.

## Capabilities

### New Capabilities

- `catalog-counters`: Correct catalog counts that are updated with each Bottle change and can be checked or repaired.

### Modified Capabilities

None.

## Impact

- Bottle creation, editing, deletion, and merge transactions.
- Entity statistics workers and the jobs they start.
- Server count helpers, the admin Automation screen, worker jobs, and integration
  tests. The Entity CLI stays unchanged.
- No public API shape changes and no new runtime dependency.
