# Catalog Field Ownership

The migration and all new writes use this matrix. BottleGroup defines the
generic target and the moderator editing scope for common values. Every
concrete Bottle durably materializes those common values together with its
exact fields and is independently authoritative, correct, and renderable.
Exact Bottle serializers must not require BottleGroup hydration.

| Concern                                                         | BottleGroup                                                       | Concrete Bottle                                                       | Observation                         | Collection unit                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Stable expression name and full name                            | Owns generic label and shared editing semantics                   | Stores complete exact marketed name including the shared identity     | Evidence only                       | No                                                    |
| Brand, bottler, distillers, category, series, flavor profile    | Owns shared editing semantics                                     | Durably stores complete values for exact reads                        | May preserve source claims          | No                                                    |
| Stable stated age                                               | Owns shared editing semantics when invariant across releases      | Stores effective age; a differing non-null value is an exact override | May preserve label evidence         | No                                                    |
| Edition or batch                                                | No                                                                | Owns                                                                  | May preserve uncertain/raw value    | No                                                    |
| Vintage and release year                                        | No                                                                | Owns                                                                  | May preserve uncertain/raw value    | No                                                    |
| ABV, single-cask, cask-strength                                 | No                                                                | Owns                                                                  | May preserve observed label value   | No                                                    |
| Canonical cask size, type, fill                                 | No                                                                | Owns                                                                  | May preserve raw maturation wording | No                                                    |
| Exact cask/barrel number                                        | No                                                                | No by default                                                         | Owns                                | May copy user-visible notes, never canonical identity |
| Bottle number, outturn, label notes, retailer-exclusive wording | No                                                                | No by default                                                         | Owns                                | May own the physical unit's value when user supplied  |
| Stable aliases                                                  | Owns                                                              | No                                                                    | Source text only                    | No                                                    |
| Exact marketed aliases                                          | No                                                                | Owns                                                                  | Source text only                    | No                                                    |
| Generic expression activity                                     | Owns through generic CatalogTarget                                | No                                                                    | No                                  | No                                                    |
| Exact activity and statistics                                   | Aggregate only                                                    | Owns through exact CatalogTarget                                      | No                                  | No                                                    |
| Aggregate statistics                                            | Owns raw generic activity plus member exact activity exactly once | Exact activity only                                                   | No                                  | No                                                    |
| Editorial description/image/tasting notes                       | Owns only explicit group editorial content                        | Owns exact content                                                    | Source evidence                     | User's physical-unit image/notes only                 |
| Representative presentation                                     | Owns explicit representative Bottle id                            | May be selected, is not rewritten                                     | No                                  | No                                                    |
| Creator and audit timestamps                                    | Owns group creation/audit                                         | Owns Bottle creation/audit                                            | Owns observation provenance         | Owns collection/user provenance                       |
| Ownership status (`sealed`, `open`, `empty`)                    | No                                                                | No                                                                    | No                                  | Owns                                                  |

## Invariants

- Every Bottle has exactly one `groupId` and one exact CatalogTarget.
- Every active BottleGroup has exactly one generic CatalogTarget and at least
  one active Bottle. A merged source is not retained as an empty group: its
  generic target and group rows are removed after references move, while its
  retired id remains in the group tombstone.
- Activity stores only `targetId`. A generic target never resolves to the
  representative Bottle as a substitute exact identity.
- Independent creation always creates a singleton group. Reusing a group
  requires an existing-member, migration, curated-alias, or moderator context.
- Exact aliases move with their Bottle. Stable aliases move with the group.
  Canonical concrete creation reserves the Bottle's required canonical exact
  alias; a caller that creates no photo/reference ingestion alias does not
  bypass that identity reservation.
- The completed alias cutover requires every new assignment to use one
  validated CatalogTarget. Exact aliases reference the owning Bottle's exact
  target; stable aliases reference the BottleGroup's generic target and never
  select its representative Bottle. Task 5.5a establishes that owner for the
  exact/moderator path while later task 5.5 caller slices retire the remaining
  raw legacy-pair writer.
