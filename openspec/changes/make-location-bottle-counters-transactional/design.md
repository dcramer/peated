## Context

`Country.totalBottles` and `Region.totalBottles` are saved for public filtering and sorting. They count active Bottles by the locations of their Distilleries. Brand and Bottler addresses do not establish where a Bottle was produced.

The current Country and Region statistics jobs recount these totals after `UpdateEntityStats` runs. This delayed chain can leave totals stale and repeats broad count queries. Entity Bottle totals now change in the Bottle transaction, so the same transaction boundaries can also own production-location totals.

## Goals / Non-Goals

**Goals:**

- Keep Country and Region Bottle totals correct when normal catalog writes commit.
- Count each Bottle once in a location even when several linked Distilleries share that location.
- Keep normal Bottle work limited to the few Bottles and locations affected by the write.
- Handle Distillery location edits and concurrent Bottle writes without lost changes.
- Repair old wrong totals while catalog edits continue.

**Non-Goals:**

- Changing `totalDistillers`, tasting totals, or public response shapes.
- Adding database triggers or a general counter framework.
- Making direct maintenance SQL update totals automatically.
- Showing progress for an individual repair run in the admin interface.

## Decisions

### Use active Bottle-to-Distillery links as the source of truth

A Bottle belongs to each distinct Country and Region found through its active Distillery links. A Bottle with no Distillery location does not contribute there. An active Bottle has a BottleGroup and no tombstone, matching the existing location queries.

Brand and Bottler locations remain excluded. This keeps the existing meaning of the totals.

### Compare location sets before and after Bottle changes

Shared code reads the distinct Country and Region IDs for each affected Bottle before and after its Distillery links or active state changes. It subtracts the old sets and adds the new sets. Set comparison makes several Distilleries in the same location count once.

Creation, shared relationship edits, deletion, and Bottle merges call this code inside the same transaction that changes the Bottle. Entity merges already move Bottle relationships through the shared update and merge functions, so they use the same rule.

Updating all Countries and Regions after every Bottle write was considered, but its cost grows with the catalog. Keeping the delayed jobs was also considered, but a saved Bottle and its location totals could then disagree.

### Handle Distillery location edits in the Entity transaction

When an Entity's Country or Region changes, the Entity transaction reads production-location sets for the active Bottles linked to that Distillery before and after the update. It applies only the combined changes for those Bottles.

This work grows with the changed Distillery's Bottles, not the whole catalog. Location edits are rare, and the query does not lock Bottle rows. A more specialized set of count queries would save memory but would repeat the rule and be harder to verify.

### Update and repair location rows in a stable order

Normal changes use atomic additions and subtractions. Country rows are updated by ID first, followed by Region rows by ID. A guarded decrease prevents a negative total. If old data is too low, the transaction locks that one location and saves its exact total from current Bottle links instead of blocking the valid Bottle change.

Stable ordering prevents two transactions that touch the same locations in different ways from taking locks in opposite orders.

### Add location work to the existing admin repair action

An independent query finds wrong Country and Region Bottle totals. A new worker repairs one location per transaction, using the same row locks as normal writes. The existing admin action starts both the Entity and location repair jobs, so production does not gain another control or CLI command.

Starting the action again keeps one active copy of each job. The repair scans can be broad, but they run only when explicitly requested and do not hold a catalog-wide write lock.

### Leave Distillery totals in the existing jobs

`UpdateCountryStats` and `UpdateRegionStats` stop writing `totalBottles` but continue to recalculate `totalDistillers`. Their existing dispatch remains until that separate counter is addressed.

## Risks / Trade-offs

- [A Bottle write path skips the shared code] → Use the same four Bottle transaction boundaries as Entity totals and test creation, updates, deletion, and merges against an independent count query.
- [A Distillery has many Bottles] → Read only that Distillery's active Bottles and update only changed Country and Region rows; do not lock the Bottle rows.
- [Two writes touch the same locations] → Apply atomic changes with a fixed Country-then-Region, ascending-ID order.
- [A production total is already wrong] → Repair one locked location at a time through the admin-started worker.
- [A decrease exposes an old undercount] → Recount the locked location inside the current transaction so the valid catalog write can finish.

## Migration Plan

1. Add the shared location count, check, and repair code.
2. Call it from Bottle writes and Distillery location updates.
3. Stop the location statistics jobs from writing Bottle totals.
4. Extend the existing admin action to start the location repair.
5. After deployment, run the existing Bottle-count repair action once.

Rollback restores the old worker recount fields. The saved totals remain compatible because no schema changes are required.

## Open Questions

None.
