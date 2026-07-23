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
- Make every ordinary/manual Bottle creation independent and prevent callers
  from selecting or reusing BottleGroup identity.
- Keep automatic semantic grouping outside the ordinary creation request.
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

### Group creation is automatic and outside manual identity selection

The ordinary Bottle creation service creates a fresh BottleGroup, its generic
target, the complete Bottle, and its exact target in one transaction. Every
manual or ordinary public/API creation starts in a singleton group, including a
Bottle created from an “add another release” prefilled form. No supported
ordinary caller supplies a group id, source Bottle as grouping authority, or
other group-reuse instruction.

Trusted group reuse remains an internal capability only for deterministic
legacy migration, measured compatibility adapters whose old contracts require
source context, and explicitly system-controlled grouping operations. A
separate automatic grouping process may later consolidate singleton groups; it
is not part of the user submission and does not turn prefill data into group
authority. Moderator merge/split remains an audited exceptional correction
boundary, not the normal way a user assigns a BottleGroup.

Search and classifier evidence may inform that separate grouping process, but
name similarity, series equality, or shared brand metadata alone is not enough
to silently merge groups. False separation is repairable without corrupting
aggregates; false grouping is not.

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
- “another release” pre-fills a complete independent draft from the selected
  Bottle and submits the same standard Bottle creation mutation, which creates
  a new singleton group;
- source Bottle and group identifiers are never accepted as ordinary creation
  authority from routes, forms, or query parameters;
- exact duplicate checks apply to Bottle identity; likely expression-group matches are suggestions, not blocking identity decisions.

The ordinary workflow never asks “Bottle or Bottling?” and never exposes a standalone Create BottleGroup form.

Section 8 composes retained create-proposal evidence into that same independent
Bottle draft before form validation. This is a creation-only UI contract,
distinct from both the sparse correction mapper and the measured legacy
Bottle/Release compatibility translator. Serialized proposal objects use null
for missing nullable stable evidence, so a non-null `proposedBottle` value is
authoritative while null, omission, or release-only evidence inherits the
independently complete source value. An explicit empty distiller list remains
authoritative. A non-null `proposedRelease.statedAge`
becomes the singleton Bottle's effective age; otherwise age follows the same
stable fallback. Exact fields preserve the staged release/Bottle/source
precedence: with both proposal layers, the first non-nullish value wins; with
one proposal layer, an owned value including null wins and only omission falls
back to the source. Description provenance follows the layer whose description
is selected: release evidence has no retained Bottle provenance, while a
selected proposed or source Bottle description keeps that Bottle value's
`descriptionSrc`. The standard independent-create schema remains authoritative
for required name, brand, and all field validation.

### Exact Bottle and generic group pages keep identity scopes distinct

The canonical `/bottles/:id` page renders the independently complete Bottle as
the primary identity. It may show a quiet `/bottle-groups/:groupId` relationship
when the group has multiple members and may offer “Add another release,” but
neither link hydrates or replaces the Bottle's exact fields. Search results and
related release lists reuse one exact-metadata presentation owner for
Bottle-owned age, ABV, years, flags, and cask traits.

The canonical `/bottle-groups/:groupId` page is explicitly generic. It renders
the BottleGroup's own label, editorial content, and aggregate statistics,
states that the exact release is unspecified, and lists independently complete
member Bottles linking to `/bottles/:id`. Generic CatalogTarget links resolve to
this group page; they never use `representativeBottleId` to construct an exact
Bottle link or to fill exact Bottle details.

Moderator group merge and split are standalone form workflows reached from the
group page. Merge requires an explicit source and destination and states that
the destination shared identity wins and generic activity moves. Split requires
an explicit nonempty proper subset and representative choices; generic
activity, stable aliases, and group editorial content remain on the source.
These forms delegate to the canonical group mutation APIs and expose no manual
Bottle-creation or group-reuse authority.

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
transactional slice. The `proposedBottle` repair draft remains sparse. Live
classifier corrections persist `statedAgeScope: exact`, making a non-null
`statedAge` exact intent for the selected Bottle. Historical unmarked proposals
retain their original shared-age interpretation until they are drained or
migrated. Required name and brand, non-null series, category, and bottler, and
non-empty distillers are shared intent; non-null edition, ABV, flags, years, and
canonical cask fields are exact intent for the selected Bottle. Marked or
unmarked null age, other null fields, and empty distiller lists remain omitted
rather than clearing catalog facts. Task 9.7 removes both the marker and
unmarked fallback after the historical proposal population is gone; from that
point forward, every non-null correction `statedAge` is exact intent for the
selected Bottle by default, while null remains a sparse unknown.

Correction approval and the canonical concrete update commit in one database
transaction. The canonical post-commit finalizer runs only after that combined
transaction succeeds, while the retained price-listing alias finalizer remains
proposal orchestration. The correction route keeps its Bottle response for the
live moderation UI, but performs no direct Bottle or BottleRelease update or
name rewrite. The create-new cutover does not expand that correction draft or
infer an exact-age repair from its sparse null fields.

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

The core promotion service scans legacy parents by ascending-id keyset pages and
processes one complete parent family per bounded transaction. It locks the
parent, its releases in ascending id order, and any existing promotion mappings
before mutation. The core service returns a cursor-ready result but does not
begin consumer backfill, own a checkpoint, or perform production access. Task
6.11 owns the external checkpoint and coordinates this service with the two
dependent parent-family phases.

The legacy parent's nullable `groupId` is the durable staging link to the
migration-created group. For a parent with no releases, that row becomes the
complete concrete Bottle, receives its exact target, and becomes the group
representative without changing its id. For a parent with releases, the parent
row is not reclassified as an exact marketed Bottle and receives no invented
exact target. It temporarily retains `groupId` only so measured legacy generic
resolution and later parent retirement can find the group; promoted Bottles
are the complete active exact members. This staged legacy meaning is private to
migration and compatibility code and does not make a parent or group id manual
creation authority.

`bottle_tombstone` preserves the destination after a Bottle row is removed. Its
nullable `newBottleId` and `newGroupId` are mutually exclusive: an exact-Bottle
merge records only the selected surviving Bottle, while task 9.8 records only
the legacy parent's staged group when it eventually retires that parent. The
temporary ungrouped compatibility purge may retain a tombstone with both
destinations null; that history is not a destination-free canonical retirement
operation. Any operation that retires a BottleGroup first repoints parent
tombstones naming the source group to the selected destination group, keeping
the redirect graph one hop.

Each release promotion uses this precedence:

- group identity and every durable common Bottle value come from the legacy
  parent: shared name basis, brand, bottler, distillers, category, series,
  flavor profile, and stable stated age;
- the release owns its marketed `name`/`fullName`, edition, release and vintage
  years, ABV, single-cask and cask-strength flags, cask size/type/fill, and a
  non-null release stated age override;
- release-owned exact editorial/content values win when present; otherwise the
  applicable parent content is copied into the promoted Bottle as durable data,
  never inherited by hydrating BottleGroup at read time;
- the promoted Bottle preserves the legacy release creator and timestamps,
  while the group preserves parent creation provenance; missing required
  provenance is a blocking condition rather than permission to use the batch
  actor;
- joins and content that are common or parent-owned are copied to every
  promoted Bottle as required by the ownership matrix;
- the core promotion claims the promoted Bottle's required canonical exact
  alias for its exact target in the same parent-family transaction. That claim
  uses the canonical alias reservation boundary and its database uniqueness,
  without synchronizing alias consumers. Re-homing every other legacy parent
  or release alias and every observation is the separate task 6.5b,
  coordinated with tasks 6.7 and 6.10.

The transaction chooses the Bottle promoted from the lowest legacy release id
as representative. The choice is deterministic presentation only and never
substitutes that Bottle for generic activity.

A release mapping becomes `promoted` only after the complete Bottle, exact
target, durable fields, required joins, and required canonical exact alias
exist. The alias is claimed for that exact target before mapping completion, so
a concurrent canonical identity claim either serializes through the same unique
alias row or rolls back the complete parent family. A rerun may reuse a
completed mapping only after validating that the legacy release still belongs
to the locked parent and that the mapped Bottle, parent group, exact target,
canonical alias, planned canonical identity, and complete materialization
agree. Missing or inconsistent mapped state stops with parent/release context;
it is not silently repaired or duplicated. Earlier parent transactions remain
safely committed when a later parent stops.

Before its first write, the parent-family transaction preflights the complete
planned canonical Bottle names and required canonical alias claims plus
ambiguous release-like parent fields. It enumerates every canonical Bottle and
alias row matching each planned identity; it never selects one arbitrary match
and ignores the rest. Except for the Bottle proven to belong to the same
structurally identical completed mapping on rerun, any conflicting match or
unresolved ownership decision rolls back or prevents every write for that
parent family. The service never suffixes, overwrites, drops, chooses a
different Bottle, or records a completed mapping for a partial promotion. Task
6.6 is therefore complete only when this mutation-path preflight and the
concurrency-safe alias claim exist and are validated; the earlier read-only
inventory is necessary evidence but is not the write gate itself. Broader
legacy alias and observation classification remains task 6.5b rather than
expanding this core slice into consumer backfill.

