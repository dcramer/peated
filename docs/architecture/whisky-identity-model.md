# Whisky Identity Model

This is the source of truth for how Peated models whisky identity.

Deterministic name cleanup is governed by the
[Bottle Normalization Contract](./bottle-normalization-contract.md).

## Identity Objects

- **Bottle** is one concrete marketed release. It has its own stable identity
  and durably stores every field needed to search, render, and understand that
  release without loading its BottleGroup.
- **BottleGroup** is the generic identity shared by releases of the same
  expression. It owns the shared editing scope, stable aliases, generic
  activity, and aggregate statistics. Groups are created and maintained by the
  system; ordinary Bottle creation never asks a user to choose one.
- **BottleSeries** is a broader named range that can contain distinct
  expressions. Series membership is organizational context, not evidence that
  two Bottles belong to the same BottleGroup.
- **CatalogTarget** is the identity stored by activity-bearing records. An
  exact target identifies one Bottle; a generic target identifies a
  BottleGroup when the expression is known but the exact release is not.
- **BottleObservation** is source evidence from a listing, label, or other
  observation. It may preserve facts more specific or less certain than the
  canonical Bottle identity.

Collection membership describes a user's physical unit, status, and image. It
does not create another catalog identity layer.

## Core Invariants

- Every marketed release is a Bottle, including a dated, batched, annual,
  vintage, or single-cask product.
- Every Bottle is independently complete and belongs to exactly one
  BottleGroup.
- Every Bottle has one exact CatalogTarget. Every active BottleGroup has one
  generic CatalogTarget and at least one Bottle.
- A generic target never resolves to the group's representative Bottle as a
  substitute exact identity.
- Ordinary creation atomically creates a complete Bottle, a singleton
  BottleGroup, and both required targets. “Add another release” only prefills a
  new Bottle draft; it does not reuse the source Bottle's group.
- Semantic grouping happens outside ordinary creation. Similar names, a shared
  brand, or a shared BottleSeries may suggest a relationship but do not prove
  same-expression identity.

There is no parent-versus-release creation decision and no `repair_parent`
workflow. Discovering another release does not change an existing Bottle's
identity.

## Field Ownership

BottleGroup owns shared editing semantics for:

- the generic expression name;
- brand, bottler, distillers, category, series, and flavor profile;
- stated age when it is invariant across the expression's releases;
- stable aliases, generic editorial content, representative presentation, and
  aggregate statistics.

Every Bottle durably materializes those shared values as part of its complete
exact identity and additionally owns:

- its complete marketed `name` and `fullName`;
- edition or batch;
- release and vintage years;
- effective stated age;
- ABV, single-cask, and cask-strength flags;
- canonical cask size, type, and fill;
- exact aliases, content, images, activity, and statistics.

This duplication is intentional. BottleGroup is the authority for shared
edits, while Bottle remains the authority for exact reads.

Observation-only facts by default include exact cask or barrel number, bottle
number, outturn, retailer-exclusive wording, label notes, and unmodeled
maturation details. Promote one of these facts into Bottle identity only when
it is part of the marketed release or is needed for recurring canonical
disambiguation.

## Shared And Exact Edits

An exact edit changes only the selected Bottle. A shared edit updates the
BottleGroup and atomically rematerializes every member Bottle's complete
identity while preserving each member's exact fields.

A shared edit that changes a name or prefix regenerates every member's
canonical exact name. Previous canonical exact names remain aliases for their
Bottles. Name or alias collisions, incomplete member updates, or audit failures
roll back the entire shared edit.

`Bottle.statedAge` stores the effective age. A non-null value that differs from
the group's current age is an exact override; null or an equal value inherits
the group age. Shared-age edits preserve differing exact overrides and
materialize the new shared age on every other member.

Group merge and split are audited catalog operations. A merge applies the
destination group's shared identity to all moved Bottles without changing their
Bottle or exact-target ids. A split moves selected Bottles without changing
their exact identities. Generic activity remains generic unless explicitly
reassigned by the operation.

## BottleGroup Versus BottleSeries

BottleGroup membership means “marketed releases of the same expression.”
BottleSeries means “related products in the same range.”

- Springbank 12 Cask Strength Batch 23 and Batch 24 can be two Bottles in one
  BottleGroup.
- Macallan 18 annual releases can be separate Bottles in one BottleGroup when
  they are marketed as annual versions of the same expression.
- Octomore 13.1 and 13.3 are distinct expressions in separate BottleGroups,
  even if they share a BottleSeries.

BottleSeries does not aggregate ratings and is never sufficient grouping
authority.

## Naming And Entity Boundaries

- `brand` is the consumer-facing label brand.
- `bottler` is a separately stated bottling house when it differs from the
  brand.
- `distillery` identifies the actual producer or producers.
- `series` is a stable range or family, not a batch code or release year.
- `edition` is a human-facing release descriptor such as `Batch 24`,
  `2024 Release`, or `S2B13`.
- `vintageYear` is the distillation year. `releaseYear` is the bottling or
  marketed release year. A bare year is ambiguous until source evidence gives
  it meaning.
- Do not infer `statedAge` from vintage and release years unless the source
  states the age.

Brand identity is not a longest-prefix match. Distillery, bottler, owner,
importer, and parent-company names may appear in source text without becoming
the brand. Canonical names and aliases are evidence, but stale or
source-specific strings cannot prove an entity repair by themselves.

Do not automate brand moves where the only difference is a generic suffix or
prefix such as `Whisky`, `Bourbon`, `Distillery`, `House`, or `Company`.
Those are brand-versus-product-versus-entity questions that require semantic
evidence.

## Matching And Canonicalization

Resolve the exact marketed Bottle first. Use exact label facts, authoritative
sources, aliases, and nearby catalog entries as evidence. Missing optional
attributes do not make a clear exact identity unresolved, while conflicting
age, edition, year, cask, or single-cask facts are strong evidence of distinct
Bottles.

Grouping is a separate decision. Same-expression evidence may relate exact
Bottles through a BottleGroup, but uncertain grouping leaves each Bottle in its
singleton group. A BottleObservation preserves useful source precision without
forcing either a new Bottle or a group change.

SMWS codes are exact identity anchors when printed or when deterministically
composed from an SMWS distillery number and single-cask number visible on the
label. A code must not invent a missing component or subtitle.

## Activity Identity

Tastings, reviews, collection entries, flights, prices, aliases, observations,
and similar consumers reference one CatalogTarget:

- use the Bottle's exact target when the concrete release is known;
- use the BottleGroup's generic target when only the expression is known.

Exact Bottle statistics include only exact-target activity. BottleGroup
statistics include direct generic activity plus every member's exact activity,
counted once. Presentation may use a representative Bottle, but representation
never changes the target or its exactness.