- Moderator Bottle-alias upsert is exact intent. Alias unassignment clears the
  alias row's target and retained legacy pair together. Task 5.6b clears all
  three identity fields from a target-aware StorePrice or Review when its
  authoritative `targetId` matches the alias snapshot, regardless of retained
  pair drift. A targetless consumer matches only when its retained pair equals
  the alias snapshot. Independently retargeted consumers and targetless
  consumers with different pairs are preserved.
- Task 5.6b makes alias-driven StorePrice and Review propagation part of the
  canonical alias assignment transaction. A target-aware assignment writes the
  supplied target and retained pair atomically to matching consumers. The alias
  assignment input owns the retained pair separately from any CatalogTarget
  descriptor. The legacy exact target-aware input carries a validated exact
  `targetId` plus an explicit retained `(bottleId, null)` pair rather than
  inventing a descriptor. Generic targets remain generic and never select the
  representative Bottle.
- Measured targetless alias compatibility may update only targetless matching
  consumers and cannot downgrade a durable consumer target.
- When canonical alias assignment creates a new alias, it queues
  `IndexBottleAlias` directly after commit because consumer synchronization
  already occurred. Existing-alias assignment need not enqueue alias indexing.
  `OnBottleAliasChange` remains only for raw alias producers and delegates
  StorePrice/Review synchronization to the canonical owner before indexing; it
  does not own a parallel propagation algorithm.
- A generic raw-alias replay resolves its retained legacy pair through measured
  assignment and proceeds only when the result equals the stored generic
  target. Invalid, cross-group, or release-bearing exact mismatches fail without
  consumer writes.
- A targetless raw-alias replay locks the retained Bottle lifecycle, then locks
  and validates any non-null retained BottleRelease as belonging to that Bottle
  before consumer locks. An invalid pair produces no consumer writes or alias
  indexing. The worker then revalidates and locks the alias snapshot; the
  measured compatibility branch remains assigned to task 9.7 removal.
- Successful direct task 5.8 classifier creation or safe reuse returns and
  writes the active exact target with `(bottleId, null)`. `no_match`, classifier
  failure, and unresolved decisions remain targetless. The missing-Bottle worker
  may audit task 5.8's concrete target and bounded evidence, but its explicitly
  unconverted Review and alias target assignment remains task 5.9 work; task
  5.6b does not invent an exact Bottle for those rows.
- Task 5.6c makes a known direct Review create/update intent resolve one
  CatalogTarget descriptor and revalidate/lock it before mutating the Review.
  The complete `{ targetId, bottleId, releaseId }` tuple is written atomically,
  the descriptor is authoritative over the retained compatibility pair, and
  any applicable alias assignment uses the same target. Generic Review intent
  never selects the representative Bottle.
- Review create/upsert treats that identity tuple as one unit. A genuinely
  unresolved or targetless current result cannot downgrade or partially mix
  with an existing durable target. When an existing different complete tuple
  wins the conflict, the rejected incoming identity owns no alias creation or
  reassignment and no decision evidence. A known mapped resolution failure is
  an error. Successful direct task 5.8 classifier creation or safe reuse writes
  its exact target; genuinely unresolved results and the explicitly unconverted
  task 5.9 worker consumer remain targetless.
- Direct Review update snapshots the Review identity, resolves and locks the
  authoritative CatalogTarget first when one applies, and then locks the
  Review. It accepts the mutation only when the locked identity tuple still
  matches the snapshot;
  otherwise it rolls back and retries a bounded number of times from a fresh
  snapshot. Explicitly clearing the association clears all three identity
  fields; identity correction validates one complete replacement tuple; and a
  non-identity update preserves a durable target. Only a currently targetless
  Review may be measured-repaired from its retained pair, and an unresolvable
  staged legacy row remains targetless.
- Exact alias lookup returns the Bottle of a non-null exact target. A generic
  target returns no Bottle, and only a null-target legacy alias may use the
  measured pair fallback retained until task 9.7.
