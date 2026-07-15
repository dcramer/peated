## Context

The current `bottle` table represents a stable expression while `bottle_release` optionally represents a concrete marketed release. Release-like columns also exist on `bottle` for legacy and “single known release” cases. Downstream records generally carry `bottleId` plus nullable `releaseId`, and most boundaries do not have a database constraint proving that the release belongs to the bottle.

This arrangement has two failure modes that cannot be solved by form copy: a creator must decide whether a concrete product is a Bottle or Bottling, and a previously valid Bottle must change identity when a second release is discovered. The revised model makes exact releases uniformly Bottles and moves shared expression identity into an automatically managed group that is not part of ordinary creation.

Current paired references exist in tastings, reviews, collection entries, flights, store prices, aliases, observations, classifier decisions, repair proposals, activity events, serializers, search, indexing, and web URLs. The migration therefore requires additive schema phases and compatibility adapters before legacy columns or routes can be removed.

## Goals / Non-Goals

**Goals:**

- Give every concrete marketed catalog entry one Bottle identity and one `bottleId`.
- Ensure every Bottle belongs to exactly one automatically created BottleGroup.
- Make independent Bottle creation safe without automatic semantic grouping.
- Represent exact and unknown-exactness activity with one database-enforced target id.
- Promote every existing `bottle_release` into a Bottle without losing source data, user activity, aliases, images, or URL reachability.
- Preserve generic activity from an old parent with known releases at the group level rather than assigning it to an arbitrary exact Bottle.
- Support reversible, audited BottleGroup merge and split operations.
- Remove release-specific APIs, fields, and nested user workflows after compatibility traffic reaches zero.

**Non-Goals:**

- Infer expression equivalence reliably from names, series, or normalized strings.
- Automatically merge independently created singleton groups based only on classifier confidence or fuzzy search.
- Treat BottleSeries as equivalent to BottleGroup; a series may contain multiple distinct expression groups.
- Model an individual physical unit owned by a user. Collection membership remains separate from catalog identity.
- Redesign observations, prices, reviews, collections, or flights beyond replacing their target identity.
- Preserve the numeric id of a `bottle_release` when it becomes a Bottle; an explicit mapping and redirects preserve identity instead.

## Decisions

### Bottle is concrete and BottleGroup is the expression aggregate

The final model is:

```text
BottleGroup (shared expression identity)
  -> Bottle (one concrete marketed release)
  -> Bottle (another concrete marketed release)
```

BottleGroup owns the stable display identity needed for a generic target: group name, brand, bottler/distillers, category, series, stable stated age, aliases, representative Bottle, and aggregate statistics. Bottle owns its exact display name and release facts: edition, release/vintage year, release-specific age, ABV, single-cask/cask-strength flags, cask traits, exact image/content, aliases, and exact statistics.

Every Bottle has a non-null `groupId`. A BottleGroup must have at least one active Bottle after a transaction completes. User-facing pages may call a group “this expression” or “all releases”; ordinary users do not create a BottleGroup directly.

This retains normalized shared metadata without allowing the group to impersonate an exact Bottle. The alternative of putting every field on Bottle and deriving a group name from members was rejected because a safe generic name cannot be inferred by stripping years, batches, or cask tokens.

### Group creation is automatic; semantic merging is contextual

The Bottle creation service creates the BottleGroup, its generic target, the Bottle, and its exact target in one transaction. Independent creation always creates a singleton group. A caller may reuse a group only through a trusted context:

- “Add another release” from an existing Bottle;
- migration from an existing parent and its releases;
- an exact curated group identifier or accepted alias relationship;
- a moderator-approved group merge.

Search and classifier logic may suggest likely groups, but unreviewed name similarity, series equality, or shared brand metadata cannot silently merge groups. False separation is repairable without corrupting aggregates; false grouping is not.

The alternative of deterministic grouping by a normalized identity key was rejected because the normalization contract explicitly cannot decide release scope or discard identity-bearing batch, year, cask, retailer, brand, or distillery information.

### A catalog target table replaces paired foreign keys

Add a `catalog_target` table with one row for the generic BottleGroup target and one row for every exact Bottle target:

```text
catalog_target
  id
  bottle_group_id  NOT NULL
  bottle_id        NULL for the group target, otherwise NOT NULL
```

Database constraints enforce:

- exactly one generic target per BottleGroup;
- exactly one exact target per Bottle;
- an exact target's Bottle belongs to the stored BottleGroup, using a composite foreign key or equivalent constraint;
- consumers reference only `catalog_target.id`, never an independently supplied group/Bottle pair.

