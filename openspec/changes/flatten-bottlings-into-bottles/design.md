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

Task 5.3 is split into two coherent cutovers. Task 5.3a moves the standard
moderator route and live edit workflow to strict `shared` and `exact` patches
over the canonical service. Its mod-only edit-context read resolves the exact
CatalogTarget, but intentionally sources shared values and rich entity/series
choices from BottleGroup ownership; ordinary exact Bottle reads remain
independent and do not hydrate the group. Task 5.3b separately composes
moderator price-match correction approval with the canonical update
transaction and removes the superseded proposal-specific updater in the same
transactional slice. Until task 5.7 introduces target-aware proposal actions,
the legacy `proposedBottle` repair draft retains its sparse parent/stable
meaning: required name and brand, non-null series, category, stable stated age,
and bottler, and non-empty distillers are shared intent; non-null edition, ABV,
flags, years, and canonical cask fields are exact intent for the selected
Bottle. Null fields and empty distiller lists remain omitted rather than
clearing catalog facts.

Correction approval and the canonical concrete update commit in one database
transaction. The canonical post-commit finalizer runs only after that combined
transaction succeeds, while the retained price-listing alias finalizer remains
proposal orchestration. The correction route keeps its Bottle response for the
live moderation UI, but performs no direct Bottle or BottleRelease update or
name rewrite. Task 5.7 owns the later target-aware action, result, and explicit
exact-age proposal contracts.

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

Splitting selected Bottles creates a new group and generic target, clones the
source shared identity and group distillers, and moves the selected Bottles
without rematerializing them. The source retains its group-owned editorial
content, stable aliases, generic target, and generic activity. The new group
starts with empty explicit editorial content and an explicitly selected
moved-member representative. Exact Bottle content, ids, targets, aliases, and
Bottle distiller rows remain unchanged. A later shared identity edit uses the
normal atomic fan-out path. The system does not infer that existing generic
activity described the split expression.

Bottle merge remains a distinct exact-duplicate operation. It merges two
concrete Bottles and their exact targets; it does not imply that all other
members of either group are duplicates. The destination Bottle remains
independently authoritative: its identity, exact content, distillers, Bottle id,
and exact target win. Exact consumers, aliases, promotion mappings, and derived
counts converge on it without copying BottleGroup presentation into the Bottle.

Within one group, merging its representative into another member selects the
destination as representative. Across groups, a non-representative source may
be removed without moving its siblings or generic activity. A representative
with surviving siblings must first be replaced explicitly, while a singleton
source retires its now-empty group and moves generic consumers and stable aliases
to the destination group without selecting an arbitrary exact Bottle. Identical
tombstone retries are unchanged and a retry naming another destination
conflicts. Bottles that still own unmigrated `bottle_release` children are
rejected rather than running a second legacy merge algorithm.

Every legacy release keeps its own promotion mapping, while audited exact
Bottle merges may make multiple mappings converge on the surviving Bottle.

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
for additive local implementation and not a reason to deploy dormant
application behavior. Implementation commits are review boundaries rather than
deployment units. Once the additive schema and backfill tooling are available
in the controlled production migration, a dry run from that exact revision must
run against production immediately before live backfill writes. It reports
full-name/alias collisions, parent release-like fields alongside child releases,
invalid parent/release pairs, missing creators, incompatible ages, and target
counts by consumer table. The retained report identifies the Git revision,
database migration revision, generation time, and database. Existing
dirty-parent repair tooling must resolve or explicitly waive ambiguous parent
data before live backfill writes, and the audit runs again at constraint
cutover. Each constraint or cleanup gate uses a new retained production run from
its exact candidate Git and migration revisions; it records its generation time
and database, reconciles every count, and requires explicit approval. Neither
can reuse the immediately-pre-backfill task 6.13 report as freshness evidence.
No production backfill may begin without the fresh retained pre-backfill report
and explicit approval.

### Statistics count target data once

Exact Bottle statistics include only activity on that Bottle's exact target. BottleGroup aggregates include activity on all member Bottle targets plus activity recorded directly against the generic group target. Group aggregation must not add already materialized Bottle totals to raw group-target rows in a way that double-counts activity.

