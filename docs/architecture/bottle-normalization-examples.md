# Bottle Normalization Examples

This document is a working corpus for real bottle families that stress Peated's
identity model. It is not the normalization policy. The policy lives in
[Bottle Normalization Contract](./bottle-normalization-contract.md).

Use this alongside:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Classifier](./bottle-classifier.md)
- `packages/bottle-classifier/src/eval-fixtures/new-bottles/`

## How To Read This

- `proposedBottle.name` is the stable marketed expression relative to the brand.
  It may retain truly stable marketed age, finish, or strength wording.
- Structured exact fields such as `edition`, `vintageYear`, `releaseYear`,
  exact `statedAge`, ABV, and cask flags belong on that same Bottle.
- Canonical materialization combines the stable name and structured fields into
  one independently correct Bottle without duplicating exact markers.
- `observation` means the detail is real evidence but is not yet supported as
  reusable canonical Bottle identity.
- BottleGroup assignment is automatic downstream and is never inferred by
  normalization or selected by the classifier.

## Corpus

| Raw source name                                     | Stable `proposedBottle.name`  | Structured exact Bottle fields                                | Complete materialized Bottle / decision                                                                                              |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Aberfeldy 12`                                      | `12-year-old`                 | `statedAge = 12`                                              | `Aberfeldy 12-year-old`; stable marketed age wording remains renderable without group data.                                          |
| `Springbank 12 Cask Strength Batch 24`              | `12-year-old Cask Strength`   | `statedAge = 12`, `caskStrength = true`, `edition = Batch 24` | `Springbank 12-year-old Cask Strength Batch 24`; Batch 24 is stored once as an exact field.                                          |
| `Lagavulin Distillers Edition`                      | `Distillers Edition`          | none                                                          | `Lagavulin Distillers Edition`; the phrase is the stable expression.                                                                 |
| `Lagavulin Distillers Edition 2011 Release`         | `Distillers Edition`          | `releaseYear = 2011`                                          | One complete dated Bottle; canonical materialization adds the year without changing the stable expression.                           |
| `Maker's Mark Private Selection S2B13`              | `Private Selection`           | `edition = S2B13`                                             | One independently complete Bottle when reviewed evidence establishes S2B13 as marketed identity.                                     |
| `Ardbeg Traigh Bhan 19-year-old Batch 5`            | `Traigh Bhan 19-year-old`     | `statedAge = 19`, `edition = Batch 5`                         | `Ardbeg Traigh Bhan 19-year-old Batch 5`; the exact batch remains structured.                                                        |
| `Batch Strength`                                    | `Batch Strength`              | none                                                          | Stable expression wording; `Batch` is not an exact marker by itself.                                                                 |
| `Batch Proof`                                       | `Batch Proof`                 | none                                                          | Stable expression wording; do not extract an edition from the generic phrase.                                                        |
| `Batch Sherry`                                      | review required               | none                                                          | Too sparse to infer a branded Bottle or an edition.                                                                                  |
| `Double Cask`                                       | `Double Cask`                 | none                                                          | Stable product wording.                                                                                                              |
| `Sherry Cask`                                       | `Sherry Cask`                 | none                                                          | Stable product wording unless reviewed evidence establishes another exact marketed marker.                                           |
| `Cask Strength`                                     | `Cask Strength`               | `caskStrength = true`                                         | Stable strength wording and its structured flag describe the same complete Bottle without requiring group hydration.                 |
| `Elijah Craig Cask Strength`                        | reviewed canonical expression | supported exact fields                                        | Brand-specific `Barrel Proof` equivalence is model-reviewed, never a deterministic string rewrite.                                   |
| `Single Barrel`                                     | `Single Barrel`               | `singleCask = true`                                           | Stable product wording plus the supported cask flag; an unstated barrel number is not invented.                                      |
| `Four Roses Single Barrel Barrel Strength`          | reviewed stable expression    | `singleCask = true`, `caskStrength = true`                    | Preserve an evidenced exact barrel marker as a structured field only when it is marketed identity; otherwise keep it as observation. |
| `Pinhook 8-year-old - The Single Barrel / Vertical` | review required               | supported fields only                                         | Freeform program wording does not authorize deterministic identity restructuring.                                                    |
| `SMWS 6.53`                                         | `6.53`                        | `singleCask = true`                                           | The Society code is the exact Bottle identity anchor; it remains one complete Bottle.                                                |
| `Octomore 13.1`                                     | `13.1`                        | supported exact fields                                        | A distinct stable Bottle expression; downstream grouping with related Octomore Bottles is automatic.                                 |

## Practical Rules

Use these rules when adding examples or translating production misses into
fixtures:

1. Propose one independently complete Bottle when the evidence supports a
   canonical identity.
2. Keep `proposedBottle.name` at the stable expression layer. Retain recurring
   marketed age, finish, or strength wording when the Bottle must render it
   without BottleGroup data.
3. Put supported exact differentiators on that same Bottle, including:
   - coded or numbered `edition` values such as `Batch 24` or `Batch C923`
   - `vintageYear` and `releaseYear`
   - exact `statedAge`, ABV, `singleCask`, and `caskStrength`
4. Do not extract an exact differentiator from weak wording alone:
   - `Distillers Edition`
   - `Double Cask`
   - `Sherry Cask`
   - `Cask Strength`
   - `Single Barrel`
   - generic `Batch <word>`
5. When a marker's identity meaning is weak or ambiguous, let the classifier or
   moderator choose `no_match`, a supported exact Bottle field, or observation.
   Deterministic normalization must not restructure identity.
6. Keep over-specific facts as observations unless they are clearly part of the
   marketed canonical Bottle.
7. Never select a BottleGroup from these fields. Grouping is automatic
   downstream and can later rematerialize shared edits across every member.

## Scope Notes

- This corpus is intentionally pragmatic and incomplete.
- Add new examples whenever a real bottle family causes confusion during the
  cleanup pass.
- Prefer concrete examples from production data over abstract naming rules.
- The executable source of truth now lives in file-backed fixtures under
  `packages/bottle-classifier/src/eval-fixtures/`.
