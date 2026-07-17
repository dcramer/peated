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
- `apps/server/src/orpc/routes/bottleReleases/delete.ts` is the task 5.4c
  measured, promotion-mapped compatibility boundary. It retains the external
  admin authorization, path, input, and output contract, but a completed
  mapping makes no mutation and returns an actionable merge-required result
  naming the mapped Bottle and exact target. A missing, incomplete, or
  inconsistent mapping conflicts. It never guesses a representative, sibling,
  or generic target and never deletes the retained BottleRelease row. Tasks 9.4
  and 9.7 disable and remove the adapter.
- `apps/server/src/orpc/routes/bottleReleases/details.ts`
- `apps/server/src/orpc/routes/bottleReleases/index.ts`
- `apps/server/src/orpc/routes/bottleReleases/list.ts`
- `apps/server/src/orpc/routes/bottleReleases/update.ts` is the task 5.4b
  measured compatibility boundary. It requires a completed promotion mapping,
  translates only supplied legacy fields into a sparse exact patch, and
  delegates to the canonical concrete Bottle update operation used by the
  standard Bottle route. Omitted fields remain unchanged; explicit null clears
  the nullable canonical value, including a null `imageUrl`, while non-null
  `imageUrl` is rejected. It returns the exact CatalogTarget replacement and
  leaves BottleRelease unchanged, with no parallel direct alias, audit, or job
  writes. Successful telemetry records the legacy release id and replacement
  Bottle and target ids. Tasks 9.4 and 9.7 disable and remove the adapter.
- `apps/server/src/orpc/routes/index.ts`
- `apps/server/src/app.ts`

Bottle catalog and repair routes:

- `apps/server/src/orpc/routes/bottles/apply-age-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-dirty-parent-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/apply-release-repair.ts`
- `apps/server/src/orpc/routes/bottles/delete.ts` is retained only as a measured
  compatibility purge for ungrouped pre-migration Bottles. Grouped concrete
  Bottles are rejected without mutation with an actionable merge-required
  result; their retirement requires an explicit destination through
  `mergeConcreteBottles`. Task 9.7 removes this compatibility branch.
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
- `apps/server/src/orpc/routes/bottleAliases/upsert.ts` is the task 5.5a thin
  moderator adapter. Its Bottle input is exact intent; it resolves the active
  exact CatalogTarget and delegates alias persistence to the canonical
  target-aware assignment owner. It never infers a stable group alias.
- `apps/server/src/orpc/routes/bottleAliases/delete.ts` unassigns the alias row by
  clearing its durable target and retained legacy pair together. Task 5.6b owns
  clearing all three identity fields from a target-aware Review or StorePrice
  whose authoritative `targetId` matches the alias snapshot, even if its
  retained pair differs. A targetless consumer matches only by retained-pair
  equality. Independently retargeted and different targetless-pair consumers
  are preserved.
- `apps/server/src/orpc/routes/bottleAliases/list.ts` and
  `apps/server/src/orpc/routes/bottleAliases/update.ts` retain their current read
  and ignored-state contracts until the broad target-backed read cutover in task
  7.3.

Target-bearing consumer routes:

- `apps/server/src/orpc/routes/collections/bottles/create.ts` is the task 5.6d
  direct collection membership writer. It resolves and locks one validated
  exact or generic target before membership, writes no new targetless rows,
  upgrades a matching targetless legacy-pair row, and conflicts when that pair
  is owned by a different durable target. When a canonical row and matching
  targetless duplicate coexist, the canonical row wins with only blank-image
  fill from the compatibility row and an atomic count correction; status,
  ownership, and other unit state are preserved.
- `apps/server/src/orpc/routes/collections/bottles/delete.ts` is the task 5.6d
  target-aware removal boundary for release-specific and `baseOnly` requests.
  When a target resolves, it locks that target first, deletes its authoritative
  membership plus a matching targetless legacy fallback, and preserves
  different durable targets. An ungrouped parent or release without completed
  promotion may delete only its matching null-target retained-pair row as
  measured staged compatibility, never a durable target; section 6 backfills
  those rows and task 9.7 removes the fallback. A request with neither `release`
  nor `baseOnly` remains measured retained-parent family-delete compatibility
  assigned to task 9.7 because it intentionally spans multiple memberships;
  exact UI removal uses `baseOnly`.