Hydrated target schemas expose a discriminated result:

```ts
type CatalogTarget =
  | { kind: "group"; targetId: number; group: BottleGroup }
  | { kind: "bottle"; targetId: number; group: BottleGroup; bottle: Bottle };
```

Bottle pages and exact catalog APIs continue to use `bottleId`. Activity-bearing tables use `targetId`. This avoids replacing `(bottleId, releaseId)` with another invalidatable pair such as `(groupId, bottleId)`.

The alternative of nullable `groupId` and `bottleId` columns on every consumer was rejected because it repeats polymorphic validation and indexing across the same surfaces that currently mishandle paired release references.

### The unified form always creates a Bottle

The existing Add Bottle and Add Bottling field components become one add/edit Bottle form. It accepts stable group fields and exact Bottle fields in one draft, but the creation service owns persistence:

- independent creation creates a singleton group automatically;
- “another release” pre-fills stable fields from the source group and creates only a new Bottle in that group;
- inactive or inferred group identifiers are never accepted from arbitrary query parameters;
- exact duplicate checks apply to Bottle identity; likely expression-group matches are suggestions, not blocking identity decisions.

The ordinary workflow never asks “Bottle or Bottling?” and never exposes a standalone Create BottleGroup form.

### Series remains a broader merchandising relationship

BottleGroup membership means the same marketed expression across batches, years, or editions. BottleSeries remains an optional relationship across distinct expressions in a named range. Series membership does not aggregate ratings and is never sufficient evidence to merge BottleGroups.

Examples:

- Springbank 12 Cask Strength Batch 23 and Batch 24: one BottleGroup, two Bottles.
- Macallan 18 annual releases: one BottleGroup when the producer presents them as annual versions of the same expression.
- Octomore 13.1 and 13.3: separate BottleGroups, optionally within one series.
- A retailer bottle number or unit-specific outturn: an observation, not a new group by itself.

### Group merge and split preserve exact targets

Merging BottleGroups reassigns member Bottles to the destination group, moves generic target references to the destination generic target, consolidates aliases, retains a group tombstone, and recomputes aggregates. Exact Bottle ids and exact target ids do not change.

Splitting selected Bottles creates a new group and generic target, then moves the selected Bottles without changing their ids or exact targets. Existing generic activity remains on the source group unless a moderator explicitly moves it because the system cannot infer which expression it described.

Bottle merge remains a distinct exact-duplicate operation. It merges two concrete Bottles and their exact targets; it does not imply that all other members of either group are duplicates.

### Migration uses additive mappings and a shadow-read period

Generated Drizzle migrations add BottleGroup, Bottle membership, catalog targets, mapping/tombstone data, and nullable target references before changing existing data. Application backfill code, rather than hand-authored migration SQL, performs resumable batches and records an auditable mapping from every legacy release id to its promoted Bottle id.

Backfill rules are deterministic:

1. Create one BottleGroup from every legacy parent Bottle's stable identity.
2. A parent with no releases remains the concrete Bottle, preserving its id, and joins its singleton group.
3. For a parent with releases, create one concrete Bottle per release by combining stable parent identity with release-owned fields. Assign all promoted Bottles to the parent's group.
4. Map legacy references with a non-null `releaseId` to the promoted Bottle's exact target.
5. Map legacy references with a null `releaseId` under a parent that has releases to the group's generic target.
6. Map legacy references with a null `releaseId` under a parent with no releases to the retained Bottle's exact target.
7. Parent-only aliases under a parent with releases become group aliases; release aliases become exact Bottle aliases.
8. Parent rows replaced by promoted Bottles are retired only after every foreign key has moved. Old parent and nested release URLs resolve through target mappings and tombstones.

Before promotion, a dry-run audit reports full-name/alias collisions, parent release-like fields alongside child releases, invalid parent/release pairs, missing creators, incompatible ages, and target counts by consumer table. Existing dirty-parent repair tooling must resolve or explicitly waive ambiguous parent data before destructive cleanup.

### Statistics count target data once

Exact Bottle statistics include only activity on that Bottle's exact target. BottleGroup aggregates include activity on all member Bottle targets plus activity recorded directly against the generic group target. Group aggregation must not add already materialized Bottle totals to raw group-target rows in a way that double-counts activity.

Representative group content is selected explicitly from a member Bottle or stored as group-level editorial content. It is not copied opportunistically from the latest release during reads.

### Compatibility is read/write translation, not a permanent second model

