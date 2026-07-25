## ADDED Requirements

### Requirement: Activity uses one catalog target id

The system SHALL represent the catalog subject of tastings, reviews, collection entries, flights, prices, aliases, observations, classifier decisions, repair proposals, and activity events with one `targetId` rather than an independently supplied `(bottleId, releaseId)` pair.

#### Scenario: Store exact activity

- **WHEN** activity is associated with an identified Bottle
- **THEN** the consumer row references that Bottle's exact catalog target

#### Scenario: Store unknown-exactness activity

- **WHEN** the expression is known but the exact Bottle is not
- **THEN** the consumer row references the BottleGroup's generic catalog target

### Requirement: Target-native consumer flows preserve exactness

The system SHALL accept one authoritative CatalogTarget id for target-native
tasting, collection, Flight, price, and review continuations. Target-native
Tasting, collection, and Flight inputs SHALL be strict alternatives to their
retained Bottle/Release compatibility inputs. Those three writers SHALL retain
`(bottleId, null)` for an exact target and `(null, null)` for a generic target
until compatibility columns are removed. Price and review continuations SHALL
use the selected target as authority while preserving the compatibility
behavior specified by their own mutation and read contracts.

#### Scenario: Write an exact target-native consumer

- **WHEN** a target-native tasting, collection, or Flight writer receives an
  exact CatalogTarget
- **THEN** the writer uses only that target id as selection authority
- **AND** the staged retained projection is the target's own `(bottleId, null)`

#### Scenario: Write a generic target-native consumer

- **WHEN** a target-native tasting, collection, or Flight writer receives a
  generic BottleGroup CatalogTarget
- **THEN** the writer uses only that target id as selection authority
- **AND** the staged retained projection is `(null, null)`
- **AND** it does not persist the representative Bottle as selected identity

#### Scenario: Display whether exactness is known

- **WHEN** a user continues with an exact or generic CatalogTarget
- **THEN** an exact continuation identifies the selected Bottle
- **AND** a generic continuation identifies the BottleGroup and states that the
  exact release is unspecified
- **AND** it does not display the representative Bottle as selected identity

#### Scenario: Link a generic target to its release family

- **WHEN** the web renders a navigable generic CatalogTarget
- **THEN** it links to `/bottles/:representativeBottleId/releases`
- **AND** the representative is used only as a route locator for the generic
  BottleGroup identity
- **AND** the release-family page does not render that Bottle's exact header or
  Product structured data
- **AND** an active group without a valid representative fails closed

#### Scenario: Link an exact Bottle to its release family

- **WHEN** an exact Bottle page or search result links to related releases
- **THEN** it uses `/bottles/:currentBottleId/releases`
- **AND** the release-family page remains generic identity without presenting
  that current Bottle as the selected target

#### Scenario: Reject mixed target-native and legacy identity

- **WHEN** a tasting, collection, or Flight mutation supplies both a
  target-native selection and retained Bottle or BottleRelease selection fields
- **THEN** boundary validation rejects the request
- **AND** the writer does not choose between the conflicting identities

#### Scenario: Filter Reviews by target

- **WHEN** a review list continuation supplies a CatalogTarget id
- **THEN** it filters by that exact target id
- **AND** generic and exact targets within the same BottleGroup remain distinct

### Requirement: Aliases preserve exact or generic target intent

The system SHALL assign aliases through one validated CatalogTarget operation.
Exact marketed aliases SHALL reference an exact Bottle target, stable aliases
SHALL reference a generic BottleGroup target, and compatibility translation
SHALL NOT overwrite a durable target with a legacy pair.

#### Scenario: Assign a moderator Bottle alias

- **WHEN** a moderator assigns an alias using a Bottle id
- **THEN** the system resolves and stores that Bottle's active exact target
- **AND** it does not infer a stable alias for the BottleGroup

#### Scenario: Resolve an exact alias

- **WHEN** an accepted alias references an exact target
- **THEN** exact alias lookup returns that target's Bottle directly
- **AND** it does not reconstruct a BottleRelease identity

#### Scenario: Encounter a generic alias during exact lookup

- **WHEN** an accepted alias references a generic target
- **THEN** the alias remains BottleGroup identity
- **AND** the system does not substitute the representative or another member
  Bottle

#### Scenario: Resolve a legacy targetless alias

- **WHEN** a compatibility lookup encounters an alias whose `targetId` is null
- **THEN** it may use the instrumented legacy pair resolver
- **AND** a non-null target never uses the legacy pair fallback

#### Scenario: Unassign an alias

- **WHEN** a moderator deletes an alias association
- **THEN** the alias row's target id and retained legacy pair are cleared together
- **AND** a target-aware StorePrice or Review whose authoritative `targetId`
  equals the alias snapshot has its target id and retained pair cleared together
  even when that retained pair differs from the snapshot
- **AND** a targetless StorePrice or Review has all three identity fields cleared
  together only when its retained pair equals the alias snapshot
- **AND** an independently retargeted consumer or targetless consumer with a
  different pair is preserved

### Requirement: Alias-driven consumer identity has one owner

The system SHALL synchronize alias-matched StorePrice and Review identity in
the canonical alias assignment transaction. A target-aware assignment SHALL
write the validated target identity and retained compatibility pair atomically.
The alias assignment input SHALL carry that pair separately from any
CatalogTarget descriptor. Targetless compatibility SHALL NOT downgrade a
durable consumer target.

#### Scenario: Propagate an exact alias target

- **WHEN** an exact target-aware alias assignment matches StorePrice or Review
  rows in its lookup scope
- **THEN** every matching consumer atomically receives that exact `targetId`
  and the assignment input's retained Bottle/Release pair

#### Scenario: Propagate a legacy exact target-aware input

- **WHEN** an affected legacy exact caller already has a validated exact
  `targetId` and Bottle identity
- **THEN** it supplies that target id plus an explicit retained
  `(bottleId, null)` pair to canonical alias assignment
