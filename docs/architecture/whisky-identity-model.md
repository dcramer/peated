# Whisky Identity Model

This is the source of truth for how Peated models whisky identity.

## Core Objects

- `bottle`: the stable parent product most users rate, search, and collect.
- `bottle_release`: optional precision under a bottle when a user cares about a specific batch, vintage, annual release, or other marketed variant.
- `tasting.bottleDetails`: optional tasting-level precision for enthusiasts when the user knows more than canon currently captures.
- `bottle_observation`: internal source evidence tied to a bottle or release. This is where exact listing facts live before they are promoted into canonical identity.

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

Observation-only facts by default:

- cask number
- barrel number
- bottle number
- outturn
- market or store-exclusive wording
- unmodeled maturation wording
- retailer title fragments that are not part of the marketed canonical name

Tasting-only exact details:

- `edition`
- `releaseYear`
- `vintageYear`
- `abv`
- `singleCask`
- `caskStrength`
- `caskNumber`
- `bottleNumber`
- `outturn`
- `exclusiveText`
- `labelNotes`

## Naming Rules

- `brand` is the consumer-facing label brand.
- `bottler` is only for a separately stated bottling house when it differs from `brand`.
- `distillery` is the actual producer or producers.
- `series` is a stable range or family, not a batch code or release year.
- `edition` is the simple human-facing release descriptor. Use it for values like `Batch 24`, `2024 Release`, or `S2B13`.

## Canonicalization Rules

- Create separate bottles when the marketed expression itself changes.
- Create releases when the parent expression is stable and the differentiator is a variant of that expression.
- Preserve exact source facts as observations first. Do not force a canonical release split just because a retailer page mentions a cask number or similar exact detail.
- Promote an observation fact into canonical release identity only when it is clearly part of the marketed release or moderators decide it is needed for recurring disambiguation.

## Precision Layers

- `release` is shared canon. It is the reusable identity that multiple tastings, prices, and pages should point to.
- `tasting.bottleDetails` is user-facing advanced input. It captures exact details about what one person drank without forcing a new shared object.
- `bottle_observation` is internal evidence. It preserves exact source facts from retailer pages, moderator work, and other non-canonical inputs.

If a detail should aggregate across users, searches, and stats, it belongs in `bottle_release`. If it only makes one tasting more precise, it belongs in `tasting.bottleDetails` first.

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

Advanced tasting input may additionally capture exact bottle details such as cask number, bottle number, outturn, exclusive wording, or other label notes. Those details should not automatically create a release.

## Worked Examples

- `Aberfeldy 12`: one bottle, no release required.
- `Macallan 18` with annual vintages: one bottle, separate releases by vintage year.
- `Springbank 12 Cask Strength Batch 24`: one bottle, release carries `edition = Batch 24`.
- A tasting of `Springbank 12 Cask Strength` where the user knows `cask #117` and `bottle 142/246`: point to the bottle or `Batch 24` release if known, then store the exact cask and bottle numbers in `tasting.bottleDetails`.
- `Maker's Mark Private Selection S2B13`: one bottle, release carries `edition = S2B13`; any more exact barrel data stays in observations unless it becomes canonical.
- `Octomore 13.1` vs `Octomore 13.3`: separate bottles under a shared range because drinkers generally treat them as different expressions.
- `SMWS 6.53`: the SMWS code is part of the bottle identity; additional retailer-only detail stays in observations.

## Matching Rule

- Match bottle-first when bottle identity is clear and release identity is weak.
- Match or create a release only when the differentiating traits are explicit enough to survive canonicalization.
- Preserve the rest as observations so precision is not lost.