- `apps/server/src/orpc/routes/collections/bottles/imageHelpers.ts`
- `apps/server/src/orpc/routes/collections/bottles/list.ts` remains a retained
  pair read until task 7.3. Existing-row collection target backfill remains
  section 6, and pair storage/removal remains tasks 9.6/9.7.
- `apps/server/src/orpc/routes/reviews/create.ts` is a direct user/API Review
  writer assigned to task 5.6c. For known exact or generic intent it resolves
  one descriptor, locks/revalidates it before Review mutation, writes the
  complete target and retained-pair tuple atomically, and supplies the same
  target to applicable alias assignment. Its conflict/upsert cannot downgrade
  an existing durable target with an unresolved current result or mix identity
  fields from different decisions. If an existing different complete tuple wins
  the conflict, the route neither creates nor reassigns an alias and records no
  decision evidence for the rejected incoming identity. Known mapped resolution
  failures are errors; genuinely unresolved and classifier-created unpromoted
  references remain explicitly targetless until tasks 5.8/5.9. Shared
  alias-driven Review propagation remains task 5.6b.
- `apps/server/src/orpc/routes/reviews/list.ts`
- `apps/server/src/orpc/routes/reviews/update.ts` is the task 5.6c direct Review
  mutation boundary. It snapshots Review identity, resolves and locks the
  authoritative CatalogTarget first when one applies, and then locks the
  Review. It writes only when the locked tuple matches that snapshot; a
  mismatch rolls back and causes a bounded retry from a fresh snapshot. It
  clears `targetId` and the retained pair together for an explicit association
  clear, validates and writes a complete tuple for identity correction, and
  preserves a durable target for non-identity updates. Only a currently null
  target may be measured-repaired from its retained pair; an unresolvable
  staged legacy row remains targetless. Review reads remain task 7.3.
- `apps/server/src/orpc/routes/flights/targetAssignments.ts` is the task 5.6e
  shared assignment boundary for staged Flight Bottle-id input. It resolves
  every submitted `(bottleId, null)` intent through deterministic legacy
  cardinality, preserves generic targets without representative substitution,
  and canonicalizes duplicate target selections with the lowest retained Bottle
  id.
- `apps/server/src/orpc/routes/flights/create.ts` is the task 5.6e direct Flight
  creation writer. It locks the canonical requested target set before creating
  the Flight or membership, writes the validated `targetId` with the submitted
  retained Bottle id and null release id, and rolls back rather than creating a
  targetless row for an invalid or staged selection.
- `apps/server/src/orpc/routes/flights/update.ts` is the task 5.6e direct Flight
  replacement writer. An omitted Bottle list preserves membership, an explicit
  empty list clears it, and any supplied list fully replaces it. Before
  deletion, it snapshot-compares membership while locking the requested and
  existing durable target union ahead of the Flight and membership rows; a
  change retries from a fresh snapshot. A stable replacement removes existing
  durable and targetless rows and inserts only the canonical requested target
  set. Reads, existing-row backfill, target-native input, and pair cleanup remain
  tasks 7.3, section 6, 8.7, and 9.6/9.7 respectively; this slice makes no
  deployment claim.
- `apps/server/src/orpc/routes/tastings/create.ts`
- `apps/server/src/orpc/routes/tastings/delete.ts`
- `apps/server/src/orpc/routes/tastings/list.ts`
- `apps/server/src/orpc/routes/tastings/photo-identification-create.ts`
- `apps/server/src/orpc/routes/tastings/photo-identification.ts`
- `apps/server/src/orpc/routes/prices/create-batch.ts` is a direct StorePrice
  ingestion writer assigned to task 5.6f. Its existing exact-alias branch is an
  affected task 5.6b caller: through the legacy exact target-aware alias input,
  it passes the validated exact `targetId` plus the explicit retained
  `(bottleId, null)` pair so matching consumers receive target-aware
  propagation. It does not construct a CatalogTargetAssignmentDescriptor;
  descriptor-based generic, unmatched, and direct-ingestion redesign remains
  the other task 5.6f sub-slice after the automated ignored-assignment clear.

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
  transaction and removes the proposal-specific updater. Task 5.4b maps a
  completed legacy promotion to a sparse exact patch over the same operation;
  none of these adapters may duplicate its business logic or issue parallel
  alias, audit, or job writes.