- **AND** it does not construct a CatalogTargetAssignmentDescriptor or infer
  generic intent

#### Scenario: Propagate a generic alias target

- **WHEN** a generic target-aware alias assignment matches StorePrice or Review
  rows in its lookup scope
- **THEN** every matching consumer receives the generic `targetId` and retained
  compatibility pair
- **AND** the system does not substitute the BottleGroup representative or
  another exact Bottle

#### Scenario: Run targetless alias compatibility

- **WHEN** measured compatibility assigns an alias without a CatalogTarget
- **THEN** it may update only matching consumers whose `targetId` is null
- **AND** it preserves every non-null consumer target and its authoritative
  identity
- **AND** this name-wide propagation rule does not replace an orchestrator's
  explicit authority over its separately locked selected row

#### Scenario: Process a staged alias-change job

- **WHEN** a raw alias producer queues the retained alias-change worker
- **THEN** it delegates to the canonical consumer synchronization operation
- **AND** it indexes the alias only after that delegated synchronization
- **AND** it does not implement a second propagation algorithm

#### Scenario: Finalize canonical alias assignment

- **WHEN** canonical alias assignment creates a new alias and commits after
  synchronizing its consumers
- **THEN** its finalizer queues alias indexing directly
- **AND** it does not queue the alias-change worker to repeat synchronization

#### Scenario: Reassign an existing canonical alias

- **WHEN** canonical assignment synchronizes consumers for an existing alias
- **THEN** its finalizer need not enqueue alias indexing

#### Scenario: Replay a generic raw alias

- **WHEN** the retained alias-change worker loads a generic target alias with a
  legacy pair
- **THEN** it resolves that pair through measured target assignment
- **AND** it synchronizes consumers only when the result is the same stored
  generic target
- **AND** an invalid pair, cross-group result, or release-bearing exact mismatch
  fails without writing consumers

#### Scenario: Replay a targetless raw alias

- **WHEN** the retained alias-change worker loads a targetless alias with a
  Bottle identity
- **THEN** it locks the retained Bottle lifecycle before consumer mutation
- **AND** when `releaseId` is non-null, it locks that BottleRelease and validates
  that it belongs to the retained Bottle before acquiring consumer locks
- **AND** a missing or mismatched BottleRelease produces no consumer writes or
  alias indexing
- **AND** it revalidates and locks the alias snapshot after acquiring consumer
  locks
- **AND** concurrent Bottle retirement or alias reassignment cannot commit stale
  propagation
- **AND** the targetless compatibility path remains measured and removable

### Requirement: Classifier creation returns canonical exact identity

The system SHALL expose one `create_bottle` classifier action containing one
complete concrete Bottle and SHALL return that Bottle's active exact
CatalogTarget with a null retained release id. It SHALL retain a bounded
projection of classifier evidence without returning full
artifacts, candidates, search evidence, or duplicate proposed payloads.

#### Scenario: Create or safely reuse from a classifier decision

- **WHEN** a `create_bottle` classifier decision creates a concrete Bottle or
  safely reuses an exact canonical duplicate
- **THEN** the result contains the active exact target and matching
  `(bottleId, null)` projection
- **AND** creation records `create_bottle` while safe reuse records
  `match_existing`
- **AND** retained evidence includes the action, identity scope, observation,
  identity basis, and confidence basis
- **AND** creation uses an automatic singleton group without classifier-selected
  parent or source-group context
- **AND** the path does not insert a BottleRelease or use a raw alias writer
- **AND** canonical concrete creation still reserves the required canonical
  exact alias for the Bottle

#### Scenario: Classifier resolution has no valid target

- **WHEN** classification returns `no_match`, classifier execution fails, or
  applying the decision cannot produce a valid exact target
- **THEN** the resolution remains explicitly targetless
- **AND** classifier failure exposes no retained classifier-evidence projection
- **AND** the system does not select a representative or arbitrary exact Bottle

#### Scenario: Create a Bottle from reviewed photo identification

- **WHEN** an approved photo-identification create decision succeeds
- **THEN** it returns the active exact CatalogTarget for the complete Bottle
- **AND** any catalog-image side-effect failures are returned as non-fatal
  warnings
- **AND** it creates neither a BottleRelease nor a photo/reference ingestion
  alias
- **AND** canonical concrete creation still reserves the Bottle's required
  canonical exact alias

#### Scenario: Return an existing photo match

- **WHEN** photo identification matches an existing concrete Bottle
- **THEN** the public decision returns that Bottle's active exact CatalogTarget
- **AND** raw classifier Bottle/Release evidence remains internal
- **AND** the client does not reconstruct a Bottle/Release pair

#### Scenario: Assign a resolved missing-Bottle worker consumer

- **WHEN** the missing-Bottle worker receives a successful classifier resolution
- **THEN** its decision audit, alias, and matching Review consumers atomically
  receive the same validated CatalogTarget and retained identity projection
- **AND** a Review whose identity changes after the worker snapshot is preserved
  rather than overwritten by the stale resolution
- **AND** unresolved and `no_match` Review rows remain targetless

### Requirement: Direct Review mutations preserve one authoritative identity

The system SHALL resolve known exact or generic intent to one validated
CatalogTarget descriptor before a direct user/API Review mutation. It SHALL
revalidate and lock that descriptor before mutating the Review and SHALL treat
the descriptor as authoritative over the retained compatibility pair. For an
update, the system SHALL snapshot Review identity, lock the authoritative target
before locking the Review when one applies, and accept the mutation only if the
locked identity tuple matches the snapshot. A mismatch SHALL roll back and
trigger a bounded retry from a fresh snapshot.

#### Scenario: Create a Review with known catalog intent

- **WHEN** direct Review creation resolves known exact or generic intent
- **THEN** it atomically writes the descriptor's `targetId` together with the
  retained `bottleId` and `releaseId` compatibility pair
