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
- Every BottleGroup has exactly one generic CatalogTarget and at least one
  active Bottle.
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
- Observation and unit-level data do not create a Bottle or BottleGroup split
  without an explicit catalog decision.

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