Task 6.5b/6.10 is a separate parent-family alias and observation backfill after
the core promotion graph is complete. The measured legacy-pair assignment
resolver is its sole semantic resolver: a non-null release requires that
release's completed promotion and exact target; a null release under a parent
with releases resolves to the generic group target; and a null release under a
parent without releases resolves to the retained Bottle's exact target. The
phase resolves each distinct retained pair optimistically to plan the family,
then acquires the canonical group, Bottle when exact, and CatalogTarget locks
plus the applicable parent, release, and promotion-mapping evidence locks. It
re-resolves and revalidates each pair against that locked state before locking
the family aliases and observations, then sets or validates only their
`targetId` values.

Every remaining legacy alias participates, including ignored aliases. Alias
name, embedding, ignored state, assignment source, assigning actor, creation
time, and retained `(bottleId, releaseId)` evidence remain unchanged. The
required canonical exact alias already claimed by task 6.5a is excluded from
selection and mutation. Its unchanged state is covered by integration evidence
for the combined promotion and dependent backfill, not independently
revalidated by this phase.
Observations likewise preserve their retained pair plus source identity,
source URL/site, raw and parsed evidence, facts, creator, and timestamps. A
nonnull target equal to the locked descriptor is a validated rerun; a different
nonnull target, invalid descriptor, changed pair, or incomplete promotion is a
family conflict that rolls back instead of being overwritten or healed.

This target-only phase does not invoke canonical alias assignment, propagate
identity to StorePrices or Reviews, enqueue alias indexing, rename or recreate
aliases, or backfill any other consumer. Tasks 6.7-6.9 own those consumer
tables. Task 6.11 owns command/checkpoint/dry-run behavior and must sequence
this dependent phase after completed core promotion while excluding the
canonical alias and any other overlap. Production execution remains gated by
task 6.13; the later cleanup release remains separately gated by task 10.9.

Tasks 6.7-6.9 share one remaining-consumer parent-family phase. It owns eight
physical tables and ten logical target slots: `tasting`, `review`,
`collection_bottle`, `flight_bottle`, `store_price`,
`incoming_bottle_decision_log`, the current and suggested slots on
`store_price_match_proposal`, and the current and suggested slots on
`store_price_match_attempt`. The phase resolves the complete parent family
through one shared helper, including the parent-only reference and every child
release reference, then locks the resulting descriptor set through the global
BottleGroup, Bottle, and CatalogTarget hierarchy. It also locks the applicable
legacy parent, releases, and completed promotion mappings as migration
evidence, re-resolves the family, and proceeds only when every descriptor still
matches.

Consumer selection uses either side of the retained pair: a row or logical
slot participates when its Bottle is the parent or its release belongs to the
family. This catches a release paired with a null or different Bottle instead
of silently leaving invalid evidence behind. A nullable logical slot with both
Bottle and release null is outside retained-family selection and is not
mutated; the migration preserves its target whether null or nonnull and does
not invent legacy family intent from that target.
The current and suggested proposal/attempt slots are planned and validated
independently even when both occur on one physical row; all applicable slots on
that row are updated together only after the complete family preflight passes.

The phase snapshots fixed row locators and complete retained identity before
locking consumers in deterministic table and row order. `flight_bottle`, which
has no surrogate id, uses its retained `(flightId, bottleId, releaseId)` key;
the other tables use their primary ids plus the applicable logical slot. After
locking, any missing row, pair drift, or target drift aborts the parent family.
It sets only a null target to the resolved descriptor or reuses an equal
nonnull target. A different nonnull target is authoritative conflict evidence
and is never overwritten or healed.

Before mutation, the same preflight detects target-membership uniqueness
collisions for tastings, collections, and flights. Migration does not invoke
the destructive merge/consolidation rules used by moderator Bottle or group
merges, does not choose a winning row, and does not change collection counts.
One conflict in any of the ten slots rolls back every remaining-consumer target
write for that parent family. Every retained pair and every non-target column,
including content, unit state, provenance, processing state, JSON evidence,
decision vocabulary, and timestamps, remains byte-for-byte owned by its
existing row.

This remaining-consumer phase directly performs target-only migration writes;
it does not call tasting statistics dispatch, Review or alias propagation,
collection or Flight mutation services, price ingestion/history/matching,
proposal approval or lease orchestration, decision writers, indexing, queues,
or other runtime business logic. It does not change reads, which remain task
7.3, and it adds no command, production access, or deployment claim. Task 6.11
must run it only after the parent-family core promotion completes and coordinate
it with the separate 6.5b/6.10 alias-observation phase without table overlap or
duplicate selection.

Task 6.11 retains one versioned JSON report as the command's audit artifact and
checkpoint; it does not add a database checkpoint table. The report records an
exact full Git commit, database name, generation time, and the latest applied
Drizzle migration id, hash, and creation timestamp. Before either dry-run or
write behavior, the revision reader requires that applied migration hash and
timestamp to equal the latest candidate migration in the running checkout. In
production, the exact Git commit comes from the configured `VERSION`; in every
nonproduction environment it always comes from a clean worktree's current
`HEAD`, never from `VERSION`. A dry run invokes only that read-only revision
check, the existing migration audit, and read-only parent selection. It does
not call any migration mutation service and does not pretend to simulate the
three write transactions.

The CLI creates a dry-run report atomically through a same-directory,
permission-restricted temporary file and refuses to overwrite it. A write must
name a completed dry-run report and record approver identity and a timestamp
strictly after that report was generated. The approval is bound to the dry
run's exact Git, database, Drizzle revision, and audit contents. A resumed write
must also match the retained write report's approval and revision evidence
exactly; the CLI refuses to open an existing write report without explicit
resume. A write invocation exclusively owns the report through a
permission-restricted sibling lock file for its entire read/run/checkpoint
sequence. Existing locks fail closed; no automatic stale-lock timeout or
takeover exists. An operator may remove a stale lock only after independently
confirming that no writer is live. Once the invocation creates or resumes its
write report, each checkpoint atomically replaces that owned file and fsyncs
the containing directory before returning success.

The report's runtime schema is the durable state-machine owner. It requires
each row count to equal updated plus reused, trims and rejects a blank approver,
and enforces mode/status/checkpoint relationships plus ascending
after/active/next cursor order. A dry run is complete read-only evidence and may
retain its next candidate; a complete write cannot retain an active or next
parent. Failure evidence is phase-discriminated so core, alias/observation,
consumer, and checkpoint locators cannot be mixed. If persisting an operation
failure also fails, the returned checkpoint failure preserves the sanitized
original operation failure rather than hiding the storage-boundary failure.
Operation and composite failure parents equal the active parent. A
checkpoint-only failure identifies the active or pre-core next parent, while a
null parent is valid only for a final checkpoint with no active or next work.

Each write invocation processes at most one bounded parent batch. Before
starting a family, the orchestrator persists `activeParentId`; it then runs core
promotion, alias/observation target backfill, and remaining-consumer target
backfill in that order through their three separate bounded transactions. Only
after all three phases succeed does it calculate cumulative core, alias,
observation, and per-consumer-slot metrics, clear the active parent, advance
`afterParentId`, and persist the advanced checkpoint. A checkpoint failure does
not expose the proposed cursor or metrics as retained progress.

Resume replays `activeParentId` directly instead of rediscovering it through the
legacy-parent selector. This includes a zero-release parent that core promotion
has already transformed so it no longer matches that selector. The idempotency
contracts of each phase make that replay safe. The first phase or checkpoint
failure stops the batch and records only a sanitized phase, stable error code,
retryability, parent/release identity, and typed table/surface/row/projection
locator where applicable; raw error details, connection data, and stacks are
not part of the retained schema.

This orchestration is additive local tooling and makes no production execution
or deployment claim. Task 6.13 remains the separate controlled-production gate:
an actual fresh retained production dry run from the exact candidate revision
must be reconciled and approved before any live production backfill write.
The canonical orchestrator is the only batch writer; the superseded core-only
`backfillLegacyCatalogBatch` wrapper is removed, leaving only read-only parent
selection and the single-parent core transaction beneath it. After all required
backfill, cleanup-audit, and post-deploy evidence is retained, task 10.10 removes
the migration-only backfill command/runtime, run schema, orchestrator, revision
helper, core/alias/consumer services, their integration tests, and the
migration-added CLI Vitest configuration, test script, development dependencies,
and matching lockfile entries. The read-only catalog migration audit command,
schema, and service remain available through tasks 9.1, 9.10, and 10.9 and are
not removed prematurely with write tooling.

Backfill rules are deterministic:

