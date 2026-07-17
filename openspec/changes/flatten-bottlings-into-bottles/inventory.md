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

- `apps/server/src/orpc/routes/bottleReleases/create.ts` is the task 5.4a
  compatibility boundary. It retains legacy input/authentication, delegates to
  canonical concrete creation from an active source Bottle, emits measured
  write context, returns the exact CatalogTarget replacement, and must not
  insert BottleRelease or synthesize a release id.
- `apps/server/src/orpc/routes/bottleReleases/delete.ts` remains the legacy
  destructive implementation until task 5.4c defines canonical deletion and
  replaces it with a measured promotion-mapped adapter. It must not delegate to
  the current legacy Bottle delete route.
- `apps/server/src/orpc/routes/bottleReleases/details.ts`
- `apps/server/src/orpc/routes/bottleReleases/index.ts`
- `apps/server/src/orpc/routes/bottleReleases/list.ts`
- `apps/server/src/orpc/routes/bottleReleases/update.ts` remains the legacy
  direct writer until task 5.4b replaces it with a completed-promotion resolver
  plus exact-only canonical Bottle update. The adapter returns the exact target
  and never mirrors changes into BottleRelease.
- `apps/server/src/orpc/routes/index.ts`
- `apps/server/src/app.ts`

Bottle catalog and repair routes:

- `apps/server/src/orpc/routes/bottles/apply-age-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-dirty-parent-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/delete.ts`
- `apps/server/src/orpc/routes/bottles/release-repair-candidates.ts`
- `apps/server/src/orpc/routes/bottles/update.ts` is the task 5.3a thin
  moderator adapter. It accepts only strict shared/exact patches, delegates all
  writes to `updateConcreteBottle`, and returns the validated exact target.
- `apps/server/src/orpc/routes/bottles/edit-context.ts` is the task 5.3a
  mod-only form projection. It validates the selected exact target, reads
  shared choices from BottleGroup-owned ids and joins, and reads exact values
  from the selected Bottle so the live form never treats materialized Bottle
  drift as shared authority.
- `apps/server/src/orpc/routes/bottles/upsert.ts` is a translation-only
  compatibility route for the scraper caller in
  `apps/server/src/lib/scraper.ts`. A successful concrete create or update is
  reloaded as the retained legacy Bottle response and emits structured
  `bottle_upsert.compatibility` telemetry. Task 5.9 cuts the scraper and any
  remaining callers over to concrete target responses; task 9.7 removes this
  response adapter after measured traffic reaches zero.
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
- `apps/server/src/orpc/routes/prices/matchQueue/apply-bottle-repair.ts` is the
  task 5.3b thin moderator adapter. It retains the Bottle response consumed by
  the live queue UI while the price-match service composes proposal approval
  with the canonical concrete update transaction.
- `apps/server/src/orpc/routes/prices/matchQueue/create-bottle.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/resolve.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/utils.ts`

## Server services and writers

Catalog identity, aliases, search, creation, and updates:

- `apps/server/src/lib/scraper.ts` is the known caller of the legacy Bottle
  upsert response adapter. Task 5.9 moves it to concrete target responses before
  task 9.7 removes that measured adapter.
- `apps/server/src/lib/createBottle.ts` owns the shared Bottle preparation and
  persistence core plus the complete legacy and concrete transaction
  operations. Stable Bottle columns and distiller joins are durable exact-Bottle
  materialization and must remain synchronized by atomic group-wide writes.
- `apps/server/src/lib/createConcreteBottle.ts` owns the runtime-validated
  concrete creation service boundary used by future public adapters.
- `apps/server/src/lib/updateConcreteBottle.ts` is the authoritative moderator
  update domain service. Task 5.3a cuts over the standard route and live edit
  workflow. Task 5.3b composes price-match correction approval with its
  transaction and removes the proposal-specific updater; neither adapter may
  duplicate its business logic.
- Task 4.7 adds `apps/server/src/lib/mergeBottleGroups.ts` as the authoritative
  one-source-to-one-destination moderator group-merge service. It owns member
  rematerialization, generic consumer and stable-alias consolidation, tombstone
  retirement, reversible audits, and shared group aggregate recomputation.
- Task 4.9 adds `apps/server/src/lib/mergeConcreteBottles.ts` as the sole
  exact-duplicate merge owner. The moderator Bottle merge route invokes it
  synchronously; entity merge composes its transaction entry point and defers
  finalization until the entity transaction commits.
- Task 4.11a adds `aggregateCatalogTargetStatsInTransaction` in
  `apps/server/src/lib/recomputeCatalogTargetStats.ts` as the sole owner of
  raw-target tasting SQL and rating math.
  `apps/server/src/lib/recomputeBottleStats.ts` validates and overwrites one
  exact Bottle from its exact target only, while
  `apps/server/src/lib/recomputeBottleGroupStats.ts` validates the group graph
  and passes the generic plus all member exact targets to the same calculator.
  Neither service sums materialized Bottle totals.
- `apps/server/src/lib/catalogTargetStatsRepair.ts` owns the exact-target-only,
  paginated maintenance projection used by `bottles fix-stats`. It excludes
  generic targets and targetless legacy parent Bottles. The projection does not
  silently pre-filter graph errors: strict recomputation validates the active
  graph and target integrity and stops on an invalid row.
