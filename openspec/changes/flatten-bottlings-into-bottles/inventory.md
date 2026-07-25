# Direct-Bottle Cutover Inventory

Baseline:

- Branch: `feat/flatten-bottlings-first-slice`
- Contract-correction baseline: `13a39c25b59de038f7e3046f4ff0601d561dee14`
- Tracking issue: GH-483
- Change: `flatten-bottlings-into-bottles`

The unreleased CatalogTarget implementation touches 121 server runtime files
plus database schema, generated migrations, CLI, web, tests, generated clients,
and documentation. It is a second identity system and must be removed rather
than retained beside direct Bottle ownership.

Reproducible inventory commands:

```sh
rg -l -S 'CatalogTarget|catalogTarget|catalog_target|targetId|target_id|currentTarget|suggestedTarget' \
  apps packages docs openspec

rg -l -S 'releaseId|release_id|bottle_release|BottleRelease|bottleReleases' \
  apps packages docs openspec
```

## Database And Generated Migration

Primary schema owners:

- `apps/server/src/db/schema/bottles.ts`
- `apps/server/src/db/schema/collections.ts`
- `apps/server/src/db/schema/flights.ts`
- `apps/server/src/db/schema/incomingBottleDecisionLogs.ts`
- `apps/server/src/db/schema/reviews.ts`
- `apps/server/src/db/schema/stores.ts`
- `apps/server/src/db/schema/tastings.ts`

Remove:

- `catalog_target`;
- Bottle exact-target and BottleGroup generic-target relations;
- `targetId`, `currentTargetId`, and `suggestedTargetId` columns, relations,
  indexes, constraints, and inferred types;
- generic/exact target membership constraint tests.

Retain:

- BottleGroup and group distillers;
- `Bottle.groupId`, representative membership, aggregate fields, and required
  group tombstones;
- Bottle tombstones used for exact Bottle merge;
- durable BottleRelease promotion mapping;
- direct consumer `bottleId` foreign keys;
- legacy `releaseId` columns as historical evidence until cleanup.

Generated files to rebuild from the last shipped migration:

- `apps/server/migrations/0193_brave_spectrum.sql`
- `apps/server/migrations/0194_polite_ben_parker.sql`
- `apps/server/migrations/meta/0193_snapshot.json`
- `apps/server/migrations/meta/0194_snapshot.json`
- `apps/server/migrations/meta/_journal.json`

Because 0193/0194 are unreleased, regenerate them without creating and then
dropping CatalogTarget in a third migration.

## Migration Runtime And CLI

Current target-oriented owners:

- `apps/server/src/lib/catalogMigrationBackfill.ts`
- `apps/server/src/lib/catalogMigrationFamilyTargets.ts`
- `apps/server/src/lib/catalogMigrationAliasObservationBackfill.ts`
- `apps/server/src/lib/catalogMigrationConsumerBackfill.ts`
- `apps/server/src/lib/catalogMigrationOrchestrator.ts`
- `apps/server/src/schemas/catalogMigrationRun.ts`
- corresponding focused and integration tests
- `apps/cli/src/commands/catalogMigration.ts`
- `apps/cli/src/commands/catalogMigrationRuntime.ts`
- corresponding CLI tests and command registration

Replace these with:

- the retained read-only audit and revision evidence;
- one family materialization planner;
- one direct legacy-reference resolver:
  - release present -> mapped promoted Bottle;
  - release absent -> retained parent Bottle;
- one fixed-lock-order, fail-fast database transaction;
- one retained postflight report.

Remove:

- generic/exact target planning;
- target assignment metrics;
- per-family partial commits;
- three-phase orchestration;
- cursor/checkpoint resume state;
- filesystem report locks;
- target parity runtime;
- target conflict vocabulary.

Keep these target-independent audit owners:

- `apps/server/src/lib/catalogMigrationAudit.ts`
- `apps/server/src/schemas/catalogMigrationAudit.ts`
- `apps/server/src/lib/catalogMigrationRevision.ts`
- their tests.

## Server Runtime

### Identity core

- `apps/server/src/lib/catalogTargets.ts`
- `apps/server/src/lib/catalogTargetReadParity.ts`
- `apps/server/src/schemas/catalogIdentity.ts`
- `apps/server/src/serializers/catalogIdentity.ts`
- target/page-target Bottle routes

Delete target loading, discriminated exact/group identity, legacy target
resolution, and shadow parity. Direct Bottle loaders and serializers remain.

### Bottle and BottleGroup domain