- **AND** any applicable alias assignment uses that same target
- **AND** a generic target remains BottleGroup identity without substituting a
  representative Bottle

#### Scenario: Known Review intent cannot resolve a valid target

- **WHEN** a known mapped exact or generic match fails target validation
- **THEN** the Review mutation fails without writing targetless compatibility
- **AND** the system does not reinterpret the failure as unresolved intent

#### Scenario: Review creation conflicts with a durable target

- **WHEN** create/upsert encounters an existing Review with a durable target
  and the current reference is genuinely unresolved or targetless
- **THEN** the existing complete `targetId`/`bottleId`/`releaseId` identity is
  preserved as one unit
- **AND** the unresolved input does not downgrade or partially mix that identity

#### Scenario: Rejected Review conflict emits no identity evidence

- **WHEN** Review create/upsert preserves an existing different complete
  identity tuple because the incoming identity loses the conflict
- **THEN** it creates or reassigns no alias for the rejected incoming identity
- **AND** it records no decision evidence for the rejected incoming identity

#### Scenario: Correct Review identity

- **WHEN** a direct Review update explicitly changes catalog identity
- **THEN** it resolves and locks the authoritative CatalogTarget from the
  current Review snapshot and requested correction before locking the Review
- **AND** it validates and atomically writes one complete target and
  retained-pair tuple only when the locked identity matches that snapshot

#### Scenario: Review identity changes during an update

- **WHEN** the Review identity locked after CatalogTarget resolution differs
  from the snapshot used for that resolution
- **THEN** the transaction rolls back without mutating the Review
- **AND** the operation retries a bounded number of times from a fresh Review
  snapshot

#### Scenario: Clear Review identity

- **WHEN** a direct Review update explicitly clears its Bottle association
- **THEN** it atomically clears `targetId`, `bottleId`, and `releaseId`

#### Scenario: Update Review content without changing identity

- **WHEN** a direct Review update changes only non-identity fields
- **THEN** it preserves an existing durable target and retained pair
- **AND** it may measured-repair `targetId` from the retained pair only when the
  locked Review is currently targetless
- **AND** a staged legacy row whose retained pair cannot yet resolve remains
  explicitly targetless

#### Scenario: Defer adjacent Review cutovers

- **WHEN** task 5.6c dual-writes direct Review mutations
- **THEN** shared alias propagation remains owned by task 5.6b
- **AND** successful direct task 5.8 classifier creation or safe reuse writes its
  exact target, while the explicitly unconverted task 5.9 worker consumer may
  remain targetless
- **AND** target-backed reads, existing-row backfill, and compatibility removal
  remain owned by tasks 7.3, section 6, and task 9.7 respectively
- **AND** the slice remains a code-review boundary with no deployment or
  activation claim

### Requirement: Direct collection membership has one authoritative target

The system SHALL resolve one validated exact or generic CatalogTarget for
direct collection membership creation and a resolvable specific delete. It
SHALL lock that target before the membership, SHALL write no new targetless
membership, and SHALL treat a durable target as authoritative over the retained
compatibility pair.

#### Scenario: Add an exact or generic collection membership

- **WHEN** a user adds a Bottle or unknown-exactness expression to a collection
- **THEN** creation resolves and locks one exact or generic target before the
  collection membership
- **AND** it stores that target together with the retained legacy pair
- **AND** it does not substitute a representative Bottle for generic intent
- **AND** it does not create a targetless row when target validation fails

#### Scenario: Upgrade a matching targetless membership

- **WHEN** the selected retained pair already owns a targetless collection row
  and no canonical membership exists
- **THEN** creation upgrades that row to the validated target
- **AND** it preserves the row's image, status, ownership, and unit-level state
- **AND** the collection count does not increase

#### Scenario: Retained pair belongs to another durable target

- **WHEN** creation finds the selected retained pair on a collection row whose
  durable target differs from the validated target
- **THEN** the mutation conflicts without changing either identity
- **AND** it does not reinterpret the durable target from the legacy pair

#### Scenario: Consolidate canonical and targetless duplicates

- **WHEN** the validated target membership and a matching targetless legacy-pair
  membership both exist in the collection
- **THEN** the canonical target membership remains as the destination
- **AND** only a blank canonical image may be filled from the compatibility row
- **AND** canonical status, ownership, non-blank image, and other unit state win
- **AND** the duplicate is removed and the collection count is corrected in the
  same transaction

#### Scenario: Remove one resolvable selected membership

- **WHEN** a delete supplies a release or explicitly selects `baseOnly` and the
  selected pair resolves to a target
- **THEN** it resolves and locks that pair's target before collection membership
- **AND** it removes the target-authoritative row plus a matching targetless
  legacy-pair fallback
- **AND** it preserves any row owned by a different durable target

#### Scenario: Remove an unresolved staged membership

- **WHEN** a specific delete selects an ungrouped parent or a release without
  completed promotion
- **THEN** measured staged compatibility removes only the matching null-target
  retained-pair membership
- **AND** it never removes a membership with a durable target
- **AND** section 6 backfills those rows and task 9.7 removes the fallback

#### Scenario: Retain broad family-delete compatibility

- **WHEN** a delete supplies neither a release nor `baseOnly`
- **THEN** measured compatibility removes rows by retained parent Bottle
  identity and may intentionally span multiple canonical memberships
- **AND** exact UI removal uses `baseOnly` instead of this broad behavior
- **AND** task 9.7 removes the family-delete compatibility path

#### Scenario: Defer adjacent collection cutovers

- **WHEN** task 5.6d dual-writes direct collection mutations
- **THEN** collection reads and existing-row backfill remain owned by task 7.3
  and section 6
- **AND** legacy pair storage and compatibility removal remain owned by tasks
  9.6 and 9.7
- **AND** the slice remains a code-review boundary with no deployment or
  activation claim

### Requirement: Direct Flight membership has one authoritative target set

