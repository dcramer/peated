# Legacy BottleRelease Inventory

This is the source inventory for the compatibility and cleanup gates. It was
recaptured on 2026-07-20 from production source files with:

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

| Surface                        | Legacy identity                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `bottle_release`               | Concrete release table, owned by `apps/server/src/db/schema/bottles.ts`                |
| `bottle_observation`           | `bottle_id`, nullable `release_id`                                                     |
| `bottle_alias`                 | nullable `bottle_id`, nullable `release_id`                                            |
| `tasting`                      | `bottle_id`, nullable `release_id`                                                     |
| `review`                       | nullable `bottle_id`, nullable `release_id`                                            |
| `collection_bottle`            | `bottle_id`, nullable `release_id`                                                     |
| `flight_bottle`                | `bottle_id`, nullable `release_id`                                                     |
| `store_price`                  | nullable `bottle_id`, nullable `release_id`                                            |
| `incoming_bottle_decision_log` | `target_id`, `bottle_id`, nullable `release_id`; historical release-shaped decisions   |
| `store_price_match_proposal`   | current/suggested targets and retained pairs, parent Bottle, release-shaped JSON draft |
| `store_price_match_attempt`    | historical current/suggested targets and retained Bottle/Release pairs                 |
| `pending_upload`               | `bottle_release_image` target kind                                                     |
| `change`                       | `bottle_release` object type and durable release-shaped payloads                       |
| `legacy_release_repair_review` | Retained review decisions for the removed legacy release-repair workflow               |

The `legacy_release_repair_review` table and its
`legacy_release_repair_review_resolution` enum have no live workflow after task
5.9, but remain generated database schema. Task 9.6 removes both through a
Drizzle-generated migration; task 9.7 verifies that no runtime schema export or
compatibility branch remains. No migration is generated in task 5.9.

### Section 6.7-6.9 remaining-consumer scope

After the task 6.5b/6.10 alias and observation phase, the remaining target
backfill comprises eight physical tables and ten independently resolved logical
slots:

| Physical table                 | Logical target slot(s)        | Stable migration locator                          |
| ------------------------------ | ----------------------------- | ------------------------------------------------- |
| `tasting`                      | `target_id`                   | `id`                                              |
| `review`                       | `target_id`                   | `id`                                              |
| `collection_bottle`            | `target_id`                   | `id`                                              |
| `flight_bottle`                | `target_id`                   | `(flight_id, bottle_id, release_id)` retained key |
| `store_price`                  | `target_id`                   | `id`                                              |
| `incoming_bottle_decision_log` | `target_id`                   | `id`                                              |
| `store_price_match_proposal`   | current and suggested targets | `id` plus the independently planned logical slot  |
| `store_price_match_attempt`    | current and suggested targets | `id` plus the independently planned logical slot  |

Each selected slot keeps its Bottle/Release pair and every non-target value
unchanged. An optional slot whose Bottle and release are both null is outside
retained-family selection and remains entirely untouched, including preservation
of any existing target.
`parent_bottle_id`, release-shaped proposal JSON, decision vocabulary, and
created flags are compatibility evidence, not additional target slots.

`pending_upload` and `change` retain historical release-shaped kinds or
payloads but have no additive CatalogTarget column to populate. The retired
`legacy_release_repair_review` table likewise has no live target-bearing
workflow and remains assigned to generated cleanup in tasks 9.6/9.7. Activity
feeds are derived from target-bearing consumers rather than backed by a
separate paired-reference table; task 7.3 owns their read cutover and task 7.10
owns activity and queue payload identity.

The Drizzle owners are:

- `apps/server/src/db/schema/bottles.ts`
- `apps/server/src/db/schema/collections.ts`
- `apps/server/src/db/schema/enums.ts`
- `apps/server/src/db/schema/flights.ts`
- `apps/server/src/db/schema/incomingBottleDecisionLogs.ts`
- `apps/server/src/db/schema/pendingUploads.ts`
- `apps/server/src/db/schema/repairs.ts`
- `apps/server/src/db/schema/reviews.ts`
- `apps/server/src/db/schema/stores.ts`
- `apps/server/src/db/schema/tastings.ts`

## Runtime schemas and exported types

- `apps/server/src/schemas/bottleReleases.ts`
- `apps/server/src/schemas/bottles.ts`
- `apps/server/src/schemas/catalogMigrationAudit.ts`
- `apps/server/src/schemas/catalogMigrationRun.ts` owns the versioned external
  report/checkpoint, mode/status/cursor/count invariants, exact revision
  evidence, cumulative phase metrics, approval binding, and discriminated or
  composite sanitized failure contract with parent/checkpoint coherence for
  tasks 6.11-6.12. Task 10.10 removes this migration-only run schema after all
  required evidence is retained.
- `apps/server/src/schemas/collections.ts`
- `apps/server/src/schemas/index.ts`
- `apps/server/src/schemas/notifications.ts` owns a strict type-discriminated
  response contract. Friend-request, toast, and comment references remain
  nullable, while toast and comment references use a narrow notification-owned
  `{ id, target }` projection carrying the tasting id and one authoritative
  CatalogTarget.
- `apps/server/src/schemas/priceMatches.ts`
- `apps/server/src/schemas/reviews.ts`
- `apps/server/src/schemas/shared.ts`
- `apps/server/src/schemas/tastings.ts`
- `apps/server/src/types.ts`
- `packages/bottle-classifier/src/classifierTypes.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/localCatalog/schema.ts`

## Serializers and read models

- `apps/server/src/serializers/bottle.ts` now derives current-user favorite,
  Library, and tasted state only through each concrete Bottle's exact
  CatalogTarget. Generic targets and drifted retained Bottle ids cannot mark a
  representative or unrelated Bottle.
- `apps/server/src/serializers/bottleRelease.ts`
- `apps/server/src/serializers/collectionBottle.ts` now batch-hydrates the
  membership's authoritative CatalogTarget through the shared read-parity
  owner. Its response contains one required discriminated target and no
  BottleRelease-shaped nesting. A targetless membership is an integrity error;
  a retained-pair mismatch is evidence and cannot override the durable target.
  Current-user tasted state is likewise keyed by that target.
- `apps/server/src/serializers/flight.ts` keeps the bounded base Flight response
  target-free while its details serializer batch-hydrates ordered exact or
  generic membership targets with composite `flight_bottle` parity locators.
  Its Flight-specific projection adds target-owned distillers plus target-keyed
  Library and per-Flight tasted state without adding actor state to the shared
  CatalogTarget identity contract.
- `apps/server/src/serializers/review.ts` and
  `apps/server/src/serializers/tasting.ts` now hydrate their authoritative
  CatalogTargets and compare them with the retained pair through the shared
  parity reader. Tasting activity entries reuse the target-backed tasting
  serializer.
- `apps/server/src/serializers/storePrice.ts` now batch-hydrates each listing's
  nullable authoritative CatalogTarget and records retained-pair parity using
  the `store_price` row id. Price-change serialization loads its required exact
  or generic target without reconstructing a Bottle from the retained pair.
- `apps/server/src/lib/catalogTargetReadParity.ts` now correlates incoming
  Bottle decision-log resolution parity by the stable
  `incoming_bottle_decision_log` primary id. Completed parent/release promotion
  participates in semantic legacy comparison, but the retained pair remains
  evidence and cannot choose the returned target.
- `apps/server/src/lib/activityFeed.ts` passes raw collection memberships to
  the target-backed serializer; it no longer joins retained Bottle or
  BottleRelease identity for collection previews.
- `bottle_observation` has no outward route or serializer. Runtime access is
  limited to target-aware price-matching evidence writes, migration, and
  merge/consolidation operations, so task 7.3 does not require inventing an
  observation read surface. Activity routes already compose the target-backed
  Tasting and collection serializers. Parent tasks 7.1-7.3 remain open for
  proposals, adjacent analytics, and other actual readers.
- `apps/server/src/serializers/notification.ts` matches the discriminated
  notification contract at serialization time. Toast and comment references
  hydrate that narrow projection through the shared CatalogTarget parity reader,
  so exact and generic activity expose their durable target without a broad
  Tasting projection or legacy Bottle-shaped fallback. Friend-request
  references are actionable only when the referenced follow's sender and
  recipient match the notification identity; corrupt references fail closed.
