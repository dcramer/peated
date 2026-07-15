# Catalog Field Ownership

The migration and all new writes use this matrix. A field has one canonical
owner; serializers may hydrate inherited group data but must not persist a
second authoritative copy.

| Concern                                                         | BottleGroup                                                       | Concrete Bottle                                                    | Observation                         | Collection unit                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------- |
| Stable expression name and full name                            | Owns                                                              | References through `groupId`; owns its exact marketed display name | Evidence only                       | No                                                    |
| Brand, bottler, distillers, category, series                    | Owns                                                              | Hydrated from group                                                | May preserve source claims          | No                                                    |
| Stable stated age                                               | Owns when invariant across releases                               | Owns only a release-specific age; otherwise null and inherited     | May preserve label evidence         | No                                                    |
| Edition or batch                                                | No                                                                | Owns                                                               | May preserve uncertain/raw value    | No                                                    |
| Vintage and release year                                        | No                                                                | Owns                                                               | May preserve uncertain/raw value    | No                                                    |
| ABV, single-cask, cask-strength                                 | No                                                                | Owns                                                               | May preserve observed label value   | No                                                    |
| Canonical cask size, type, fill                                 | No                                                                | Owns                                                               | May preserve raw maturation wording | No                                                    |
| Exact cask/barrel number                                        | No                                                                | No by default                                                      | Owns                                | May copy user-visible notes, never canonical identity |
| Bottle number, outturn, label notes, retailer-exclusive wording | No                                                                | No by default                                                      | Owns                                | May own the physical unit's value when user supplied  |
| Stable aliases                                                  | Owns                                                              | No                                                                 | Source text only                    | No                                                    |
| Exact marketed aliases                                          | No                                                                | Owns                                                               | Source text only                    | No                                                    |
| Generic expression activity                                     | Owns through generic CatalogTarget                                | No                                                                 | No                                  | No                                                    |
| Exact activity and statistics                                   | Aggregate only                                                    | Owns through exact CatalogTarget                                   | No                                  | No                                                    |
| Aggregate statistics                                            | Owns raw generic activity plus member exact activity exactly once | Exact activity only                                                | No                                  | No                                                    |
| Editorial description/image/tasting notes                       | Owns only explicit group editorial content                        | Owns exact content                                                 | Source evidence                     | User's physical-unit image/notes only                 |
| Representative presentation                                     | Owns explicit representative Bottle id                            | May be selected, is not rewritten                                  | No                                  | No                                                    |
| Creator and audit timestamps                                    | Owns group creation/audit                                         | Owns Bottle creation/audit                                         | Owns observation provenance         | Owns collection/user provenance                       |
| Ownership status (`sealed`, `open`, `empty`)                    | No                                                                | No                                                                 | No                                  | Owns                                                  |

## Invariants

- Every Bottle has exactly one `groupId` and one exact CatalogTarget.
- Every BottleGroup has exactly one generic CatalogTarget and at least one
  active Bottle.
- Activity stores only `targetId`. A generic target never resolves to the
  representative Bottle as a substitute exact identity.
- Independent creation always creates a singleton group. Reusing a group
  requires an existing-member, migration, curated-alias, or moderator context.
- Exact aliases move with their Bottle. Stable aliases move with the group.
- Observation and unit-level data do not create a Bottle or BottleGroup split
  without an explicit catalog decision.

## Versioned runtime contracts

`apps/server/src/schemas/catalogIdentity.ts` owns the v1 BottleGroup, concrete
Bottle, and discriminated CatalogTarget runtime schemas. The exported
TypeScript types are inferred from those schemas. A breaking result-shape
change adds a new schema version rather than silently changing retained audit,
queue, or compatibility payloads.