The system SHALL accept strict alternative Flight inputs: target-native
`targets: number[]` supplies authoritative CatalogTarget ids, while retained
`bottles: number[]` supplies legacy `(bottleId, null)` intent. A request SHALL
NOT combine them. The system SHALL persist one validated exact or generic
CatalogTarget per distinct target and SHALL lock target identity before Flight
membership. An explicit membership list on update SHALL fully replace
membership; omitting both alternatives SHALL preserve it.

#### Scenario: Create a Flight from target-native input

- **WHEN** direct Flight creation receives one or more CatalogTarget ids in
  `targets`
- **THEN** every id is resolved and locked as authoritative identity
- **AND** an exact membership retains that target's own `(bottleId, null)`
- **AND** a generic membership retains `(null, null)` without selecting the
  BottleGroup representative
- **AND** every requested target is locked before the Flight and membership rows
  are inserted

#### Scenario: Create a Flight from staged Bottle-id input

- **WHEN** direct Flight creation receives one or more Bottle ids
- **THEN** each id resolves by deterministic legacy parent cardinality to an
  exact Bottle or generic BottleGroup target
- **AND** each membership stores the submitted retained `bottleId`, null
  `releaseId`, and validated `targetId` together
- **AND** generic intent does not substitute a representative Bottle
- **AND** every requested target is locked before the Flight and membership rows
  are inserted

#### Scenario: Canonicalize duplicate Flight target selections

- **WHEN** multiple submitted Bottle ids resolve to the same CatalogTarget
- **THEN** the Flight stores one membership for that target
- **AND** it deterministically retains the lowest submitted Bottle id as
  compatibility identity

#### Scenario: Flight selection cannot resolve

- **WHEN** a submitted Bottle id is invalid or its staged legacy identity has no
  valid active target
- **THEN** the complete Flight create or update rolls back
- **AND** the system does not write a targetless membership

#### Scenario: Replace a Flight membership set

- **WHEN** a Flight update supplies either a `targets` list or a retained
  `bottles` list
- **THEN** the supplied list is the complete desired membership set
- **AND** an empty list clears all membership
- **AND** the operation locks the union of requested and existing durable
  targets through the BottleGroup, Bottle, then CatalogTarget hierarchy before
  the Flight and membership rows
- **AND** it removes previous durable and targetless rows and inserts only the
  canonical requested assignments atomically

#### Scenario: Flight membership changes during replacement

- **WHEN** locked Flight membership differs from the snapshot used to resolve
  and lock its existing target set
- **THEN** the transaction rolls back without replacing membership
- **AND** the operation retries a bounded number of times from a fresh snapshot

#### Scenario: Update Flight metadata without replacing membership

- **WHEN** a Flight update omits both `targets` and `bottles`
- **THEN** existing membership is preserved unchanged

#### Scenario: Defer adjacent Flight cutovers

- **WHEN** task 5.6e dual-writes direct Flight mutations
- **THEN** Flight reads and existing-row backfill remain owned by task 7.3 and
  section 6
- **AND** retained pair storage and compatibility removal remain owned by tasks
  9.6 and 9.7
- **AND** the slice remains a code-review boundary with no deployment or
  activation claim

### Requirement: Automated ignored StorePrice clearing preserves authoritative identity

The system SHALL treat a StorePrice's `{ targetId, bottleId, releaseId }` as one
identity tuple when automated price matching clears an ignored listing. A
durable target SHALL be authoritative over the retained compatibility pair, and
the clear SHALL lock validated target identity before the proposal and
StorePrice while conditionally clearing the complete tuple. An authorized
ignored resolver SHALL mean tokenless execution or a resolver whose token owns
the current active processing lease.

#### Scenario: Clear an unchanged durable exact assignment

- **WHEN** ignored resolution snapshots a StorePrice with an exact target and
  the complete identity tuple remains unchanged
- **THEN** it resolves and locks the BottleGroup, exact Bottle, and CatalogTarget
  through the global hierarchy before the proposal and StorePrice
- **AND** one null-safe compare-and-set clears `targetId`, `bottleId`, and
  `releaseId` together

#### Scenario: Clear an unchanged durable generic assignment

- **WHEN** ignored resolution snapshots a StorePrice with a generic target and
  the complete identity tuple remains unchanged
- **THEN** it resolves and locks the BottleGroup and CatalogTarget through the
  global hierarchy before the proposal and StorePrice
- **AND** it clears all three identity columns together without selecting the
  representative or another exact Bottle

#### Scenario: Clear targetless compatibility identity

- **WHEN** ignored resolution snapshots a targetless StorePrice whose retained
  pair remains unchanged
- **THEN** measured compatibility may clear the three identity columns together
- **AND** it does not invent a CatalogTarget merely to perform the clear

#### Scenario: StorePrice identity changes during ignored resolution

- **WHEN** the current StorePrice differs from the snapshot in `targetId`,
  `bottleId`, or `releaseId`
- **THEN** the conditional clear affects no identity column
- **AND** target-only drift, pair-only drift, and a complete reassignment are
  preserved as one current tuple

#### Scenario: A concurrent merge changes an invalidated target assignment

- **WHEN** concurrent merge work changes the StorePrice identity tuple and the
  snapshotted durable target fails during initial descriptor resolution or
  hierarchy-lock revalidation after waiting
- **THEN** the operation preserves the changed current tuple
- **AND** it does not clear or reconstruct identity from the stale retained pair

#### Scenario: An authorized resolver encounters an unchanged invalid target

- **WHEN** the snapshotted durable target fails resolution, the StorePrice still
  has the unchanged snapshotted identity tuple, and the ignored resolver is
  authorized
- **THEN** the operation fails without clearing any identity column
- **AND** it reports target-integrity failure rather than falling back to
  targetless pair semantics

#### Scenario: A stale resolver lost its processing lease

- **WHEN** target resolution fails after an ignored resolver loses its lease to
  a replacement owner
- **THEN** it returns the replacement owner's current proposal and preserves the
  current StorePrice identity tuple