- `apps/server/src/orpc/routes/users/library-stats.ts` is the task 7.1d-7.3d
  target-backed Library analytics reader. It uses each non-empty
  `collection_bottle.targetId` as sole identity and records retained-pair
  parity by stable collection-entry id. Exact targets contribute Bottle-owned
  age, category, and distillers; generic targets contribute the corresponding
  BottleGroup-owned fields without representative substitution. Targetless
  entries count only in the total and unstated-age bucket, while invalid
  nonnull targets fail closed. The route preserves privacy, non-empty
  filtering, count/order behavior, and response shape, performs no GET-side
  mutation, and makes no production activation claim.

`apps/server/src/orpc/routes/countries/categories.ts` is the task 7.3e
target-backed country category aggregate. It counts only active exact
CatalogTargets with valid Bottle/group membership, excluding generic,
targetless, Bottle-tombstoned, and BottleGroup-tombstoned identity. Category
and country membership come from the independently complete Bottle and its
Bottle-owned distillers; BottleGroup fields and representatives do not
participate. An exact Bottle counts once per country even when it has multiple
distillers in that country. `totalCount` is derived from the same category
population, including null category, and results use the shared nullable
category schema with deterministic ordering. The route preserves public
numeric-id and slug lookup, performs no GET-side mutation, and makes no
production activation claim. Because this catalog-wide aggregate has no
durable target/retained-pair consumer row, it does not invent task 7.1/7.2
row-parity evidence; task 7.11d owns its integration coverage.

`apps/server/src/orpc/routes/entities/categories/list.ts` is the task 7.3f
target-backed entity category aggregate. It counts only active exact
CatalogTargets with valid Bottle/group membership, excluding generic,
targetless, Bottle-tombstoned, and BottleGroup-tombstoned identity. Category
and brand, bottler, or distiller association come from the independently
complete Bottle; BottleGroup fields and representatives do not participate.
An exact Bottle counts once even when the requested entity fills multiple
roles. `totalCount` is derived from the same category population, including
null category, rather than materialized `entity.totalBottles`; results use the
shared nullable category schema with deterministic ordering. The route
preserves public entity lookup, not-found and empty behavior, performs no
GET-side mutation, and makes no production activation claim. Because this
catalog-wide aggregate has no durable target/retained-pair consumer row, it
does not invent task 7.1/7.2 row-parity evidence; task 7.11e owns its
integration coverage.

`apps/server/src/orpc/routes/stats.ts` is the task 7.3g target-backed global
Bottle aggregate. Its `totalBottles` value counts each active exact
CatalogTarget once through valid Bottle/group membership, excluding generic
targets, targetless Bottles, Bottle tombstones, and BottleGroup tombstones. It
does not substitute a representative Bottle or use BottleGroup-owned identity
as exact Bottle identity. The route preserves its raw Tasting and Entity row
totals, public response shape, and read-only behavior. Because this
catalog-wide aggregate has no durable target/retained-pair consumer row, it
does not invent task 7.1/7.2 row-parity evidence; task 7.11f owns its integration
coverage.

`apps/server/src/orpc/routes/users/details.ts` is the tasks 7.1e-7.3h
user-profile statistics cutover boundary. Before this slice, its
`stats.bottles` and `stats.collected` values count distinct retained Bottle ids.
The cutover reads the user's Tastings and collection entries in bounded
ascending-id batches, records target-versus-retained parity by stable Tasting
or collection-entry id, and derives both identity-distinct metrics only from
nonnull authoritative target ids. Exact and generic targets are separate
identities, while targetless rows never use their retained pair as aggregate
identity. Invalid nonnull targets fail closed as conflicts.

The same route preserves the underlying row scopes: every user Tasting
contributes to `stats.tastings`; every collection entry remains eligible for
`stats.collected` regardless of collection or status; and the case-insensitive
reserved Library keeps its non-empty total plus open and sealed row counts.
Targetless rows may contribute to the applicable Tasting and Library-status
totals but not to distinct target counts. User lookup, actor-aware serialization
and privacy, friend status, contribution counts, public response shape, and
read-only behavior remain unchanged. Retained Bottle/Release identity is
bounded parity telemetry only, never fallback or repair authority. Tasks 7.2e
and 7.11g own mismatch evidence and integration coverage.

`apps/server/src/lib/badges/` is the tasks 7.1f-7.3i target-backed badge
evaluation boundary. Before this slice, live award accepts a prehydrated Bottle
while rescan joins `tasting.bottleId` directly and each check duplicates its
in-memory rule with a SQL predicate. The cutover makes live award and bounded
ascending-id keyset rescan share one target-versus-retained parity hydrator and
one parsed in-memory check/tracker path. Exact targets use independently
complete Bottle ownership; generic targets use BottleGroup-owned fields without
representative substitution. The Bottle check and tracker remain exact-only,
and targetless, missing, retired, or inconsistent target identity fails closed.

The badge boundary removes the superseded per-check SQL predicate API and the
unused `apps/server/src/lib/badges/base.ts`; it retains one in-memory owner for
evaluation, tracking, XP, formulas, levels, and idempotency. Badge definitions,
stored checks and trackers, tracked-object schema, admin forms, and API
contracts remain unchanged. In particular, this slice performs no migration or
rewrite of a “Release” badge or any other badge configuration. Tasks 7.2f and
7.11h own row-correlated mismatch evidence and integration coverage.

`apps/server/src/orpc/routes/users/flavor-list.ts` and
`apps/server/src/orpc/routes/users/region-list.ts` are the tasks 7.1g-7.3j
target-backed user analytics readers. They share the bounded ascending-id
Tasting scanner in
`apps/server/src/orpc/routes/users/tasting-target-scan.ts`, also used by
`apps/server/src/orpc/routes/users/details.ts`. The scanner owns row-correlated
target-versus-retained parity and returns authoritative
exact Bottle or generic BottleGroup identity. Exact results use independently
complete Bottle-owned flavor and brand identity; generic results use
BottleGroup-owned values without representative substitution. Promoted legacy
releases remain exact target identity, while targetless rows contribute only to
the routes' existing totals. Invalid nonnull targets fail closed, and retained
pairs are evidence only and are never fallback or repair authority.

Region analytics deliberately attribute location through the target owner's
brand only. They aggregate equal country/region locations across brands,
preserve the country-with-null-region bucket, omit brand identities without a
country from classified results, and apply deterministic top-25 ordering.
Flavor analytics preserve total rating score and classified flavor counts and
scores with the same bounded scanner and deterministic limit. Both routes keep
their existing profile privacy and response contracts and perform no GET-side
mutation. Task 7.11i retains their exact/generic, promotion, targetless, drift,
invalid-target, batching, ordering, null-field, aggregation, and privacy
validation; it makes no production backfill, schema, deployment, or activation
claim.

No known retained Bottle-id user flavor or region analytics reader remains
after this cutover. The cleanup inventory remains open for other legacy
analytics discovered under parent tasks 7.1-7.3 and 7.11.

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
- `apps/server/src/orpc/routes/bottleReleases/list.ts` retains its legacy
  parent/release ids and BottleRelease response only as a task 9.7 compatibility
  projection. It lists completed promotion mappings, renders fields from the
  promoted ordinary Bottle, and applies query/sort/pagination through that
  Bottle's active exact search identity. It does not read
  `bottle_release.search_vector`, expose incomplete promotions, or return a
  Bottle/BottleGroup tombstoned identity.
- `apps/server/src/orpc/routes/bottleReleases/target.ts` is the task 7.8
  anonymous measured read adapter for legacy nested-Bottling redirects. It
  delegates the supplied parent/release pair to
  `loadCatalogTargetByLegacyReference`, requires an exact-Bottle response, and
  projects only that exact Bottle's positive id for the redirect consumer. It
  never selects a representative or generic target. Missing or mismatched pairs
  return not found, while incomplete, corrupt, or retired mappings conflict.
  Task 9.7 removes the adapter after measured redirect traffic is gone.
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

Bottle catalog routes:

