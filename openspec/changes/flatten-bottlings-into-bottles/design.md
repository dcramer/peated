## Context

The current `bottle` table represents a stable expression while `bottle_release` optionally represents a concrete marketed release. Release-like columns also exist on `bottle` for legacy and “single known release” cases. Downstream records generally carry `bottleId` plus nullable `releaseId`, and most boundaries do not have a database constraint proving that the release belongs to the bottle.

This arrangement has two failure modes that cannot be solved by form copy: a creator must decide whether a concrete product is a Bottle or Bottling, and a previously valid Bottle must change identity when a second release is discovered. The revised model makes exact releases uniformly Bottles and moves shared expression identity into an automatically managed group that is not part of ordinary creation.

Current paired references exist in tastings, reviews, collection entries, flights, store prices, aliases, observations, classifier decisions, repair proposals, activity events, serializers, search, indexing, and web URLs. The migration therefore requires additive schema phases and compatibility adapters before legacy columns or routes can be removed.

## Goals / Non-Goals

**Goals:**

- Give every concrete marketed catalog entry one Bottle identity and one `bottleId`.
- Keep every Bottle independently complete, correct, and renderable without
  hydrating its BottleGroup.
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

BottleGroup owns the generic target's shared label and the editing semantics for
common identity and metadata: group name, brand, bottler/distillers, category,
series, flavor profile, stable stated age, stable aliases, representative
Bottle, and aggregate statistics. Every Bottle durably stores the common values
needed for its own complete identity plus its exact display name and release
facts: edition, release/vintage year, effective stated age, ABV,
single-cask/cask-strength flags, cask traits, exact image/content, aliases, and
exact statistics. An exact Bottle read, serializer, search result, or page uses
the Bottle record and does not require BottleGroup hydration to become correct
or renderable.

Every Bottle has a non-null `groupId`. Every active BottleGroup must have at
least one active Bottle after a transaction completes. A merge does not retain
an empty retired BottleGroup row: after its members and generic references move,
the source generic target and group are removed while a durable tombstone keeps
the retired group id mapped to its destination. User-facing pages may call a
group “this expression” or “all releases”; ordinary users do not create a
BottleGroup directly.

BottleGroup is the moderator editing scope for shared values, while each Bottle
is the durable, authoritative exact record presented to users. A shared edit is
therefore a transactional fan-out, not a runtime inheritance relationship. This
retains an explicit generic identity without allowing the group to impersonate
an exact Bottle. Deriving a group name from member Bottles was rejected because
a safe generic name cannot be inferred by stripping years, batches, or cask
tokens.

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

### Shared edits atomically regenerate complete Bottles

Moderator updates distinguish shared group edits from exact-only Bottle edits.
An exact-only edit updates the selected Bottle and its exact aliases without
mutating its BottleGroup or sibling Bottles. A shared edit updates the
BottleGroup and atomically fans out the new common identity and metadata to
every member Bottle, including the durable brand, bottler, distiller, category,
series, flavor-profile, effective stated-age, and complete name materialization
needed by exact Bottle reads.

Bottle `statedAge` always stores the effective age without adding provenance
schema. Relative to the pre-update current group age, a non-null Bottle age that
differs is an exact override; a null or equal value means shared inheritance.
An exact null clears the override and materializes the resulting group age on
the Bottle. An explicit exact age equal to the shared age is semantically
redundant and does not become a sticky override. A shared-age fan-out preserves
the differing exact overrides identified against the current group age and
writes the resulting group age to every other member.

The fan-out regenerates each member's complete `name` and `fullName` from the
new shared identity plus that member's preserved exact fields. In particular, a
stable group label or prefix rename regenerates every member's complete exact
identity. Every previous canonical exact name remains attached to the same
Bottle as an exact alias. The transaction preflights and enforces Bottle and
alias uniqueness; any name or alias collision, incomplete member update, or
audit failure rolls back the group edit, all member updates, and all alias
changes together. Indexing, verification, and other slow post-commit work
remains idempotent and outside the committed request path.