- Task 4.7 adds `apps/server/src/lib/mergeBottleGroups.ts` as the authoritative
  one-source-to-one-destination moderator group-merge service. It owns member
  rematerialization, generic consumer and stable-alias consolidation, tombstone
  retirement, reversible audits, and shared group aggregate recomputation.
- Task 4.9 adds `apps/server/src/lib/mergeConcreteBottles.ts` as the sole
  exact-duplicate merge and grouped exact-Bottle retirement owner. Every
  retirement requires an explicit surviving Bottle. The service owns exact
  consumer consolidation, promotion-mapping repointing, aliases and tombstones,
  representative replacement, and singleton group retirement; it never infers
  a representative, sibling, or generic destination. The moderator Bottle merge
  route invokes it synchronously; entity merge composes its transaction entry
  point and defers finalization until the entity transaction commits.
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
  Its batch assignment lock owns the global BottleGroup, exact-Bottle, then
  CatalogTarget hierarchy for set-based writers and revalidates every
  descriptor after acquiring the complete lock set.
  It replaces the removed ID-only assignment facade so consumers do not
  reconstruct or re-load target identity.
  Task 5.5b uses one measured legacy-pair resolution from this boundary for
  existing-match and correction approvals and reuses its descriptor for the
  alias and observation; exact/generic selection follows the promotion and
  parent-cardinality rules. A locked alias integrity check validates that
  descriptor rather than resolving another semantic intent. Create-new approval
  cannot use this path while it creates ungrouped legacy rows; task 5.5c cuts it
  over after task 5.7 supplies a newly created concrete target.
  Durable `targetId` values are authoritative; the measured legacy pair is used
  only when a compatibility row has no target. Retain that legacy branch
  through the task 9.5 read window and remove it under task 9.7.
  Task 5.6c uses this boundary once for direct Review exact or generic intent,
  then revalidates and locks that descriptor before locking and mutating the
  Review. Review update accepts the mutation only when its subsequently locked
  identity still matches the snapshot used for resolution; otherwise it rolls
  back and retries from a fresh snapshot. A durable target is never reconstructed
  from the retained pair; only a null-target Review may use the measured pair for
  compatibility repair, without substituting a group representative.
- `apps/server/src/lib/bottleAliases.ts` is the task 5.5a canonical assignment
  owner for the exact/moderator alias path. An explicit exact target is validated
  and stored. Its measured targetless compatibility mode does not resolve a
  CatalogTarget and may write `targetId` as null, but it preserves an existing
  durable target instead of downgrading it to a legacy pair. Later task 5.5
  caller slices supply explicit exact or generic targets; task 9.7 removes the
  targetless mode. Task 5.6b extends this transaction's existing matching
  StorePrice and Review propagation: a supplied exact or generic descriptor, or
  the validated legacy exact `targetId` input, atomically writes its target and
  retained pair to those consumers, while targetless compatibility can update
  only targetless consumers. The alias assignment input owns the retained pair
  separately from any CatalogTarget descriptor. Generic assignment never
  selects the representative Bottle. When canonical assignment creates a new
  alias, its post-commit finalizer queues `IndexBottleAlias` directly because
  consumer synchronization already occurred; it does not queue
  `OnBottleAliasChange`. Existing-alias assignment need not enqueue alias
  indexing.
- `apps/server/src/lib/bottleCreationDrafts.ts`
- `apps/server/src/lib/bottleFinder.ts` owns target-aware exact alias resolution.
  A non-null exact target returns its Bottle, while a generic target returns no
  Bottle and never becomes a representative; only a null-target alias may use
  the measured legacy pair fallback. Broad target-backed alias reads and Bottle
  search/index replacement remain tasks 7.3 and 7.5.
