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

Until task 5.7 replaces legacy price-match proposal actions with target-aware
contracts, a correction `proposedBottle` remains a sparse repair draft for the
old parent/stable Bottle layer. The compatibility mapper sends required `name`
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
exact values remain selected-only. Task 5.7 owns target-aware proposal actions
and an explicit exact-age contract rather than adding inference here.

## Legacy BottleRelease write adapters

The BottleRelease create adapter treats its legacy `bottle` input only as
trusted group context and maps release-owned fields to a new exact Bottle. The
source must be an active Bottle in a valid group; a retired parent or generic
group cannot be converted into exact identity by choosing a representative or
another member. The response is the new Bottle's exact CatalogTarget, never a
release-shaped object with a fabricated `id`. A non-null legacy `imageUrl` is
rejected because canonical images use the upload boundary rather than accepting
an arbitrary stored URL.

A legacy update owns no shared fields. It requires a completed promotion
mapping and applies only to the mapped exact Bottle through the canonical
update service. The retained BottleRelease is immutable compatibility input,
not a write mirror. Legacy delete cannot be translated until canonical Bottle
deletion preserves the permanent promotion mapping and defines group,
representative, target, and tombstone ownership. All adapters emit measured
compatibility writes and are disabled under task 9.4 and removed under task
9.7.

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
