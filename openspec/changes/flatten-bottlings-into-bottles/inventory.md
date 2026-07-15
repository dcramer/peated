# Legacy BottleRelease Inventory

This is the source inventory for the compatibility and cleanup gates. It was
captured on 2026-07-14 from production source files with:

```sh
rg -l -S 'releaseId|release_id|bottle_release|bottleReleases|BottleRelease' \
  apps packages docs \
  --glob '!**/*.test.*' \
  --glob '!**/.vitest-evals/**' \
  --glob '!**/eval-fixtures/**' \
  --glob '!**/__fixtures__/**'
```

Generated migration SQL and snapshots are historical evidence, not runtime
readers or writers. Tests and eval fixtures are migration coverage and must be
updated with the production surface they exercise.

## Database storage

| Surface                        | Legacy identity                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `bottle_release`               | Concrete release table, owned by `apps/server/src/db/schema/bottles.ts`              |
| `bottle_observation`           | `bottle_id`, nullable `release_id`                                                   |
| `bottle_alias`                 | nullable `bottle_id`, nullable `release_id`                                          |
| `tasting`                      | `bottle_id`, nullable `release_id`                                                   |
| `review`                       | nullable `bottle_id`, nullable `release_id`                                          |
| `collection_bottle`            | `bottle_id`, nullable `release_id`                                                   |
| `flight_bottle`                | `bottle_id`, nullable `release_id`                                                   |
| `store_price`                  | nullable `bottle_id`, nullable `release_id`                                          |
| `incoming_bottle_decision_log` | `bottle_id`, nullable `release_id`; release-shaped decision enum values              |
| `store_price_match_proposal`   | current and suggested Bottle/Release pairs, parent Bottle, release-shaped JSON draft |
| `store_price_match_attempt`    | historical current and suggested Bottle/Release pairs                                |
| `pending_upload`               | `bottle_release_image` target kind                                                   |
| `change`                       | `bottle_release` object type and durable release-shaped payloads                     |

The Drizzle owners are:

- `apps/server/src/db/schema/bottles.ts`
- `apps/server/src/db/schema/collections.ts`
- `apps/server/src/db/schema/enums.ts`
- `apps/server/src/db/schema/flights.ts`
- `apps/server/src/db/schema/incomingBottleDecisionLogs.ts`
- `apps/server/src/db/schema/pendingUploads.ts`
- `apps/server/src/db/schema/reviews.ts`
- `apps/server/src/db/schema/stores.ts`
- `apps/server/src/db/schema/tastings.ts`

## Runtime schemas and exported types

- `apps/server/src/schemas/bottleReleases.ts`
- `apps/server/src/schemas/bottles.ts`
- `apps/server/src/schemas/catalogMigrationAudit.ts`
- `apps/server/src/schemas/collections.ts`
- `apps/server/src/schemas/index.ts`
- `apps/server/src/schemas/priceMatches.ts`
- `apps/server/src/schemas/reviews.ts`
- `apps/server/src/schemas/shared.ts`
- `apps/server/src/schemas/tastings.ts`
- `apps/server/src/types.ts`
- `packages/bottle-classifier/src/classifierTypes.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/localCatalog/schema.ts`

## Serializers and read models

- `apps/server/src/serializers/bottle.ts`
- `apps/server/src/serializers/bottleRelease.ts`
- `apps/server/src/serializers/collectionBottle.ts`
- `apps/server/src/serializers/review.ts`
- `apps/server/src/serializers/tasting.ts`
- `apps/server/src/lib/activityFeed.ts`
- `apps/server/src/orpc/routes/users/library-stats.ts`

## API routes

BottleRelease CRUD and registration:

- `apps/server/src/orpc/routes/bottleReleases/create.ts`
- `apps/server/src/orpc/routes/bottleReleases/delete.ts`
- `apps/server/src/orpc/routes/bottleReleases/details.ts`
- `apps/server/src/orpc/routes/bottleReleases/index.ts`
- `apps/server/src/orpc/routes/bottleReleases/list.ts`
- `apps/server/src/orpc/routes/bottleReleases/update.ts`
- `apps/server/src/orpc/routes/index.ts`
- `apps/server/src/app.ts`

Bottle catalog and repair routes:

- `apps/server/src/orpc/routes/bottles/apply-age-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-dirty-parent-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/delete.ts`
- `apps/server/src/orpc/routes/bottles/release-repair-candidates.ts`
- `apps/server/src/orpc/routes/bottles/update.ts`
- `apps/server/src/orpc/routes/bottleAliases/delete.ts`

Target-bearing consumer routes:

- `apps/server/src/orpc/routes/collections/bottles/create.ts`
- `apps/server/src/orpc/routes/collections/bottles/delete.ts`
- `apps/server/src/orpc/routes/collections/bottles/imageHelpers.ts`
- `apps/server/src/orpc/routes/collections/bottles/list.ts`
- `apps/server/src/orpc/routes/reviews/create.ts`
- `apps/server/src/orpc/routes/reviews/list.ts`
- `apps/server/src/orpc/routes/reviews/update.ts`
- `apps/server/src/orpc/routes/tastings/create.ts`
- `apps/server/src/orpc/routes/tastings/delete.ts`
- `apps/server/src/orpc/routes/tastings/list.ts`
- `apps/server/src/orpc/routes/tastings/photo-identification-create.ts`
- `apps/server/src/orpc/routes/tastings/photo-identification.ts`
- `apps/server/src/orpc/routes/prices/create-batch.ts`

Classifier, price matching, and moderation routes:

- `apps/server/src/orpc/routes/admin/incoming-bottle-decisions.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/create-bottle.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/resolve.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/utils.ts`

## Server services and writers

Catalog identity, aliases, search, creation, and updates:

- `apps/server/src/lib/createBottle.ts` owns the shared Bottle preparation and
  persistence core plus the complete legacy and concrete transaction
  operations. Stable Bottle columns and distiller joins are durable exact-Bottle
  materialization and must remain synchronized by atomic group-wide writes.
- `apps/server/src/lib/createConcreteBottle.ts` owns the runtime-validated
  concrete creation service boundary used by future public adapters.
- `apps/server/src/lib/updateConcreteBottle.ts` is the authoritative moderator
  update domain service. Task 5.3 routes and proposal flows are deferred adapters
  that must delegate to it rather than duplicate its business logic.
- Task 4.7 adds `apps/server/src/lib/mergeBottleGroups.ts` as the authoritative
  one-source-to-one-destination moderator group-merge service. It owns member
  rematerialization, generic consumer and stable-alias consolidation, tombstone
  retirement, reversible audits, and shared group aggregate recomputation.
- `apps/server/src/lib/catalogTargets.ts` is the instrumented compatibility
  reader/writer from tasks 3.2/3.7; retain it through the task 9.5 read window
  and remove its legacy branch under task 9.7.
- `apps/server/src/lib/bottleAliases.ts`
- `apps/server/src/lib/bottleCreationDrafts.ts`
- `apps/server/src/lib/bottleFinder.ts`
- `apps/server/src/lib/bottleReferenceCandidates.ts`
- `apps/server/src/lib/bottleReferenceResolution.ts`
- `apps/server/src/lib/bottleReleaseIdentity.ts`
- `apps/server/src/lib/bottleSchemaRules.ts`
- `apps/server/src/lib/createBottleRelease.ts`
- `apps/server/src/lib/db.ts`
- `apps/server/src/lib/format.ts`
- `apps/server/src/lib/search.ts`

Repair and migration-adjacent services:

- `apps/server/src/lib/applyDirtyParentAgeRepair.ts`
- `apps/server/src/lib/applyDirtyParentReleaseRepair.ts`
- `apps/server/src/lib/applyLegacyReleaseRepair.ts`
- `apps/server/src/lib/applyRepairBackfillProposals.ts`
- `apps/server/src/lib/canonRepairCandidates.ts`
- `apps/server/src/lib/dirtyParentAgeRepairCandidates.ts`
- `apps/server/src/lib/legacyReleaseRepairCandidates.ts`
- `apps/server/src/lib/legacyReleaseRepairClassifier.ts`
- `apps/server/src/lib/legacyReleaseRepairReviewState.ts`
- `apps/server/src/lib/legacyReleaseRepairReviews.ts`
- `apps/server/src/lib/repairBackfillProposals.ts`
- `apps/server/src/lib/repairBottleBrandDistilleryAssignments.ts`
- `apps/server/src/lib/fixBadReviewEntities.ts`

Classifier decisions and price matching:

- `apps/server/src/agents/bottleClassifier/service.ts`
- `apps/server/src/lib/classifierDecisionCreateInputs.ts`
- `apps/server/src/lib/incomingBottleDecisionLog.ts`
- `apps/server/src/lib/priceMatchingAutomation.ts`
- `apps/server/src/lib/priceMatchingDraftNormalization.ts`
- `apps/server/src/lib/priceMatchingProposals.ts`
- `apps/server/src/lib/pendingUploads.ts`

## Workers and queue payloads

- `apps/server/src/worker/jobs/createMissingBottles.ts`
- `apps/server/src/worker/jobs/index.ts`
- `apps/server/src/worker/jobs/indexBottleReleaseSearchVectors.ts`
- `apps/server/src/worker/jobs/mergeBottle.ts` remains the legacy exact-Bottle
  merge worker; group merge must not duplicate or delegate to its business logic.