Task 4.6 uses the existing `bottle` update audit shape. A shared fan-out writes
one transactional Bottle update row per affected member with group id and
shared-scope context. When the selected Bottle also has exact changes, its one
row contains the combined shared and exact context rather than writing two
rows. Task 4.6 does not add a `bottle_group` audit enum or migration.

Neither shared nor exact-only updates change Bottle ids, group membership,
generic or exact target ids, representative selection, activity, or
Bottle/BottleGroup activity and rating aggregates. When a shared edit changes
series membership or repairs drift, task 4.6 recomputes only the affected old
and new BottleSeries `numReleases` membership counts. Other statistics remain
owned by their explicit merge, split, representative, and recomputation
operations.

### Series remains a broader merchandising relationship

BottleGroup membership means the same marketed expression across batches, years, or editions. BottleSeries remains an optional relationship across distinct expressions in a named range. Series membership does not aggregate ratings and is never sufficient evidence to merge BottleGroups.

Examples:

- Springbank 12 Cask Strength Batch 23 and Batch 24: one BottleGroup, two Bottles.
- Macallan 18 annual releases: one BottleGroup when the producer presents them as annual versions of the same expression.
- Octomore 13.1 and 13.3: separate BottleGroups, optionally within one series.
- A retailer bottle number or unit-specific outturn: an observation, not a new group by itself.

### Group merge and split preserve exact targets

Group merge is an explicit moderator user action analogous to Merge Bottle. One
request merges one source group into one selected destination; it is not a
classifier, repair, or background inference. The destination's shared identity
wins. Every moved Bottle is atomically rematerialized from that shared identity
and its preserved exact fields, and every previous canonical exact name remains
an exact alias for the same Bottle. Bottle ids and exact target ids do not
change.

The merge repoints every source-generic consumer and stable alias to the
destination generic target before retiring the source target and group behind a
durable tombstone. When both groups already have an entry in the same
collection, the destination row wins except that its blank image may be filled
from the source row. Duplicate flight membership collapses to one destination
row. A tasting uniqueness collision or any unresolved Bottle identity, alias,
or SMWS conflict is ambiguous and rolls back the complete merge rather than
choosing or discarding a record.

An identical retry whose source tombstone already names the selected
destination succeeds as an unchanged operation. A source retired to another
destination conflicts. Task 4.7 adds transactional `bottle_group` before/after
audit snapshots plus one Bottle update audit per moved member, including enough
source/destination and alias context for an explicit reversal. It also brings
forward the shared BottleGroup aggregate recomputation helper so the destination
is recalculated from raw exact and generic target activity after the move. Task
4.11 remains open for the remaining exact-Bottle recomputation and reusable
statistics entry points.

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

The production audit is a deployment-phase freshness gate, not a prerequisite
for additive local implementation. After the additive schema and backfill
tooling are deployed, a dry run from that same deployed revision reports
full-name/alias collisions, parent release-like fields alongside child releases,
invalid parent/release pairs, missing creators, incompatible ages, and target
counts by consumer table. The retained report identifies the Git revision,
database migration revision, generation time, and database. Existing
dirty-parent repair tooling must resolve or explicitly waive ambiguous parent
data before live backfill writes, and the audit runs again at constraint
cutover.

### Statistics count target data once

Exact Bottle statistics include only activity on that Bottle's exact target. BottleGroup aggregates include activity on all member Bottle targets plus activity recorded directly against the generic group target. Group aggregation must not add already materialized Bottle totals to raw group-target rows in a way that double-counts activity.

The transaction-scoped BottleGroup recomputation helper is introduced with
group merge because a committed merge cannot leave destination aggregates
stale. Task 4.11 completes exact-Bottle recomputation and the remaining reusable
job/service entry points; it does not replace the merge helper with a parallel
calculation.

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
- exact-Bottle runtime dependence on BottleGroup hydration: task 9.9;
- remaining runtime/storage references and the final zero-legacy audit: tasks 9.6,
  9.7, and 9.10.

