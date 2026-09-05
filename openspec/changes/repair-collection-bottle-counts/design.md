## Context

`Collection.totalBottles` is the saved number of rows in `collection_bottle` for that Collection. Collection pages display the saved value. Add and remove routes change it now, while Bottle merge recounts selected collections. The existing **Check Bottle counts** action repairs other saved Bottle totals but not collections.

Membership changes already use database transactions. A queued job must not be required for a normal user action to leave the count correct, and production repair must run while users keep editing collections.

## Goals / Non-Goals

**Goals:**

- Keep `totalBottles` correct when a membership change commits.
- Put the count rule and repair query in one small module.
- Change only the Collections affected by a normal write.
- Repair old wrong totals one Collection at a time.
- Keep the existing admin Bottle-count action as the only repair control.

**Non-Goals:**

- Changing collection membership, status, or image behavior.
- Counting quantities beyond one row per Bottle and Collection.
- Adding a general counter framework.
- Adding a migration, CLI command, or separate admin page.

## Decisions

### Derive count changes from membership rows before and after the write

The shared owner will accept Collection IDs represented by membership rows before and after a change. It will combine them into a change for each Collection and update only nonzero changes in Collection ID order.

Creation supplies the new membership, removal supplies the deleted membership, and Bottle merge supplies its membership rows before and after duplicate cleanup. Status and image updates supply no changes because they do not create, remove, or move membership.

Keeping separate arithmetic and recounts in each route was rejected because it repeats the rule and makes merge recounts vulnerable to overwriting an overlapping membership change.

### Save count changes in the membership transaction

Normal collection operations will update `totalBottles` before the membership transaction commits. Database row updates serialize overlapping changes to the same Collection. Operations affecting more than one Collection will update them in ascending ID order.

A queued recount was rejected because a missed, delayed, or repeated job must not leave a completed user action with the wrong count.

### Repair an old undercount instead of blocking a valid removal

A negative change will not save a value below zero. If the guarded update cannot change an existing Collection, the owner will lock that Collection and recount it from its membership rows after the caller's membership changes. A missing Collection remains an error because it means the relationship is invalid.

This also makes failed image-upload cleanup conditional on the membership row actually being removed, so an overlapping removal cannot subtract twice.

### Check broadly, repair narrowly

The repair job will first find Collections whose saved and actual counts differ without taking broad locks. It will then repair each candidate in its own transaction. Each repair locks one Collection row, checks its current membership again, and writes only `totalBottles` when it is still wrong.

The job will use a strict empty input, be dispatched uniquely, and run from the existing **Check Bottle counts** admin action.

## Risks / Trade-offs

- **A repair scan reads all Collection membership rows.** → The scan is read-only; writes and locks are limited to one Collection per transaction.
- **A Collection may change after the scan.** → The per-Collection repair locks and checks again before saving.
- **An old count can be too low for a decrement.** → The normal write recounts that one locked Collection instead of failing or going negative.
- **Bottle merge can affect many Collections.** → It keeps the existing transaction and changes affected Collection rows in stable order without adding another workflow.

## Migration Plan

1. Deploy the shared owner and all normal membership-path changes together.
2. Deploy the repair worker through the existing admin action.
3. Run **Check Bottle counts** after deployment to repair old Collection totals.
4. If rollback is needed, revert the code; there is no schema or irreversible data change. A later repair run can restore totals changed while old code was active.

## Open Questions

None.