- `apps/server/src/lib/bottleGroupReads.ts` is the BottleGroup read owner. Group
  list/details return only the generic CatalogTarget and group-owned aggregate
  statistics. Related-release listing is paginated and returns each member as
  an independently complete exact Bottle target, while stable-alias listing is
  paginated and selects only non-ignored aliases whose `targetId` directly owns
  the group's generic target. These reads fail closed on malformed target
  graphs, expose retired replacement identity through one discriminated 409
  payload, and never substitute the representative Bottle.
- `apps/server/src/orpc/routes/bottleGroups/` registers public list, details,
  related-Bottle, and stable-alias reads plus moderator-only merge, split, and
  presentation operations. The mutation routes are thin delegates to
  `mergeBottleGroups`, `splitBottleGroup`, and
  `updateBottleGroupPresentation`; they do not implement another grouping,
  shared-identity, aggregate, alias, or member-update system. Presentation
  input cannot change shared Bottle identity. Ordinary/manual Bottle creation
  still cannot select or reuse a group, and no route derives exact identity
  from a representative.
- `apps/server/src/openapi/spec.test.ts` locks the seven BottleGroup operations,
  their generic/exact/alias response boundaries, and their bounded moderator
  request shapes. This additive API surface is review slicing only: it makes no
  deployment, activation, production-audit, or backfill-execution claim.
- The former `apps/server/src/orpc/routes/bottles/create-from-source.ts` and its
  `/bottles/from/{bottle}` public group-selection contract were removed by tasks
  5.2 and 5.11. Internal trusted-source creation remains reachable only from the
  explicitly retained migration, compatibility, and system-controlled
  boundaries inventoried below.
- `apps/server/src/orpc/routes/bottles/delete.ts` is retained only as a measured
  compatibility purge for ungrouped pre-migration Bottles. Grouped concrete
  Bottles are rejected without mutation with an actionable merge-required
  result; their retirement requires an explicit destination through
  `mergeConcreteBottles`. Task 9.7 removes this compatibility branch.
- `apps/server/src/orpc/routes/bottles/update.ts` is the task 5.3a thin
  moderator adapter. It accepts only strict shared/exact patches, delegates all
  writes to `updateConcreteBottle`, and returns the validated exact target.
- `apps/server/src/orpc/routes/bottles/edit-context.ts` is the task 5.3a
  mod-only form projection. It validates the selected exact target, reads
  shared choices from BottleGroup-owned ids and joins, and reads exact values
  from the selected Bottle so the live form never treats materialized Bottle
  drift as shared authority.
- `apps/server/src/orpc/routes/bottles/upsert.ts` is a translation-only
  compatibility route with no supported in-repository caller after task 5.9. A
  successful concrete create or update is reloaded as the retained legacy
  Bottle response and emits structured `bottle_upsert.compatibility` telemetry.
  Task 9.7 removes this measured response adapter after observed traffic reaches
  zero.
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
- `apps/server/src/orpc/routes/bottleAliases/list.ts` now filters Bottle
  membership through the selected Bottle's active exact target and defines
  `onlyUnknown` as a null `targetId`. It hydrates every returned row through the
  shared parity reader and returns a nullable discriminated exact Bottle,
  generic BottleGroup, or null target; the compatibility `bottleId` is projected
  only from an exact target. Generic aliases never select a representative.
  Bottle-filter parity resolves retained promoted-release references
  semantically, records drift by unique alias name, and cannot affect the
  authoritative page. Invalid selected or returned durable targets fail closed
  with a conflict. `apps/server/src/orpc/routes/bottleAliases/update.ts` retains
  only its existing ignored-state mutation contract for later cleanup.
- `apps/server/src/orpc/routes/bottles/brand-repair-candidates.ts` and
  `brand-repair-groups.ts` expose brand-repair candidate reads that accept alias
  membership only from validated live exact targets. Their bounded alias-name
  parity sample is telemetry, never candidate authority, and a malformed or
  retired durable target fails closed as a conflict.

Target-bearing consumer routes:

- `apps/server/src/orpc/routes/collections/bottles/create.ts` is the task 5.6d
  direct collection membership writer. It resolves and locks one validated
  exact or generic target before membership, writes no new targetless rows,
  upgrades a matching targetless legacy-pair row, and conflicts when that pair
  is owned by a different durable target. When a canonical row and matching
  targetless duplicate coexist, the canonical row wins with only blank-image
  fill from the compatibility row and an atomic count correction; status,
  ownership, and other unit state are preserved. Target-native exact input
  stores the independently complete Bottle with a null retained release. The
  generated contract and runtime validator expose target-native and retained
  identity as two strict complete alternatives, so clients cannot combine or
  omit the identity discriminant.
  Target-native generic creation remains unavailable while the retained
  `collection_bottle.bottleId` column is non-null; it never invents the
  representative Bottle. Existing generic rows support target-native read,
  filter, delete, status, and image actions. The remaining generic-create
  storage/input cutover stays mapped to tasks 8.7 and 9.6.
- `apps/server/src/orpc/routes/collections/bottles/delete.ts` is the task 5.6d
  target-aware removal boundary for release-specific and `baseOnly` requests.
  Target input locks and deletes only its authoritative membership. A specific
  retained input may delete that resolved target plus its caller-pair
  targetless fallback while preserving different durable targets. An ungrouped
  parent or release without completed promotion may delete only its matching
  null-target retained-pair row as measured staged compatibility, never a
  durable target; section 6 backfills those rows and task 9.7 removes the
  fallback. A request with neither `release` nor `baseOnly` remains measured
  retained-parent family-delete compatibility assigned to task 9.7 because it
  intentionally spans multiple memberships; target-backed Library removal uses
  the target id directly. Its generated contract likewise exposes distinct
  strict target-native and retained alternatives, structurally excluding
  `baseOnly`, Bottle, and BottleRelease fields from target-native requests.
- `apps/server/src/orpc/routes/collections/bottles/collectionBottleHelpers.ts`
  owns collection-entry loading, authoritative serialization, and the reserved
  Library predicate shared by list, status, image, and create routes.
- `apps/server/src/orpc/routes/collections/bottles/imageHelpers.ts` owns only
  pending-image purpose, validation, and copy behavior.
- `apps/server/src/orpc/routes/collections/bottles/list.ts` now filters, orders,
  and returns authoritative target-backed membership identity. Query, entity,
  and retained catalog-reference filters record bounded target-versus-pair
  membership parity; the retained Bottle/Release filter is a measured adapter
  removed under task 9.7. Existing-row target backfill remains section 6, and
  pair storage/removal remains tasks 9.6/9.7.
- `apps/server/src/orpc/routes/reviews/create.ts` is a direct user/API Review
  writer assigned to task 5.6c. For known exact or generic intent it resolves
  one descriptor, locks/revalidates it before Review mutation, writes the
  complete target and retained-pair tuple atomically, and supplies the same
  target to applicable alias assignment. Its conflict/upsert cannot downgrade
  an existing durable target with an unresolved current result or mix identity
  fields from different decisions. If an existing different complete tuple wins
  the conflict, the route neither creates nor reassigns an alias and records no
  decision evidence for the rejected incoming identity. Known mapped resolution
  failures are errors. Under task 5.8, successful classifier creation or safe
  reuse supplies the active exact target and `(bottleId, null)` projection to
  the Review, canonical alias assignment, and incoming decision log; the log
  retains the bounded original classifier evidence. This direct path has no raw
  alias or BottleRelease writer. Only `no_match` and failed/unresolved decisions
  remain targetless. Shared alias-driven Review propagation remains task 5.6b.
- `apps/server/src/orpc/routes/reviews/list.ts` now filters and returns
  target-backed Review identity. Its retained Bottle/Release list input is a
  measured translation adapter removed under task 9.7; it does not make the
  legacy pair authoritative over a durable target.
