## Why

Peated currently models a marketed release as a parent `bottle` plus an optional
`bottle_release`. Creators and consumers must choose which layer owns a record
and carry a potentially invalid `(bottleId, releaseId)` pair. A previously valid
Bottle can also change meaning when a more specific release is discovered.

The catalog should have one independently correct entity: Bottle. Related
versions may be organized by an automatic BottleGroup, but user activity and
catalog integrations should never need a second polymorphic target identity.

## What Changes

- Make every concrete catalog entry a Bottle, including every current
  BottleRelease.
- Keep each legacy parent as a valid general or unversioned Bottle. Parent-only
  activity remains on that Bottle; release-specific activity moves to the
  Bottle promoted from the referenced BottleRelease.
- Add automatically managed BottleGroups for related versions. Every Bottle
  belongs to one group, ordinary creation always starts in a singleton group,
  and grouping occurs outside manual Bottle creation.
- Keep every Bottle independently complete and renderable. Shared BottleGroup
  edits transactionally rematerialize affected member Bottles.
- Point tastings, reviews, collection entries, flights, prices, aliases,
  observations, classifier decisions, proposals, activity, statistics, and
  other catalog consumers directly to Bottle.
- Do not create a generic group activity target. BottleGroup owns relationship,
  shared identity-edit intent, representative selection, and aggregate scope
  only; exact editorial presentation remains on Bottle.
- Collapse Add Bottle and Add Bottling into one Bottle form with all concrete
  identity fields.
- Migrate legacy releases and consumer references in audited, resumable,
  component-complete batches after a retained production preflight. Retain
  release-to-Bottle mappings through validation, then remove them with the
  separately approved physical cleanup.
- **BREAKING**: retire `BottleRelease`, nested bottling APIs, `releaseId`, and
  the unreleased `CatalogTarget` system after validation and backup approval.
- Supersede `add-target-aware-catalog-creation`, which would deepen the paired
  identity model this change removes.

## Capabilities

### New Capabilities

- `concrete-bottle-catalog`: One independently correct Bottle entity and one
  add/edit/search/detail workflow for all marketed releases.
- `automatic-bottle-groups`: Relationship groups established by migration or
  singleton creation, shared materialization, related-release presentation, and
  member-derived aggregates. Automatic regrouping is a separate future change.
- `direct-bottle-identity`: One direct Bottle reference for all activity and
  integrations, including deterministic legacy migration.

### Modified Capabilities

None.

## Impact

- Database schema and generated migrations for BottleGroup, Bottle membership,
  durable release promotion mappings, direct consumer Bottle references, and
  removal of unreleased CatalogTarget additions.
- Bottle, legacy release, alias, observation, tasting, review, collection,
  flight, price, proposal, classifier, activity, search, statistics, and
  indexing services.
- oRPC/OpenAPI inputs and results, CLI/classifier contracts, and removal of
  BottleRelease compatibility APIs and nested bottling redirects.
- Add/edit Bottle forms, Bottle pages, related-release pages, search, Library,
  tasting, price, review, and flight workflows.
- A retained production preflight, resumable bounded data transactions,
  postflight validation, and separately approved destructive cleanup.