During migration, old release inputs resolve through the release-to-Bottle mapping and old release-shaped outputs are adapters over the new Bottle. New writes create only BottleGroup/Bottle/target records. The compatibility layer records usage so removal is gated on zero legacy write traffic and an agreed read deprecation window.

Nested `/bottles/:oldParentId/bottlings/:releaseId` URLs permanently redirect to the promoted Bottle. A retired parent Bottle URL redirects to the BottleGroup page. APIs return explicit replacement identifiers rather than silently choosing a member Bottle for a generic target.

Compatibility does not permit a second business-logic implementation. When a
new service replaces a legacy writer or reader, the old internal implementation
is deleted in the same slice; any retained route may only translate its legacy
input/output and delegate to the new service. Every temporarily retained path
must have an explicit removal task:

- BottleRelease write adapters: tasks 5.4 and 9.4/9.7;
- paired-reference dual writes: tasks 5.6, 7.3, and 9.6;
- legacy target resolution and dual reads: tasks 3.2/3.7, 7.1/7.3, and 9.5/9.7;
- release-only search/indexing: task 7.5;
- nested Bottling UI: task 8.9;
- remaining runtime/storage references: tasks 9.6, 9.7, and 9.9.

At the end of each implementation slice, rerun the inventory and remove any
superseded code that is not required by one of those measured compatibility
paths. Tests that exist only for removed behavior are deleted or rewritten with
the implementation they covered.

## Risks / Trade-offs

- **Ambiguous legacy parent fields could create a missing or invented Bottle** → Audit parents with both releases and release-like fields, run existing repair tooling, and require an explicit migration disposition before retirement.
- **The cross-cutting target migration can produce mixed reads** → Add `targetId` first, dual-read with parity assertions, backfill in resumable batches, and gate every cutover on zero null/mismatch counts.
- **Promoted names or aliases can collide with existing Bottles** → Produce a preflight collision report and resolve through exact Bottle merge/mapping rather than suffixing or silently overwriting names.
- **Automatic fuzzy grouping can corrupt ratings** → Automatically create singleton groups but require trusted context or moderation for group merges.
- **More rows are created for singleton products** → Keep groups invisible in normal UI and create group/Bottle/targets atomically; the predictable invariant is worth the storage overhead.
- **Generic targets complicate some consumers** → Centralize polymorphism in `catalog_target` and serializers so feature tables keep one foreign key.
- **Old URLs and clients may depend on release ids** → Preserve permanent mappings/redirects and instrument compatibility usage before removal.
- **A single large deployment would have a difficult rollback** → Separate additive schema, backfill, read cutover, write cutover, and destructive cleanup releases.

## Migration Plan

1. **Inventory and audit:** add read-only counts and integrity checks for all paired-reference tables, dirty parents, aliases, duplicate names, images, and legacy routes. Capture a production dry-run report.
2. **Additive schema:** generate migrations for BottleGroup, Bottle membership, catalog targets, release-promotion mappings, group tombstones, and nullable `targetId` columns. Do not remove legacy columns.
3. **Domain services:** implement atomic singleton creation, create-another-release, target loading, group merge/split, and idempotent aggregate recomputation with database-backed tests.
4. **New-write cutover:** move Add Bottle, classifier creation, importers, proposals, and repair flows to create concrete Bottles and automatic groups. Keep legacy release routes as instrumented adapters.
5. **Resumable backfill:** create groups/targets, promote releases, migrate aliases and content, and populate every consumer `targetId` according to the deterministic rules. Re-run safely until no work remains.
6. **Parity period:** dual-read target and legacy references, assert serialized identity parity, compare exact/group counts, rebuild search indexes, and verify representative URLs and workflows.
7. **Product cutover:** switch search, Bottle details, Library, tastings, reviews, prices, flights, activity, and moderation UI to Bottle/Group targets. Redirect old nested bottling routes.
8. **Constraint cutover:** make required group/target columns non-null, reject new release writes, and remove paired-reference use from runtime code.
9. **Cleanup:** after compatibility traffic reaches zero, generate migrations removing `releaseId` columns and `bottle_release`; remove release routes, serializers, jobs, form pages, and legacy repair code; update architecture documentation.

Rollback remains straightforward through the parity period: disable new-write cutover, read legacy columns, and retain additive records. After destructive cleanup, rollback requires restoring the pre-cleanup database snapshot or applying a forward repair, so cleanup ships separately with an explicit backup and verification checkpoint.

## Open Questions

None required before implementation. “BottleGroup” is the schema/API term for this change; user-facing copy can be tested separately without changing the identity model.
