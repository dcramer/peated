## Why

Peated currently models a marketed release as a parent `bottle` plus an optional `bottle_release`, so every creator and consumer must decide which layer owns the record and carry a potentially invalid `(bottleId, releaseId)` pair. As the catalog gains detail, valid parent bottles must be split into releases, creating exactly the accidental identity changes and repair work that the model should prevent.

## What Changes

- Make every concrete catalog entry a Bottle, including records currently represented as Bottle+Bottling pairs.
- Add an automatically managed BottleGroup for the shared expression identity across related Bottles; every Bottle belongs to exactly one group, and ordinary creation never asks the user to create or select a group.
- Create a singleton group automatically for an independently created Bottle, and reuse a known group when creating “another release” from an existing Bottle or migrating an existing parent and its bottlings.
- Replace paired bottle/release references with one catalog-target reference that points to either an exact Bottle or its BottleGroup when exact release identity is unknown.
- Collapse Add Bottle and Add Bottling into one Bottle form with all concrete identity fields.
- Add explicit, reversible BottleGroup merge and split operations; name-based identity logic may suggest grouping but must not silently merge uncertain expressions.
- Migrate current bottlings into Bottles, preserve generic parent-level activity on group targets, and preserve old URLs/API references through audited mappings and redirects.
- Recompute exact Bottle and aggregate BottleGroup statistics after migration.
- **BREAKING**: retire `BottleRelease`, nested bottling routes, `releaseId`, and create-release APIs after a compatibility window.
- Supersede the unimplemented `add-target-aware-catalog-creation` proposal, which would deepen the paired-target model this change removes.

## Capabilities

### New Capabilities

- `concrete-bottle-catalog`: A single concrete Bottle entity and unified add/edit/search/detail behavior for all marketed releases.
- `automatic-bottle-groups`: Automatic expression grouping, group membership, aggregation, and curated merge/split behavior.
- `catalog-target-identity`: One validated target reference for exact-Bottle and unknown-exactness BottleGroup activity, including compatibility resolution during migration.

### Modified Capabilities

None.

## Impact

- Database schema and generated migrations for BottleGroup, Bottle membership, catalog targets, migration mappings, and removal of `bottle_release` references.
- Bottle, bottling, alias, observation, tasting, review, collection, flight, price, proposal, classifier, repair, activity, search, statistics, and indexing services.
- oRPC/OpenAPI inputs and results, CLI/classifier contracts, compatibility adapters, and nested bottling URL redirects.
- Add/edit Bottle forms, Bottle and group pages, search results, Library, tasting, price, review, and flight workflows.
- Architecture, schema, bottle-entry, photo-tasting, and store-price-matching documentation.
- A staged production backfill and cutover with dry-run audits, parity checks, rollback boundaries, and removal only after legacy traffic reaches zero.