1. Create one BottleGroup from every legacy parent Bottle's stable identity.
2. A parent with no releases remains the concrete Bottle, preserving its id, and joins its singleton group.
3. For a parent with releases, create one independently complete concrete Bottle per release by applying the parent/release precedence contract. Assign all promoted Bottles to the parent's group and select the lowest-release-id promotion as representative.
4. Map legacy references with a non-null `releaseId` to the promoted Bottle's exact target.
5. Map legacy references with a null `releaseId` under a parent that has releases to the group's generic target.
6. Map legacy references with a null `releaseId` under a parent with no releases to the retained Bottle's exact target.
7. The core transaction first claims each promoted Bottle's required canonical
   exact alias. The separate alias/observation phase preserves that alias,
   target-backs every other parent-only alias under a parent with releases with
   the generic group target, and target-backs every release alias with the
   promoted Bottle's exact target. It preserves retained pairs and evidence and
   changes no alias consumer.
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
database migration revision, generation time, and database. Every ambiguous
parent reported by that audit must receive an explicit migration disposition
before live backfill writes, and the audit runs again at constraint
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
Both paths carry only the authoritative `targetId`, resolve and validate its
kind at the worker boundary, and refresh entity aggregates through one shared
target-aware helper. Exact activity derives brand, bottler, and distillers from
the independently complete Bottle; generic activity derives those owners from
the BottleGroup without selecting a representative. Entity tasting totals join
through CatalogTarget and do not consult the retained Bottle/Release pair.
Every statistics event independently queues an idempotent downstream entity
refresh rather than coalescing events under a stable key. Successful downstream
jobs are removed and failed jobs are retained for diagnosis and retry. Task 9.6
removes obsolete consumer `bottleId`/`releaseId` storage, and task 9.7 removes
the remaining runtime compatibility branches.
Publication failure is recorded with the tasting and resolved target identity
without failing an already committed user write. The former worker-owned raw SQL
and every tasting-route inline Bottle statistics formula are removed; the
canonical raw-target calculator remains the only rating-math owner.

Worker handlers log and rethrow failures so BullMQ records them as failed, and
statistics jobs retain failed records while removing successful ones. A retry
therefore reruns the idempotent canonical services rather than losing an
incomplete downstream refresh.

`OnBottleChange`, `UpdateBottleStats`, and `UpdateBottleGroupStats` have strict
`{ targetId }` payloads with no legacy fallback. `OnBottleChange` requires an
active exact target before deriving Bottle details, search, or statistics work;
the two statistics workers reject the wrong target kind. Before enabling these
workers, operators must stop or upgrade old Bottle-id producers and drain or
expire queued legacy payloads, including jobs naming a parent that will retire.
The `bottles fix-stats` maintenance command selects exact target rows and
dispatches their target ids; strict recomputation validates the active graph and
stops on an invalid row rather than silently skipping it. Task 7.10 owns the
remaining operational producer and queue-drain evidence; task 7.7 retains the
aggregate parity evidence and approval for the statistics cutover itself.

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

Nested `/bottles/:oldParentId/bottlings/:releaseId` URLs permanently redirect to
the promoted Bottle. The anonymous Bottle page-target route resolves an active
migrated parent with releases through its generic target and resolves a future
retired parent through `bottle_tombstone.newGroupId`; both return the
BottleGroup, never its representative. Exact Bottles and exact-merge tombstones
continue to return exact Bottle destinations. The cached web Bottle-page owner
first loads the normal Bottle details path. An exact-merge tombstone still
redirects from that response; only a typed not-found result invokes the
page-target route to distinguish a generic parent from a missing Bottle.
Generic results permanently redirect to `/bottle-groups/:groupId`. Task 9.8
owns creation of parent-retirement tombstones. Task 8.9 makes both legacy
parent-list aliases, `/bottles/:oldParentId/bottlings` and
`/bottles/:oldParentId/releases`, route-only permanent redirects to that
generic BottleGroup. The aliases preserve the query string, discard the
Bottle-only suffix, and never choose a representative Bottle. The same slice
removes the nested BottleRelease list loaders and renderers, release-shaped
moderator and Library actions, and their obsolete presentation/path helpers
rather than retaining a second read system. The measured detail, edit, and new
redirect routes remain translation-only compatibility until task 9.7 removes
them after the traffic gate. APIs return explicit replacement identifiers
rather than silently choosing a member Bottle for generic intent.

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

### Exact alias assignment establishes a target-aware owner

Task 5.5a makes `assignBottleAlias` and
`assignBottleAliasInTransaction` the canonical owner for the exact/moderator
alias path cut over in this slice. When supplied an exact CatalogTarget, that
owner validates and stores the target with the retained Bottle compatibility
identity. Its targetless mode remains an instrumented compatibility path for
existing callers: it may persist `targetId` as null and does not resolve a
missing target, but it must preserve an existing durable target rather than
downgrading it to a legacy pair.

The raw `apps/server/src/lib/db.ts` `upsertBottleAlias` pair primitive remains
inside canonical creation only as a transactional name reservation that is
upgraded to the new exact target before commit. Outside creation, only the
explicitly isolated `groupId IS NULL` branch of `mergeEntity` retains the raw
writer for pre-migration Bottle/BottleRelease compatibility. Grouped entity
merge and brand/distillery maintenance delegate shared changes to the canonical
BottleGroup update transaction, which atomically fans out complete member
identity and canonical aliases. Task 9.7 removes the ungrouped branch, raw
primitive, and measured targetless compatibility after migration.

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

Task 5.5b first introduced shared target ownership while the then-current
approval request still carried a legacy `(bottleId, releaseId)` pair. At that
staged boundary, deterministic promotion and parent-cardinality rules resolved
one target descriptor and the alias and observation writers reused it rather
than making independent identity decisions. This is retained design history,
not the current moderator request contract.

Task 7.3c removes the unreleased Bottle/Release selection request in favor of
one selected `targetId`. Exact approval derives `(bottleId, null)` from the
target. Generic approval accepts only the proposal's own suggested target and
locks and revalidates that slot's retained projection for staged storage. The
StorePrice, listing alias, source-keyed BottleObservation, proposal, and latest
attempt share the selected target atomically, and generic intent never
substitutes the group's representative Bottle. Correction repair likewise uses
matching non-null exact current and suggested targets for the same Bottle; its
retained pairs are evidence rather than selection authority.

### Create-new price approval creates one complete Bottle

Create-new approval accepts an `independentBottle` carrying the standard flat
Bottle create contract and maps it directly to canonical independent creation.
It creates a singleton even when historical proposal context retains a parent
Bottle or release creation target. The measured adapter separately infers the
retained `bottle`, `release`, or `bottle_and_release` payload shape: Bottle-only
and combined payloads create an independent Bottle with its singleton group,
while release-only payloads require the proposal's trusted source Bottle and
create another Bottle in that source's group. Neither path inserts or finalizes
a BottleRelease.

The translation preserves the supported legacy fields without introducing
group inheritance at read time. Bottle-only input supplies the independent Bottle's
stable identity, including shared stated age, and supplies its release-shaped
fields as exact input with exact stated age null. Release-only input reuses the
trusted source Bottle's group and maps all retained release fields to exact
input. Combined input takes stable identity from Bottle input and gives Release
input precedence for exact fields: release stated age wins even when null,
while other nullable exact values use Bottle input as a nullish fallback.
Description follows the same release-then-Bottle fallback, but Bottle
`descriptionSrc` is retained only when Bottle description is the selected
description. These are retained input shapes, not a promise that every legacy
field is translatable: a non-null Bottle or Release `imageUrl` remains valid in
the legacy schema but is deliberately rejected because canonical image creation
must cross the upload boundary. The adapter neither ignores that value nor
writes it directly.

Creation takes an unlocked proposal/price preflight before the canonical
group-first creation locks, then locks and revalidates the proposal after the
concrete identity is known. A changed price id, parent identity,
`creationTarget`, `proposedBottle`, `proposedRelease`, or complete StorePrice
`{ targetId, bottleId, releaseId }` tuple aborts the transaction.
The canonical creation attempt runs in a nested savepoint, so exact-duplicate
reuse first rolls back any preparatory entity, series, or graph writes. After
that rollback, duplicate handling resolves, locks, and revalidates the existing
exact descriptor and the trusted source descriptor when one applies. It reuses
the existing target only when the existing Bottle's canonical `fullName`
exactly equals the requested canonical `fullName` or its structurally parsed
SMWS code exactly matches, the exact target and
descriptor set remain active, and a release-only duplicate remains in the
trusted source group. A collision surfaced only through an arbitrary or ignored
alias, fuzzy name similarity, or fuzzy or substring-only SMWS matching is not safe reusable exact
identity; it remains a conflict or suggestion. A cross-group or drifted
descriptor also remains a conflict. A newly created Bottle uses
`create_bottle`, while safe duplicate reuse uses `match_existing`.
Historical release-shaped enum values remain readable in persisted audit rows,
but no live classifier or proposal producer emits them. New classifier creation
has one `create_bottle` action carrying the complete marketed Bottle. Tasks 5.9
and 9.7 own remaining caller cutover and persisted compatibility removal, so
this price slice needs no enum migration.