The transaction-scoped BottleGroup recomputation helper is introduced with
group merge because a committed merge cannot leave destination aggregates
stale. Task 4.11 completes exact-Bottle recomputation and the remaining reusable
job/service entry points; it does not replace the merge helper with a parallel
calculation.

Task 4.11a establishes `aggregateCatalogTargetStatsInTransaction` in
`apps/server/src/lib/recomputeCatalogTargetStats.ts` as the sole owner of the
raw-target tasting query and rating math. `recomputeBottleStats` validates one
active exact target and overwrites only that Bottle's statistics from activity
on that target. `recomputeBottleGroupStats` validates the active group graph,
supplies its generic target and all member exact targets to the same calculator,
and overwrites the group aggregates without summing materialized Bottle totals.

Task 4.11b implements the runtime side of the eventual post-backfill,
parity-gated statistics cutover for tasting mutations. The shared
`resolveCatalogTargetForAssignment` boundary returns a validated descriptor
containing `targetId`, `groupId`, and nullable exact `bottleId`. Tasting create
always persists the resolved target. Update and delete trust an existing durable
target; only a row whose `targetId` is still null uses the measured legacy
`(bottleId, releaseId)` resolver, and update persists that resolved target as a
small compatibility backfill. This descriptor boundary replaces the former
ID-only assignment facade so consumers do not reconstruct target identity.
There is no statistics fallback to legacy `bottleId` activity.

After a committed tasting create or delete, a rating-changing update, or a
null-target repair, a shared dispatcher independently queues one delayed
idempotent job from the resolved descriptor. Each qualifying event gets its own
job rather than sharing a stable coalescing key; completed jobs are removed. A
notes-only update to a row that already has a durable target does not dispatch
statistics work. Exact activity dispatches `UpdateBottleStats`, which delegates
to exact recomputation and then recomputes its BottleGroup. Generic activity
dispatches `UpdateBottleGroupStats`, which delegates only to group recomputation.
Both paths preserve the existing entity-aggregate refresh through one shared
helper. Until entity statistics become target-aware, both exact and generic
tasting jobs carry the retained tasting `bottleId` as `entityStatsBottleId`
only as compatibility context for that refresh. An exact job's separate
`bottleId` is the validated exact Bottle scope for its durable `targetId`; the
compatibility Bottle on a generic job does not affect the target-backed group
calculation.
Every statistics event independently queues an idempotent downstream entity
refresh rather than coalescing events under a stable key. Successful downstream
jobs are removed and failed jobs are retained for diagnosis and retry. Task
7.10 replaces the bridge with target-aware queue/entity work, task 9.6 removes
its obsolete consumer `bottleId`/`releaseId` storage, and task 9.7 removes the
runtime compatibility branch.
Publication failure is recorded with the tasting and resolved target identity
without failing an already committed user write. The former worker-owned raw SQL
and every tasting-route inline Bottle statistics formula are removed; the
canonical raw-target calculator remains the only rating-math owner.

Worker handlers log and rethrow failures so BullMQ records them as failed, and
statistics jobs retain failed records while removing successful ones. A retry
therefore reruns the idempotent canonical services rather than losing an
incomplete downstream refresh.

`UpdateBottleStats` has a strict mixed-version cutover gate. Its previous
`{ bottleId }` payload cannot identify whether legacy activity should resolve to
a promoted exact target, so the target-backed worker deliberately has no
payload fallback. Before enabling the new worker, operators must stop or
upgrade every old producer and drain or expire every queued legacy payload.
Queued `OnBottleChange` jobs for legacy parent Bottles pose the same activation
risk: after promotion and parent retirement, their `bottleId` has no active
exact target. Operators must stop or upgrade those producers and drain or
expire those jobs as part of the same gate. The `bottles fix-stats` maintenance
command instead selects exact-target rows and dispatches their Bottle ids
directly; strict recomputation validates the active graph and target integrity
and stops on an invalid row rather than silently skipping it. This explicitly
exact maintenance intent is separate from tasting assignment descriptor
routing. Task 7.10 owns verification of these producer and queue-payload
transitions; task 7.7 retains the aggregate parity evidence and approval for the
statistics cutover itself.