- `apps/server/src/orpc/routes/reviews/update.ts` is the task 5.6c direct Review
  mutation boundary. It snapshots Review identity, resolves and locks the
  authoritative CatalogTarget first when one applies, and then locks the
  Review. It writes only when the locked tuple matches that snapshot; a
  mismatch rolls back and causes a bounded retry from a fresh snapshot. It
  clears `targetId` and the retained pair together for an explicit association
  clear, validates and writes a complete tuple for identity correction, and
  preserves a durable target for non-identity updates. Only a currently null
  target may be measured-repaired from its retained pair; an unresolvable
  staged legacy row remains targetless. Review serialization is now part of the
  partial task 7.1-7.3 cutover; other named consumers still keep those tasks
  open.
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
- `apps/server/src/orpc/routes/flights/details.ts` now returns the Flight's
  authoritative ordered CatalogTargets with target-owned distillers and
  target-keyed viewer state. Generic members remain group identity without
  representative substitution. The superseded `flight` filter on the ordinary
  Bottle list was removed because it could expose a retained Bottle as exact
  identity for a generic membership. Flight list/create/update keep their
  bounded target-free response; target-native membership input remains task
  8.7.
- `apps/server/src/orpc/routes/tastings/create.ts`
- `apps/server/src/orpc/routes/tastings/delete.ts`
- `apps/server/src/orpc/routes/tastings/list.ts` now filters and returns
  target-backed Tasting identity. Its retained Bottle/Release list input is a
  measured translation adapter removed under task 9.7; a durable target remains
  authoritative and generic filtering never selects a representative Bottle.
- `apps/server/src/orpc/routes/tastings/update.ts` trusts a durable target and
  uses the measured legacy pair only to repair a null `targetId` when rating or
  target state requires recomputation. It persists that descriptor before
  dispatching exact or group statistics; task 9.7 removes the fallback after
  backfill and parity.
- `apps/server/src/orpc/routes/tastings/photo-identification-create.ts` applies
  an approved create-shaped classifier decision through the same task 5.8
  concrete creation owner. Success returns one independently complete Bottle
  backed by its active exact target, always returns `release: null`, and does not
  insert a BottleRelease or write a photo/reference ingestion alias. Canonical
  concrete creation still reserves the Bottle's required canonical exact alias.
  The reviewed decision remains the caller's structured evidence; optional
  catalog-image promotion is a separate post-creation side effect.
- `apps/server/src/orpc/routes/tastings/photo-identification.ts`
- `apps/server/src/orpc/routes/prices/create-batch.ts` is the second task 5.6f
  sub-slice and now resolves accepted aliases to one validated exact, generic,
  or measured staged-targetless assignment. It tries the normalized alias key
  before the retained raw fallback, locks target descriptors through the global
  hierarchy before StorePrice/history/alias mutation, and delegates consumer
  synchronization and source-snapshot timing to canonical alias assignment. A
  same-name normalized source is checked after consumers before claim; a
  distinct raw compatibility source is checked after normalized canonical
  claim. Its
  conflict upsert treats `{targetId,bottleId,releaseId}` as one tuple: validated
  targets replace the tuple, targetless legacy input may replace only a
  targetless tuple, and unmatched input preserves an existing complete tuple.
  Generic aliases never store a representative; a retained pair is carried only
  after it resolves to the same generic target. Resolvable targetless aliases
  upgrade through the deterministic target boundary. Explicitly staged mappings
  lock and revalidate their parent/release/promotion state before mutation and
  abort if grouping or promotion completed first. Exact, generic, and
  targetless alias matches
  suppress resolver work, while unmatched rows retain it. Authentication,
  batching, history, image, provenance, and post-commit behavior are unchanged.
- `apps/server/src/orpc/routes/prices/list.ts` now treats `targetId` as the
  authoritative assigned/unknown predicate, records bounded parity against the
  retained Bottle predicate, and returns the nullable target directly.
- `apps/server/src/orpc/routes/prices/change-list.ts` now groups changes by
  `targetId` plus currency and returns the exact Bottle or generic BottleGroup
  target together with target-keyed current-user Library and tasted state.
  Anonymous state is false and retained pairs do not affect either flag.
  `apps/server/src/orpc/routes/bottles/prices/list.ts`,
  `apps/server/src/orpc/routes/bottles/prices/history.ts`, and the Bottle details
  last-price query select only the requested Bottle's exact target; retained
  pair drift and generic group activity cannot populate a Bottle-specific
  price surface. Bottle-scoped parity treats a raw retained Bottle id or a valid
  retained parent/release pair with a completed promotion to the selected
  Bottle as semantic legacy membership, without consulting target data. Bottle
  details compares only the target and semantic legacy top candidates. The
  admin `onlyUnknown` parity query independently paginates a bounded
  target/legacy union sample; displaced excluded rows and rows outside that
  sample can remain unseen, so it is not exhaustive. Price changes run parity
  after selecting the authoritative target page and inspect only a bounded
  sample of StorePrice rows behind that page, so they cannot observe legacy-only
  rows outside it.
- `apps/server/src/orpc/routes/admin/review-workbench-stats.ts` counts a listing
  as matched only when `targetId` is non-null, and
  `apps/server/src/worker/jobs/reconcileStorePriceMatchProposals.ts` queues only
  targetless listings. Their retained Bottle columns no longer decide assigned
  state.

Classifier, price matching, and moderation routes:

- `apps/server/src/orpc/routes/admin/incoming-bottle-decisions.ts` now returns
  each row's nullable authoritative CatalogTarget and records retained-pair
  parity using the decision-log id. It removes Bottle/BottleRelease joins and
  output. Exact targets return independently complete Bottles; generic targets
  remain BottleGroup identity without representative substitution; targetless
  history returns null; and an invalid nonnull durable target becomes a 409
  conflict instead of falling back. Historical decision vocabulary and created
  flags remain audit evidence, while authorization, filters, deterministic
  ordering, and pagination are preserved.
- `apps/server/src/orpc/routes/prices/matchQueue/apply-bottle-repair.ts` is the
  task 5.3b thin moderator adapter. It retains the Bottle response consumed by
  the live queue UI while the price-match service composes proposal approval
  with the canonical concrete update transaction.
- `apps/server/src/orpc/routes/prices/matchQueue/create-bottle.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/resolve.ts`
- `apps/server/src/orpc/routes/prices/matchQueue/utils.ts`

## Server services and writers

Catalog identity, aliases, search, creation, and updates:

- `apps/server/src/lib/scraper.ts` calls canonical Bottle create directly,
  handles the defined exact-duplicate conflict through canonical Bottle update,
  and consumes the returned exact CatalogTarget for image work. It no longer
  calls or reconstructs the legacy Bottle upsert response.
- `apps/server/src/lib/createBottle.ts` owns the shared Bottle preparation and
  persistence core plus canonical concrete transaction operations. Its
  superseded exported ungrouped transaction wrapper has been removed; retained
  compatibility reaches the private persistence core only through an explicit
  trusted concrete-creation boundary. Stable Bottle columns and distiller joins
  are durable exact-Bottle materialization and must remain synchronized by
  atomic group-wide writes.
- `apps/server/src/lib/createConcreteBottle.ts` owns the runtime-validated
  concrete creation service boundary used by future public adapters.
- `apps/server/src/lib/concreteBottleIdentity.ts` materializes complete exact
  Bottle names and effective shared/exact age from retained release traits. It
  is a final concrete-Bottle identity owner, not a BottleRelease writer.
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
- `apps/server/src/lib/email.ts` and
  `packages/email/src/templates/newCommentEmail.tsx` render comment activity
  from the tasting's durable `targetId`. The email boundary receives the exact
  Bottle or generic BottleGroup label instead of a hydrated `tasting.bottle`;
  it has no representative-Bottle or legacy-pair fallback, and generic activity
  explicitly states that the exact Bottle was not specified.
- `apps/server/src/lib/consolidateCatalogTargetConsumers.ts` is the canonical
  transaction-scoped consumer consolidation owner used by group and exact
  target merges. Retained pair columns remain compatibility preimages until
  task 9.6 removes them; the service never derives target identity from those
  pairs.