The selected exact target is the one assignment for StorePrice, listing alias,
source-keyed observation, proposal current/suggested identity, and latest
attempt. Each stores the matching `(bottleId, null)` current/suggested
compatibility projection. The approved proposal and its own latest attempt,
when one is present, are updated in the same approval transaction so neither
can commit a different or partial identity. No cross-volume sibling proposal is
retargeted. An incoming decision log is emitted only for an
initial incoming Bottle assignment. When emitted, a new graph records
`create_bottle` and safe duplicate reuse records `match_existing`, with the
same exact target and retained projection. The source-key uniqueness boundary
keeps any prior decision immutable, and approval of a previously assigned price
does not rewrite it. Alias or observation failure rolls back the entire
group/Bottle/target graph and every approval write. Concrete creation and alias
finalizers run only after commit; duplicate reuse skips the creation finalizer.
The route adds the canonical approval result's exact `targetId` to its retained
`{ bottle, release }` response shape and always returns `release: null` after a
successful request. Section 8 callers use `targetId` plus the independently
complete Bottle directly, without reconstructing identity from that
compatibility field.

Every authorized schema-valid legacy call that reaches the retained
compatibility branch emits structured usage with caller, operation, payload
discriminator, and handler success or rejection outcome. A successful event
includes the replacement Bottle and exact target ids without copying the raw
payload into telemetry. Section 8 callers use `independentBottle`; task 9.7
explicitly removes the legacy input and response adapter only after observed
compatibility-handler traffic reaches zero.

Target-backed reads remain task 7.3. Task 5.8 owns the adjacent classifier
application cutover, other supported legacy writers remain task 5.9, the
Section 8 UI constructs canonical `independentBottle` create payloads, task 5.11
owns generated OpenAPI/client dependencies, and task 9.7 removes the legacy
route adapter and historical compatibility branches after their gates pass.
This code-review slice makes no deployment, production backfill, or activation
claim.

### Classifier application creates one complete Bottle

Task 5.8 routes classifier `create_bottle` through the canonical
concrete-Bottle creation service. The proposal contains one independently
complete marketed Bottle and creates an automatic singleton group. The
classifier never selects a parent, source group, or BottleRelease operation;
automatic group discovery and later curation are separate concerns.

Every successful result returns the active exact CatalogTarget and concrete
Bottle id. Safe exact
duplicate reuse returns that same target only after the canonical attempt has
rolled back, the collision resolves to an exact Bottle whose canonical
`fullName` exactly matches the requested value, and its exact target is still
active. Classifier creation supplies no trusted parent or group context and
duplicate reuse does not infer one. New decision logs use `create_bottle` for
an actual concrete creation and `match_existing` for safe reuse, while metadata
retains bounded structured classifier evidence. Historical action labels remain
readable only on persisted compatibility records until later cleanup tasks
remove them.

### Alias-driven consumers share one assignment owner

Task 5.6b extends the canonical alias assignment transaction to the StorePrice
and Review rows selected by its alias lookup scope. A target-aware assignment
atomically writes the supplied `targetId` together with the retained
`(bottleId, releaseId)` compatibility pair carried separately by the alias
assignment input. The CatalogTarget descriptor does not own that pair. The
validated target identity remains the semantic decision: a generic target stays
generic and never selects the BottleGroup representative merely to populate a
consumer row.

An affected caller that already resolved exact intent supplies that validated
identity to the canonical operation even when its own direct consumer writer
belongs to a later slice. In particular, task 5.6b updates the existing
exact-alias branch of price create-batch to pass the validated exact `targetId`
plus an explicit retained `(bottleId, null)` pair through the legacy exact
target-aware alias input. That caller does not construct a
CatalogTargetAssignmentDescriptor. The route's direct StorePrice upsert plus
descriptor-based generic, unmatched, and broader ingestion redesign remain task
5.6f.

Measured name-wide targetless alias compatibility may update only targetless
matching consumers. It cannot clear, replace, or reinterpret a durable consumer
target, even when the alias name or retained pair would otherwise match. This
keeps a later legacy alias event from downgrading a target-aware StorePrice or
Review. Create-new approval no longer enters this compatibility mode: it passes
the newly created or reused exact target through the canonical alias assignment,
which updates the locked selected StorePrice without downgrading any other
durable consumer.

Alias unassignment uses the captured alias preimage according to the same
identity authority rule as reads. For a target-aware consumer, `targetId` is
authoritative: the consumer matches when its `targetId` equals the alias
snapshot's `targetId`, even when its retained pair differs, as can occur for a
promoted release. For a targetless consumer, the retained `(bottleId,
releaseId)` pair is the matching authority and must equal the alias snapshot's
pair. Either match clears `targetId`, `bottleId`, and `releaseId` together. An
independently retargeted consumer or targetless consumer with a different pair
is preserved. The alias row remains conditionally cleared against its complete
preimage so concurrent reassignment rolls back the earlier consumer work rather
than committing a partial unassignment.

Canonical alias assignment already synchronizes consumers in its transaction.
When that assignment creates a new alias, its post-commit finalizer queues
`IndexBottleAlias` directly and does not round-trip through
`OnBottleAliasChange`; an existing-alias assignment need not enqueue alias
indexing. The worker remains only for raw alias producers and does not retain a
second StorePrice/Review propagation algorithm; it delegates to the canonical
consumer synchronization operation before indexing.

A replayed generic alias is safe only when its retained legacy pair resolves
through the measured assignment boundary to the same generic target stored on
the alias. An invalid pair, a cross-group result, or a release-bearing pair that
resolves exact instead of to that generic target fails before synchronization,
so the transaction writes no consumers. For a targetless raw alias, the worker
locks the retained Bottle lifecycle first. If the retained `releaseId` is
non-null, it then locks that BottleRelease and validates that it belongs to the
retained Bottle before acquiring consumer locks. A missing or mismatched release
aborts before consumer mutation, and the worker does not index the alias. After
consumer locks, the worker revalidates and locks the alias snapshot. This
prevents an invalid legacy pair, concurrent Bottle retirement, or alias
reassignment from committing stale targetless propagation. The measured
targetless compatibility path remains removable under task 9.7.

Classifier `no_match` and unresolved reviews remain explicitly targetless.
Task 5.8 gives successful classifier creation or safe reuse an active exact
target and retained decision evidence. Task 5.9 makes the missing-Bottle worker
consume that descriptor through canonical alias, Review, StorePrice, and
incoming-decision propagation in one transaction. The worker compares the
selected Review's identity snapshot under lock, so stale classifier work cannot
overwrite a concurrent retarget. `no_match`, failed resolution, and genuinely
unresolved Reviews remain targetless without inventing a representative or
other exact Bottle.

Direct review, collection, flight, and price mutations remain separate review
boundaries in tasks 5.6c-5.6f. Create-new price approval remains tasks 5.7 and
5.5c, target-backed reads remain task 7.3, and existing legacy rows remain the
section 6 backfill. These boundaries keep task 5.6b from silently widening into
a direct writer, read, classifier, creation, or migration cutover.

### Direct Review mutations dual-write one validated target

Task 5.6c moves only the direct user/API Review create and update paths to
CatalogTarget dual writes. When the orchestration has known exact or generic
intent, it resolves one `CatalogTargetAssignmentDescriptor`, revalidates and
locks that identity before the Review mutation, and writes the complete
`{ targetId, bottleId, releaseId }` tuple atomically. The descriptor is the
semantic authority; the retained pair is migration compatibility. Generic
intent stays on the BottleGroup target and never selects the representative or
another member Bottle merely to populate the pair. Any applicable alias
assignment receives the same target instead of performing a second semantic
resolution. Failure to validate a known mapped match is an error and cannot be
reclassified as targetless compatibility.

Review creation's conflict/upsert behavior treats identity as one unit. A
genuinely unresolved or targetless current reference cannot overwrite, clear,
or partially mix with an existing durable target tuple. Successful direct
classifier creation or safe reuse writes its exact target under task 5.8;
task 5.9 applies the same exact target through the missing-Bottle worker only
while the selected Review still has its snapshotted identity. `no_match`, failed
resolution, and genuinely unresolved consumers remain explicitly targetless
without permitting arbitrary target selection. When an existing different
complete identity wins the upsert conflict, the incoming identity is rejected
as a unit: creation neither creates nor reassigns an alias and records no
decision evidence for that rejected identity.

Review update takes a Review identity snapshot, resolves and locks the
authoritative CatalogTarget for that snapshot and requested mutation when one
applies, and only then locks the Review. The mutation commits only when the locked
`{ targetId, bottleId, releaseId }` tuple still matches the snapshot; otherwise
the transaction rolls back and retries a bounded number of times from a fresh
snapshot. This target-before-consumer order avoids inverting the canonical lock
order without allowing a stale snapshot to overwrite concurrent identity work.
An explicit identity clear atomically clears all three identity columns. An
identity correction resolves and validates a complete replacement tuple. A
non-identity update preserves an existing durable target; only a currently null
target may use measured retained-pair resolution as a small compatibility
repair. If a staged legacy row cannot yet resolve, it remains targetless rather
than failing an unrelated content update or inventing identity.

Shared alias-driven Review propagation remains exclusively owned by task 5.6b.
Task 5.6c does not switch Review reads, bulk-backfill existing rows, or remove
compatibility columns and branches; those remain tasks 7.3, section 6, and task
9.7. Like the adjacent slices, this is a code-review boundary and makes no
deployment or activation claim.