- Existing-match and correction price approvals resolve their retained legacy
  Bottle/Release pair once through the measured CatalogTarget assignment
  boundary and reuse the same descriptor for both the listing alias and
  source-keyed observation. A promoted release remains exact; a parent-only
  reference follows deterministic cardinality to a generic group target or
  retained exact Bottle target. Locked alias integrity validation is not a
  second semantic resolution.
- Those target-backed alias and observation writes commit atomically. Exact or
  generic intent is preserved without representative substitution, while the
  observation remains source evidence rather than a catalog grouping decision.
  Create-new approval translates its retained payload into canonical concrete
  Bottle creation and reuses the resulting exact target for the StorePrice,
  alias, observation, proposal, and latest attempt. Proposal and attempt current
  and suggested identity store that target with the matching
  `(createdBottleId, null)` compatibility projection. The path never inserts a
  BottleRelease or enters targetless alias/observation compatibility.
- Bottle-only create-new input supplies stable ownership, including shared
  stated age, while exact stated age is null. Release-only input requires the
  trusted source Bottle's group and supplies exact fields. Combined input keeps
  Bottle stable fields; Release exact values win, with stated age winning even
  when null and other exact values using Bottle input only as a nullish fallback.
  Bottle `descriptionSrc` survives only when Bottle description wins. These
  retained legacy shapes do not guarantee every field can cross the canonical
  boundary: a non-null Bottle or Release `imageUrl` is rejected rather than
  ignored or written outside the upload workflow.
- Duplicate handling rolls the failed creation savepoint back before locking
  and revalidating the existing exact descriptor and any trusted source
  descriptor. Reuse requires exact equality with the requested canonical
  `fullName` and an active exact target; an arbitrary or ignored alias collision,
  fuzzy name similarity, or fuzzy SMWS collision is not reusable identity.
  Release-only reuse is limited to the source group; cross-group or drifted
  descriptors conflict. The later gate rejects changed proposal price, parent,
  `creationTarget`, `proposedBottle`, `proposedRelease`, or complete StorePrice
  `{ targetId, bottleId, releaseId }` identity.
- Create-new approval changes the approved proposal and its own latest-attempt
  current and suggested target/pair projections, when an attempt exists, in the
  same transaction. Neither row may commit only part of the selected identity,
  and cross-volume sibling proposals are not retargeted.
- For an initial incoming assignment, a new concrete result emits a decision
  with `create_bottle` and an active exact duplicate emits `match_existing`,
  both with the exact target and `(bottleId, null)`. A prior source decision is
  immutable and approval of a previously assigned price does not rewrite or
  add one. Historical release-creation decisions remain readable until the
  remaining classifier, caller, and cleanup tasks remove them.
- An authorized schema-valid call reaching the retained create-new
  compatibility handler emits structured telemetry with caller, operation,
  payload discriminator, and handler outcome; a success also records replacement
  Bottle and exact target ids without the raw payload. Section 8 removes
  release-shaped callers and task 9.7 removes the route adapter only after
  observed compatibility-handler traffic is zero.
- Tasks 5.6c-5.6f own direct review, collection, flight, and price mutations;
  task 5.8 owns classifier application, task 5.9 owns the remaining caller and
  worker consumer cutover, task 7.3 owns target-backed reads, section 6 owns
  backfill, Section 8 owns release-shaped UI removal, task 5.11 owns generated
  OpenAPI/client dependencies, and tasks 9.6/9.7 remove retained pairs and
  compatibility. This slice neither begins production backfill nor authorizes
  deployment.
- Task 5.6d resolves and locks one validated exact or generic target before
  direct collection membership creation or a resolvable specific delete. New
  membership is never targetless; a matching targetless legacy-pair row may be
  upgraded, while a different durable target is authoritative and conflicts
  rather than being overwritten.
- Collection uniqueness is target-authoritative. If the canonical target row
  and a matching targetless legacy duplicate coexist, the canonical row wins;
  only its blank image may be filled from the compatibility row. Consolidation
  atomically corrects the collection count and preserves canonical status,
  ownership, non-blank image, and all other unit-level state.
