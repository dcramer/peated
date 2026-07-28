# Schema Conventions

The authoritative model lives in
[Whisky Identity Model](../architecture/whisky-identity-model.md). This document
defines extraction, normalization, and editing conventions for that model.

## Identity Layers

Every marketed release is one independently complete Bottle. Extraction may be
partial and may identify both shared-expression and exact-release fields. A
`create_bottle` decision must produce one complete Bottle proposal rather than
a parent plus child release.

BottleGroup shared editing fields:

- `brand`
- `bottler`
- `distillery`
- `expression`
- `series`
- `category`
- `flavor_profile`
- `stated_age` when invariant across the expression's releases

Exact Bottle fields:

- `edition`
- `release_year`
- `vintage_year`
- release-specific `stated_age`
- `abv`
- `single_cask`
- `cask_strength`
- `cask_fill`
- `cask_type`
- `cask_size`

Bottle `name`, `fullName`, brand/entity relationships, category, series,
flavor profile, distillers, and effective stated age are durable exact-record
data even when their editing authority is shared. An exact Bottle must remain
correct and renderable without BottleGroup hydration.

There is no single-known-release exception. A dated, batched, vintage, or
otherwise specific marketed form is a Bottle from the start. Discovering a
sibling later may lead the automatic grouping system to relate their singleton
BottleGroups; it does not turn either Bottle into a parent or move its exact
fields to another object.

## Shared Editing Semantics

Ordinary Bottle creation creates a singleton BottleGroup automatically. Input
must not use a source Bottle, group id, normalized name, or BottleSeries as
grouping authority.

An exact edit updates only the selected Bottle. A shared edit must, in one
transaction:

1. update the BottleGroup's shared values;
2. preserve every member's exact fields;
3. regenerate and persist every member's complete Bottle identity;
4. retain previous canonical exact names as exact aliases;
5. roll back on any Bottle, alias, materialization, or audit failure.

For age fan-out, a member's non-null age differing from the pre-edit group age
is an exact override. Null or equal values inherit the shared age. Clearing an
exact override materializes the current shared age; changing the shared age
preserves only the differing overrides.

## Field Definitions

- **brand**: The consumer-facing label brand.
- **bottler**: A separately stated bottling house when different from `brand`.
- **distillery**: An array of actual producing distilleries. Use `[]` when
  unknown.
- **expression**: The shared product name after removing producer, age, ABV,
  and generic style words.
- **series**: A stable range or family, or `null`; never a batch code, release
  year, or grouping key.
- **edition**: A human-facing exact descriptor such as `Batch 3`,
  `2024 Release`, or `S2B13`.
- **category**: One of `blend`, `bourbon`, `rye`, `single_grain`,
  `single_malt`, or `single_pot_still`.
- **stated_age**: The label-stated age in years as an integer, or `null`.
- **abv**: Alcohol by volume as a percentage, for example `46.3`.
- **release_year**: The bottling or marketed release year, or `null`.
- **vintage_year**: The distillation or vintage year, or `null`.
- **cask_type**: The primary maturation or finishing cask, or `null`.
- **cask_strength**: `true` only when the source explicitly states cask,
  barrel, full, natural, or equivalent strength; otherwise `null`.
- **single_cask**: `true` only when the source explicitly states single cask,
  single barrel, or an equivalent phrase; otherwise `null`.

## Label Components

Treat a label or retailer title as a bundle of components:

- producer or bottler;
- actual distillery or distilleries;
- shared expression;
- stable series;
- exact edition, batch, store-pick code, or numbered release;
- category and stated age;
- cask description, ABV, vintage year, release year, and explicit strength or
  single-cask flags.

These details usually do not drive identity by themselves:

- volume and pack size;
- gift sets, tins, glassware, and sampler bundles;
- generic retailer SEO style words;
- ratings, tasting notes, medals, pricing, shipping, and legal text.

Preserve exact cask or barrel number, bottle number, outturn, retailer-exclusive
wording, label notes, and uncommon raw maturation wording as observations by
default. Promote them to Bottle identity only with evidence that they define
the marketed release or are required for recurring disambiguation.

## Extraction Rules

### Brand, Bottler, And Distillery

- For an official distillery bottling, the brand is normally the distillery
  name and `distillery` contains that entity.
- For an independent bottling, use the consumer-facing bottler label as the
  brand, record the separately stated bottler when appropriate, and list the
  actual producer or producers as distilleries.
- For a blend, list all known contributors. Use `[]` rather than guessing when
  they are unknown.
- Do not derive brand identity from a longest-prefix string match.

### Age And Years

- Extract a stated age only when the source states it; do not calculate it from
  vintage and release years.
- Normalize a stated age to an integer and use `null` for no age statement.
- Extract `vintage_year` for an explicitly identified distillation or vintage
  year.
- Extract `release_year` for an explicitly identified bottling or release year.
  A standalone year near edition or ABV evidence may qualify when the source
  context is unambiguous.
- Ignore unrelated dates such as founding years and legal notices. If multiple
  years are present, preserve their stated roles rather than guessing.

### Series And Edition

- Extract a named stable family into `series`.
- Extract a release label such as `Batch 3`, `2021 Release`, or `S2B13` into
  `edition`.
- Do not use `series` for a one-off batch code, annual year, exact cask number,
  or evidence that Bottles share a BottleGroup.

### ABV And Cask Details

- Extract ABV as a decimal percentage.
- Extract canonical primary maturation or finish wording into `cask_type`.
- Set cask-strength and single-cask flags only from explicit source language.
- Preserve more granular or uncertain cask facts as BottleObservations.

### Uncertainty

- Prefer `null` or `[]` over guessing.
- A missed optional component is safer than a false identity signal.
- Do not discard uncertain source precision; retain it as observation evidence.

## Matching Conventions

Compare exact Bottle candidates in this order: brand, distillery, expression,
series, age, edition, category, cask details, single-cask and cask-strength
flags, ABV, then year fields.

- Missing generic style words are weak evidence.
- Conflicting age, edition, store-pick code, barrel description, or single-cask
  status is strong evidence of different Bottles.
- Evaluate brand and distillery separately for independent bottlings.
- Bias toward `no_match` or review when decisive components are weak or
  conflicting. A false exact match is worse than an unresolved listing.
- Preserve observation evidence even when it is not strong enough to create or
  distinguish a Bottle.

Exact Bottle matching and BottleGroup grouping are separate decisions. A
classifier or user-created Bottle does not select a group. Similarity may
produce a grouping suggestion, but only the automatic/system-controlled
grouping boundary establishes shared expression identity.

## Consumer Bottle Selection

When writing activity or catalog evidence:

- select the independently complete Bottle when the marketed release is known;
- select the retained general Bottle only when evidence identifies that
  general expression;
- otherwise preserve the consumer's supported unresolved state;
- never use BottleGroup or its representative as consumer identity;
- keep Bottle identity distinct from observation or collection-unit details.