### Direct collection mutations use target-authoritative membership

Task 5.6d moves direct collection creation and resolvable specific delete
mutations to one validated exact or generic CatalogTarget descriptor. Creation
resolves and locks the descriptor before locking or writing collection
membership, writes its `targetId` with the retained legacy pair, and never
creates a new targetless row. The canonical `(collectionId, targetId)`
membership is authoritative: a matching targetless legacy-pair row may be
upgraded, while a legacy-pair collision owned by a different durable target
conflicts rather than reinterpreting that target.

When both the canonical target membership and its matching targetless
legacy-pair compatibility row exist, creation consolidates them into the
canonical row. The canonical row wins all unit state; only a blank canonical
image may be filled from the compatibility row. The duplicate removal and
collection count adjustment occur in the same transaction, preserving the
canonical image when non-blank, status, collection ownership, and other
unit-level state.

A release-specific delete and a `baseOnly` delete resolve and lock the selected
legacy pair's target before collection membership when one exists. They remove
the target-authoritative membership plus only a matching targetless legacy-pair
fallback and preserve a row owned by a different durable target. If the pair is
an ungrouped parent or a release without completed promotion, measured staged
compatibility may instead remove only its matching null-target retained-pair
row; it never removes a durable target. Section 6 backfills those rows and task
9.7 removes this fallback. The retained delete shape with neither `release` nor
`baseOnly` remains measured legacy family-delete compatibility: it
intentionally selects every retained row for the parent `bottleId` and can
therefore span multiple canonical memberships. Target-backed UI removal
supplies `targetId` directly; `baseOnly` remains only retained compatibility.
Task 9.7 removes the broad family-delete adapter after compatibility traffic
reaches zero.

The current partial task 7.3 collection read cutover now requires and hydrates
the membership's authoritative CatalogTarget, records retained-pair parity, and
uses target identity for serialization, ordering, filtering, and Library
actions. A targetless membership is an integrity error rather than permission
to fall back to the retained pair. This read cutover does not satisfy the
section 6 existing-row backfill gate, enable generic target-native creation
while retained `bottleId` storage is non-null, or remove the retained input and
family-delete adapters; those remain tasks 8.7, 9.6, and 9.7. Unit image,
status, and ownership behavior outside identity selection is unchanged. The
partial consumer slice is a code-review boundary and makes no deployment or
activation claim.

### Direct Flight mutations replace one target-authoritative membership set

Task 5.6e retains the public Flight `bottles: number[]` input as staged legacy
compatibility. Each submitted Bottle id expresses the retained legacy
`(bottleId, null)` intent and resolves through the deterministic CatalogTarget
assignment boundary: a legacy parent with releases selects its generic
BottleGroup target, while a parent without releases selects its exact Bottle
target. The persisted membership keeps the submitted `bottleId`, a null
`releaseId`, and the resolved `targetId` together. A generic descriptor's
nullable Bottle identity is not substituted into the retained pair, and the
group representative is never selected as exact identity.

Flight membership is target-authoritative. Multiple submitted Bottle ids that
resolve to the same target produce one row; the lowest submitted Bottle id is
retained deterministically for compatibility. Creation sorts and locks every
resolved target before inserting the Flight or any membership. An invalid or
staged selection rolls back the complete create, and this path writes no new
targetless membership.

On update, an omitted `bottles` field preserves the membership set, an explicit
empty list clears it, and any other explicit list is a full replacement rather
than an incremental pair-based edit. Before deleting or replacing membership,
the operation snapshots the existing rows, resolves the union of the requested
and existing durable targets, locks their BottleGroups, exact Bottles, and
CatalogTargets in the shared hierarchy and id order, then locks the Flight and
its membership rows. A changed membership snapshot rolls back and retries a
bounded number of times. Once stable, the operation deletes the old set and
inserts the canonical requested target assignments atomically; explicit
replacement also removes targetless compatibility rows instead of carrying
them forward.

The current partial task 7.3 Flight read cutover keeps the bounded base Flight
response target-free while the Flight details response hydrates its ordered
authoritative CatalogTargets, records retained-pair parity, and carries
target-keyed viewer state. A generic member remains group identity without
representative substitution. Existing-row backfill remains section 6, the
public Bottle-id membership input remains staged compatibility until task 8.7,
and tasks 9.6 and 9.7 remove retained pair storage and compatibility. The
partial consumer slice is a code-review boundary and makes no deployment or
activation claim.

### Target-native consumer entry uses one durable identity

Task 8.7 gives new tasting, collection, Flight, review-filter, and
photo-identification continuations one CatalogTarget id. Target-native schemas
are strict alternatives to retained Bottle/Release compatibility schemas, so a
request cannot combine the two identities. Each writer resolves and locks that
target as its semantic authority. Exact writes retain `(bottleId, null)` and
generic writes retain `(null, null)` until task 9.6 removes those columns; no
generic path chooses the BottleGroup representative.

The retained Bottle column becomes nullable on Tasting, collection membership,
and Flight membership. Canonical target uniqueness remains authoritative.
Legacy-pair uniqueness is a partial index that applies only when a retained
Bottle exists, allowing different generic targets without permitting duplicate
retained compatibility rows. Existing `targetId` nullability and production
backfill gates are unchanged.

Bottle list and details results expose their already-joined exact target id for
selection without per-row lookups. Review list accepts a direct target filter,
photo match decisions serialize an exact target rather than a public legacy
pair, and approved photo creation returns that exact target. Raw classifier
Bottle/Release evidence remains internal. Retained adapters remain measured and
mapped to task 9.7; this slice performs no production mutation, backfill,
deployment, or activation.

### Automated ignored StorePrice clears preserve one identity tuple

The first task 5.6f sub-slice changes only the automated assignment clear that
runs when price matching classifies a listing as ignored. A StorePrice's
`{ targetId, bottleId, releaseId }` values form one identity tuple. A non-null
`targetId` is authoritative; the retained pair remains compatibility data and
cannot independently authorize clearing or reconstruct a different target.

Ignored resolution snapshots the complete tuple before classifier work. When
the snapshot has a durable exact or generic target, the clear path resolves and
locks that target through the global BottleGroup, exact-Bottle when present,
then CatalogTarget hierarchy before locking or mutating the proposal and price
rows. Generic identity remains on the BottleGroup target and never selects a
representative Bottle. A targetless compatibility snapshot does not invent a
target merely to clear an assignment and therefore needs no target lock.

The StorePrice clear is one null-safe compare-and-set over all three identity
columns. It clears `targetId`, `bottleId`, and `releaseId` together only when the
locked current tuple still equals the snapshot. Target-only drift, pair-only
drift, or a complete reassignment preserves the current tuple. If a concurrent
group or Bottle merge makes the snapshotted target fail resolution but also
changes the StorePrice tuple, that changed tuple is preserved as merge drift.
This recovery applies whether target invalidation is observed during initial
descriptor resolution or during hierarchy-lock revalidation after waiting.
An ignored resolver is authorized when execution is tokenless or its token owns
the current active processing lease. If target resolution fails for an
authorized resolver while the StorePrice still has the unchanged snapshotted
tuple, the operation fails as target-integrity damage instead of erasing the
evidence or falling back to pair-only clearing. A stale resolver that lost its
lease to a replacement owner instead returns the replacement owner's current
proposal and preserves the StorePrice tuple without clearing it or surfacing
the stale target-resolution failure.

The existing processing-token and expiration checks continue to decide whether
the token-bearing ignored resolver owns the active lease; this identity cutover
does not change lease acquisition, renewal, or release semantics. Direct
create-batch StorePrice ingestion is completed by the adjacent task 5.6f
sub-slice below.
Alias-driven StorePrice propagation remains owned by task 5.6b; create-new
approval is the separate concrete-target cutover described above. Target-backed reads, legacy-row backfill,
broader repair/caller cutovers, retained-pair cleanup, and any deployment or
activation remain outside this review boundary.

### Direct StorePrice ingestion writes one complete assignment

The second task 5.6f sub-slice moves `prices/create-batch` from independent
pair `COALESCE` updates to one target-authoritative StorePrice identity tuple.
Alias lookup still tries the normalized identity-preserving key first and the
legacy raw listing name second. A target-backed alias resolves and validates
its exact or generic assignment descriptor; a targetless alias resolves its
retained pair through the measured deterministic legacy boundary and stays
targetless only for the explicit staged ungrouped-parent or
promotion-incomplete-release states. Other retired, invalid, or inconsistent
target states fail the transaction.

A target-backed incoming decision replaces `{ targetId, bottleId, releaseId }`
as one unit. Exact aliases retain the concrete Bottle id and null release id. A
generic alias with no retained pair stores null retained ids and never selects a
representative; when it does retain a legacy pair, that pair must resolve
through measured compatibility to the same generic target before it is carried
to the StorePrice. A resolvable targetless legacy alias likewise retains its
measured pair alongside the resolved target. Staged targetless input may replace
only a targetless existing tuple, while unmatched input preserves every
existing identity field. This prevents the old independent `COALESCE`
expressions from combining a new Bottle with an old release or downgrading a
durable target.