- creation, conflict, update, Bottle merge, group merge/split, group reads, and
  consumer consolidation services under `apps/server/src/lib/`
- Bottle and BottleGroup oRPC routes and serializers
- BottleRelease compatibility routes

Creation stops creating target rows. Group operations become internal
membership/presentation operations and never repoint activity. Exact Bottle
merge repoints direct consumer Bottle ids. BottleRelease adapters resolve the
promotion mapping and delegate.

### Direct consumer writers

- tasting create/update/delete and photo identification
- review create/update
- collection create/delete
- Flight assignment/create/update
- StorePrice ingestion, match, proposal, attempt, approval, and clear flows
- alias/observation assignment and propagation
- incoming decision logging

Each canonical operation validates and writes one Bottle id. Group-only
classifier evidence remains non-assigning.

### Consumer reads

Affected serializers:

- `collectionBottle.ts`
- `flight.ts`
- `notification.ts`
- `review.ts`
- `storePrice.ts`
- `tasting.ts`

Affected read families include Bottle/price/alias lists, Library, reviews,
tastings, Flights, activity, incoming decisions, and match-proposal moderation.
They hydrate Bottles directly and remove exact/group branches.

### Statistics, workers, and analytics

Remove target indirection from:

- CatalogTarget statistics and repair services;
- Bottle/BottleGroup recomputation;
- tasting statistics dispatch;
- `UpdateBottleStats`, `UpdateBottleGroupStats`, `OnBottleChange`, alias,
  reconciliation, indexing, notification, and entity-stat workers;
- badges;
- Library, country, entity, global, user, flavor, and region analytics.

Bottle jobs carry `bottleId`. Group jobs carry `groupId`. Group totals query raw
member-Bottle activity.

### Shared fixtures

`apps/server/src/lib/test/fixtures.ts` and route/service fixtures must stop
creating target graphs for ordinary Bottles. Explicit migration fixtures retain
legacy parent/release pairs.

## Web And Generated Clients

Primary target UI owners:

- `apps/web/src/lib/catalogTarget.ts`
- `apps/web/src/components/catalogTargetIdentity.tsx`
- tasting, collection, Library, Flight, price, review, and photo flows
- `apps/web/src/lib/addBottle.ts`
- `(layout-free)/addBottle/addBottleFlow.tsx`
- Bottle related-release pages and group workflows
- generated OpenAPI/client contracts in `packages/api`

Cutover:

- forms and actions carry Bottle ids;
- remove group query/prefill authority;
- remove generic activity buttons and exactness copy;
- related-release pages show member Bottles and member-derived aggregates;
- remove manual group merge/split controls;
- keep user-facing “Similar bottles” or “Other releases” copy;
- preserve nested BottleRelease redirects;
- regenerate client types without CatalogTarget.

## Documentation

Rewrite:

- `docs/architecture/whisky-identity-model.md`
- `docs/architecture/bottle-creation-alias-system.md`
- `docs/architecture/rating-systems.md`
- `docs/development/schema-conventions.md`
- `docs/features/bottle-entry-workflow.md`
- `docs/features/photo-tasting-entry.md`
- `docs/features/store-price-matching.md`
- `docs/features/simple-rating-system.md`

Remove CatalogTarget and generic activity semantics while preserving automatic
groups and independently complete Bottles.

## Implementation Slices

1. Schema source and generated migration.
2. Migration transaction and retained audit.
3. Identity core plus Bottle/Group domain.
4. Direct consumer writers.
5. Prices, aliases, classifier, and resolution.
6. Consumer reads, notifications, and generated API.
7. Statistics, workers, badges, and analytics.
8. Web workflows and related-release UX.
9. Fixtures, tests, docs, final inventory, and visual QA.

Agents assigned to a slice must not edit files owned by another concurrent
slice. Verification agents are no-edit and report commands, status, concise
results, failure locators, and skipped checks only.

## Acceptance Criteria

- No runtime `CatalogTarget`, `catalog_target`, or consumer target-id reference.
- No activity or integration selects BottleGroup.
- Parent-only legacy references remain on the parent Bottle.
- Release-specific legacy references resolve to promoted Bottles.
- Every Bottle is independently complete.
- Group aggregate activity equals raw member-Bottle activity once.
- Group moves preserve Bottle ids and consumer references.
- Exact Bottle merge owns all consumer repointing.
- BottleRelease compatibility only translates and delegates.
- Revised generated migration is additive and reviewed.
- Focused DB/API/web tests, server/web typechecks, lint/format, OpenSpec
  validation, diff check, and constrained visual QA pass.