- `apps/server/src/lib/catalogTargets.ts` is the instrumented compatibility
  reader/writer from tasks 3.2/3.7. Its
  `resolveCatalogTargetForAssignment` boundary returns the validated target,
  group, and nullable exact-Bottle identity used by dual-write consumers.
  Its batch assignment lock owns the global BottleGroup, exact-Bottle, then
  CatalogTarget hierarchy for set-based writers and revalidates every
  descriptor after acquiring the complete lock set. Its staged-targetless
  serialization operation instead locks the retained parent Bottle, any
  BottleRelease, and existing promotion mapping before re-running legacy
  resolution. A completed grouping or promotion aborts the stale decision; it
  never acquires target hierarchy locks after those legacy locks.
  It replaces the removed ID-only assignment facade so consumers do not
  reconstruct or re-load target identity.
  Task 5.5b uses one measured legacy-pair resolution from this boundary for
  existing-match and correction approvals and reuses its descriptor for the
  alias and observation; exact/generic selection follows the promotion and
  parent-cardinality rules. A locked alias integrity check validates that
  descriptor rather than resolving another semantic intent. Create-new approval
  now receives the exact target directly from canonical concrete creation or
  validated exact-duplicate reuse and passes that descriptor to the StorePrice,
  alias, and observation writers. It does not re-resolve its newly created
  `(bottleId, null)` projection through the measured legacy-pair boundary.
  Durable `targetId` values are authoritative; the measured legacy pair is used
  only when a compatibility row has no target. Retain that legacy branch
  through the task 9.5 read window and remove it under task 9.7.
  `resolveLegacyCatalogTargetFilterForRead` is the measured Bottle/Release list
  input adapter used by the partial tasting and Review cutover; task 9.7 removes
  it after callers carry target identity directly.
  Task 5.6c uses this boundary once for direct Review exact or generic intent,
  then revalidates and locks that descriptor before locking and mutating the
  Review. Review update accepts the mutation only when its subsequently locked
  identity still matches the snapshot used for resolution; otherwise it rolls
  back and retries from a fresh snapshot. A durable target is never reconstructed
  from the retained pair; only a null-target Review may use the measured pair for
  compatibility repair, without substituting a group representative.
- `apps/server/src/lib/catalogTargetReadParity.ts` is the shared task 7.1-7.2
  parity owner for target-bearing serializers and route filters. It batch-loads
  authoritative targets, compares them with measured legacy-pair resolution,
  records correlated consumer/row mismatch evidence, and records bounded
  target-versus-legacy filter-membership drift without changing authoritative
  results. `loadLegacyCatalogTargetReadBatch` resolves each distinct retained
  pair once per batch and returns aligned legacy targets and resolution
  evidence; the alias list and brand-repair filters use that shared semantic
  resolver rather than rebuilding legacy membership. BottleAlias evidence uses
  the table's unique alias name as its stable locator because the table has no
  numeric row id. It never falls back when a durable target is invalid. Its
  legacy comparison is removed with runtime compatibility under task 9.7 after
  the remaining task 7.1-7.3 consumers and parity gates complete.
- `apps/server/src/lib/brandRepairCandidates.ts` uses only live exact
  CatalogTargets for Bottle candidate scans and for query/supporting alias
  membership. Generic, targetless, tombstoned, and retired identities cannot
  become repair evidence, and bounded target-versus-retained alias parity is
  recorded separately from candidate selection.
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
  selects the representative Bottle and may carry either the valid generic
  consumer projection `{bottleId:null,releaseId:null}` or a separately validated
  measured pair. It also owns matched-source snapshot timing after consumer
  synchronization: same-name normalized sources are checked before claim and
  distinct raw compatibility sources after normalized canonical claim. When
  canonical assignment creates a new alias, its post-commit finalizer queues
  `IndexBottleAlias` directly because consumer synchronization already occurred;
  it does not queue `OnBottleAliasChange`. Existing-alias assignment need not
  enqueue alias indexing. Bottle search reindexing comes only from the validated
  assignment target's exact Bottle id; a generic or targetless alias never uses
  its retained Bottle pair or a group representative as indexing identity.
  `listUnmatchedBottleAliasNames` also owns the bounded maintenance read: it
  selects only the ordered name projection for non-ignored aliases whose
  `targetId` is null.
- `apps/server/src/lib/bottleCreationDrafts.ts`
- `apps/server/src/lib/legacyConcreteBottleInput.ts` is the retained translation
  boundary for price-proposal Bottle/BottleRelease-shaped evidence. It emits one
  canonical concrete-Bottle input, rejects untranslatable image URLs, and never
  writes BottleRelease. Section 8 UI callers bypass it with canonical
  `independentBottle` input; task 9.7 removes this translator after measured
  compatibility traffic reaches zero.
- `apps/server/src/lib/bottleFinder.ts` owns target-aware exact alias resolution
  and the task 5.6f StorePrice-ingestion alias projection. Existing exact-only
  readers still receive a Bottle only from an exact target. Direct ingestion
  instead receives a validated exact or generic descriptor plus its explicit
  consumer projection. A generic retained pair must resolve to that same target;
  targetless aliases resolve through measured legacy assignment and return an
  explicit staged decision only for the two allowed migration states. Canonical
  source-snapshot locking remains owned by `bottleAliases.ts`. The general alias
  list is target-backed under task 7.3a; remaining specialized alias readers and
  retained compatibility stay in tasks 7.3 and 9.7, while Bottle search/index
  replacement remains task 7.5.
- `apps/server/src/lib/bottleReferenceCandidates.ts` searches ordinary exact
  Bottle targets. Text and brand candidates require an exact CatalogTarget;
  vector and exact-alias candidates resolve accepted aliases through their
  authoritative exact target rather than the retained pair. Generic and
  ignored aliases cannot become exact candidates. The release-only text lookup
  and release-row enrichment/synthesis are removed, so all candidate metadata
  comes from the independently complete Bottle. An explicitly supplied
  historical release id remains compatibility input only when its completed
  promotion mapping resolves to an active ordinary promoted Bottle. Every
  ordinary candidate query excludes Bottle and BottleGroup tombstones.
- `apps/server/src/lib/bottleReferenceResolution.ts` owns task 5.8 classifier
  application and reference resolution. The live `create_bottle` action
  delegates to canonical concrete creation and returns one exact target with
  `(bottleId, null)`; safe canonical duplicate reuse returns the same active
  exact target only after rollback and revalidation. The result carries only a
  bounded classifier-evidence projection (action, identity scope, observation,
  identity basis, and confidence basis). Exact aliases and
  classifier failures carry no classifier evidence, and `no_match`/unresolved
  results remain targetless. This service no longer owns a raw alias or
  BottleRelease writer.
- `apps/server/src/lib/bottleReleaseIdentity.ts`
- `apps/server/src/lib/bottleSchemaRules.ts`
- `apps/server/src/lib/db.ts` still owns the raw legacy-pair
  `upsertBottleAlias` primitive. Canonical creation uses it only to reserve a
  canonical name inside its transaction, then upgrades that alias to the new
  exact target before commit. `worker/jobs/mergeEntity.ts` uses it only in the
  explicitly isolated `groupId IS NULL` pre-migration branch. Task 9.7 removes
  that ungrouped compatibility branch and the raw primitive.
- `apps/server/src/lib/format.ts`
- `apps/server/src/lib/search.ts`

After production promotion/backfill and before search cutover is approved, the
ordinary Bottle search index must be rebuilt for every promoted Bottle and the
retained task 9.1 gate must verify that rebuild. Release-only index jobs or
`bottle_release.search_vector` are not an alternative index and cannot satisfy
that gate.

Active repair and migration-adjacent services:

- `apps/server/src/lib/canonRepairCandidates.ts`
- `apps/server/src/lib/repairBottleBrandDistilleryAssignments.ts` groups
  candidates by BottleGroup and delegates one shared brand, distillery, and
  series edit per group to `updateConcreteBottleInTransaction`, which owns the
  atomic member fan-out and canonical aliases. It refuses ungrouped
  pre-migration Bottles and performs no direct grouped-Bottle or raw-alias
  mutation.
- `apps/server/src/lib/fixBadReviewEntities.ts` resolves one validated target
  descriptor, then atomically assigns it through the canonical alias/Review
  propagation owner. A Review identity changed since discovery is preserved.

Classifier decisions and price matching:

- `apps/server/src/agents/bottleClassifier/service.ts`
- `apps/server/src/lib/classifierDecisionCreateInputs.ts` projects the single
  live `create_bottle` action into independent canonical concrete-Bottle input;
  classifier output never selects a parent, source group, or BottleRelease.