- Release-specific and `baseOnly` collection removal resolves and locks the
  target before membership when one exists, removes that target plus only its
  matching targetless fallback, and preserves a different durable target. An
  ungrouped parent or release without completed promotion may remove only its
  matching null-target retained-pair row as measured staged compatibility,
  never a durable target; section 6 backfills those rows and task 9.7 removes
  the fallback. The measured no-release/no-`baseOnly` family delete
  intentionally spans memberships by retained parent identity until task 9.7;
  exact UI removal uses `baseOnly`.
- Task 5.6e keeps Flight `bottles: number[]` as staged legacy input. Each
  submitted id is `(bottleId, null)` intent resolved by deterministic legacy
  cardinality to an exact Bottle or generic BottleGroup target. The Flight
  membership row retains the submitted Bottle id and null release id alongside
  the validated target; generic intent never substitutes a representative
  Bottle.
- Flight membership is unique and authoritative by target. Submitted ids that
  resolve to the same target collapse to one assignment with the lowest
  submitted Bottle id retained deterministically. Creation locks the canonical
  set through the BottleGroup, Bottle, then CatalogTarget hierarchy before
  Flight and membership writes and creates no targetless row.
- An omitted Flight `bottles` update preserves membership, an explicit empty
  list clears it, and any explicit non-empty list fully replaces it. Replacement
  snapshots membership, locks the union of requested and existing durable
  targets through the shared BottleGroup, Bottle, then CatalogTarget hierarchy
  before the Flight and membership rows, and retries from a fresh snapshot when
  concurrent identity changes are observed. A stable replacement removes old
  durable and targetless rows and inserts only the canonical requested target
  assignments atomically.
- Task 7.3 owns target-backed Flight reads, section 6 owns existing-row
  backfill, task 8.7 owns target-native Flight input, and tasks 9.6/9.7 remove
  retained pair storage and compatibility. Task 5.6e is not a deployment or
  activation unit.
- A StorePrice's `{ targetId, bottleId, releaseId }` columns form one identity
  tuple. A durable `targetId` is authoritative over its retained compatibility
  pair; pair-only state cannot reinterpret or downgrade that target.
- The automated ignored-assignment clear snapshots the complete StorePrice
  identity tuple. For a durable exact or generic target, it resolves and locks
  the BottleGroup, exact Bottle when present, and CatalogTarget before the
  proposal and StorePrice. A targetless compatibility tuple may clear without
  inventing or substituting a target.
- The ignored clear uses one null-safe compare-and-set over all three identity
  columns and clears all three together only when the current tuple still
  equals the snapshot. Target-only drift, pair-only drift, and complete
  reassignment preserve the current tuple.
- If concurrent merge work invalidates the snapshotted target and also changes
  the StorePrice tuple, the changed tuple is preserved as merge drift. An
  ignored resolver is authorized when execution is tokenless or its token owns
  the current active processing lease. Only for that authorized resolver is an
  unchanged tuple whose durable target cannot resolve an integrity failure; it
  is not silently cleared through the retained pair. A stale resolver that lost
  its lease returns the replacement owner's current proposal and preserves the
  StorePrice tuple without clearing it or surfacing the stale target failure.
- Task 5.6f does not change ignored-proposal lease ownership or expiration.
  Direct create-batch ingestion is the completed adjacent 5.6f sub-slice.
  Alias-driven propagation remains task 5.6b, create-new approval is the
  separate concrete-target cutover above, and target-backed reads, backfill, broader repair/caller cutovers,
  cleanup, and deployment remain deferred.
- Direct create-batch ingestion now owns one incoming StorePrice identity
  decision. A validated exact or generic target replaces the complete tuple;
  generic identity stores no representative, but a retained legacy pair may be
  carried only after it resolves to that same generic target. A deterministically
  resolved targetless alias keeps its measured pair alongside the target.
  Explicit staged targetless input may replace only a targetless tuple, and
  unmatched input preserves every existing identity field.