At the end of each implementation slice, rerun the inventory and remove any
superseded code that is not required by one of those measured compatibility
paths. Tests that exist only for removed behavior are deleted or rewritten with
the implementation they covered.

## Risks / Trade-offs

- **Ambiguous legacy parent fields could create a missing or invented Bottle** → Audit parents with both releases and release-like fields, run existing repair tooling, and require an explicit migration disposition before retirement.
- **The cross-cutting target migration can produce mixed reads** → Add `targetId` first, dual-read with parity assertions, backfill in resumable batches, and gate every cutover on zero null/mismatch counts.
- **Promoted names or aliases can collide with existing Bottles** → Produce a preflight collision report and resolve through exact Bottle merge/mapping rather than suffixing or silently overwriting names.
- **A shared edit can collide or partially rematerialize a group** → Lock and
  update the group, all member Bottles, retained exact aliases, and audit rows in
  one transaction; roll back the entire edit on any collision or failed member.
- **Automatic fuzzy grouping can corrupt ratings** → Automatically create singleton groups but require trusted context or moderation for group merges.
- **More rows are created for singleton products** → Keep groups invisible in normal UI and create group/Bottle/targets atomically; the predictable invariant is worth the storage overhead.
- **Generic targets complicate some consumers** → Centralize polymorphism in `catalog_target` and serializers so feature tables keep one foreign key.
- **Old URLs and clients may depend on release ids** → Preserve permanent mappings/redirects and instrument compatibility usage before removal.
- **A single large deployment would have a difficult rollback** → Separate additive schema, backfill, read cutover, write cutover, and destructive cleanup releases.

## Migration Plan

1. **Inventory and audit tooling:** add read-only counts and integrity checks for all paired-reference tables, dirty parents, aliases, duplicate names, images, and legacy routes. Validate the report contract locally without requiring production access.
2. **Additive schema:** generate migrations for BottleGroup, Bottle membership, catalog targets, release-promotion mappings, group tombstones, and nullable `targetId` columns. Do not remove legacy columns.
3. **Domain services:** implement atomic singleton creation, create-another-release, target loading, group merge/split, and idempotent aggregate recomputation with database-backed tests.
4. **New-write cutover:** move Add Bottle, classifier creation, importers, proposals, and repair flows to create concrete Bottles and automatic groups. Keep legacy release routes as instrumented adapters.
5. **Resumable backfill:** after the additive schema and backfill tooling are deployed, run and retain the fresh production dry run from that revision and approve its counts before live writes. Then create groups/targets, promote releases, migrate aliases and content, and populate every consumer `targetId` according to the deterministic rules. Re-run safely until no work remains.
6. **Parity period:** dual-read target and legacy references, assert serialized identity parity, compare exact/group counts, rebuild search indexes, and verify representative URLs and workflows.
7. **Product cutover:** switch search, Bottle details, Library, tastings, reviews, prices, flights, activity, and moderation UI to Bottle/Group targets. Redirect old nested bottling routes.
8. **Constraint cutover:** make required group/target columns non-null, reject new release writes, and remove paired-reference use from runtime code.
9. **Cleanup:** after compatibility traffic reaches zero, generate migrations removing `releaseId` columns and `bottle_release`; remove release routes, serializers, jobs, form pages, and legacy repair code; remove runtime dependence on BottleGroup hydration for exact Bottle rendering while retaining complete Bottle materialization; then run the final zero-legacy and materialization-invariant audit and update architecture documentation.

Rollback remains straightforward through the parity period: disable new-write cutover, read legacy columns, and retain additive records. After destructive cleanup, rollback requires restoring the pre-cleanup database snapshot or applying a forward repair, so cleanup ships separately with an explicit backup and verification checkpoint.

## Open Questions

None required before implementation. “BottleGroup” is the schema/API term for this change; user-facing copy can be tested separately without changing the identity model.