This runnable implementation slice is not independently deployable or
servable. The tasting work is the task 5.6a subset; remaining review,
collection, flight, and price mutation dual-writes keep task 5.6 open. Before
the target-backed statistics path can serve production, section 6 must complete
promotion and consumer target backfill, the graph must have zero required null
or invalid targets, and task 7.7 must retain matching target/legacy aggregate
evidence and deployment approval. The fresh production audit runs immediately
before the production migration and must approve the backfill; it does not
authorize an earlier dormant application deployment.

Representative group content is selected explicitly from a member Bottle or stored as group-level editorial content. It is not copied opportunistically from the latest release during reads.

### Compatibility is read/write translation, not a permanent second model

During migration, old release inputs resolve through the release-to-Bottle
mapping. Retained read APIs may project a legacy release shape from the new
Bottle, while write adapters return explicit replacement identity instead of
inventing a legacy id. New writes create only BottleGroup/Bottle/target records.
The compatibility layer records usage so removal is gated on zero legacy write
traffic and an agreed read deprecation window.

Nested `/bottles/:oldParentId/bottlings/:releaseId` URLs permanently redirect to the promoted Bottle. A retired parent Bottle URL redirects to the BottleGroup page. APIs return explicit replacement identifiers rather than silently choosing a member Bottle for a generic target.

Task 5.4 is split by mutation lifecycle. Task 5.4a retains the legacy
BottleRelease create input, authentication, and terms-acceptance requirements,
but treats the supplied parent Bottle only as trusted group context. The source
must be an active Bottle with a valid group and exact target. The adapter passes
the release-owned fields through canonical concrete creation and returns the
versioned exact CatalogTarget result. It never inserts a BottleRelease or uses
the created Bottle id as a fake legacy release id. Legacy `imageUrl` cannot be
translated into the canonical upload boundary, so a non-null value is rejected
rather than silently ignored; all remaining exact fields use canonical runtime
validation. A missing or retired source fails explicitly. The adapter does not
guess a member Bottle, follow a representative as exact identity, or recover
group authority from a tombstone.

Task 5.4b is a measured promotion-mapped adapter. It requires a completed
release-promotion mapping, translates only supplied legacy fields into a sparse
exact patch, and delegates to the canonical concrete Bottle update operation
used by the standard Bottle route. Omitted fields remain unchanged. An explicit
null clears the corresponding nullable canonical exact value, including a null
`imageUrl`, while a non-null legacy `imageUrl` is rejected rather than bypassing
the canonical upload boundary. The adapter returns the mapped Bottle's exact
CatalogTarget and leaves the retained BottleRelease row unchanged. It performs
no parallel direct alias, audit, or job writes; those effects remain owned by
the canonical update operation. A successful compatibility event records the
legacy release id and replacement Bottle and target ids. Read/UI coherence must
be handled by the staged read and product cutovers rather than by a second
writer.

Task 5.4c makes the existing `mergeConcreteBottles` operation the only way to
retire a grouped exact Bottle. The moderator must select an explicit surviving
Bottle; the merge owns exact-consumer consolidation, promotion-mapping
repointing, aliases and tombstones, representative replacement, and singleton
group retirement. Neither a delete route nor a compatibility adapter may guess
the representative, a sibling, the generic target, or any other destination.
Promotion mappings remain live and may converge on the selected survivor, so
this slice adds no retired-promotion state or migration.

The standard Bottle DELETE route is retained only as a measured compatibility
path for ungrouped pre-migration Bottles. A grouped concrete Bottle is rejected
without mutation with an actionable merge-required result. BottleRelease DELETE
retains its external admin authorization, path, input, and output contract,
but resolves the completed promotion mapping and makes no mutation: a valid
mapping returns an actionable merge-required result naming the mapped Bottle
and exact target, while a missing, incomplete, or inconsistent mapping returns
a conflict. It never deletes the retained BottleRelease row. Web delete actions
that would always reach this rejection are removed or hidden in this slice;
tasks 8.9 and 9.7 remove the remaining nested UI and compatibility surfaces.
These boundaries preserve the independently complete Bottle and shared-edit
fan-out invariants rather than introducing destination-free canonical deletion.

Legacy release-repair discovery and apply remain compatibility-only for
ungrouped pre-migration Bottles. `legacyReleaseRepairCandidates.ts` filters to
`groupId IS NULL`, and `applyLegacyReleaseRepair.ts` enforces the same condition
in both its preflight read and locked transactional read. A grouped Bottle is
never offered, repaired, or deleted by that path; it requires an explicit exact
Bottle merge. Task 9.7 removes the retained repair compatibility.

