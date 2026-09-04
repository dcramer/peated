## Context

`BottleGroup.totalBottles` counts active Bottle rows assigned to that group. A new Bottle and group are created together with a total of one. Bottle deletion and Bottle merge already recount affected groups in their catalog transactions. Shared Bottle edits do not change group membership.

The existing BottleGroup statistics module also recalculates the total when rating work runs. It locks the BottleGroup before reading member Bottles. Bottle deletion currently takes those locks in the opposite order, which can deadlock with a queued statistics run. There is also no admin repair for old wrong BottleGroup totals.

## Goals / Non-Goals

**Goals:**

- Keep normal BottleGroup totals correct without depending on a queued job.
- Give old wrong totals a repair that is safe while Bottle work continues.
- Use one module for the BottleGroup count rule and independent check.
- Make group and member lock order consistent.

**Non-Goals:**

- Changing Bottle grouping or adding a group merge or split feature.
- Changing rating aggregates stored on BottleGroup.
- Deleting empty legacy BottleGroups during count repair.
- Adding a general counter framework, CLI command, new admin control, schema change, or public API change.

## Decisions

### Keep active member Bottles as the source of truth

The total is the number of Bottle rows assigned to a BottleGroup that do not have a tombstone. This matches the existing BottleGroup statistics calculation.

Normal creation continues to save one for a new singleton group. Deletion and merge continue to recount only the affected groups before commit. Bottle field and relationship updates do not touch the total because they cannot change group membership.

Replacing these bounded recounts with a new before-and-after change system was considered, but it would add another concept without reducing meaningful work. BottleGroups are small, and the existing exact recount also updates required rating aggregates after deletion and merge.

### Add the check and repair to the BottleGroup statistics owner

The existing BottleGroup statistics module gains an independent query that compares every saved total with active Bottle rows. Repair locks one BottleGroup, runs the filtered check again, and updates only `totalBottles`. Rechecking after the lock prevents a scan result from overwriting a newer catalog change.

Repairing only the total avoids recalculating or changing unrelated rating data. If an old BottleGroup has no active members, repair saves zero but does not delete the group or change links. Removing invalid groups requires a separate reviewed catalog operation.

### Lock BottleGroups before member Bottles

Bottle update, merge, and group statistics work already lock a BottleGroup before its member Bottles. Bottle deletion will discover the group without a lock, then lock the group and all member Bottles by ID before checking and changing the graph. It verifies the discovered Bottle still belongs to the locked group.

This order lets a repair or queued statistics run wait for a normal write without the two transactions holding one another's needed rows.

### Extend the existing admin repair action

A strict, unique worker job checks all BottleGroups once and repairs each wrong group in a separate transaction. The existing admin Bottle-count action starts it after the Entity and location repair jobs. The Maintenance page uses general wording so another saved Bottle count does not require another control or a list of internal data types.

## Risks / Trade-offs

- [A catalog write bypasses the group lock] → Keep group membership changes in the existing create, delete, and merge owners and test each path.
- [A scan result becomes stale] → Lock and recheck one BottleGroup before saving its total.
- [An old group has no active Bottles] → Save the accurate zero total without deleting catalog history or links.
- [A group has many releases] → Count only that group's indexed member rows during repair; the broad comparison runs only when an administrator starts it.

## Migration Plan

1. Deploy the check, repair job, and consistent deletion lock order.
2. Run the existing Bottle-count repair once from Maintenance.

Rollback removes the new repair job and restores the earlier deletion code. No stored format or schema rollback is needed.

## Open Questions

None.