- `apps/server/src/lib/incomingBottleDecisionLog.ts` maps successful task 5.8
  concrete creation to `create_bottle` and safe reuse to `match_existing`, while
  accepting the exact target and retained `(bottleId, null)` projection from the
  caller. Review callers persist the bounded original classifier evidence in
  metadata instead of reconstructing an action from the resolution source.
- `apps/server/src/lib/priceMatchConcreteBottleInput.ts` is the sole translator
  from retained price-match creation payloads to canonical concrete creation:
  bottle-only input owns the independent Bottle's stable fields, including
  shared stated age, while its exact stated age is null; release-only input
  requires a trusted source Bottle and maps the release fields to exact input;
  combined input keeps stable fields from Bottle input and gives Release input
  precedence for exact fields. Combined release stated age wins even when null;
  other nullable exact fields fall back to Bottle input, and Bottle
  `descriptionSrc` is retained only when Bottle description wins. The three
  legacy payload shapes remain valid compatibility shapes, but a non-null
  Bottle or Release `imageUrl` is deliberately rejected because this
  transaction cannot cross the canonical upload boundary; the translator does
  not claim that every legacy field is accepted or silently preserved.
- `apps/server/src/lib/priceMatchingAutomation.ts`
- `apps/server/src/lib/priceMatchingDraftNormalization.ts`
- `apps/server/src/lib/priceMatchingProposals.ts` retains proposal validation,
  approval, price assignment, decision logging, observations, and listing-alias
  orchestration. Its task 5.3b correction composer maps the sparse legacy
  parent/stable draft to canonical shared and exact patches and invokes the
  transaction-scoped concrete update service. The superseded proposal-specific
  updater, including its direct entity, series, distiller, Bottle,
  BottleRelease-name, audit, and post-commit writes, is removed rather than
  retained as a second business system. For task 5.5b,
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
  Existing-match and correction price assignment retains its compatibility
  pair while persisting current/suggested proposal and latest-attempt targets.
  A finalized attempt stores the same target and matching current/suggested
  retained pair, including `(bottleId, null)` for concrete create-new approval.
  Create-new approval accepts canonical `independentBottle` input using the
  standard flat Bottle create contract and creates a singleton regardless of
  retained proposal parent context. The measured compatibility branch still
  infers the actual retained payload shape and delegates exclusively to
  `createConcreteBottleInTransaction`; its translator rejects images that
  cannot cross the canonical upload boundary. Legacy Bottle-only and combined
  input create an independent concrete Bottle, while release-only input requires
  the proposal's trusted source Bottle. No BottleRelease writer or finalizer
  remains in this path.
  The operation preflights proposal identity before canonical group-first locks,
  then locks and revalidates the proposal. The concrete creation attempt runs in
  a nested savepoint so a duplicate first rolls back all preparatory writes. It
  then locks and revalidates the existing exact target together with the trusted
  source descriptor when present before accepting reuse. Reuse additionally
  requires exact equality with the requested canonical `fullName` or an exact
  structurally parsed SMWS code match and an active exact target; an arbitrary
  or ignored alias collision, fuzzy name match, or fuzzy or substring-only SMWS
  collision is not reusable identity. Release-only reuse must stay in
  the trusted source group, and cross-group duplicates conflict. The later
  proposal/price gate rejects parent-id drift, price-id drift, changes to
  `creationTarget`, `proposedBottle`, or `proposedRelease`, or any change to the
  complete StorePrice `{targetId,bottleId,releaseId}` tuple.
  A new graph uses `create_bottle`; duplicate reuse uses `match_existing`. For
  an initial incoming assignment, the emitted source decision stores that
  action, exact target, and `(bottleId, null)` projection. A preexisting source
  decision remains immutable through the source conflict rule, and approval of
  an already assigned StorePrice does not promise to rewrite or add that log.
  The exact target and retained projection are written atomically to the
  StorePrice, alias, observation, proposal, and latest attempt. The approved
  proposal and its own latest-attempt current/suggested identities, when an
  attempt is present, change in the same approval transaction so neither can
  commit a different or partial target projection. Cross-volume sibling
  proposals are not retargeted. Historical
  release-create enum values remain for untouched classifier/caller records and
  require no migration. The route accepts canonical `independentBottle` input
  and preserves `{ bottle, release }` output with `release: null`; post-commit
  concrete and alias finalizers remain the only finalizers. Every authorized
  schema-valid legacy call reaching the compatibility branch emits structured
  usage with caller, operation, payload discriminator, and handler outcome;
  successful usage also records replacement Bottle and exact target ids without
  the raw payload. Task 9.7 removes the legacy adapter after observed
  compatibility traffic reaches zero. Task 5.6b owns StorePrice and Review
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
  ingestion is completed by the adjacent task 5.6f sub-slice. Task 5.6b retains
  alias-driven propagation, task 5.8 owns classifier application, task 5.9 owns
  the remaining caller/worker consumer cutover, task 7.3 owns target-backed
  reads, section 6 owns existing-row backfill, broader
  repair/caller cutovers remain outside this sub-slice, task 9.6 removes
  retained consumer pairs, and task 9.7 removes measured targetless/legacy
  resolution. Section 8 removes release-shaped UI input/output assumptions,
  task 5.11 owns generated OpenAPI/client cutover, and this review boundary
  makes no deployment or activation claim. Production backfill and deployment
  remain gated by their fresh retained audits and explicit approvals.
- `apps/server/src/lib/pendingUploads.ts`

## Workers and queue payloads

- `apps/server/src/worker/jobs/createMissingBottles.ts` now consumes the task 5.8
  resolution's concrete Bottle, exact target, and bounded classifier evidence,
  and passes the validated descriptor atomically through canonical alias,
  Review, StorePrice, and incoming-decision propagation. It compares the
  selected Review's identity snapshot under lock so a concurrent retarget wins
  over stale classifier work. `no_match` and failed/unresolved reviews stay
  targetless, and the worker never selects a representative or arbitrary exact
  Bottle.
- `apps/server/src/worker/jobs/index.ts` registers only the ordinary Bottle and
  alias search-index jobs. Task 7.5 removes the release-only index and
  change-handler registrations rather than retaining dormant compatibility
  workers.
- `apps/server/src/worker/jobs/indexBottleSearchVectors.ts` builds the ordinary
  Bottle search vector from independently complete Bottle fields and accepted,
  non-ignored aliases whose authoritative exact CatalogTarget resolves to that
  Bottle. Generic, targetless, and ignored aliases do not enrich an exact
  Bottle's search vector, and the worker does not read BottleRelease fields or
  `bottle_release.search_vector`.
- `apps/server/src/worker/jobs/indexBottleAlias.ts` indexes an accepted alias
  only when its authoritative CatalogTarget resolves to a live exact Bottle and
  BottleGroup. It builds the embedding from the independently complete Bottle
  and clears the embedding for ignored, targetless, generic, tombstoned, or
  concurrently changed aliases; it has no BottleRelease fallback.
- `apps/server/src/worker/jobs/onBottleChange.ts` refreshes Bottle details and
  search before queueing delayed exact Bottle and BottleGroup statistics. Before
  strict target-backed statistics activation, task 7.10 must stop or upgrade
  any producer that can enqueue a retired legacy parent and drain or expire
  those queued jobs because a retired parent has no active exact target.
- `apps/server/src/worker/jobs/notifyDiscordOnTasting.ts` keeps the stable
  `{ tastingId }` job identity, loads the tasting's durable `targetId`, and
  renders either the exact Bottle or generic BottleGroup label, explicitly
  identifying generic activity as lacking an exact Bottle. It no longer hydrates
  `tasting.bottle` or substitutes a representative Bottle.
- `apps/server/src/worker/jobs/processNotification.ts` keeps the stable
  `{ notificationId }` job identity and delegates comment email rendering from
  the tasting's durable target without hydrating `tasting.bottle`. A missing
  target, retired target, or target-integrity failure is not translated through
  legacy identity: it escapes the worker boundary so BullMQ retains the failure
  for diagnosis and retry.
- `apps/server/src/worker/jobs/updateBottleStats.ts` owns a strict
  `{targetId}` payload, requires that target to be exact, derives its Bottle and
  group, and delegates to the canonical exact and group recomputation services.
