# Bottle Normalization Examples

This document is a working corpus for one-time cleanup and future normalization
decisions. The goal is not to model every edge case up front. The goal is to
capture real bottle families we see in the wild and make the expected mapping to
Peated's identity model explicit.

Use this alongside:

- `docs/architecture/whisky-identity-model.md`
- `docs/architecture/bottle-classifier.md`
- `packages/bottle-classifier/src/normalizationCorpus.ts`

## How To Read This

- `bottle` is the stable canonical parent product.
- `release` is only used when the differentiator is marketed canonical release
  identity that should aggregate across users and listings.
- `observation` means the detail is real but should stay as evidence first, not
  be forced into canonical bottle or release identity.

## Corpus

| Raw source name                                     | Expected bottle identity                           | Expected release identity        | Notes                                                                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Aberfeldy 12`                                      | `Aberfeldy 12-year-old`                            | none                             | Simple stable bottle.                                                                                                                                                     |
| `Springbank 12 Cask Strength Batch 24`              | `Springbank 12-year-old Cask Strength`             | `edition = Batch 24`             | Strong batched release under a stable parent.                                                                                                                             |
| `Lagavulin Distillers Edition`                      | `Lagavulin Distillers Edition`                     | none                             | `Distillers Edition` is a stable family / bottle identity, not release identity by itself.                                                                                |
| `Lagavulin Distillers Edition 2011 Release`         | `Lagavulin Distillers Edition`                     | `releaseYear = 2011`             | Release year is the differentiator under a stable parent expression.                                                                                                      |
| `Maker's Mark Private Selection S2B13`              | `Maker's Mark Private Selection`                   | `edition = S2B13`                | Canonically this is bottle plus release, but current repair heuristics should leave this to classifier review instead of forcing a split.                                 |
| `Ardbeg Traigh Bhan 19-year-old Batch 5`            | `Ardbeg Traigh Bhan 19-year-old`                   | `edition = Batch 5`              | Numeric batch code is release identity.                                                                                                                                   |
| `Batch Strength`                                    | `Batch Strength`                                   | none                             | `Batch` here is part of the marketed bottle name, not release identity.                                                                                                   |
| `Batch Proof`                                       | `Batch Proof`                                      | none                             | Same as above.                                                                                                                                                            |
| `Batch Sherry`                                      | review required                                    | none                             | Generic batch wording is not a release marker, but this raw input is too sparse to safely infer a branded bottle.                                                         |
| `Double Cask`                                       | `Double Cask`                                      | none                             | Stable product wording, not a release split.                                                                                                                              |
| `Sherry Cask`                                       | `Sherry Cask`                                      | none                             | Stable product wording unless paired with an actual release marker.                                                                                                       |
| `Cask Strength`                                     | `Cask Strength`                                    | none                             | Bottle-level product wording by default. Release only when another marketed variant marker exists.                                                                        |
| `Elijah Craig Cask Strength`                        | `Elijah Craig Barrel Proof`                        | none                             | Common shorthand should normalize to the canonical Barrel Proof bottle family unless a real batch code is present.                                                        |
| `Single Barrel`                                     | `Single Barrel`                                    | none                             | Bottle-level product wording by default. Generic single-barrel language is not enough for a canonical release.                                                            |
| `Four Roses Single Barrel Barrel Strength`          | `Four Roses Single Barrel` or exact-cask candidate | observation or exact-cask review | Needs classifier review. Barrel strength alone is not enough to force a release split.                                                                                    |
| `Pinhook 8-year-old - The Single Barrel / Vertical` | review required                                    | none                             | Freeform single-barrel program wording is not a deterministic release marker. Do not auto-split into `Pinhook 8-year-old` plus a child release without classifier review. |
| `SMWS 6.53`                                         | `SMWS 6.53`                                        | none                             | Society code is part of the bottle identity itself.                                                                                                                       |
| `Octomore 13.1`                                     | `Octomore 13.1`                                    | none                             | This is generally a distinct bottle expression, not a child release of `Octomore 13`.                                                                                     |

## Practical Rules For Cleanup

Use these rules during the cleanup pass:

1. Prefer bottle-level identity when the title looks like a stable marketed
   expression.
2. Only derive release identity heuristically from strong markers such as:
   - structured `edition` when it is already a strong coded or numbered release marker
   - structured `releaseYear`
   - numeric or coded batch markers like `Batch 24` or `Batch C923`
3. Do not split on weak wording alone:
   - `Distillers Edition`
   - `Double Cask`
   - `Sherry Cask`
   - `Cask Strength`
   - `Single Barrel`
   - generic `Batch <word>`
4. When bottle identity is clear but release identity is weak or ambiguous,
   leave it at the bottle layer and let the classifier or moderator review make
   the harder call.
5. Keep over-specific facts as observations unless they are clearly part of the
   marketed canonical release.

## Scope Notes

- This corpus is intentionally pragmatic and incomplete.
- Add new examples whenever a real bottle family causes confusion during the
  cleanup pass.
- Prefer concrete examples from production data over abstract naming rules.
- The structured source of truth for executable examples lives in
  `packages/bottle-classifier/src/normalizationCorpus.ts`.