- `apps/server/src/lib/bottleReferenceCandidates.ts`
- `apps/server/src/lib/bottleReferenceResolution.ts`
- `apps/server/src/lib/bottleReleaseIdentity.ts`
- `apps/server/src/lib/bottleSchemaRules.ts`
- `apps/server/src/lib/createBottleRelease.ts`
- `apps/server/src/lib/db.ts` still owns the raw legacy-pair
  `upsertBottleAlias` writer. It remains active for
  `createBottle.ts`, `createBottleRelease.ts`,
  `applyDirtyParentReleaseRepair.ts`, `applyLegacyReleaseRepair.ts`,
  `bottleReferenceResolution.ts`,
  `repairBottleBrandDistilleryAssignments.ts`, and
  `worker/jobs/mergeEntity.ts`, with direct coverage in `lib/db.test.ts`.
  Active CLI callers also include the Bottle `fix-names` command and the price
  and review `backfill-aliases` commands, while Bottle `normalize` and review
  `backfill-aliases` contain direct bound and unbound alias inserts respectively.
  These creation, repair, import/reference-resolution, and entity-merge callers
  and CLI maintenance paths are outside task 5.5a; later task 5.5 caller slices
  migrate them to explicit targets and task 9.7 removes the raw writer and
  direct legacy-pair/unbound inserts.
- `apps/server/src/lib/format.ts`
- `apps/server/src/lib/search.ts`

Repair and migration-adjacent services:

- `apps/server/src/lib/applyDirtyParentAgeRepair.ts`
- `apps/server/src/lib/applyDirtyParentReleaseRepair.ts`
- `apps/server/src/lib/applyLegacyReleaseRepair.ts` is a task 5.4c
  compatibility-only repair owner. Its preflight and locked transactional reads
  require `groupId IS NULL`, so it cannot repair or delete a grouped Bottle;
  grouped retirement uses explicit exact Bottle merge. Task 9.7 removes it.
- `apps/server/src/lib/applyRepairBackfillProposals.ts`
- `apps/server/src/lib/canonRepairCandidates.ts`
- `apps/server/src/lib/dirtyParentAgeRepairCandidates.ts`
- `apps/server/src/lib/legacyReleaseRepairCandidates.ts` is the matching
  compatibility-only discovery owner. It offers only legacy parents with
  `groupId IS NULL` and never presents grouped Bottles for release repair. Task
  9.7 removes this discovery path.
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
  service remains until tasks 5.7 and 9.7. For task 5.5b,
  `applyApprovedStorePriceMatchInTransaction` and
  `applyStorePriceBottleRepairFromProposal` are the existing-match and
  correction orchestrators. Each owns its one measured legacy-pair resolution
  through `resolveCatalogTargetForAssignment` and takes the CatalogTarget
  identity locks before the proposal/price and alias/consumer locks in its
  transaction. `applyApprovedStorePriceMatchProposalInTransaction` does not
  resolve semantic intent; it requires the supplied target assignment and
  atomically passes it to `assignBottleAliasInTransaction` while
  `upsertStorePriceObservationInTransaction` persists the same `targetId`.
  Either both target-backed identities commit or the approval rolls back.
  Existing price assignment, proposal state, decision log vocabulary, and
  their retained legacy pair are unchanged.
  Create-new approval still creates ungrouped Bottle/BottleRelease rows and
  retains measured targetless alias/observation writes. As the authoritative
  direct writer for its locked selected StorePrice, it first replaces only that
  row with the newly created legacy pair and `targetId: null`; this explicit
  selected-row mutation is distinct from name-wide targetless alias
  propagation, which cannot downgrade any other durable consumer. This is
  compatibility, not compliant target-backed behavior. Task 5.7 replaces its
  legacy creation and decision vocabulary, then task 5.5c assigns the newly
  created concrete target to both records. Task 5.6b owns StorePrice and Review
  propagation reached through canonical alias assignment; task 5.6f owns direct
  price-row identity writers, including automated assignment clears that
  previously cleared only the retained pair.
  The first task 5.6f sub-slice makes
  `clearIgnoredStorePriceAssignmentInTransaction` snapshot and conditionally
  clear the complete `{ targetId, bottleId, releaseId }` tuple. A durable exact
  or generic target is resolved and locked through the global BottleGroup,
  exact-Bottle when present, then CatalogTarget hierarchy before proposal and
  StorePrice mutation. A targetless compatibility tuple may clear without
  inventing a target. One null-safe compare-and-set clears all three columns
  only if none changed; target-only or pair-only drift preserves the current
  tuple. When target resolution fails after a concurrent merge changed that
  tuple, the changed assignment is preserved. A tokenless resolver or the
  current active processing-lease owner is authorized; only for that resolver
  does the same failure against an unchanged tuple remain an integrity error
  instead of falling back to a pair-only clear. A stale resolver that lost its
  lease returns the replacement owner's current proposal and preserves the
  StorePrice tuple without clearing it or surfacing the stale target failure.
  Existing processing-lease behavior is unchanged. Direct create-batch
  ingestion remains the other task 5.6f sub-slice. Task 5.6b retains
  alias-driven propagation, tasks 5.7/5.5c retain create-new approval, task 7.3
  owns target-backed reads, section 6 owns existing-row backfill, broader
  repair/caller cutovers remain outside this sub-slice, task 9.6 removes
  retained consumer pairs, and task 9.7 removes measured targetless/legacy
  resolution. This review boundary makes no deployment or activation claim.