- `apps/server/src/worker/jobs/updateBottleGroupStats.ts` owns the same strict
  payload shape, requires a generic target, and delegates only to canonical
  group recomputation.
- `apps/server/src/worker/jobs/queueCatalogTargetEntityStats.ts` is the shared
  downstream entity-refresh helper. Exact targets queue the independently
  complete Bottle's brand, bottler, and distillers; generic targets queue the
  BottleGroup's owners without representative fallback. `UpdateEntityStats`
  counts active concrete Bottles through exact targets and counts tastings by
  joining their authoritative CatalogTarget, using Bottle ownership for exact
  activity and group ownership for generic activity. Targetless legacy tastings
  do not fall back to their retained pair. Each statistics event independently
  queues idempotent refreshes without stable-key coalescing; successful jobs are
  removed and failed jobs are retained.
- `apps/server/src/orpc/routes/tastings/dispatchStatsRecompute.ts` maps a
  validated target descriptor to one independently queued, delayed idempotent
  exact-or-group `{targetId}` job per qualifying event. Completed jobs are removed;
  publication failure is logged with tasting and target identity and does not
  fail a committed tasting mutation.
- The worker registry logs and rethrows handler failures to BullMQ. Statistics
  jobs remove completed records but retain failed records, so a failed
  canonical or downstream entity refresh is observable and retryable.
- `apps/server/src/worker/jobs/onBottleChange.ts` also owns a strict
  `{targetId}` payload and requires an active exact target before deriving its
  Bottle details, search, and statistics work. Concrete creation, update, group
  merge, and exact merge finalizers preserve exact target ids in their
  transaction results and dispatch that identity after commit. The maintenance
  CLI likewise selects exact target rows and dispatches their target ids.
  Before activation, old Bottle-id producers must be stopped or upgraded and
  queued legacy statistics or parent `OnBottleChange` payloads must be drained
  or expired. That deployment evidence remains open under task 7.10; task 7.7
  owns aggregate parity evidence and cutover approval.
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
- Task 7.10's local application work now includes target-backed notification
  payloads, authoritative alias reindexing, typed target-aware Library cache
  updates, and target-owned statistics/entity queues. No persistent catalog
  response cache exists to migrate, and exact Bottle search revalidation remains
  Bottle-owned. Only the deployment-time producer-stop and legacy queue-drain
  evidence remains before these strict workers may be activated.
- `apps/server/src/worker/jobs/mergeBottle.ts` is a measured compatibility
  adapter for queued pre-cutover payloads. It validates and translates the old
  payload into `mergeConcreteBottles` transaction calls and owns no merge
  business logic. Remove its registration and job type under task 9.7 after the
  compatibility queue is drained.
- `apps/server/src/worker/jobs/mergeEntity.ts` delegates grouped brand,
  bottler, distiller, and series changes to the canonical shared BottleGroup
  update transaction, including exact duplicate merges before fan-out. Its
  direct Bottle/BottleRelease/raw-alias logic is restricted to an explicit
  `groupId IS NULL` pre-migration compatibility branch removed by task 9.7.
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
- `apps/server/src/worker/types.ts` exposes only the ordinary Bottle and alias
  search jobs. The release-only search and change job names, handlers, and
  registrations are removed together at the task 7.5 boundary.

## CLI

- `apps/cli/src/commands/labels.ts`: `labels dump-unmatched` is a thin adapter
  over `listUnmatchedBottleAliasNames`; it paginates the server-owned query in
  1,000-row batches and writes each returned name to stdout.
- `apps/cli/src/commands/bottles.ts`: `bottles fix-stats` selects exact-target
  rows and directly dispatches their target ids to the strict exact statistics
  worker. Strict recomputation validates the active graph and target integrity
  and stops on an invalid row rather than silently skipping it. This explicit
  maintenance scope cannot select a generic target. Its brand/distillery repair
  command delegates grouped work to the canonical shared-update fan-out.
- `apps/cli/src/commands/prices.ts` and
  `apps/cli/src/commands/reviews.ts` retain name-normalization maintenance but
  no longer expose raw Bottle-alias backfill writers.
- Obsolete Bottle name/normalization and price/review alias-backfill commands
  have been removed rather than retained as a second mutation system.
- `apps/cli/src/commands/catalogMigration.ts` exposes the retained-report dry
  run and one-bounded-batch approved write/resume command. It does not imply
  that the command has run against production. Task 10.10 removes only its
  migration-only backfill operation after all later evidence gates, retaining
  the read-only audit operation through those gates.
- `apps/cli/src/commands/catalogMigrationRuntime.ts` uses configured `VERSION`
  only in production and always resolves clean current `HEAD` outside
  production. It parses retained reports and owns atomic same-directory report
  files, parent-directory fsync after publication or replacement, and the
  fail-closed exclusive write lock. Task 10.10 removes this backfill-only
  runtime after all required evidence is retained.
- `apps/cli/src/commands/catalogMigrationRuntime.test.ts` covers that file and
  lock boundary and is removed with it under task 10.10.
- `apps/cli/vitest.config.mts`, the CLI package test script, the migration-added
  CLI `esbuild`/`vite`/`vitest` development dependencies, and their matching
  `pnpm-lock.yaml` entries exist only to test this migration tooling. Task 10.10
  removes them with the runtime test unless another retained CLI test has taken
  explicit ownership of that infrastructure.

## Migration audit and backfill orchestration

- `apps/server/src/lib/catalogMigrationAudit.ts`
- `apps/server/src/lib/catalogMigrationBackfill.ts` owns the core parent-family
  transaction and exports the shared ascending-keyset parent selector used by
  the orchestrator. Its superseded core-only batch wrapper is removed; task
  10.10 removes the remaining migration-only selector/core service and its
  integration test.
- `apps/server/src/lib/catalogMigrationAliasObservationBackfill.ts` owns the
  separate alias/observation parent-family transaction and is removed with its
  integration test under task 10.10.
- `apps/server/src/lib/catalogMigrationConsumerBackfill.ts` owns the separate
  remaining-consumer parent-family transaction and consumes the runtime-owned
  logical-slot contract. Task 10.10 removes it and its integration test.
- `apps/server/src/lib/catalogMigrationFamilyTargets.ts` is the shared
  BottleRelease-family resolver and lock/revalidation owner used by the
  alias/observation and remaining-consumer backfills. Task 10.10 removes it
  with those migration-only backfills after their evidence is retained.
- `apps/server/src/lib/catalogMigrationRevision.ts` loads the database name and
  latest applied Drizzle revision read-only and requires its hash/timestamp to
  match the latest candidate migration before reporting or writes. Task 10.10
  removes this backfill-run evidence helper.
- `apps/server/src/lib/catalogMigrationOrchestrator.ts` owns the external
  active/after/next checkpoint lifecycle, approved dry-run binding, strict
  core-to-alias/observation-to-consumer transaction order, cumulative metrics,
  active-family replay, stop-first/composite failures, and one bounded batch per
  call. Task 10.10 removes this migration-only orchestrator.
- `apps/server/src/lib/catalogMigrationOrchestrator.test.ts` covers the 6.11-
  6.12 coordination and interruption contract without production access and is
  removed with the orchestrator under task 10.10.
- `apps/server/src/lib/test/fixtures.ts` supplies legacy graph fixtures to the
  integration suite and is not a production reader or writer.

The read-only `catalogMigrationAudit` service, schema, and CLI operation remain
available through the task 9.1 constraint gate, task 9.10 final legacy audit,
and task 10.9 cleanup-release audit. They are not part of task 10.10's
write-tooling removal until all required audit evidence has been retained.

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
- `packages/bottle-classifier/src/legacyReleaseIdentityEvidence.ts`
- `packages/bottle-classifier/src/localCatalog/candidates.ts`
- `packages/bottle-classifier/src/localCatalog/dataSource.ts`
- `packages/bottle-classifier/src/localCatalog/schema.ts`
- `packages/bottle-classifier/src/priceMatchingEvidence.ts`
- `packages/bottle-classifier/src/releaseIdentity.ts`
- `packages/bottle-classifier/src/reviewPolicy.ts`
- `packages/bottle-classifier/src/runtime/candidates.ts`
- `packages/bottle-classifier/AGENTS.md`
- `packages/bottle-classifier/README.md`
- `packages/bottle-classifier/package.json`