- Create-batch locks validated targets through BottleGroup, Bottle, then
  CatalogTarget before StorePrice, history, or alias writes. Canonical alias
  assignment remains the consumer synchronization and source-snapshot owner: a
  same-name normalized source is checked before claim, while a distinct raw
  fallback is checked after normalized canonical claim. Staged targetless
  compatibility locks the parent, release, and promotion state and re-runs
  resolution before StorePrice/history mutation, aborting when the staged state
  changed rather than inverting target-after-legacy lock order.
- Normalized-key lookup, raw fallback, price/image history, image finalization,
  alias provenance, and post-commit job ownership are unchanged. Alias matches
  of every valid exact, generic, or staged-targetless kind suppress resolver
  work; unmatched listings schedule it. Reads/backfill/create-new/cleanup stay
  assigned to task 7.3, section 6, tasks 5.7/5.5c, and tasks 9.6/9.7.
- An exact Bottle read is complete without BottleGroup hydration.
- An exact-only update mutates only the selected Bottle and its exact aliases.
- A moderator shared edit atomically updates the BottleGroup and rematerializes
  the common fields, distiller joins, and complete identity of every member
  Bottle while preserving each member's exact fields.
- Bottle `statedAge` is normalized without provenance schema: differing
  non-null values relative to the pre-update current group age are exact
  overrides; null or equal values inherit the shared age. Exact null clears the
  override and materializes the resulting group age. Shared-age fan-out
  preserves the differing overrides identified against the current group age
  and updates all other members; an explicit exact age equal to the shared age
  is not sticky.
- Shared identity fan-out retains every old canonical exact name as an exact
  alias and rolls back the entire update on any Bottle or alias collision.
- Shared fan-out writes one existing `bottle` update audit row per affected
  member with group and scope context. A selected member receiving shared and
  exact changes gets one combined row; task 4.6 adds no `bottle_group` audit
  enum or migration.
- Shared and exact-only updates leave Bottle ids, membership, generic and exact
  target ids, representative selection, activity, and Bottle/BottleGroup
  activity and rating aggregates unchanged. Shared series fan-out or drift
  repair may recompute only affected old and new BottleSeries `numReleases`
  membership counts.
- A moderator group merge moves one source group into one selected destination.
  Destination shared identity wins and atomically rematerializes every moved
  Bottle, preserves its exact fields and exact target id, and retains its prior
  canonical exact name as an exact alias.
- A merge repoints source-generic consumers and stable aliases to the destination
  generic target before removing the source target and group. Destination
  collection rows win with blank-image fill from the source, flight duplicates
  collapse, and tasting, Bottle identity, alias, or SMWS ambiguity rolls back
  the transaction.
- A merge writes BottleGroup before/after snapshots plus one Bottle update audit
  per moved member with reversible source/destination and alias context. An
  identical retry to the tombstoned destination is unchanged; another
  destination conflicts.
- Group merge uses the shared transaction-scoped BottleGroup aggregate helper
  brought forward from task 4.11 and recomputes raw exact plus generic target
  activity exactly once. Task 4.11 remains responsible for remaining exact and
  reusable statistics entry points.
- A group split clones source shared identity and group distillers into the new
  group, selects one moved member as its representative, and does not
  rematerialize moved Bottles. Exact Bottle content, ids, targets, aliases, and
  Bottle distiller rows remain unchanged; later shared identity edits use
  atomic fan-out.
- The split source retains group-owned editorial content, stable aliases, its
  generic target, and generic activity. The new group starts with empty
  explicit editorial content and its own generic target.
- Observation and unit-level data do not create a Bottle or BottleGroup split
  without an explicit catalog decision.

## Legacy correction proposal mapping

For correction proposals, a `proposedBottle` remains a sparse repair draft for
the old parent/stable Bottle layer. The compatibility mapper sends required `name`
and `brand`, non-null `series`, `category`, `statedAge`, and `bottler`, and
non-empty `distillers` as shared BottleGroup intent. The legacy stated age is
shared because release-specific age belonged to `proposedRelease`; the draft
cannot yet express an exact-age repair.

