# Whisky Identity Model

This is the source of truth for how Peated models whisky identity.

Deterministic name cleanup is governed by the
[Bottle Reference Normalization](./bottle-reference-normalization.md).
User-facing rendering is governed by
[Bottle Presentation](../features/bottle-presentation.md).
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
- **Entity** is a catalog identity with exactly one top-level `kind`: `brand`,
  `distillery`, `bottler`, or `company`. Kind controls browse
  placement. It does not restrict Bottle relationships. A Bottle can use any
  Entity as its brand, bottler, or distiller, and one Entity can fill more than
  one of those relationships.
- **EntityReference** is a name that Peated can match to one Entity without a
  classifier. Each reference belongs to at most one Entity.
- **EntityAlias** is another name shown on an Entity page and used in search.
  An alias alone is not enough to match new input to an Entity.

Collection membership describes a user's physical unit, status, and image. It
does not create another catalog identity layer.

## Core Invariants

- Every marketed release is a Bottle, including a dated, batched, annual,
  vintage, or single-cask product.
- Every Bottle is independently complete and belongs to exactly one
  BottleGroup.
- `BottleGroup.name` stores the name shared by the group. `Bottle.name` stores
  that shared name plus the Bottle's explicit edition.
- Every assigned reference and activity-bearing record references one Bottle id.
  BottleGroup is never a fallback consumer identity.
- A general expression reference points to the retained general Bottle, not the
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

## Whisky Categories

Category records one normalized production style. Country and region remain
separate facts. Use the most specific recognized local style. If local law does
not define the style, use the baseline in `/about/categories`. Leave category
null when the evidence does not establish one.

The supported categories are Blended Whisky, Blended Grain, Blended Malt,
Bourbon, Corn Whisky, Rye Whisky, Single Grain, Single Malt, Single Pot Still,
and Wheat Whisky. Do not use a region, a country, or a generic spirit value as a
category.

Use this precedence when 2 descriptions apply:

1. Bourbon takes precedence over Corn Whisky.
2. Rye, Corn Whisky, and Wheat Whisky take precedence over Blended Whisky and
   grain categories.
3. Blended Malt and Blended Grain take precedence over Blended Whisky.
4. Single Malt and Single Pot Still take precedence over Single Grain.