### Exact alias assignment establishes a target-aware owner

Task 5.5a makes `assignBottleAlias` and
`assignBottleAliasInTransaction` the canonical owner for the exact/moderator
alias path cut over in this slice. When supplied an exact CatalogTarget, that
owner validates and stores the target with the retained Bottle compatibility
identity. Its targetless mode remains an instrumented compatibility path for
existing callers: it may persist `targetId` as null and does not resolve a
missing target, but it must preserve an existing durable target rather than
downgrading it to a legacy pair.

The raw `apps/server/src/lib/db.ts` `upsertBottleAlias` pair writer and its
creation, repair, import/reference-resolution, and entity-merge callers remain
active outside the task 5.5a cutover. Later task 5.5 caller slices migrate those
callers to explicit exact or generic CatalogTargets; task 9.7 removes the raw
writer and the measured targetless compatibility mode after their staged use
ends. Stable alias assignment through a generic group target is therefore a
final-state requirement, not behavior activated by task 5.5a.

Moderator `PUT /bottle-aliases` keeps its Bottle-shaped external input but treats
that Bottle as exact intent, requires its active exact target, and delegates to
the same assignment operation. It does not infer a stable group alias from a
Bottle id. Alias deletion clears the alias row's `targetId`, `bottleId`, and
`releaseId` together so a target-aware lookup cannot continue resolving an
unassociated row. Target-aware clearing or preservation rules for matching
store-price and review rows belong to task 5.6; task 5.5a does not invent those
consumer semantics.

Exact alias lookup treats a non-null alias `targetId` as authoritative. An exact
target returns its Bottle without reconstructing a release pair, while a generic
target returns no Bottle and never resolves to the representative or another
member. Only an alias whose `targetId` is null may use the measured legacy pair
resolver. Broader target retirement and integrity validation belongs to the
target-backed read and search/index cutovers in tasks 7.3 and 7.5, while
migration ownership and repointing of parent and release aliases remain task
6.10.

Task 5.5a is only the alias half of task 5.5. Observation target assignment for
existing-match and correction price approvals remains task 5.5b; create-new
alias/observation cutover remains task 5.5c after task 5.7 replaces its creation
and decision vocabulary. Task 5.6 owns `targetId` mutation for store prices,
reviews, and the other remaining consumers. These boundaries prevent the alias
slice from silently activating a second consumer or price-matching cutover.

### Existing-match price approvals share one resolved target

Task 5.5b keeps existing-match and correction approvals' legacy
`(bottleId, releaseId)` input and resolves that pair once through the measured
CatalogTarget assignment boundary. The deterministic migration rules decide
the result: a promoted release selects its exact Bottle target, a parent-only
reference with releases selects the generic group target, and a parent without
releases selects the retained Bottle's exact target. The resulting descriptor
is the single semantic assignment decision for the operation. Low-level locked
validation inside the alias writer may recheck target integrity, but it does not
resolve a second intent or choose another target.

The existing-match or correction approval transaction supplies that same
`targetId` to the listing-alias assignment and the source-keyed
BottleObservation upsert. An exact result keeps the alias and observation
exact; a generic result keeps both generic and never substitutes the group's
representative Bottle. Failure to resolve the target or write either record
rolls back the complete approval transaction.

Create-new approval remains on the measured targetless alias/observation
compatibility path in this slice. It still creates legacy ungrouped
Bottle/BottleRelease rows and therefore has no valid concrete CatalogTarget to
assign.
Task 5.7 first replaces that creation and decision vocabulary with concrete
Bottle/target identity; task 5.5c then requires create-new approval to assign
both records to the newly created target. The targetless result is staged
compatibility, not compliant final-state target-backed behavior.

This slice does not redefine price assignment, proposal state, decision-log
vocabulary, or their retained legacy Bottle/Release pair. Store-price and other
consumer dual writes remain task 5.6, target-aware proposal actions and decision
vocabulary remain task 5.7, and target-backed reads remain task 7.3. Task 9.6
removes the retained consumer pair columns after backfill and parity; task 9.7
removes the measured legacy resolver and targetless compatibility after traffic
reaches zero.