- **AND** it neither clears that tuple nor surfaces the stale target-resolution
  failure

#### Scenario: Retain ignored-processing lease behavior

- **WHEN** ignored resolution attempts an assignment clear
- **THEN** the existing processing-token ownership and lease-expiration checks
  still gate that clear
- **AND** this identity cutover does not change lease acquisition, renewal, or
  release behavior

#### Scenario: Defer adjacent StorePrice cutovers

- **WHEN** the first task 5.6f sub-slice updates automated ignored-assignment
  clearing
- **THEN** direct create-batch ingestion is completed by the adjacent second
  task 5.6f sub-slice
- **AND** alias-driven propagation remains owned by task 5.6b
- **AND** create-new approval is handled by its separate concrete-target cutover
- **AND** target-backed reads, existing-row backfill, broader repair and caller
  cutovers, retained-pair cleanup, and deployment remain outside this review
  boundary

### Requirement: Direct StorePrice ingestion writes one authoritative identity

The system SHALL resolve an accepted listing alias to one exact, generic, or
measured targetless assignment before direct StorePrice ingestion. A validated
target SHALL replace the complete retained identity tuple, while targetless or
unmatched input SHALL NOT downgrade a durable target or partially mix identity
from two decisions.

#### Scenario: Ingest an exact target-backed alias

- **WHEN** the accepted alias owns an active exact target
- **THEN** ingestion locks the target hierarchy before StorePrice, history, or
  alias mutation
- **AND** writes its `targetId`, exact Bottle id, and null release id together

#### Scenario: Ingest a generic target-backed alias

- **WHEN** the accepted alias owns an active generic target
- **THEN** an alias without a retained pair writes that target with null retained
  Bottle and release ids
- **AND** a retained pair is carried only when measured legacy resolution maps
  it to that same generic target
- **AND** an invalid or different-target pair fails without mutation
- **AND** it neither selects the representative Bottle nor queues unresolved
  matching work

#### Scenario: Upgrade a targetless legacy alias

- **WHEN** a targetless alias's retained pair resolves through the measured
  deterministic assignment boundary
- **THEN** ingestion locks and writes that target with the retained pair
- **AND** canonical alias assignment upgrades the alias to the same exact or
  generic target

#### Scenario: Retain staged targetless compatibility

- **WHEN** the only alias match is an ungrouped parent or an unpromoted release
- **THEN** ingestion locks the retained parent, release when present, and
  existing promotion mapping before re-running legacy resolution
- **AND** it may write its measured targetless pair only when that same staged
  state remains and the existing StorePrice is also targetless
- **AND** completed grouping or promotion aborts stale targetless ingestion
  without taking target hierarchy locks after the legacy locks
- **AND** it preserves an existing durable identity tuple

#### Scenario: Ingest an unmatched listing

- **WHEN** neither the normalized alias key nor retained raw fallback matches
- **THEN** a new StorePrice remains targetless and queues matching work
- **AND** an existing StorePrice preserves its complete current identity tuple

#### Scenario: Alias identity changes during ingestion

- **WHEN** an alias is retargeted, ignored, or invalidated after lookup
- **THEN** canonical alias assignment revalidates a same-name normalized source
  after consumers and before claim
- **AND** it claims the normalized canonical alias before revalidating a
  distinct raw compatibility source
- **AND** stale StorePrice, history, and alias mutations roll back together

#### Scenario: Defer adjacent direct-ingestion cutovers

- **WHEN** the second task 5.6f sub-slice updates create-batch ingestion
- **THEN** normalized-key lookup and legacy raw fallback, price/image history,
  image finalization, and post-commit job behavior remain supported
- **AND** task 7.3 owns target-backed reads, section 6 owns existing-row
  backfill, tasks 5.7/5.5c own create-new approval, and tasks 9.6/9.7 own
  retained-pair and compatibility removal
- **AND** the slice makes no deployment or activation claim

### Requirement: Existing-match price evidence shares one target

The system SHALL accept one selected CatalogTarget id for an approved
existing-match store-price proposal and SHALL atomically use that same target
for the StorePrice, listing alias, source observation, approved proposal, and
that proposal's latest attempt. Retained Bottle/Release pairs SHALL remain
compatibility evidence rather than approval authority.

#### Scenario: Approve an exact target

- **WHEN** a moderator approves an existing match by supplying an active exact
  target id
- **THEN** the approval derives the retained `(bottleId, null)` projection from
  that target's independently complete Bottle
- **AND** the StorePrice, listing alias, source observation, approved proposal,
  and that proposal's latest attempt store the exact target and projection

#### Scenario: Approve the proposal's generic suggestion

- **WHEN** a moderator approves an active generic target
- **THEN** that target must be the proposal's own suggested target
- **AND** the approval locks and revalidates that suggested slot's retained
  projection as compatibility evidence for the same generic target
- **AND** the StorePrice, listing alias, source observation, approved proposal,
  and that proposal's latest attempt store the generic target and validated
  projection without substituting a representative or another member Bottle

#### Scenario: Apply a same-Bottle correction repair

- **WHEN** a moderator applies a correction proposal's sparse Bottle repair
- **THEN** its current and suggested target ids are both non-null active exact
  targets for the same concrete Bottle
- **AND** the exact target identity is locked and revalidated before the
  proposal and canonical Bottle update commit
- **AND** retained current and suggested pairs are compatibility evidence and
  cannot select a different Bottle or target

#### Scenario: Approval cannot persist one target-backed record

- **WHEN** target resolution, retained-projection validation, listing-alias
  assignment, observation persistence, proposal persistence, or latest-attempt
  persistence fails
- **THEN** the approval transaction rolls back
- **AND** it does not commit different targets or only part of the assignment

#### Scenario: Retain adjacent compatibility contracts

- **WHEN** an exact or generic approval assigns its shared target
- **THEN** retained Bottle/Release columns remain a matching staged storage
  projection until their explicit cleanup task