The route locks the resolved descriptor set through the global BottleGroup,
Bottle, then CatalogTarget hierarchy before StorePrice, history, or alias
mutation. Canonical alias assignment remains the sole consumer-synchronization
owner and owns source-snapshot timing: it revalidates a same-name normalized
source after consumers and before claim, then upgrades or creates that canonical
alias; when lookup used a distinct raw compatibility alias, it claims the
normalized canonical alias first and then revalidates the raw source. Concurrent
retarget, ignore, merge, or target retirement therefore rolls back the
StorePrice, history, and alias work instead of committing stale identity.

Before a staged targetless decision mutates StorePrice or history, the canonical
compatibility boundary locks the retained parent Bottle, then any BottleRelease
and existing promotion mapping, and re-runs legacy resolution. The release lock
serializes a missing promotion insert through its foreign key. If grouping or
promotion completed first, ingestion aborts rather than acquiring target locks
after legacy locks or committing stale targetless identity.

Exact, generic, and staged targetless alias matches suppress
`ResolveStorePriceBottle`; only unmatched listings queue it. Existing
authentication, batching, price history, image capture/finalization, alias
provenance, and post-commit behavior remain unchanged. Alias-driven propagation
stays in task 5.6b, create-new approval stays in tasks 5.7/5.5c, reads and
backfill stay in task 7.3 and section 6, and tasks 9.6/9.7 remove retained pairs
and measured compatibility. This commit is a review boundary, not a deployment
or activation unit.

### StorePrice reads use authoritative CatalogTargets

The current partial tasks 7.1-7.3 StorePrice read cutover adds the listing's
nullable authoritative CatalogTarget to every StorePrice response and records
row-correlated retained-pair parity during batch hydration. A non-null target
is never replaced by retained-pair identity, including when the pair drifts;
a targetless listing stays explicitly null. The admin unknown filter,
review-workbench matched predicate, and reconciliation-worker unmatched
predicate now use `targetId` rather than `bottleId`.

Bottle-specific current prices, history, and details resolve the selected
Bottle's exact target first and query prices only through that target. Generic
BottleGroup prices remain generic and cannot appear on a representative or
retained Bottle merely because of compatibility columns. Price-change results
group by authoritative target plus currency and return the discriminated target
identity, so exact and generic changes remain distinct without a Bottle-shaped
fallback. Their Library and tasted indicators are queried by target id for the
current user, including generic targets, and are false anonymously.

Bottle-scoped filter parity samples the union of target matches and semantic
legacy matches before the authoritative result filter. The semantic legacy
predicate includes both a raw retained `bottleId` match and a retained
`{ parent bottleId, releaseId }` whose release belongs to that parent and has a
completed promotion to the selected concrete Bottle. It does not consult
CatalogTarget data. Bottle details compares the single newest target-backed
candidate with the single newest semantic legacy candidate.

The admin `onlyUnknown` parity query paginates independently over a bounded
target/legacy union sample. It can expose excluded retained-only or target-only
rows in that sample with their StorePrice row ids, but it is not exhaustive:
union ordering can displace a row relative to the authoritative page and rows
outside the sample remain unseen. Price-change parity likewise runs only after
the authoritative target page is selected: it samples StorePrice rows behind
those returned target ids, capped at ten times the page's target count and one
thousand rows total. It therefore cannot observe legacy-only rows that fall
outside the authoritative page. Serializer parity still validates every
returned StorePrice response independently.

This is another partial consumer review boundary. Existing-row backfill and
production activation remain gated by section 6 and the retained parity/audit
sequence; retained StorePrice pair storage and measured compatibility remain
tasks 9.6/9.7. Proposals, adjacent analytics, specialized alias readers, and
other actual consumers keep tasks 7.1-7.3 open.

### BottleAlias reads use authoritative CatalogTargets

The task 7.1a-7.3a alias slice makes the BottleAlias list filter and hydrate
through durable CatalogTarget identity. A Bottle filter first resolves that
Bottle's active exact target and selects aliases by `targetId`; `onlyUnknown`
means `targetId IS NULL`. Each response carries a nullable discriminated exact
Bottle, generic BottleGroup, or null target. The retained compatibility
`bottleId` output is derived only from an exact target, so generic identity never
selects the representative Bottle and targetless identity stays explicitly
unknown.

Hydration records target-versus-retained resolution parity with the unique alias
name as the stable `bottle_alias` locator. Bottle-filter parity separately
samples the union of authoritative and retained candidates; its legacy side
resolves completed BottleRelease promotions semantically instead of comparing a
raw parent id to the promoted Bottle. `onlyUnknown` parity compares target-null
membership with the retained Bottle-null predicate. These bounded measurements
record caller, operation, target, retained pair, and resolved identity evidence,
but never alter the target-backed result. A selected Bottle or returned alias
whose durable target is missing, retired, or inconsistent fails closed as a
conflict rather than falling back.

Brand-repair query and supporting-alias evidence likewise accepts only aliases
whose durable target resolves to a live exact Bottle. Candidate scans exclude
Bottle and BottleGroup tombstones; generic and targetless aliases cannot become
exact repair evidence. A separate bounded alias-name parity sample measures
legacy drift without influencing ranking or membership, and route boundaries
translate invalid durable targets to conflicts. The labels `dump-unmatched`
command now selects null `targetId`, matching the same unknown definition.

This completes only the alias-read sub-slice. Other specialized alias readers,
proposals, adjacent analytics, and other actual consumers keep parent tasks
7.1-7.3 open; retained pairs and parity adapters remain until tasks 9.6/9.7.
The slice makes no production activation or backfill claim.

### Incoming decision reads use authoritative CatalogTargets

The task 7.1b-7.3b incoming-decision slice makes the admin decision-log route
hydrate its nullable durable `targetId` through the shared CatalogTarget parity
reader. The decision-log primary id is the stable row locator for
target-versus-retained resolution evidence. Retained parent/release identity is
resolved semantically, including completed release promotion, but remains
parity evidence only and cannot select or replace the authoritative result.

The route returns a nullable discriminated CatalogTarget instead of joining or
returning legacy Bottle and BottleRelease objects. An exact target returns its
independently complete Bottle, a generic target remains BottleGroup identity
without representative substitution, and a targetless historical row remains
explicitly null. A missing, retired, or inconsistent nonnull durable target
fails closed as a conflict response rather than falling back to the retained
pair. Historical decision values and `createdBottle`/`createdRelease` flags
remain readable audit fields; this read cutover does not reinterpret persisted
history. Existing admin authorization, actor/source filters, deterministic
ordering, and pagination remain unchanged.

The admin page renders nonnull results through the shared CatalogTarget
identity component and labels a null target explicitly unknown. It no longer
constructs a nested Bottling link. Task 7.11a covers exact, generic, promoted,
targetless, invalid-target, authorization, filtering, ordering, pagination, and
focused UI rendering behavior.

`bottle_observation` has no outward route or serializer to cut over: it remains
internal source evidence owned by target-aware price-matching writes, migration,
and merge/consolidation operations. The activity routes likewise compose the
already target-backed Tasting and collection-membership serializers, so this
slice does not invent a second observation or activity read system. Proposal
and adjacent analytics reads, plus other remaining consumers, keep parent tasks
7.1-7.3 and 7.11 open. This slice makes no production backfill, deployment, or
activation claim.

### Price-match proposal reads and approvals use authoritative CatalogTargets

Tasks 7.1c-7.3c make the StorePrice match-proposal queue hydrate its current
and suggested logical slots independently through their durable CatalogTargets.
The proposal id plus `current` or `suggested` slot is the stable parity locator;
the retained Bottle/Release pair is measurement evidence only and cannot select
or replace the result. Exact targets expose independently complete Bottles,
generic targets remain BottleGroup identity, targetless slots stay explicitly
unknown, and an invalid nonnull durable target fails closed as a conflict.

The proposal producer resolves and persists the suggested target for every new
existing-match or correction decision before the target-backed reader is used,
and the corresponding attempt copies that target. This prerequisite prevents a
new proposal from depending on the legacy backfill merely to render its live
recommendation. Create-new and no-match proposals keep a null suggested target
until concrete creation or a later assignment establishes one.

Moderator approval accepts the selected target id and uses one target-native
transaction. An exact target derives the concrete `(bottleId, null)` staged
storage projection. A generic target is approvable only when it is the
proposal's own suggested target; the transaction validates and temporarily
reuses that slot's retained pair so the still-present database columns remain
consistent without choosing a representative Bottle. The target, retained
projection, proposal, latest attempt, StorePrice, alias, observation, and any
decision log are locked or revalidated as one assignment. The old
Bottle/Release approval request is removed because this branch has not shipped.

Correction repair remains proposal-bound rather than accepting a second
identity input. Both current and suggested target ids must be non-null active
exact targets for the same concrete Bottle. The transaction locks and
revalidates that exact target identity before composing the canonical Bottle
update with proposal approval; retained current and suggested pairs are staged
compatibility evidence and cannot select or substitute a different identity.

