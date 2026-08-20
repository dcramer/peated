# Whisky Identity Model

This is the source of truth for how Peated models whisky identity.

Deterministic name cleanup is governed by the
[Bottle Normalization Contract](./bottle-normalization-contract.md).
Surface-specific rendering is governed by
[Bottle Identity Presentation](./bottle-identity-presentation.md).
Classifier terms are governed by the
[Bottle Classifier Glossary](./bottle-classifier-glossary.md).

## Identity Objects

- **Bottle** is one complete product release. It has its own stable identity
  and durably stores every field needed to search, render, and understand that
  release without loading its BottleGroup.
- **BottleGroup** relates releases of the same expression. It owns the shared
  editing scope, representative relationship, and member-derived aggregate
  statistics. Ordinary Bottle creation creates a singleton group, and the
  legacy migration creates deterministic family groups. Users never choose or
  manage groups.
- **BottleSeries** is a broader named range that can contain distinct
  expressions. Series membership is organizational context, not evidence that
  two Bottles belong to the same BottleGroup.
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
- Every assigned alias and activity-bearing record references one Bottle id.
  BottleGroup is never a fallback consumer identity.
- A general expression alias points to the retained general Bottle, not the
  group's representative Bottle.
- Ordinary creation atomically creates a complete Bottle and a singleton
  BottleGroup. “Add a similar bottle” only prefills a new Bottle draft; it does
  not reuse the source Bottle's group.
- Creation accepts one flat Bottle input. The server assigns storage ownership.
  A submitted `statedAge` starts as the Bottle's exact age. The singleton
  BottleGroup starts with no shared age because one release does not prove that
  the age is invariant across a future group.
- Updates accept one flat `BottlePatch`. The server assigns storage ownership.
  Name, brand, bottler, distillers, category, series, and flavor profile changes
  use shared editing semantics. A non-null `statedAge` change belongs to the
  selected Bottle. A null age clears a differing exact override, or clears and
  fans out the shared age when the selected Bottle has no exact override.
- Semantic grouping happens outside ordinary creation. Similar names, a shared
  brand, or a shared BottleSeries may suggest a relationship but do not prove
  same-expression identity. This release does not ship an automatic regrouping
  service; independently created Bottles remain in their singleton groups.

There is no parent-versus-release creation decision and no `repair_parent`
workflow. Discovering another release does not change an existing Bottle's
identity.

## Field Ownership

BottleGroup owns shared editing semantics for:

- the shared expression name;
- brand, bottler, distillers, category, series, and flavor profile;
- stated age when it is invariant across the expression's releases;
- representative selection and aggregate statistics.

Every Bottle durably materializes those shared values as part of its complete
exact identity and additionally owns:

- its complete marketed `name` and `fullName`;
- edition or batch;
- release and vintage years;
- effective stated age;
- ABV, single-cask, and cask-strength flags;
- optional cask size, type, and fill when explicitly supplied;
- exact aliases, content, images, activity, and statistics.

This duplication is intentional. BottleGroup is the authority for shared
edits, while Bottle remains the authority for exact reads.

`bottler` is the market-facing bottler or release imprint named for the product.
It may point to the same Entity as `brand` or a producing distillery; a separate
imprint is not required. Ownership, importing, distribution, and physical
packing alone do not establish the role.

During an audit, do not remove a populated bottler because the same Entity fills
another role or because a source omits it. Remove it only when product evidence
shows the assignment is wrong. Leave `bottler` null when classifying a product
whose evidence does not establish the role.

Observation-only facts by default include exact cask or barrel number, bottle
number, outturn, non-marketed production lot codes, retailer-exclusive wording,
label notes, and unmodeled maturation details. Promote one of these facts into
Bottle identity only when it is part of the marketed release or is needed for
recurring canonical disambiguation.

A fact about one component of a blend does not become a field on the complete
Bottle. Set the Bottle's age, year, ABV, or other exact trait only when evidence
states that trait for the marketed blend itself.

`caskType`, `caskSize`, and `caskFill` remain nullable storage fields for
compatibility but are soft-deprecated for automated identity decisions. Preserve
explicit values without requiring or researching them, and do not select,
reject, create, repair, or gate automation solely on differences in those
fields. This does not deprecate marketed finish wording in `name` or `edition`,
exact cask or barrel codes, `singleCask`, or `caskStrength`.

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

This release has no manual or dormant group merge/split service. Any future
automatic regrouping system must be a separately reviewed change that preserves
Bottle ids and consumer references, rematerializes shared fields
transactionally, recomputes affected group aggregates, and records an auditable
before/after result.

