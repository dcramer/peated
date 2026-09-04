## Context

`BottleSeries.numReleases` is the saved number of active Bottles whose `seriesId` points to that BottleSeries. Search sorts on it and BottleSeries pages display it. The same count query is currently repeated in Bottle creation, shared Bottle updates, Bottle deletion, Bottle merges, BottleSeries merges, and Entity merges.

The normal write paths already run in database transactions. A queued job must not be required for correctness, and production repair must run while Bottle editing continues.

## Goals / Non-Goals

**Goals:**

- Keep `numReleases` correct when its Bottle rows commit.
- Put the count rule and repair query in one small module.
- Change only the few BottleSeries rows affected by a normal write.
- Repair old wrong totals one BottleSeries at a time.
- Keep the existing admin Bottle-count action as the only repair control.

**Non-Goals:**

- Changing BottleSeries identity or membership rules.
- Adding a general counter framework.
- Changing Collection totals or other Bottle statistics.
- Adding a migration, CLI command, or separate admin page.

## Decisions

### Derive normal changes from Bottle membership before and after the write

The shared owner will accept the affected Bottles' series membership before and after a change. It will combine those rows into a change for each BottleSeries and update only nonzero changes in BottleSeries ID order.

This keeps creation, deletion, series changes, and Bottle merges on the same rule. It also avoids recounting all releases in a series during common Bottle writes. Keeping the existing count queries in each operation was rejected because it repeats the source-of-truth rule and makes concurrent results depend on several implementations.

### Save release-total changes in the source transaction

Normal Bottle operations will update `numReleases` before their transaction commits. Database row updates serialize concurrent changes to the same BottleSeries. Operations affecting more than one BottleSeries will update them in ascending ID order.

A queued recount was rejected because a missed, delayed, or repeated job must not leave a committed Bottle change with the wrong total.

### Repair an old undercount instead of blocking a valid Bottle change

A negative change will not save a value below zero. If the guarded update cannot change an existing BottleSeries, the owner will lock that series and recount it from its active Bottles after the caller's Bottle changes. A missing BottleSeries remains an error because it means the catalog relationship is invalid.

This lets deletion and merge repair old drift without rolling back valid work, while still failing invalid references.

### Check broadly, repair narrowly

The repair job will first find BottleSeries rows whose saved and actual totals differ without taking broad locks. It will then repair each candidate in its own transaction. Each repair locks one BottleSeries row, checks its current Bottle membership again, and writes only `numReleases` when it is still wrong.

The job will use a strict empty input, be dispatched uniquely, and run from the existing **Check Bottle counts** admin action. Reusing that action keeps production operation simple.

### Preserve rare merge behavior while removing repeated count ownership

BottleSeries and Entity merges may move many Bottles and retire a BottleSeries. They will use the same count owner or its one-series recount rather than embedding their own `COUNT(*)` expressions. Their existing identity checks, tombstones, audit rows, and transaction boundaries remain unchanged.

## Risks / Trade-offs

- **A large repair scan still reads the Bottle and BottleSeries tables.** → The scan is read-only; writes are limited to one locked BottleSeries per transaction.
- **A busy BottleSeries may change after the scan.** → The per-series repair locks and rechecks before saving.
- **Old counts can be too low for a decrement.** → The normal write recounts that one locked BottleSeries instead of failing or going negative.
- **Merge paths have more affected Bottles than ordinary edits.** → Keep their work inside the existing merge transaction and avoid introducing another workflow.
- **Changing lock order broadly could create new risk.** → Update affected BottleSeries rows in stable ID order and leave unrelated graph locking unchanged unless a focused concurrency test proves a conflict.

## Migration Plan

1. Deploy the shared owner and all normal write-path changes together.
2. Deploy the repair worker through the existing admin action.
3. Run **Check Bottle counts** after deployment to repair old BottleSeries totals.
4. If rollback is needed, revert the code; no schema or irreversible data change is involved. A later repair run can restore any totals changed while old code was active.

## Open Questions

None.