The queue response and UI expose `currentTarget` and `suggestedTarget`, not
nested current/suggested BottleRelease identity. `parentBottle` remains only as
explicit historical create-draft context until the Section 8 unified creation
cutover; it is never a fallback for current or suggested identity. Manual
Bottle search crosses a narrow Bottle-to-exact-target lookup before submitting
the same target-only approval request. Missing historical automation snapshots
may be computed for display, but queue GET requests do not persist them or
otherwise mutate proposal state.

This completes only the proposal-queue sub-slice. Retained proposal and attempt
pair columns remain migration evidence until task 9.6, and historical
create-draft shapes remain assigned to Section 8 and task 9.7. The slice begins
no production backfill and authorizes no deployment or activation.

### Library statistics read authoritative CatalogTargets

Tasks 7.1d-7.3d cut the visible-user Library statistics route over from its
retained Bottle/BottleRelease joins to each non-empty `collection_bottle` row's
nullable authoritative `targetId`. The collection-entry primary id is the
stable parity locator. For each row, bounded parity measurement independently
resolves the durable target and retained Bottle/Release pair and records the
`collection_bottle` table, entry id, retained ids, target id, caller,
operation, and both resolved identities. Retained identity is telemetry only;
it cannot select statistics identity or repair the row during the GET request.

An exact target contributes age and category from its independently complete
Bottle and distillers from that Bottle's durable distiller membership. A
generic target contributes those same dimensions from BottleGroup-owned age,
category, and distillers. Generic statistics never hydrate or select the
representative or another member Bottle. A targetless compatibility entry still
counts toward the Library total and the existing unstated-age bucket, but it
contributes no known age, category, or distiller classification even when its
retained pair could resolve. A missing, retired, or inconsistent nonnull target
fails the route closed as a conflict rather than falling back to the retained
pair or silently omitting the entry.

The cutover preserves the existing user lookup and profile-visibility rules,
reserved-Library lookup, exclusion of `empty` memberships, one-count-per-entry
semantics, age bucket and median/oldest calculations, top-five distiller and
category count ordering, empty result behavior, and response schema. It is a
read-only aggregation: it writes no target, collection, parity repair, or other
durable state. Task 7.11c covers exact, generic, targetless, retained-drift,
invalid-target, privacy, filtering, count, and ordering behavior.

This is one bounded analytics-reader cutover. Other Library, badge, country,
entity, and catalog analytics that still derive identity through Bottle or
BottleRelease joins remain inventoried under the parent tasks 7.1-7.3 and 7.11
until separately cut over. Existing-row target backfill, retained-pair removal,
and production activation remain owned by section 6, tasks 9.6/9.7, and the
retained parity/audit gates. This slice performs no production backfill and
authorizes no deployment or activation.

### Country category analytics read active exact CatalogTargets

Task 7.3e cuts the public country category aggregate over to the active exact
catalog population. A Bottle contributes only when it has an exact
CatalogTarget whose Bottle and BottleGroup membership agree, neither the Bottle
nor its BottleGroup is tombstoned, and at least one of the Bottle's own
distillers belongs to the requested country. Category and distiller membership
come from the independently complete Bottle. The aggregate does not read
BottleGroup category or distillers, include a generic or targetless identity,
or select a representative Bottle.

One exact Bottle contributes once to one category bucket for a country even
when more than one of its distillers belongs to that country. `totalCount` is
the sum of those same buckets, including the null-category bucket, rather than
a second join with different duplicate semantics. Results use the shared
nullable category schema and deterministic category ordering. Existing public
numeric-id and case-insensitive slug lookup, invalid-slug behavior, empty
results, and response shape remain unchanged.

This catalog-wide aggregate has no durable consumer row containing a target id
and retained Bottle/Release pair. It therefore is not assigned a fabricated
task 7.1 or 7.2 row-parity adapter; the active exact CatalogTarget population is
the read boundary, while production aggregate comparison and activation remain
owned by the existing audit and deployment gates. The GET performs no target,
catalog, statistics, or other durable mutation. Task 7.11d covers exact
membership, tombstones, generic/targetless exclusion, Bottle-owned fields,
same-country multi-distiller de-duplication, nullable ordering, totals, lookup,
and error behavior. This slice performs no production backfill and authorizes
no deployment or activation.

### Entity category analytics read active exact CatalogTargets

Task 7.3f cuts the public entity category aggregate over to the active exact
catalog population. A Bottle contributes only when it has an exact
CatalogTarget whose Bottle and BottleGroup membership agree, neither the Bottle
nor its BottleGroup is tombstoned, and the requested entity is that Bottle's
brand, bottler, or one of its own distillers. Category and every entity role
come from the independently complete Bottle. The aggregate does not read
BottleGroup category, brand, bottler, or distillers, include a generic or
targetless identity, or select a representative Bottle.

One exact Bottle contributes once to one category bucket even when the entity
occupies more than one role on that Bottle. `totalCount` is the sum of those
same buckets, including the null-category bucket, rather than the independently
materialized and potentially stale `entity.totalBottles`. Results use the
shared nullable category schema and deterministic category ordering. Existing
public entity lookup, not-found behavior, empty results, and response shape
remain unchanged.

Like the country aggregate, this catalog-wide read has no durable consumer row
containing a target id and retained Bottle/Release pair. It therefore is not
assigned a fabricated task 7.1 or 7.2 row-parity adapter. The active exact
CatalogTarget population is authoritative, while production aggregate
comparison and activation remain owned by the existing audit and deployment
gates. The GET performs no target, catalog, statistics, or other durable
mutation. Task 7.11e covers active exact membership, tombstones,
generic/targetless exclusion, Bottle-owned roles, multi-role de-duplication,
nullable ordering, live totals, lookup, and error behavior. This slice performs
no production backfill and authorizes no deployment or activation.

### Global statistics count active exact CatalogTargets

Task 7.3g cuts the public global `totalBottles` statistic over to the active
exact catalog population. A Bottle contributes only through its one exact
CatalogTarget when the target's Bottle and BottleGroup membership agree and
neither the Bottle nor its BottleGroup is tombstoned. Generic targets and
targetless Bottles do not contribute. The aggregate counts each qualifying
exact target once and never substitutes a representative Bottle or reads
BottleGroup-owned identity as exact Bottle identity.

The route's `totalTastings` and `totalEntities` values remain raw Tasting and
Entity row counts. Public access, the response shape, and the meaning of those
two fields remain unchanged. This GET performs no target, catalog, statistics,
or other durable mutation.

Like the country and entity aggregates, this catalog-wide read has no durable
consumer row containing a target id and retained Bottle/Release pair. It
therefore is not assigned a fabricated task 7.1 or 7.2 row-parity adapter. The
active exact CatalogTarget population is authoritative, while production
aggregate comparison and activation remain owned by the existing audit and
deployment gates. Task 7.11f covers exact membership, tombstones,
generic/targetless exclusion, one-count-per-exact-target behavior, raw Tasting
and Entity totals, public access, and the unchanged response contract. This
slice performs no production backfill and authorizes no deployment or
activation.

### User profile statistics use authoritative CatalogTargets

Tasks 7.1e-7.3h cut the user-details statistics over from distinct retained
Bottle ids to each Tasting and collection entry's nullable authoritative
`targetId`. The route reads the selected user's Tastings and collection entries
in bounded ascending-id batches. Tasting primary ids and collection-entry
primary ids are the stable parity locators. For every row, parity measurement
independently resolves the durable target and retained Bottle/Release pair and
records the consumer table, row id, retained ids, target id, caller, operation,
and both resolved identities. Retained identity is telemetry only; it cannot
select aggregate identity, repair a row, or mutate state during the GET.

`stats.tastings` counts every Tasting row created by the user, while
`stats.bottles` counts distinct nonnull authoritative target ids across those
rows. `stats.collected` counts distinct nonnull authoritative target ids across
every collection entry in every collection owned by the user, regardless of
collection name or status. Exact and generic CatalogTargets are separate
identities, and repeated rows for the same target count once in each distinct
metric. A targetless Tasting still contributes to `stats.tastings`, and a
targetless collection entry may still contribute to the existing Library
status row counts, but neither contributes to an identity-distinct count.

The Library status metrics remain row counts over the case-insensitive reserved
Library: `total` includes every status except `empty`, while `open` and `sealed`
include only their respective statuses. A missing, retired, or inconsistent
nonnull target on any row in the aggregate fails the route closed as a
conflict. The route never falls back to the retained pair for statistics
identity and never substitutes a representative Bottle for a generic target.

The cutover preserves the existing public numeric-id, username, and `me`
lookup behavior, missing-user and unauthenticated-`me` errors, actor-aware
`UserSerializer` visibility, friend status, response shape, and actor-backed
contribution count. The GET writes no target, Tasting, collection, parity
repair, or other durable state. Task 7.11g covers exact, generic, repeated,
targetless, retained-drift, invalid-target, collection-scope, Library-status,
lookup, serialization, contribution, and response behavior. Existing-row
target backfill, retained-pair removal, and production activation remain owned
by section 6, tasks 9.6/9.7, and the retained parity/audit gates. This slice
performs no production backfill and authorizes no deployment or activation.