- **AND** they are not accepted as moderator selection input or used to replace
  the selected target

#### Scenario: Approve a create-new proposal after concrete creation cutover

- **WHEN** create-new approval creates or reuses a concrete Bottle
- **THEN** the exact CatalogTarget is the shared StorePrice, listing-alias,
  source-observation, proposal, and latest-attempt identity
- **AND** proposal and attempt current and suggested identities store that target
  with matching `(bottleId, null)` projections
- **AND** target-aware alias assignment gives same-site, same-listing-name,
  same-volume StorePrice rows that exact target and retained projection
- **AND** it does not retarget a cross-volume proposal
- **AND** failure to persist any identity rolls back the complete concrete graph and approval

#### Scenario: Keep the approved proposal and its latest attempt in atomic parity

- **WHEN** create-new approval stores the selected exact target and retained
  projection on its proposal
- **THEN** that proposal's own latest attempt, when present, receives the same
  target and current/suggested retained projections in that approval transaction
- **AND** no approval may commit a proposal identity without its corresponding
  latest-attempt identity update, or vice versa
- **AND** it does not retarget a cross-volume sibling proposal

#### Scenario: Record concrete create-new vocabulary

- **WHEN** create-new approval makes an initial incoming Bottle assignment and
  no source decision already exists
- **THEN** a newly created Bottle emits `create_bottle`, the exact target,
  `(bottleId, null)`, and `createdBottle: true`
- **AND** safe exact-duplicate reuse emits `match_existing`, the same target and
  retained-pair shape, and no concrete creation finalizer
- **AND** historical release-creation decision values remain readable until their explicit compatibility removal

#### Scenario: Preserve prior incoming decisions

- **WHEN** create-new approval encounters a prior source decision or a
  StorePrice that already had Bottle identity
- **THEN** it does not rewrite or add an incoming decision log for that source
- **AND** the approved proposal, attempt, StorePrice, alias, and observation
  still receive the selected concrete target according to their own contracts

#### Scenario: Reuse a duplicate after rollback and revalidation

- **WHEN** canonical create-new execution detects an exact duplicate
- **THEN** its nested creation savepoint first rolls back all preparatory writes
- **AND** the existing exact descriptor and any trusted source descriptor are
  locked and revalidated before reuse
- **AND** reuse requires either exact canonical `fullName` equality or an exact
  structurally parsed SMWS code match, and its exact target remains active
- **AND** an arbitrary or ignored alias collision, fuzzy name similarity, or
  fuzzy or substring-only SMWS collision is not accepted as reusable exact identity
- **AND** release-only reuse requires both descriptors to remain active in the
  same group
- **AND** a changed proposal price id, parent Bottle id, `creationTarget`,
  `proposedBottle`, `proposedRelease`, or complete StorePrice identity tuple
  aborts approval without overwriting the newer identity

#### Scenario: Defer adjacent create-new cutovers

- **WHEN** the concrete create-new price-approval slice is reviewed
- **THEN** task 5.8 classifier application produces canonical exact targets and
  task 5.9 retains only the remaining caller/worker consumer cutovers
- **AND** target-backed reads, existing-row backfill, release-shaped web input,
  generated OpenAPI/client dependencies, and compatibility cleanup stay assigned
  to task 7.3, section 6, section 8, task 5.11, and task 9.7 respectively
- **AND** the slice neither begins production backfill nor authorizes deployment

### Requirement: Target integrity is database enforced

The system SHALL enforce one generic target per BottleGroup, one exact target per Bottle, and consistency between an exact target's Bottle and BottleGroup.

#### Scenario: Create an inconsistent exact target

- **WHEN** a write attempts to pair a Bottle with a BottleGroup it does not belong to
- **THEN** the database rejects the write

#### Scenario: Create a duplicate target

- **WHEN** a write attempts to create a second generic target for a group or a second exact target for a Bottle
- **THEN** the database rejects the write

### Requirement: Target results are discriminated

The API SHALL return a discriminated target result that identifies whether the target is an exact Bottle or a generic BottleGroup and includes only valid hydrated objects for that kind.

#### Scenario: Load an exact target

- **WHEN** an exact target is requested
- **THEN** the result contains `kind: "bottle"`, its Bottle, and its BottleGroup

#### Scenario: Load a generic target

- **WHEN** a generic target is requested
- **THEN** the result contains `kind: "group"` and its BottleGroup
- **AND** it does not invent a representative exact Bottle as the activity target

### Requirement: Legacy references migrate deterministically

The migration SHALL populate target ids from legacy references using release promotion and parent cardinality without guessing exact identity.

#### Scenario: Legacy release reference

- **WHEN** a legacy row has a non-null `releaseId`
- **THEN** it maps to the exact target of the Bottle promoted from that release

#### Scenario: Generic reference under a parent with releases

- **WHEN** a legacy row has a null `releaseId` and its parent has one or more releases
- **THEN** it maps to the parent's BottleGroup target

#### Scenario: Reference under a parent without releases

- **WHEN** a legacy row has a null `releaseId` and its parent has no releases
- **THEN** it maps to the retained Bottle's exact target

#### Scenario: Target-back legacy aliases and observations

- **WHEN** the separate post-promotion alias and observation phase processes a
  locked parent family
- **THEN** the measured legacy-pair assignment resolver is the sole semantic
  resolver for each distinct retained pair
- **AND** each pair is first resolved optimistically, then re-resolved and
  revalidated after the canonical group, Bottle when exact, and target locks
  plus applicable parent, release, and promotion-mapping evidence locks are
  acquired
- **AND** its aliases and observations are locked and changed only after that
  post-lock resolution agrees
- **AND** each row has only its null `targetId` set, or its matching nonnull
  `targetId` validated on rerun
- **AND** alias retained pairs, names, embeddings, ignored state, assignment
  provenance, and timestamps remain unchanged
- **AND** observation retained pairs, source identity, URLs/sites, raw and
  parsed evidence, facts, creator, and timestamps remain unchanged