`packages/bottle-classifier/src/realWorldNewBottleEval.fixtures.ts` is a
production-source fixture registry and is included in the eval migration even
though it is not executed in the request path.

## Web routes and components

Routes:

- `apps/web/src/app/(admin)/admin/(default)/incoming-decisions/page.tsx` renders
  nonnull decision identity through `CatalogTargetIdentity`, labels null as an
  unknown target, and no longer builds a nested Bottling link.
- `apps/web/src/app/(default)/bottle-groups/[groupId]/page.tsx` is the canonical
  generic BottleGroup page. It renders only group-owned identity, editorial
  content, and aggregate statistics, labels the exact release as unspecified,
  and paginates independently complete member Bottles linking to
  `/bottles/:id`. It never substitutes `representativeBottleId` for exact
  identity or hydrates exact fields from the group.
- `apps/web/src/app/(default)/bottle-groups/[groupId]/bottleGroupView.tsx` owns
  the generic group presentation, aggregate statistics, and exact member list.
- `apps/web/src/app/(default)/bottle-groups/[groupId]/groupModActions.tsx`
  exposes moderator-only links to the standalone merge and split forms.
- `apps/web/src/app/(layout-free)/bottle-groups/[groupId]/merge/page.tsx`
  requires an explicit destination group and delegates to the canonical merge
  mutation. Its confirmation states the merge direction, destination-owned
  shared identity, and movement of generic activity.
- `apps/web/src/app/(layout-free)/bottle-groups/[groupId]/split/page.tsx`
  requires all members to be loaded, an explicit nonempty proper subset, and
  valid representative choices before delegating to the canonical split
  mutation. It states that generic activity, stable aliases, and editorial
  content stay on the source group.
- `apps/web/src/app/(default)/bottles/[bottleId]/bottleFullHeader.tsx` keeps the
  exact Bottle header primary and adds quiet links to the related-release group
  when it has multiple members and to the independent “Add another release”
  workflow.
- `apps/web/src/app/(default)/bottles/[bottleId]/(tabs)/bottlings/page.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/(tabs)/releases/releaseTable.tsx`
- `apps/web/src/app/(default)/bottles/[bottleId]/bottlingModActions.tsx`
- `apps/web/src/app/(layout-free)/addBottle/addBottleFlow.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/addTasting/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/addRelease/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/bottlings/[bottlingId]/route.ts`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/bottlings/[bottlingId]/edit/route.ts`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/bottlings/new/route.ts`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/edit/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/[bottleId]/releases/[releaseId]/edit/page.tsx`
- `apps/web/src/app/(layout-free)/bottles/new/page.tsx`

Task 7.8 moves the legacy nested-Bottling detail URL out of the exact-Bottle
layout and makes the layout-free route its permanent redirect owner. It parses
the retained parent/release ids, calls the anonymous measured
`bottleReleases.target` adapter, preserves query parameters, and permanently
redirects only to the returned exact Bottle URL. The superseded roughly
940-line BottleRelease detail renderer is removed rather than retained as a
second read system. The nested list remains measured compatibility owned by
task 8.9. The nested new and edit URLs are permanent redirect routes: new
points to the independent "Add another release" workflow, while edit resolves
the retained release mapping and points to the promoted concrete Bottle editor.

The canonical BottleGroup page now exists. Task 7.9 remains deferred until a
durable retired-parent-to-group mapping and redirect are implemented and
validated. That redirect must preserve generic group identity and must never
substitute the representative or another member Bottle. This review slice makes
no production deployment, activation, audit, or backfill claim.

Task 8.3 replaces the nested new-bottling route with a prefilled standard
Bottle-create flow. The selected Bottle supplies independently durable draft
values only; the submit path creates a singleton group and never calls the
public trusted-source route removed by task 5.2. Later grouping is automatic
and outside this manual workflow.

Task 5.4c removes or hides Bottle/BottleRelease delete actions that can only
produce the merge-required compatibility response. Task 8.9 removes the nested
Bottling UI after redirects are active, and task 9.7 removes the remaining
compatibility branches after measured traffic reaches zero.

Shared UI and client helpers:

- `apps/web/src/components/bottleCard.tsx`
- `apps/web/src/components/bottleExactMetadata.tsx` is the shared exact-field
  rendering owner used by search and BottleGroup related-release results. It
  reads only durable Bottle fields and does not hydrate BottleGroup identity.
- `apps/web/src/components/bottleGroupField.tsx` owns typed BottleGroup lookup
  and labels candidates with stable group ids and member counts.
- `apps/web/src/components/bottleForm.tsx`
- `apps/web/src/components/bottleResolver/helpers.ts`
- `apps/web/src/components/bottleResolver/index.tsx`
- `apps/web/src/components/bottleResolver/states.tsx`
- `apps/web/src/components/bottleResolver/types.ts`
- `apps/web/src/components/bottleReviews.tsx`
- `apps/web/src/components/bottleTable.tsx`
- `apps/web/src/components/collectionAction.tsx`
- `apps/web/src/components/search/bottleResult.tsx` owns exact Bottle search-row
  navigation and the quiet relationship link to a multi-member BottleGroup.
- `apps/web/src/components/tastingForm.tsx`
- `apps/web/src/components/notifications/entry.tsx` narrows the strict
  notification union and renders toast/comment activity with the referenced
  CatalogTarget label. Exact activity names its Bottle; generic activity names
  its BottleGroup, states that the exact Bottle was not specified, and never
  links or labels a representative Bottle.
- `apps/web/src/lib/addBottle.ts`
- `apps/web/src/lib/catalogTarget.ts` links exact targets to `/bottles/:id` and
  generic targets to `/bottle-groups/:groupId`; it never turns a generic target
  into a representative Bottle link.
- `apps/web/src/lib/independentBottleProposal.ts` owns canonical UI composition
  for retained price-proposal evidence and durable “Add another release”
  prefills. This Section 8 creation composer is distinct from sparse correction
  mapping and the legacy server translator. A non-null `proposedBottle` value
  is authoritative for stable fields, while serialized null, omission, an
  absent proposed Bottle, or release-only evidence inherits the independently
  complete source stable value. An explicit empty distiller list remains
  authoritative. A non-null proposed-release age may supply the
  singleton's effective age. Exact fields retain release/Bottle/source
  precedence, and description provenance follows the description layer that
  wins. The helper parses queue approval as one standard independent flat
  Bottle input, so required name/brand and field constraints remain schema
  owned. It never carries source Bottle or BottleGroup authority into creation;
  release-shaped proposal fields are staged input evidence only, and later
  grouping remains automatic outside the manual workflow.
- Collection tables, activity previews, image/status actions, and the
  post-scan Library confirmation now render one CatalogTarget. Exact entries
  link their independently complete Bottle; generic entries show the group
  label and scope without a Bottle link or representative. Existing generic
  Library entries mutate by target id, while generic creation remains disabled
  at the non-null retained-Bottle storage boundary described above. Library
  cache updates use the typed collection-list query prefix and globally unique
  collection-entry ids rather than serialized query-key substring matching.
- Flight detail, overlay, and edit routes consume the details response's target
  list directly. Exact entries retain their quick panel, Flight-scoped tasting
  action, target-keyed status indicators, and distiller display. Generic
  memberships cannot start an exact tasting or be rewritten through the staged
  Bottle-id form; metadata edits preserve them. Exact-only membership editing
  remains the measured task 8.7 compatibility input until every target-bearing
  flow is target-native.
- `apps/web/src/lib/tastingForm.ts` shapes the validated form submission. Create
  still carries the staged Bottle/Release identity until task 8.7 moves tasting
  creation to one `targetId`; edit is content-only and cannot mutate identity.
- `apps/web/src/lib/bottlings.ts`

Admin exports and test protocol fixtures that encode release fields:

- `apps/web/src/app/(admin)/admin/(default)/queue/llmExport.ts`
- `apps/web/e2e/mock-rpc-server.mjs`
- `apps/web/e2e/rpc-fixtures.mjs`

## Documentation

- `docs/architecture/bottle-creation-alias-system.md`
- `docs/architecture/bottle-classifier.md`
- `docs/architecture/rating-systems.md`
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