### Badge evaluation uses one normalized CatalogTarget path

Tasks 7.1f-7.3i cut live Tasting badge awards and badge rescans over to one
normalized authoritative CatalogTarget hydrator and the same in-memory check
and tracker path. Each Tasting is correlated by its stable primary id while the
hydrator independently resolves its durable target and retained Bottle/Release
pair. Bounded parity records the `tasting` table, row id, retained ids, target
id, caller, operation, and both resolved identities. Retained identity is
telemetry only and cannot select badge identity, repair the Tasting, or change
award behavior.

An exact target supplies check and tracker data from its independently complete
Bottle, including Bottle-owned brand, bottler, distillers, age, category, and
country/region relationships. A generic target supplies the corresponding
shared data from BottleGroup ownership without hydrating or substituting the
representative Bottle. The existing Bottle check and Bottle tracker remain
exact-only because their configured and tracked ids are concrete Bottle ids; a
generic target does not match or emit a Bottle object. A targetless Tasting or
a missing, retired, or inconsistent nonnull target fails badge evaluation
closed instead of falling back to the retained pair or choosing a member
Bottle.

Live award and rescan both invoke the normalized hydrator and the same parsed
in-memory checks and trackers. Rescan walks Tastings in bounded ascending-id
keyset batches and no longer asks checks to reproduce their predicates as SQL.
The superseded SQL `buildWhereClause` system and the unused top-level badge
base are removed in this slice, leaving one owner for age, category, entity,
region, Bottle, and every-Tasting evaluation. Region checks retain their
existing brand-or-distiller country/region semantics, while entity, country,
and region trackers retain their existing role inclusion and de-duplication
semantics.

Badge definitions and stored configuration remain unchanged. This slice adds
no check type, tracker type, tracked-object type, schema, admin form, or Badge
API contract, and it performs no migration or rewrite of any badge named or
described as “Release.” Existing XP increments, tracked-object idempotency,
formula selection, maximum levels, level-transition records, award response
shape, and existing log message/context shapes remain unchanged. Because the
new in-memory rescan evaluates every row in each bounded batch, it also emits
those existing check/result logs for scanned rows that the removed SQL
prefilter previously skipped; log volume is therefore not claimed to be
unchanged. Task 7.11h covers exact and generic ownership, promoted-release
exact identity, exact-only Bottle behavior, badge-local targetless and retired
failure without fallback, retained-pair drift, row-correlated badge wiring,
shared parity payload and CatalogTarget invalid/inconsistent integrity
evidence, shared live/rescan results, keyset batching, XP idempotency, formulas,
levels, and region semantics. The slice changes no GET behavior, begins no
production backfill, and authorizes no deployment or activation.

### User flavor and region analytics share target-backed Tasting scans

Tasks 7.1g-7.3j cut the user flavor and region routes over from direct retained
Bottle joins to the same bounded ascending-id Tasting scanner used by
user-details Tasting statistics. The scanner at
`apps/server/src/orpc/routes/users/tasting-target-scan.ts` owns row-correlated CatalogTarget
parity for each stable Tasting id and returns the authoritative exact Bottle or
generic BottleGroup identity together with the Tasting's aggregate inputs.
Callers supply their own operation context, while the shared scan owns batching,
target hydration, retained-pair evidence, and invalid-target failure. Retained
Bottle/Release identity cannot select aggregate data, repair a Tasting, or
mutate state during any GET request.

An exact target contributes flavor profile and brand location from its
independently complete Bottle. A generic target contributes the corresponding
BottleGroup-owned values without hydrating or selecting its representative.
A promoted legacy release therefore contributes through its promoted exact
Bottle even while its retained parent/release pair remains parity evidence.
Region aggregation follows only the target owner's brand country and region;
bottler and distiller locations do not contribute. Different brands at the same
country/region location aggregate into one bucket, a brand with a country and
no region contributes to that country's null-region bucket, and a brand without
a country contributes to no location bucket.

Every selected user Tasting still contributes to each route's existing total
row count, and its rating still contributes to the flavor route's total score.
A targetless compatibility row contributes only to those totals, not to a
flavor or location bucket, even when its retained pair is resolvable. A missing,
retired, or inconsistent nonnull target fails the route closed as a conflict
without retained-pair fallback. Classified results preserve their existing
response shapes and are ordered deterministically by the established aggregate
rank before applying the top-25 limit.

The cutover preserves user lookup and profile-visibility behavior and performs
no target, Tasting, parity repair, or other durable mutation. Task 7.11i covers
exact and generic ownership, promoted exact identity, targetless totals,
retained drift, invalid targets, batching, deterministic limits, null fields,
location aggregation, response contracts, and privacy. Existing-row backfill,
retained-pair removal, and production activation remain owned by section 6,
tasks 9.6/9.7, and the retained parity/audit gates. This slice adds no schema
migration, performs no production backfill, and authorizes no deployment or
activation.

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

- **Ambiguous legacy parent fields could create a missing or invented Bottle** → Audit parents with both releases and release-like fields and require an explicit migration disposition before retirement.
- **The cross-cutting target migration can produce mixed reads** → Add `targetId` first, dual-read with parity assertions, backfill in resumable batches, and gate every cutover on zero null/mismatch counts.
- **Promoted names or aliases can collide with existing Bottles** → Produce a preflight collision report and resolve through exact Bottle merge/mapping rather than suffixing or silently overwriting names.
- **A shared edit can collide or partially rematerialize a group** → Lock and
  update the group, all member Bottles, retained exact aliases, and audit rows in
  one transaction; roll back the entire edit on any collision or failed member.
- **Incorrect automatic grouping can corrupt ratings** → Create singleton
  groups synchronously, keep grouping outside the creation request, require
  stronger evidence than fuzzy similarity, and retain audited merge/split
  correction boundaries.
- **More rows are created for singleton products** → Keep groups invisible in normal UI and create group/Bottle/targets atomically; the predictable invariant is worth the storage overhead.
- **Generic targets complicate some consumers** → Centralize polymorphism in `catalog_target` and serializers so feature tables keep one foreign key.
- **Old URLs and clients may depend on release ids** → Preserve permanent mappings/redirects and instrument compatibility usage before removal.
- **An incompletely sequenced production migration could serve invalid target-backed behavior** → Treat review commits as non-deployable boundaries and gate application activation on the fresh audit, completed backfill, valid target graph, and retained parity; ship destructive cleanup separately after its own approval.

## Migration Plan

1. **Inventory and audit tooling:** add read-only counts and integrity checks for all paired-reference tables, dirty parents, aliases, duplicate names, images, and legacy routes. Validate the report contract locally without requiring production access.
2. **Additive schema:** generate migrations for BottleGroup, Bottle membership, catalog targets, release-promotion mappings, group tombstones, and nullable `targetId` columns. Do not remove legacy columns or treat this review slice as a deployment unit.
3. **Domain services:** implement atomic singleton creation, keep trusted-source
   group reuse internal to migration/compatibility/system contexts, add target
   loading and group merge/split, and provide idempotent aggregate recomputation
   with database-backed tests.
4. **New-write cutover:** move Add Bottle, classifier creation, importers, proposals, and supported maintenance flows to create concrete Bottles and automatic groups. Remove obsolete age/release repair workflows and keep legacy release routes as instrumented adapters.
5. **Resumable backfill:** in the controlled production migration, make the additive schema and backfill tooling available, then immediately run and retain the fresh production dry run from that exact revision and approve its counts before live writes. Create groups/targets, promote releases, migrate aliases and content, and populate every consumer `targetId` according to the deterministic rules. Re-run safely until no work remains; do not serve target-dependent application behavior during the incomplete state.
6. **Parity period:** dual-read target and legacy references, assert serialized identity parity, compare exact/group counts, rebuild search indexes, and verify representative URLs and workflows.
7. **Product cutover:** only after completed backfill, a valid zero-null target graph, retained parity evidence, and explicit approval, switch search, Bottle details, Library, tastings, reviews, prices, flights, activity, statistics workers, and moderation UI to Bottle/Group targets. Redirect old nested bottling routes.
8. **Constraint cutover:** make required group/target columns non-null, reject new release writes, and remove paired-reference use from runtime code.
9. **Cleanup:** after compatibility traffic reaches zero, generate migrations removing obsolete consumer `bottleId` columns wherever `targetId` replaces the full legacy pair, plus `releaseId` columns and `bottle_release`, as specified by task 9.6; remove release routes, serializers, jobs, form pages, and remaining compatibility code; remove runtime dependence on BottleGroup hydration for exact Bottle rendering while retaining complete Bottle materialization; then run the final zero-legacy and materialization-invariant audit and update architecture documentation.

Rollback remains straightforward through the parity period: disable new-write cutover, read legacy columns, and retain additive records. After destructive cleanup, rollback requires restoring the pre-cleanup database snapshot or applying a forward repair, so cleanup ships separately with an explicit backup and verification checkpoint.

## Open Questions

None required before implementation. “BottleGroup” is the schema/API term for this change; user-facing copy can be tested separately without changing the identity model.