Bottle checks may report a non-executable `bottle_group` finding, but they
cannot move or merge groups. An exact duplicate remains a Bottle merge: for the
reviewed Laphroaig Càirdeas 2022 case, malformed Bottle `39096` merges into
Warehouse 1 Bottle `45146` while generic Bottle `44288` remains unchanged.
That case does not authorize a grouping operation. A separate follow-up may
define the smallest regroup or group-merge operation only after real reviewed
findings demonstrate the need. It must also preserve aliases, representatives,
and auditable history in addition to the invariants above.

## Exact Bottle Merge

Exact Bottle merge is the only operation that retires a duplicate Bottle and
repoints consumer Bottle ids. A moderator selects an explicit surviving Bottle;
consumer rows, assigned aliases, release-promotion mappings, and tombstones
converge on that Bottle in one canonical operation. BottleGroup is never the
merge destination and a representative Bottle is never selected implicitly.

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
- `bottler` is the named, market-facing bottler or release imprint for the
  product. It may equal the Brand or a producing distillery.
- `distillery` identifies the actual producer or producers.
- `series` is a stable range or family, not a batch code or release year.
- `edition` is a complete human-facing release descriptor such as `Batch 24`,
  `2024 Release`, or `S2B13`. Preserve its descriptor words. A printed batch or
  lot code is not an edition when the producer sells one ongoing product
  without batch-specific marketing.
- `vintageYear` is the distillation year. `releaseYear` is the bottling or
  marketed release year. A bare year is ambiguous until source evidence gives
  it meaning.
- Do not infer `statedAge` from vintage and release years unless the source
  states the age.

Brand identity is not a longest-prefix match. Distillery, bottler, owner,
importer, and parent-company names may appear in source text without becoming
the brand. Canonical names and aliases are evidence, but stale or
source-specific strings cannot prove an entity repair by themselves.

Entity selection is also not a shortest-name match. When existing Bottle data
uses separate Entities for the consumer Brand and producing distillery, reuse
the Entity established in the required role unless stronger evidence shows the
catalog assignment is wrong.

Do not automate brand moves where the only difference is a generic suffix or
prefix such as `Whisky`, `Bourbon`, `Distillery`, `House`, or `Company`.
Those are brand-versus-product-versus-entity questions that require semantic
evidence.

## Matching And Canonicalization

Resolve the exact marketed Bottle first. Use exact label facts, authoritative
sources, aliases, and nearby catalog entries as evidence. Missing optional
attributes do not make a clear exact identity unresolved, while conflicting
age, edition, year, marketed finish or exact cask code, single-cask, or
cask-strength facts are strong evidence of distinct Bottles. Cask type, size,
and fill metadata alone is not such a conflict.

A retailer listing is identified by its source and stable external product id,
falling back to its canonical product URL when the source exposes no id. Its
title is evidence, not listing identity: two same-size listings with the same
generic title may represent different releases and must remain separate.

A retailer GTIN is stored first as a source claim. An existing canonical GTIN
mapping may assign a listing directly only when package volume and explicit
Bottle facts do not conflict. Canonical barcode creation remains an explicit
moderator operation; approving a Bottle match does not promote or overwrite a
retailer's barcode claim.

Change a populated exact field only with evidence for the same Bottle. A value
from another batch, edition, year, or exact cask does not qualify.

Grouping is a separate decision. Same-expression evidence may relate exact
Bottles through a BottleGroup, but uncertain grouping leaves each Bottle in its
singleton group. A BottleObservation preserves useful source precision without
forcing either a new Bottle or a group change.

SMWS codes are exact identity anchors when printed or when deterministically
composed from an SMWS distillery number and single-cask number visible on the
label. A code must not invent a missing component or subtitle. SMWS may rename
the subtitle marketed for a cask, but that does not create a new Bottle: the
code continues to identify the same Bottle, the new subtitle becomes its
canonical name, and the previous canonical name remains an alias.

## Activity Identity

Tastings, reviews, collection entries, flights, prices, aliases, observations,
and similar consumers reference one Bottle id. Assigned aliases resolve
directly to that Bottle with no BottleGroup alias identity and no second
resolver. A general expression alias may reference the retained general Bottle;
otherwise an uncertain source remains unresolved.

Bottle statistics include only activity assigned to that Bottle. BottleGroup
statistics derive from raw activity on current member Bottle ids, counted once;
the group owns no direct activity. Presentation may use a representative
Bottle, but representation never changes consumer identity.
