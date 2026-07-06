# Whisky Identity Model

This is the source of truth for how Peated models whisky identity.

Deterministic name cleanup is governed by
[Bottle Normalization Contract](./bottle-normalization-contract.md).

## Core Objects

- `bottle`: the stable parent product most users rate, search, and collect.
- `bottle_release`: optional precision under a bottle when a user cares about a specific batch, vintage, annual release, or other marketed variant.
- `bottle_observation`: internal store-price evidence tied to a bottle or release. This is where exact listing facts live before they are promoted into canonical identity.

## Field Ownership

Bottle identity:

- `brand`
- `bottler`
- `distillery`
- `name` / expression
- `series`
- `category`
- `statedAge` only when it is stable across every canonical release

Release identity:

- `edition`
- `releaseYear`
- `vintageYear`
- `statedAge` when it is release-specific
- `abv`
- `singleCask`
- `caskStrength`
- `caskFill`
- `caskType`
- `caskSize`

Year semantics:

- `vintageYear` is the distillation year.
- `releaseYear` is the bottling year or marketed annual release year.
- A bare year is ambiguous until label wording, official evidence, or sibling
  structure explains it. Do not infer a child release solely because any year is
  present.
- Do not compute or infer `statedAge` from vintage and bottling years unless the
  source states the age.

Observation-only facts by default:

- cask number
- barrel number
- bottle number
- outturn
- market or store-exclusive wording
- unmodeled maturation wording
- retailer title fragments that are not part of the marketed canonical name

## Naming Rules

- `brand` is the consumer-facing label brand.
- `bottler` is only for a separately stated bottling house when it differs from `brand`.
- `distillery` is the actual producer or producers.
- `series` is a stable range or family, not a batch code or release year.
- `edition` is the simple human-facing release descriptor. Use it for values like `Batch 24`, `2024 Release`, or `S2B13`.

## Brand And Entity Boundary

- Brand identity is not the longest leading string match. It is the consumer-facing label that should appear in the canonical bottle name.
- Distillery, bottler, parent company, importer, and owner names may appear in source text, aliases, or marketing copy without becoming the bottle brand.
- `fullName` and aliases are derived reference strings. They are useful evidence, but they can be stale or source-specific and must not prove a brand repair by themselves.
- A proposed brand repair must be valid after applying it: the resulting bottle and release names should still describe the marketed bottle without duplicated, missing, or stale brand text.
- Do not automate brand moves where the only difference is a generic product/entity suffix or prefix such as `Bourbon`, `Whiskey`, `Whisky`, `Distillery`, `House`, or `Company`. Those cases are brand-vs-product-vs-entity ambiguity and belong in classifier or manual review.
- Examples: `Yamazaki 12-year-old` stays brand `Yamazaki` even when aliases mention owner `Suntory`; `Belle Meade` should not automatically move to `Belle Meade Bourbon` just because the full bottle name starts with those words.

## Canonicalization Rules

- Create separate bottles when the marketed expression itself changes.
- Create releases when the parent expression is stable and the differentiator is a variant of that expression.
- Preserve exact source facts as observations first. Do not force a canonical release split just because a retailer page mentions a cask number or similar exact detail.
- Promote an observation fact into canonical release identity only when it is clearly part of the marketed release or moderators decide it is needed for recurring disambiguation.
- Classification is intentionally model-led for semantic boundaries. Code may
  enforce structurally safe validation, but it should not encode brand- or
  family-specific bottle-versus-release rules.

## Single Known Release Rule

- If the only currently known marketed form is a single dated, batched, or otherwise specific version and there is no clear reusable parent expression yet, it may live on `bottle` initially.
- If a second sibling later appears and the shared parent expression becomes clear, split the record into a parent `bottle` plus child `bottle_release` rows and move release-specific traits there.
- If the year or code is itself the stable marketed product identity rather than optional precision, keep it at the bottle layer instead of forcing a child release.
- Sibling evidence may come from existing child releases, multiple legacy bottle
  rows that share a stable family, or authoritative sources that describe a
  recurring batch/vintage/annual release program. That evidence should inform
  the classifier; it should not bypass classifier judgment.

## Precision Layers

- `release` is shared canon. It is the reusable identity that multiple tastings, prices, and pages should point to.
- `bottle_observation` is internal evidence. Today it preserves exact facts from approved store-price listings.

If a detail should aggregate across users, searches, and stats, it belongs in `bottle_release`. If it is exact but not yet canonical, preserve it as evidence first rather than forcing a new shared object.

## Simple Input Rule

Default entry should stay bottle-first with optional release details.

Normal user input should focus on:

- bottle identity
- optional `edition`
- optional `vintageYear`
- optional `releaseYear`
- optional `abv`
- optional `singleCask`
- optional `caskStrength`

## Worked Examples

- `Aberfeldy 12`: one bottle, no release required.
- `Macallan 18` with annual vintages: one bottle, separate releases by vintage year.
- `Springbank 12 Cask Strength Batch 24`: one bottle, release carries `edition = Batch 24`.
- `Maker's Mark Private Selection S2B13`: one bottle, release carries `edition = S2B13`; any more exact barrel data stays in observations unless it becomes canonical.
- `Mystery Distillery 1990 Release`: if `1990` is the only known marketed form and no reusable parent expression is established yet, one bottle is acceptable. If a `1991 Release` later appears under the same parent expression, split into one bottle plus `1990` and `1991` releases.
- `Octomore 13.1` vs `Octomore 13.3`: separate bottles under a shared range because drinkers generally treat them as different expressions.
- `SMWS 6.53`: the SMWS code is the exact-cask bottle identity; different subtitles or retailer names can still be the same bottle/code, and additional wording stays in observations.

## Matching Rule

- Resolve the source bottle family and exact release/bottling details first.
- Use Peated DB search as prior-art evidence for whether that exact target
  already exists and how nearby items are modeled.
- Match bottle-first when bottle identity is clear and release identity is weak.
- Match or create a release only when the differentiating traits are explicit
  enough to survive canonicalization.
- Preserve the rest as observations so precision is not lost.
- Do not route a clear identity to manual search merely because the matched
  catalog row is missing optional attributes or exposes repair/enrichment work.