These rules follow the overlapping blend and named-grain types in
[27 CFR 5.143](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I/section-5.143)
and the global baseline and local-rule precedence in the
[World Whiskies Awards definitions](https://www.worldwhiskiesawards.com/shares/WWA_Categories_2026-Category-Definitions.pdf).

## Field Ownership

BottleGroup owns shared editing semantics for:

- the shared expression name;
- brand, bottler, distillers, category, series, and flavor profile;
- stated age when it is invariant across the expression's releases;
- representative selection and aggregate statistics.

Every Bottle durably materializes those shared values as part of its complete
exact identity and additionally owns:

- its marketed `name` and `fullName`, composed from the stable expression and
  an explicit edition when present;
- edition or batch;
- distillation, bottling, and release years;
- effective stated age;
- ABV, single-cask, and cask-strength flags;
- a confirmed no-age-statement fact;
- natural-color and non-chill-filtered facts;
- the producer-stated phenol level of the malted barley, in PPM;
- optional cask size, type, and fill when explicitly supplied;
- exact references, content, images, activity, and statistics.

BottleReference and BottleAlias have separate authority. A BottleReference is
an internal accepted string that can resolve exact ingestion. A quarantined
reference cannot match new input. A BottleAlias is a moderator-verified
alternate marketed name for display and customer search only. It never grants
exact-match authority. Both records belong to one Bottle, not a BottleGroup.

This duplication is intentional. BottleGroup is the authority for shared
edits, while Bottle remains the authority for exact reads.

`maltPhenolPpm` is the producer-stated phenol level of the malted barley used
for that release. It is not a measurement of the finished whisky and does not
affect Bottle identity, matching, or grouping.

The Bottle `bottler` relationship identifies a business that independently
selects and releases whisky made by another producer. An official Brand or
distillery release has no bottler. A Bottler may also be the Brand, as with
Compass Box. Ownership, importing, distribution, or physical packing alone
does not prove this role.

During an audit, do not remove a populated bottler because the same Entity fills
another Bottle relationship or because a source omits it. Remove it only when
product evidence shows the assignment is wrong. Leave `bottler` null when
classifying a product whose evidence does not establish the relationship.

Observation-only facts by default include bottle number, non-marketed
production lot codes, retailer-exclusive wording, and label notes. Store a
producer-stated cask identifier, maturation statement, or outturn on the Bottle.
Use the cask identifier for identity only when it is part of the marketed
release.

A fact about one component of a blend does not become a field on the complete
Bottle. Set the Bottle's age, year, ABV, or other exact trait only when evidence
states that trait for the marketed blend itself.

`maturation` is free text copied from the producer. Do not split it into a cask
taxonomy. `caskNumber` and `outturn` hold the marketed identifier and stated
bottle count. Do not infer any of these fields.

## Shared And Exact Edits

An exact edit changes only the selected Bottle. A shared edit updates the
BottleGroup and atomically rematerializes every member Bottle's complete
identity while preserving each member's exact fields.

A shared edit that changes a name or prefix regenerates every member's marketed
name while preserving that member's explicit edition. A title change does not
create an exact reference because the same marketed title can identify several
structured releases. An unchanged SMWS code can preserve the previous subtitle
as a reference. SMWS code collisions, incomplete member updates, or audit
failures roll back the entire shared edit.

`Bottle.statedAge` stores the effective age. A non-null value that differs from
the group's current age is an exact override; null or an equal value inherits
the group age. Shared-age edits preserve differing exact overrides and
materialize the new shared age on every other member.

Peated has no manual or automatic group merge or split service. Adding one
requires a separate reviewed change that preserves Bottle IDs and references,
updates shared fields in one transaction, rebuilds group totals, and records the
before and after state.

Bottle checks may report a `bottle_group` finding, but they cannot move or merge
groups. An exact duplicate remains a Bottle merge. A group operation needs
separate design and reviewed evidence.

## Exact Bottle Merge

Exact Bottle merge is the only operation that retires a duplicate Bottle and
repoints consumer Bottle ids. A moderator selects an explicit surviving Bottle;
consumer rows, assigned references, release-promotion mappings, and tombstones
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

An Entity `name` is its full catalog name. `shortName` is the compact name used
in Bottle names. The alias list includes `shortName`, but it can be changed only
by editing the Entity.

Peated keeps references for the Entity name, short name, and the name without a
leading “The.” A moderator can add more references. Adding or deleting an alias
does not change these references. The same alias can belong to more than one
Entity.

- `brand` is the consumer-facing label brand.
- `bottler` is a business that independently selects and releases whisky made by
  another producer. It may also be the Brand. An official Brand or distillery
  release has no bottler.
- `distillery` identifies the actual producer or producers.
- `series` is a stable range or family, not a batch code or release year.
- `edition` is the exact human-facing release descriptor shown in the
  producer's product title or on the label, such as `Batch 24`, `2024 Release`,
  or `S2B13`. Preserve descriptor words that appear there. Narrative prose can
  confirm that a code identifies a marketed release, but it cannot add a word
  to the edition. If the title and label show `4.2` while prose calls it
  "release 4.2," store `4.2`. A printed batch or lot code is not an edition
  when the producer sells one ongoing product without batch-specific
  marketing.
- Bottle names combine the stable expression with an explicit marketed
  edition. Age, vintage year, release year, ABV, cask strength, cask number, and
  outturn remain structured facts. Do not generate name suffixes from those
  fields to make a Bottle look unique. Wording already marketed in the
  expression remains there.
- For a uniform multi-distillery label with no separate expression name, use
  the featured distillery as the Bottle name. For example, use `Glenury Royal`
  as the Rare Series Bottle name. Store its 55-year age, 1970 vintage, 2026
  release year, and 62.4% ABV in their fields, not in the name.
- `vintageYear` is the distillation year. `bottlingYear` is the year the whisky
  was bottled. `releaseYear` is the known year the marketed release became
  available. Store `releaseMonth` and `releaseDay` only when the source gives
  them. A month requires a year, and a day requires a month. Do not make up a
  month or day. A bare year is ambiguous until the source explains it.
- A different `bottlingYear` does not prove that it is a different Bottle.
  Create a separate Bottle for that year only when the producer markets the
  bottling as a separate release.
- Do not infer `statedAge` from year fields unless the source states the age.

When one uniform consumer label markets whiskies from multiple named
distilleries, use that uniform label as the Brand when the distillery names
identify provenance rather than separate consumer brands. Keep each producer
in `distillers`. Do not assign the distillery as Brand only because a common
product title puts the distillery name first. Display order does not change
identity.

For example, model Rare Malts Selection as Brand for its Brora release. Use
Brora as the Bottle name and distiller. Do not model Rare Malts Selection as a
series beneath the Brora Brand.

BottleSeries belongs to one Brand. Do not use BottleSeries to demote an
evidenced uniform Brand into several distillery Brands. A real marketing
program that relates independently branded products needs a separately
designed cross-brand collection concept; it is not a BottleSeries in the
current model.

Package volume, export carton, gift box, and miniature presentation are not
Bottle editions by themselves. Variants that differ only by those package
facts identify the same Bottle. Store a market or package phrase in `edition`
only when product evidence shows that the producer markets it as a distinct
release descriptor.

Brand identity is not a longest-prefix match. Distillery, bottler, owner,
importer, and parent-company names may appear in source text without becoming
the brand. Canonical names and references are evidence, but stale or
source-specific strings cannot prove an entity repair by themselves.

Entity selection is also not a shortest-name match. When existing Bottle data
uses separate Entities for the consumer Brand and producing distillery, reuse
the Entity established in the required Bottle relationship unless stronger
evidence shows the catalog assignment is wrong.

Do not automate brand moves where the only difference is a generic suffix or
prefix such as `Whisky`, `Bourbon`, `Distillery`, `House`, or `Company`.
Those are brand-versus-product-versus-entity questions that require semantic
evidence.

## Matching And Canonicalization

Resolve the exact marketed Bottle first. Use exact label facts, authoritative
sources, references, and nearby catalog entries as evidence. Missing optional
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
canonical name, and the previous canonical name remains a reference. Its
canonical Bottle name is `<distillery number>.<cask number> <subtitle>`. Exact
traits stay in structured fields and are not appended to that name.

## Activity Identity

Tastings, reviews, collection entries, flights, prices, references,
observations, and similar consumers reference one Bottle id. Assigned
references resolve directly to that Bottle with no BottleGroup reference
identity and no second resolver. A general expression reference may reference
the retained general Bottle. Otherwise, an uncertain source remains
unresolved.

Bottle statistics include only activity assigned to that Bottle. BottleGroup
statistics derive from raw activity on current member Bottle ids, counted once;
the group owns no direct activity. Presentation may use a representative
Bottle, but representation never changes consumer identity.