Every 5.4 adapter records a structured compatibility write with caller,
operation, legacy identity where one exists, and replacement Bottle/target
identity. Tasks 9.4 and 9.7 respectively disable these writes with an explicit
gone/replacement response and remove the routes after measured traffic reaches
zero. The 5.4 review commits are code-review boundaries, not independently
deployable changes: activation remains gated on the staged migration audit,
promotion/backfill state, valid target graph, parity evidence, and explicit
approval.

Compatibility does not permit a second business-logic implementation. When a
new service replaces a legacy writer or reader, the old internal implementation
is deleted in the same slice; any retained route may only translate its legacy
input/output and delegate to the new service. Every temporarily retained path
must have an explicit removal task:

- BottleRelease write adapters: tasks 5.4a-5.4c and 9.4/9.7;
- paired-reference dual writes and storage: tasks 5.6, 7.3, and 9.6;
- legacy target resolution and dual reads: tasks 3.2/3.7, 7.1/7.3, and 9.5/9.7;
- legacy pair alias assignment and null-target alias lookup: later task 5.5
  caller slices and task 9.7;
- legacy Bottle upsert response translation: task 5.1 retains a measured
  adapter for the scraper, task 5.9 cuts the scraper and any remaining callers
  over to concrete target responses, and task 9.7 removes the adapter after
  measured traffic reaches zero;
- queued `MergeBottle` compatibility adapter: task 9.7;
- legacy release-repair discovery and apply: task 9.7;
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
- **An incompletely sequenced production migration could serve invalid target-backed behavior** → Treat review commits as non-deployable boundaries and gate application activation on the fresh audit, completed backfill, valid target graph, and retained parity; ship destructive cleanup separately after its own approval.

## Migration Plan

1. **Inventory and audit tooling:** add read-only counts and integrity checks for all paired-reference tables, dirty parents, aliases, duplicate names, images, and legacy routes. Validate the report contract locally without requiring production access.
2. **Additive schema:** generate migrations for BottleGroup, Bottle membership, catalog targets, release-promotion mappings, group tombstones, and nullable `targetId` columns. Do not remove legacy columns or treat this review slice as a deployment unit.
3. **Domain services:** implement atomic singleton creation, create-another-release, target loading, group merge/split, and idempotent aggregate recomputation with database-backed tests.
4. **New-write cutover:** move Add Bottle, classifier creation, importers, proposals, and repair flows to create concrete Bottles and automatic groups. Keep legacy release routes as instrumented adapters.
5. **Resumable backfill:** in the controlled production migration, make the additive schema and backfill tooling available, then immediately run and retain the fresh production dry run from that exact revision and approve its counts before live writes. Create groups/targets, promote releases, migrate aliases and content, and populate every consumer `targetId` according to the deterministic rules. Re-run safely until no work remains; do not serve target-dependent application behavior during the incomplete state.
6. **Parity period:** dual-read target and legacy references, assert serialized identity parity, compare exact/group counts, rebuild search indexes, and verify representative URLs and workflows.
7. **Product cutover:** only after completed backfill, a valid zero-null target graph, retained parity evidence, and explicit approval, switch search, Bottle details, Library, tastings, reviews, prices, flights, activity, statistics workers, and moderation UI to Bottle/Group targets. Redirect old nested bottling routes.
8. **Constraint cutover:** make required group/target columns non-null, reject new release writes, and remove paired-reference use from runtime code.
9. **Cleanup:** after compatibility traffic reaches zero, generate migrations removing obsolete consumer `bottleId` columns wherever `targetId` replaces the full legacy pair, plus `releaseId` columns and `bottle_release`, as specified by task 9.6; remove release routes, serializers, jobs, form pages, and legacy repair code; remove runtime dependence on BottleGroup hydration for exact Bottle rendering while retaining complete Bottle materialization; then run the final zero-legacy and materialization-invariant audit and update architecture documentation.

Rollback remains straightforward through the parity period: disable new-write cutover, read legacy columns, and retain additive records. After destructive cleanup, rollback requires restoring the pre-cleanup database snapshot or applying a forward repair, so cleanup ships separately with an explicit backup and verification checkpoint.

## Open Questions

None required before implementation. “BottleGroup” is the schema/API term for this change; user-facing copy can be tested separately without changing the identity model.