#### Scenario: Exclude the canonical promotion alias

- **WHEN** the alias phase selects remaining legacy aliases after promotion
- **THEN** the required canonical exact alias already claimed by promotion task
  6.5a is excluded from selection and mutation rather than independently
  revalidated, reassigned, or recreated by this phase
- **AND** integration evidence for the combined promotion and dependent
  backfill proves its state remains unchanged
- **AND** ignored legacy aliases remain included in the remaining target-only
  backfill

#### Scenario: Reject target or descriptor drift

- **WHEN** an alias or observation has a different nonnull target, its retained
  pair changes, its descriptor is invalid, or its promotion is incomplete
- **THEN** the parent-family alias and observation transaction rolls back
- **AND** the phase does not overwrite or heal the conflicting state
- **AND** it does not synchronize alias consumers, enqueue indexing, rename an
  alias, or backfill another consumer table

#### Scenario: Backfill all remaining consumer slots for one parent family

- **WHEN** tasks 6.7-6.9 process a promoted parent family
- **THEN** one atomic phase covers ten logical target slots across `tasting`,
  `review`, `collection_bottle`, `flight_bottle`, `store_price`,
  `incoming_bottle_decision_log`, and the independent current and suggested
  slots on `store_price_match_proposal` and `store_price_match_attempt`
- **AND** one shared helper resolves the parent-only reference and every family
  release reference, locks the canonical group/Bottle/target descriptors plus
  parent/release/promotion evidence, and re-resolves them before consumer locks
- **AND** a non-null release maps to its promoted Bottle's exact target
- **AND** a null release under a parent with releases maps to the generic group
  target
- **AND** a null release under a parent without releases maps to the retained
  Bottle's exact target

#### Scenario: Preserve optional unresolved absence

- **WHEN** a nullable consumer slot has both Bottle and release ids null
- **THEN** the slot is not selected or mutated
- **AND** the migration preserves its target whether null or nonnull and does
  not invent retained-family intent
- **AND** proposal and attempt current and suggested slots are evaluated
  independently even when both belong to the same row

#### Scenario: Reject remaining-consumer drift or collision

- **WHEN** a selected consumer pair is invalid, a locked row or logical slot
  differs from its preflight, a nonnull target differs from the resolved target,
  or the target would collide with tasting, collection, or Flight membership
  uniqueness
- **THEN** every remaining-consumer write for that parent family rolls back
- **AND** the migration does not overwrite or heal the target, choose or
  consolidate a membership row, or change a collection count
- **AND** a matching nonnull target is validated as idempotent reuse

#### Scenario: Preserve consumer evidence during target backfill

- **WHEN** a remaining consumer target is populated or reused
- **THEN** its Bottle/Release pair and every non-target field remain unchanged,
  including content, unit state, provenance, processing state, decision
  vocabulary, JSON evidence, and timestamps
- **AND** the migration invokes no runtime writer, alias propagation,
  statistics, indexing, queue, price-matching, proposal-approval, or decision
  side effect
- **AND** target-backed reads remain a later cutover

### Requirement: Target migration is auditable and resumable

The system SHALL provide idempotent backfill commands and dry-run reports covering every target-bearing table, legacy release mapping, collision, and unresolved identity condition.

#### Scenario: Process a keyset parent batch

- **WHEN** the core promotion service processes legacy parents
- **THEN** it selects them in ascending-id keyset order
- **AND** it processes one locked parent family per bounded transaction
- **AND** it returns cursor-ready progress without beginning consumer backfill

#### Scenario: Promote one parent family atomically

- **WHEN** a legacy parent with releases passes promotion preflight
- **THEN** one transaction creates or validates its group and generic target,
  every complete promoted Bottle and exact target, and their completed mappings
- **AND** the Bottle promoted from the lowest legacy release id becomes the
  deterministic representative
- **AND** each promoted Bottle's required canonical exact alias is atomically
  claimed for its exact target before its mapping becomes complete
- **AND** no mapping becomes complete before its Bottle is independently
  correct without BottleGroup hydration

#### Scenario: Reuse a completed promotion

- **WHEN** a rerun encounters a completed release mapping
- **THEN** it validates the release-parent relationship, mapped Bottle, parent
  group, exact target, required canonical exact alias, canonical identity, and
  durable materialization
- **AND** it reuses a matching graph without creating duplicate records
- **AND** any missing or inconsistent mapped state stops with parent and release
  context rather than being silently healed

#### Scenario: Promotion preflight finds a collision

- **WHEN** any canonical Bottle or alias row matching a planned promoted
  identity conflicts, or release-like parent fields remain ambiguous
- **THEN** the parent-family transaction performs no partial promotion
- **AND** it enumerates every matching canonical Bottle and alias row rather
  than selecting one arbitrary match
- **AND** only the Bottle proven by the same structurally identical completed
  mapping may be accepted on rerun
- **AND** it does not suffix, overwrite, discard, or invent identity
- **AND** the required canonical exact alias claim uses database uniqueness so a
  concurrent conflicting claim rolls back the parent family
- **AND** completion of the earlier read-only audit alone does not satisfy this
  mutation-path preflight

#### Scenario: Backfill is interrupted

- **WHEN** a target backfill batch stops before completion and is run again
- **THEN** the retained external checkpoint replays its `activeParentId`
  directly before selecting another parent, even when a zero-release parent's
  completed core phase means it no longer matches legacy-parent selection
- **AND** completed phase state and mappings are validated and reused
- **AND** remaining rows are processed without duplicate Bottles, groups, or
  targets

#### Scenario: Retain a revisioned dry-run report

- **WHEN** an operator runs the backfill command without write authority
- **THEN** it produces a versioned external JSON report through only read-only
  revision evidence, the existing catalog migration audit, and parent selection
- **AND** it does not call or simulate core, alias/observation, or consumer
  mutation services
- **AND** the report records its generation time, database name, exact full Git
  commit, and latest applied Drizzle migration id, hash, and timestamp