- `apps/server/src/worker/jobs/mergeEntity.ts`
- `apps/server/src/worker/jobs/onBottleAliasChange.ts`
- `apps/server/src/worker/jobs/onBottleReleaseChange.ts`
- `apps/server/src/worker/types.ts`

## CLI

- `apps/cli/src/commands/bottles.ts`
- `apps/cli/src/commands/catalogMigration.ts`

## Migration audit

- `apps/server/src/lib/catalogMigrationAudit.ts`
- `apps/server/src/lib/test/fixtures.ts` supplies legacy graph fixtures to the
  integration suite and is not a production reader or writer.

## Classifier contract and runtime

- `packages/bottle-classifier/src/bottleCreationDrafts.ts`
- `packages/bottle-classifier/src/bottleSchemaGuidance.ts`
- `packages/bottle-classifier/src/bottleSchemaRules.ts`
- `packages/bottle-classifier/src/candidateFamilyContext.ts`
- `packages/bottle-classifier/src/classifierRuntime.ts`
- `packages/bottle-classifier/src/classifierTypes.ts`
- `packages/bottle-classifier/src/evalFixtureBuilders.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/exactCask.ts`
- `packages/bottle-classifier/src/index.ts`
- `packages/bottle-classifier/src/instructions.ts`
- `packages/bottle-classifier/src/legacyReleaseRepairIdentity.ts`
- `packages/bottle-classifier/src/legacyReleaseRepairResolution.ts`
- `packages/bottle-classifier/src/localCatalog/candidates.ts`
- `packages/bottle-classifier/src/localCatalog/dataSource.ts`
- `packages/bottle-classifier/src/localCatalog/schema.ts`
- `packages/bottle-classifier/src/priceMatchingEvidence.ts`
- `packages/bottle-classifier/src/releaseIdentity.ts`
- `packages/bottle-classifier/src/reviewPolicy.ts`
- `packages/bottle-classifier/src/runtime/candidates.ts`
- `packages/bottle-classifier/README.md`
- `packages/bottle-classifier/package.json`

`packages/bottle-classifier/src/realWorldNewBottleEval.fixtures.ts` is a
production-source fixture registry and is included in the eval migration even
though it is not executed in the request path.

## Web routes and components

Routes:

- `apps/web/src/app/(admin)/admin/(default)/release-repairs/page.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/(tabs)/bottlings/page.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/(tabs)/releases/releaseTable.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/bottlingModActions.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/bottlings/[bottlingId]/page.tsx`
- `apps/web/src/app/(layout-free)/addBottle/addBottleFlow.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/addTasting/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/bottlings/[bottlingId]/edit/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/bottlings/new/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/edit/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/releases/[releaseId]/edit/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/new/page.tsx`

Shared UI and client helpers:

- `apps/web/src/components/bottleCard.tsx`
- `apps/web/src/components/bottleForm.tsx`
- `apps/web/src/components/bottleResolver/helpers.ts`
- `apps/web/src/components/bottleResolver/index.tsx`
- `apps/web/src/components/bottleResolver/states.tsx`
- `apps/web/src/components/bottleResolver/types.ts`
- `apps/web/src/components/bottleReviews.tsx`
- `apps/web/src/components/bottleTable.tsx`
- `apps/web/src/components/collectionAction.tsx`
- `apps/web/src/components/releaseField.tsx`
- `apps/web/src/components/releaseForm.tsx`
- `apps/web/src/components/tastingForm.tsx`
- `apps/web/src/lib/addBottle.ts`
- `apps/web/src/lib/bottlings.ts`

Admin exports and test protocol fixtures that encode release fields:

- `apps/web/src/app/(admin)/admin/(default)/queue/llmExport.ts`
- `apps/web/e2e/mock-rpc-server.mjs`
- `apps/web/e2e/rpc-fixtures.mjs`

## Documentation

- `docs/architecture/bottle-creation-alias-system.md`
- `docs/architecture/whisky-identity-model.md`
- `docs/development/production-debugging.md`
- `docs/features/photo-tasting-entry.md`
- `docs/features/store-price-matching.md`

## Cleanup verification

Cleanup must rerun the inventory command without the test/eval exclusions and
classify every remaining match as one of:

1. a permanent legacy redirect or promotion mapping;
2. retained migration/audit history;
3. a defect blocking removal.

Cleanup must also verify that exact Bottle serializers, search, details, and
other presentation paths remain correct without BottleGroup hydration, and
that every shared group writer atomically synchronizes complete member Bottle
identity, effective-age normalization, distiller joins, retained exact aliases,
collision rollback, and one existing Bottle update audit row per affected
member.
