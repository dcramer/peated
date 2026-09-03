# Bottle Reference Migrations 0253–0255

Use this checklist to rename `bottle_alias` to `bottle_reference` in an
environment that has not applied migrations `0253` through `0255`. The old
application cannot use the new database shape. Do not run these production
steps without an approved deployment window and database backup.

## Before The Migration

1. Confirm the application and worker release is ready.
2. Run `pnpm cli bottles reference-migration-report --phase preflight` from the
   release candidate against the old production schema.
3. Save the complete JSON output as the rollout baseline.
4. Check assigned, unresolved, ignored, provenance, canonical coverage,
   collision, and retired-Bottle counts. Stop if they are not understood.
5. Create and verify the database backup used for rollback.
6. Stop or pause all workers that can write Bottle references, StorePrices,
   external reviews, Bottle identity, or search embeddings.
7. Stop application writes before the schema migration starts.

## Migration And Verification

1. Apply migrations `0253`, `0254`, and `0255` with the approved deployment.
2. Start one release-candidate application instance. Keep workers paused.
3. Run `pnpm cli bottles reference-migration-report --phase postflight
--expected <preflight-json-path>`.
4. Treat any count, fingerprint, canonical coverage, collision, provenance,
   actor, timestamp, ignored-state, or assignment mismatch as a failed rollout.
5. Confirm that `bottle_reference` contains the migrated rows and that the new
   `bottle_alias` table is empty. Do not copy references into aliases.
6. Smoke-test a Bottle detail read, an exact reference match, a public search,
   and a moderator BottleReference list read.
7. Resume application writes, then workers. Watch reference indexing,
   StorePrice ingestion, external-review ingestion, and search errors.

## Rollback

1. Stop application writes and workers again.
2. Do not run the previous application against the renamed schema.
3. Restore the pre-migration database backup and the previous application and
   worker release together.
4. Run the original preflight report again and compare it with the saved
   baseline.
5. Resume traffic and workers only after the restored identity report matches.

Do not delete compatibility fields, migration reports, or review evidence in
this rollout. Those cleanups require a separate approved change.

## Removal

Delete this guide and the migration-only audit code after every maintained
environment has applied migrations `0253` through `0255`, the rollback window
has closed, and an older application release can no longer be deployed. Until
then, this versioned guide is intentional compatibility documentation.