Non-null `edition`, `abv`, `singleCask`, `caskStrength`, `vintageYear`,
`releaseYear`, `caskSize`, `caskType`, and `caskFill` are exact intent for the
selected Bottle. Null fields and empty distillers mean unknown in this sparse
contract and preserve existing values; boolean false and numeric zero remain
explicit values. The canonical concrete update service applies both scopes in
the same transaction as proposal approval, so shared values fan out while
exact values remain selected-only. A later explicit contract may replace this
sparse compatibility shape rather than adding more inference here.

## Legacy BottleRelease write adapters

The BottleRelease create adapter treats its legacy `bottle` input only as
trusted group context and maps release-owned fields to a new exact Bottle. The
source must be an active Bottle in a valid group; a retired parent or generic
group cannot be converted into exact identity by choosing a representative or
another member. The response is the new Bottle's exact CatalogTarget, never a
release-shaped object with a fabricated `id`. A non-null legacy `imageUrl` is
rejected because canonical images use the upload boundary rather than accepting
an arbitrary stored URL.

A legacy update owns no shared fields. The task 5.4b measured adapter requires a
completed promotion mapping and sends only supplied fields as a sparse exact
patch through the canonical concrete Bottle update operation used by the
standard Bottle route. Omitted fields remain unchanged. An explicit null clears
the corresponding nullable canonical value, including a null `imageUrl`, while
a non-null legacy `imageUrl` is rejected rather than bypassing the canonical
upload boundary. The retained BottleRelease is immutable compatibility input,
not a write mirror, and the adapter issues no parallel direct alias, audit, or
job writes. On success it returns the mapped Bottle's exact CatalogTarget and
records the legacy release id plus replacement Bottle and target ids. Legacy
delete does not create a destination-free canonical retirement operation.

A grouped exact Bottle can be retired only through the existing
`mergeConcreteBottles` operation with an explicit surviving Bottle. That merge
owns exact-consumer consolidation, promotion-mapping repointing, aliases and
tombstones, representative replacement, and singleton group retirement. It
never infers a representative, sibling, or generic target as the destination.
Promotion mappings remain live and converge on the selected survivor, so no
retired-promotion schema or migration is introduced.

The standard Bottle DELETE route remains only as a measured compatibility
purge for ungrouped pre-migration Bottles and rejects grouped concrete Bottles
without mutation with an actionable merge-required result. BottleRelease DELETE
retains its external admin authorization, path, input, and output contract,
requires a completed internally consistent promotion mapping, makes no mutation,
and returns merge-required with the mapped Bottle and exact target. Invalid
mappings conflict, and the retained BottleRelease is never deleted. Delete UI
actions that can only fail are removed or hidden; tasks 8.9 and 9.7 remove the
remaining nested UI and compatibility surfaces. All adapters emit measured
compatibility writes and are disabled under task 9.4 and removed under task
9.7. These rules preserve independently complete Bottles and shared-edit
fan-out rather than making a Bottle depend on BottleGroup hydration.

Legacy release-repair candidate discovery and application are likewise limited
to ungrouped pre-migration Bottles. Discovery and both the preflight and locked
apply reads require `groupId IS NULL`. Grouped Bottles are not offered,
repaired, or deleted by this compatibility path and instead require an explicit
exact Bottle merge. Task 9.7 removes the retained repair path.

## Durable Bottle materialization

Bottle `brandId`, `bottlerId`, `category`, `seriesId`, `flavorProfile`,
`statedAge`, and `bottlesToDistillers` rows are durable parts of the exact
Bottle record, not temporary compatibility mirrors. Creation writes them for
every Bottle. A shared group update synchronizes them across every member in
the same transaction that updates names and aliases. Task 9.9 removes runtime
dependence on group hydration for exact Bottle rendering; it does not remove
this Bottle materialization.

## Versioned runtime contracts

`apps/server/src/schemas/catalogIdentity.ts` owns the v1 BottleGroup, concrete
Bottle, and discriminated CatalogTarget runtime schemas. The exported
TypeScript types are inferred from those schemas. A breaking result-shape
change adds a new schema version rather than silently changing retained audit,
queue, or compatibility payloads.
