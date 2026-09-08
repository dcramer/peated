## Context

`Entity.totalBottles` is a saved count used by public lists and sorting. It currently comes from delayed `UpdateEntityStats` jobs. A queued job can be skipped, and each job must search all Bottle links after the Bottle change has already been saved. Earlier Peated code changed counts in several places, which caused wrong counts when Bottle roles changed.

This change covers only the distinct active Bottle count on Entities. Entity tasting counts and Country and Region Bottle counts keep their current behavior for now.

## Goals / Non-Goals

**Goals:**

- Keep `Entity.totalBottles` correct at every successful normal catalog commit.
- Make work per catalog mutation depend on the few affected relationships, not catalog size.
- Count a Bottle once when the same Entity is its Brand, Bottler, and/or Distillery.
- Give administrators a production-safe repair job for old wrong counts.
- Keep count rules in one place so create, update, delete, and merge code does not repeat them.

**Non-Goals:**

- Changing Entity tasting counts or Country and Region Bottle counts.
- Making direct SQL changes update counts automatically.
- Adding database triggers, a shared event system, or counts split across several rows.
- Changing public response shapes.

## Decisions

### Supported write-path inventory

Normal relationship changes are owned by four transaction boundaries:

- `createBottleInTransaction` inserts a Bottle and its Distillery rows.
- `updateBottleInTransaction` changes Brand, Bottler, and Distillery rows for one BottleGroup.
- the Bottle delete route removes one otherwise-unused Bottle.
- `mergeBottlesInTransaction` moves consumers and removes the source Bottle.

Entity merge, Bottle operation execution, generated-detail repair, Brand repair, Series merge, and price matching delegate relationship changes to the update or merge boundaries above. Other direct Bottle updates found in search indexing, image handling, photo identification, references, price maintenance, statistics, and Series merge do not change Brand, Bottler, Distillery, or active state. Direct migration or maintenance SQL remains covered by post-operation verification rather than the runtime helper.

### Compare Bottle links before and after a change

The shared count code reads each Bottle's Brand, Bottler, and Distillery IDs inside the Bottle transaction. Each `(bottleId, entityId)` pair is included once, even when the Entity fills more than one role. A Bottle counts only when it has a BottleGroup and no tombstone.

Callers read these links before changing a Bottle and again after the change. The shared code finds the links that were added or removed, then combines the changes for each Entity.

This avoids trusting request input and handles one Entity occupying several Bottle roles without special cases.

### Update counts in the Bottle transaction

Affected Entity rows are updated in ID order using `totalBottles = totalBottles + change`. The transaction fails if an Entity is missing. If a decrease exposes an old undercount, the transaction locks that Entity and saves the exact count from the active Bottle links after the change. It does not replace a negative result with zero because other active Bottles may remain.

Normal work depends only on the few affected Entities. Brief row locks make two changes to the same Entity wait their turn, so neither count is lost.

Counting every Bottle after each change was considered, but it gets slower as an Entity gains Bottles. A queued count was also considered, but the Bottle and its count could then disagree until the job finishes.

### Repair one Entity at a time

A separate query calculates the actual count from active Bottle links. Tests
compare saved counts with this query after normal Bottle operations. A separate
helper locks, recounts, and repairs one Entity.

The admin Automation screen can start one background job. The job first finds
wrong counts with a read-only query. It then repairs only those Entities, one at
a time. Each repair locks the Entity row before recounting and commits
immediately. Normal Bottle transactions update that same row, so a Bottle edit
either finishes before the repair recounts or waits briefly and applies its
change after the repair. No catalog-wide pause is needed.

The job is safe to run again. Starting it more than once while it is waiting or
running does not create another copy. It records which administrator started it
and logs how many counts were wrong and repaired.

Normal Bottle writes do not run the full check. Keeping it separate helps find a
missed write path or an old wrong count without slowing normal requests.

This change does not add a CLI command. Peated does not normally run its CLI in
production. The admin-only route starts the repair through the normal worker.

### Remove only Entity Bottle recounting from the worker

`UpdateEntityStats` stops writing `totalBottles`. It still updates `totalTastings` and starts the existing Country and Region jobs, so this change does not alter unrelated counts.

## Risks / Trade-offs

- [A Bottle write path skips the shared count code] → List every direct Bottle and Bottle-Distillery write and test every supported Bottle operation against the separate count check.
- [A production count is already wrong] → Start the admin repair job. It
  checks all counts, then locks and repairs one affected Entity at a time.
- [Two writes change the same Entity] → Update Entity rows in ID order so both Bottle changes are counted.
- [A decrease exposes an old undercount] → Lock and recount that Entity inside the current Bottle transaction so deletion, updates, and merges do not depend on a separate repair first.
- [Maintenance SQL changes Bottle links directly] → Run the count check after each limited maintenance operation. Automatic database triggers remain out of scope.

## Migration Plan

1. Add shared code to read Bottle links, update counts, check counts, and repair counts.
2. Use it for Bottle creation, editing, deletion, Bottle merge, and Entity merge.
3. Stop the Entity worker from overwriting `totalBottles` and update worker tests.
4. Leave the Entity CLI unchanged.
5. Start the repair from the admin Automation screen after deployment.
6. Review the worker log, which records how many counts were wrong and fixed.

## Open Questions

- Whether Entity `totalTastings` or Country and Region Bottle counts should be changed next.