- **AND** execution is refused unless the applied migration hash and timestamp
  equal the latest candidate migration in the checkout
- **AND** the CLI creates the retained file atomically without overwriting an
  existing dry-run report
- **AND** after publishing the retained file it fsyncs the containing directory
  before reporting success
- **AND** production resolves the configured full Git revision while every
  nonproduction run ignores configured version metadata and requires clean
  current `HEAD`

#### Scenario: Run one approved bounded write batch

- **WHEN** an operator supplies a completed retained dry run and explicit
  approval bound to a strictly later approval time, audit, Git commit, database,
  and Drizzle revision
- **THEN** the command persists the active parent before mutation and invokes
  core promotion, alias/observation target backfill, and remaining-consumer
  target backfill in that order as three separate bounded transactions
- **AND** only after all three phases succeed does it add cumulative phase and
  per-consumer-slot metrics, clear the active parent, advance the after cursor,
  and atomically retain that advanced checkpoint
- **AND** after publishing or replacing a checkpoint it fsyncs the containing
  directory before reporting checkpoint success
- **AND** one invocation processes no more than the requested bounded batch
- **AND** resume requires the retained write report, approved dry run, approval,
  and current revision evidence to match exactly
- **AND** the invocation holds an exclusive report lock for the complete
  read/run/checkpoint sequence and fails closed when that lock exists
- **AND** a stale lock has no automatic timeout or takeover and may be removed
  operationally only after confirming that no writer remains live

#### Scenario: Validate a retained run state

- **WHEN** a retained report is created or loaded
- **THEN** its runtime schema enforces mode/status/checkpoint relationships and
  ascending completed/active/next cursor order
- **AND** every count equals updated plus reused and approver identity is trimmed
  and nonblank
- **AND** a complete dry run may retain its next read-only candidate while a
  complete write retains no active or next parent
- **AND** failure variants permit only locators owned by their core,
  alias/observation, consumer, or checkpoint phase
- **AND** operation and composite failure parents identify the active parent,
  while a checkpoint-only failure identifies the active or pre-core next parent
- **AND** a checkpoint failure may omit its parent only for a final checkpoint
  with no active or next work

#### Scenario: A migration phase fails

- **WHEN** a checkpoint or parent-family phase fails
- **THEN** the command stops at the first failure without running a later phase
  or exposing an unretained cursor or metrics advance
- **AND** its versioned report contains only the failure phase, stable code,
  retryability, parent/release identity, and applicable typed
  table/surface/row/projection locator
- **AND** if persisting that operation failure also fails, the observable
  checkpoint failure preserves the sanitized original operation failure
- **AND** raw error details, connection data, and stacks are not retained

#### Scenario: Use only the canonical batch orchestrator

- **WHEN** the command selects and processes a bounded parent batch
- **THEN** it uses the read-only parent selector and canonical three-phase
  orchestrator
- **AND** no core-only `backfillLegacyCatalogBatch` wrapper or second batch
  mutation path remains

#### Scenario: Verify coordinated migration behavior

- **WHEN** migration integration tests exercise clean, reused, conflicting, and
  interrupted parent families
- **THEN** they prove row counts, mappings, field ownership, exact versus
  generic target selection, canonical-alias exclusion, and idempotent replay
  across the three phase transactions
- **AND** they prove dry run performs no mutation, revision/approval drift
  blocks writes, active-family replay recovers a zero-release parent, and a
  first failure prevents later-phase writes and checkpoint advancement
- **AND** they use no production data or production execution

#### Scenario: Audit finds an ambiguous parent

- **WHEN** a parent with child releases also contains unresolved release-like fields or a promoted name collides
- **THEN** the audit reports the record and blocks destructive cleanup until it has an explicit disposition

### Requirement: Read cutover proves parity

The system SHALL compare legacy and target-based resolution during a parity period and SHALL block constraint and cleanup cutovers while mismatches or unmapped references remain.

#### Scenario: Parity mismatch

- **WHEN** a target-based read resolves a different exact or generic identity from its legacy reference
- **THEN** the mismatch is recorded
- **AND** removal of the legacy columns remains blocked

### Requirement: Compatibility never chooses an arbitrary Bottle

Compatibility routes SHALL return replacement target information or redirect mappings and SHALL NOT choose a member Bottle when a legacy reference was generic.

#### Scenario: Store one Bottle retirement destination

- **WHEN** the system records a Bottle tombstone
- **THEN** its nullable exact-Bottle and generic-group destinations are mutually
  exclusive
- **AND** the measured ungrouped legacy purge may retain neither destination
- **AND** a canonical exact merge or legacy parent retirement records its one
  explicit destination

#### Scenario: Resolve a retired generic parent

- **WHEN** an old parent URL or API reference maps to a BottleGroup through its
  active migration `groupId` or its future Bottle tombstone group destination
- **THEN** the system returns the group identity or redirects to
  `/bottles/:representativeBottleId/releases`
- **AND** the representative is only the web route locator and is not
  substituted as the selected target
- **AND** resolution fails closed when the active group has no valid
  representative

#### Scenario: Preserve exact Bottle retirement

- **WHEN** an exact Bottle merge tombstone identifies its selected surviving
  Bottle
- **THEN** the page target remains that exact Bottle
- **AND** the system does not reinterpret the merge as generic group identity

#### Scenario: Flatten a retired parent destination

- **WHEN** a group merge retires a group named by one or more Bottle tombstone
  group destinations
- **THEN** the merge atomically repoints those destinations to its selected
  destination group before removing the source group
- **AND** subsequent parent resolution remains a one-hop generic group mapping

#### Scenario: Resolve a merged source group

- **WHEN** a group merge has repointed every source-generic reference and removed
  the source generic target and BottleGroup rows
- **THEN** the source group tombstone identifies the selected destination group
- **AND** exact Bottle ids and exact target ids from the merged source remain
  unchanged