- `apps/server/src/lib/pendingUploads.ts`

## Workers and queue payloads

- `apps/server/src/worker/jobs/createMissingBottles.ts` may create unresolved
  classifier Review rows before classifier and worker creation can produce a
  valid concrete CatalogTarget. Those rows remain explicitly targetless in task
  5.6b; tasks 5.8/5.9 own their target-producing cutover rather than selecting a
  representative or other arbitrary exact Bottle.
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
- `apps/server/src/worker/jobs/onBottleAliasChange.ts` remains only for raw alias
  producers. It delegates to the canonical alias-consumer synchronization owner
  before indexing. A generic replay first resolves the retained legacy pair
  through measured assignment and requires that result to equal the alias's
  stored generic target; invalid, cross-group, or release-bearing exact
  mismatches fail without consumer writes. A targetless replay locks the
  retained Bottle lifecycle, then locks any non-null retained BottleRelease and
  validates that it belongs to that Bottle before consumer locks. A missing or
  mismatched release fails without consumer writes or alias indexing. The worker
  then revalidates and locks the alias snapshot after consumer locks. This
  measured targetless compatibility adapter is removed under task 9.7 and does
  not own a second propagation algorithm.
- `apps/server/src/worker/jobs/onBottleReleaseChange.ts`
- `apps/server/src/worker/types.ts`

## CLI

- `apps/cli/src/commands/bottles.ts`: `bottles fix-stats` selects exact-target
  rows and directly dispatches their Bottle ids to the strict exact statistics
  worker. Strict recomputation validates the active graph and target integrity
  and stops on an invalid row rather than silently skipping it. This explicit
  maintenance scope does not use the tasting assignment descriptor, which
  distinguishes exact from generic user intent. The same file's `fix-names`
  command still calls the raw pair `upsertBottleAlias`, and `normalize` directly
  inserts a Bottle-bound alias without `targetId`.
- `apps/cli/src/commands/prices.ts`: `prices backfill-aliases` still calls the
  raw pair `upsertBottleAlias` for Bottle-bound price names.
- `apps/cli/src/commands/reviews.ts`: `reviews backfill-aliases` calls the raw
  pair `upsertBottleAlias` for Bottle-bound review names and directly inserts
  an unbound alias for reviews without a Bottle.
- These CLI alias maintenance paths are explicitly assigned to later task 5.5
  caller slices; task 9.7 removes their raw pair and unbound writes after
  target-aware replacements are active.
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

Task 5.4c removes or hides Bottle/BottleRelease delete actions that can only
produce the merge-required compatibility response. Task 8.9 removes the nested
Bottling UI after redirects are active, and task 9.7 removes the remaining
compatibility branches after measured traffic reaches zero.

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