- `apps/server/src/lib/catalogTargets.ts` is the instrumented compatibility
  reader/writer from tasks 3.2/3.7. Its
  `resolveCatalogTargetForAssignment` boundary returns the validated target,
  group, and nullable exact-Bottle identity used by dual-write consumers.
  It replaces the removed ID-only assignment facade so consumers do not
  reconstruct or re-load target identity.
  Durable `targetId` values are authoritative; the measured legacy pair is used
  only when a compatibility row has no target. Retain that legacy branch
  through the task 9.5 read window and remove it under task 9.7.
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
- `apps/server/src/lib/priceMatchingProposals.ts` retains proposal validation,
  approval, price assignment, decision logging, observations, and listing-alias
  orchestration. Its task 5.3b correction composer maps the sparse legacy
  parent/stable draft to canonical shared and exact patches and invokes the
  transaction-scoped concrete update service. The superseded proposal-specific
  updater, including its direct entity, series, distiller, Bottle,
  BottleRelease-name, audit, and post-commit writes, is removed rather than
  retained as a second business system. Release creation elsewhere in this
  service remains until tasks 5.7 and 9.7.
- `apps/server/src/lib/pendingUploads.ts`

## Workers and queue payloads

- `apps/server/src/worker/jobs/createMissingBottles.ts`
- `apps/server/src/worker/jobs/index.ts`
- `apps/server/src/worker/jobs/indexBottleReleaseSearchVectors.ts`
- `apps/server/src/worker/jobs/onBottleChange.ts` refreshes Bottle details and
  search before queueing delayed exact Bottle and BottleGroup statistics. Before
  strict target-backed statistics activation, task 7.10 must stop or upgrade
  any producer that can enqueue a retired legacy parent and drain or expire
  those queued jobs because a retired parent has no active exact target.
- `apps/server/src/worker/jobs/updateBottleStats.ts` delegates exact
  recomputation to `recomputeBottleStats`, then delegates aggregate
  recomputation to `recomputeBottleGroupStats`.
- `apps/server/src/worker/jobs/updateBottleGroupStats.ts` is the generic-target
  entry point and delegates only to `recomputeBottleGroupStats`.
- `apps/server/src/worker/jobs/queueBottleEntityStats.ts` is the one shared
  downstream entity-aggregate refresh helper used by both statistics jobs.
  Both exact and generic tasting jobs carry the retained tasting `bottleId` as
  `entityStatsBottleId` only as compatibility context for the still-legacy
  entity aggregate. The exact job's separate `bottleId` is the validated exact
  Bottle scope for its durable `targetId`; the compatibility Bottle does not
  affect generic group calculation.
  Each statistics event independently queues an idempotent downstream entity
  refresh without stable-key coalescing; successful jobs are removed and failed
  jobs are retained. Task 7.10 replaces this bridge with target-aware
  queue/entity aggregation, task 9.6 removes its obsolete consumer
  `bottleId`/`releaseId` storage, and task 9.7 removes the runtime compatibility
  branch.
- `apps/server/src/orpc/routes/tastings/dispatchStatsRecompute.ts` maps a
  validated target descriptor to one independently queued, delayed idempotent
  exact-or-group job per qualifying event. Completed jobs are removed;
  publication failure is logged with tasting and target identity and does not
  fail a committed tasting mutation.
- The worker registry logs and rethrows handler failures to BullMQ. Statistics
  jobs remove completed records but retain failed records, so a failed
  canonical or downstream entity refresh is observable and retryable.
- `UpdateBottleStats` intentionally rejects its previous `{ bottleId }` payload:
  that legacy identity cannot infer whether activity belongs to a promoted
  exact target. Before the target-backed worker is enabled, every old producer
  must be stopped or upgraded and queued legacy payloads must be drained or
  expired. Legacy-parent `OnBottleChange` producers and queued jobs must likewise
  be stopped or upgraded and drained or expired before activation. Task 7.10
  owns verification of this mixed-version queue gate, while task 7.7 owns
  aggregate parity evidence and cutover approval.
- Tasting create persists a resolved target. Update and delete trust a durable
  `targetId`; only null-target compatibility rows resolve the measured legacy
  `(bottleId, releaseId)` pair, and update persists the resolved target. Create,
  delete, rating-changing update, and null-target repair dispatch statistics;
  a notes-only update to a durable-target row does not. The old route-inline
  Bottle formulas and worker-owned `bottleId` tasting query are removed. There
  is no legacy statistics fallback.
- This is only the task 5.6a tasting subset. Remaining review, collection,
  flight, and price mutation dual-writes keep task 5.6 open. These commits are
  review boundaries, not independently deployable or servable application
  states. In the controlled production migration, the fresh retained audit must
  identify the exact Git and migration revisions and be approved immediately
  before any production backfill begins. The target-backed statistics path must
  not serve until promotion and consumer target backfill are complete, required
  target nulls and graph errors are zero, and task 7.7 has retained matching
  target/legacy aggregate evidence plus deployment approval. Constraint and
  cleanup gates require a newly generated retained production audit from their
  exact Git and migration revisions, including generation time, database,
  reconciled counts, and explicit approval; the task 6.13 pre-backfill report
  cannot satisfy that later freshness gate.
- `apps/server/src/worker/jobs/mergeBottle.ts` is a measured compatibility
  adapter for queued pre-cutover payloads. It validates and translates the old
  payload into `mergeConcreteBottles` transaction calls and owns no merge
  business logic. Remove its registration and job type under task 9.7 after the
  compatibility queue is drained.
- `apps/server/src/worker/jobs/mergeEntity.ts`
- `apps/server/src/worker/jobs/onBottleAliasChange.ts`
- `apps/server/src/worker/jobs/onBottleReleaseChange.ts`
- `apps/server/src/worker/types.ts`

## CLI

- `apps/cli/src/commands/bottles.ts`: `bottles fix-stats` selects exact-target
  rows and directly dispatches their Bottle ids to the strict exact statistics
  worker. Strict recomputation validates the active graph and target integrity
  and stops on an invalid row rather than silently skipping it. This explicit
  maintenance scope does not use the tasting assignment descriptor, which
  distinguishes exact from generic user intent.
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
