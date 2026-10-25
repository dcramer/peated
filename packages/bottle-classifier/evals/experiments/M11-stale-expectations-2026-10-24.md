# M11: correct stale expectations behind the failing eval gate

**Accepted as a measurement correction.** Seven checks expected values that
the label, the producer, or a later identity rule contradicts, and a second
batch filled reviewed evidence gaps and applied the current identity rules to
eleven more cases. No classifier code or prompt changed.

The classifier eval job has failed every completed run since 2026-10-19
(73–74% against the 0.8 gate). The six saved CI reports from 2026-10-20 to
2026-10-24 were compared case by case, and each recurring failure was traced
to its owning layer before any edit. This record covers only the corrections
that rest on verified evidence. The other failures need an owner decision and
are listed at the end.

## Corrections

| Check                                   | Was                                                                                                               | Now                                                                              | Evidence                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Image: Compass Box Hedonism²            | `category: blend`                                                                                                 | `blended_grain`                                                                  | Label prints `BLENDED GRAIN SCOTCH WHISKY`. M03 corrected the decision case but missed this one.                                        |
| Image: Willett barrel 4769              | `4769` in `expression` or `edition`                                                                               | `cask_number: "4769"`                                                            | Identity model: a printed cask or barrel number is `caskNumber`, never `edition`.                                                       |
| Image: SMWS 95.71                       | brand or bottler contains `SMWS`; `95.71` in expression/edition                                                   | contains `Scotch Malt Whisky Society`; `cask_number: "95.71"`                    | The label prints the full name, never `SMWS`. The SMWS code is `caskNumber`.                                                            |
| Image: Mars Komagatake 2022 Edition     | `brand: Komagatake`, `expression: null`, `edition: null`, `release_year: 2022`                                    | `Komagatake` in brand or expression; `2022 Edition` in expression or edition     | The label prints the MARS crest, KOMAGATAKE, and `2022 EDITION`. Choosing the Peated Brand (E1953 since 2026-09-16) is classifier work. |
| Audit: Laphroaig Càirdeas 2022          | maturation `Aged in first-filled Maker’s Mark Bourbon casks in Warehouse 1, with extra exposure to the elements.` | `first-fill Maker's Mark bourbon barrels`                                        | Identity model: maturation drops story wording. The producer page prints both sentences; the reviewed pack states the short one.        |
| SMWS RW6.5 listing                      | `releaseYear: 2024`                                                                                               | removed; `in 2024` removed from the reviewed summary                             | The producer page prints no bottling or release year. M08 made the same removal for the text-only sibling.                              |
| Text-only SMWS RW6.5 listing (evidence) | Page result was the title only                                                                                    | Page result carries the printed facts: RW6.5, 6 years, 56.0%, distilled 11/01/18 | The producer page. The case asked for age and ABV that the CI pack never supplied.                                                      |

## Results

Controlled runs used `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna
high, and a fresh copy of the committed recordings.

| Check                        | CI before (6 runs) | After (3 runs) | Remaining failure                             |
| ---------------------------- | -----------------: | -------------: | --------------------------------------------- |
| Image: Mars Komagatake       |                0/6 |            3/3 | —                                             |
| Image: Hedonism²             |                0/6 |            2/3 | `bottler` (owner decision below)              |
| Image: SMWS 95.71            |                0/6 |            1/3 | model read `Wemyss Malts` once and 57.6% once |
| Image: Willett               |                0/6 |            0/3 | `cask_strength` (owner decision below)        |
| Audit: Laphroaig             |                2/6 |            3/3 | —                                             |
| SMWS RW6.5 listing           |                3/6 |            3/3 | —                                             |
| Text-only SMWS RW6.5 listing |                0/6 |            3/3 | —                                             |

Before changing expectations, the image checks were run three times on GPT-6
Luna and three times on GPT 5.6 Luna. GPT 5.6 Luna passed fewer (2–4 of 14
against 4–5 of 14), so the 2026-09-22 model switch did not cause these
failures. The image checks were not part of that switch's comparison.

## Second batch: evidence packs and identity rules

Approved by the owner on 2026-10-24 after the first batch. Each pack entry
states only what its page prints. The Hedonism² `bottlingYear: 2023` was left
unchanged: the Whiskybase record M03 cited could not be reopened, and no other
source confirms that year.

| Check                                    | Change                                                                                                                                                                  | Evidence                                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Wild Turkey Rare Breed Rye (two cases)   | Added the producer page to the pack. The cases ask the classifier to confirm the omitted barrel-proof trait from the web, and the pack had no web evidence.             | Producer page: barrel proof, bottled from the barrels at 112.2 proof.                                                                      |
| Glenlivet Caribbean Reserve              | Added the owner's launch release to the pack; refreshed candidate 1760 to production (Brand The Glenlivet, no bottler, distiller The Glenlivet, 40%).                   | Pernod Ricard: a single malt selectively finished in rum barrels.                                                                          |
| Quinta Ruban 14                          | The producer page result now carries its facts; refreshed candidate 2466 to production (no bottler, distiller Glenmorangie, 46%).                                       | Glenmorangie: 14 years, bourbon and port casks, 46.0%, no numbered edition.                                                                |
| Glen Breton 21 cask 665                  | The review page result now carries the review text.                                                                                                                     | Whisky Advocate, Fall 2015: barrel selected for Casker's whisky club, distillery only.                                                     |
| TBWC Paul John 6                         | Added the bottler page and two more Whisky Advocate reviews.                                                                                                            | Bottler: Batch 3 is 52.9%, 822; the same Summer 2018 issue calls a 52.9%, 822-bottle review Batch 5; Winter 2016 reviews Batch 2 at 54.7%. |
| Springbank 25                            | Now expects `no_match`; moved to `ignore_or_reject` with a new id.                                                                                                      | Separate yearly vattings at 46%; Peated already holds the 2022 release (53503). Same shape as M10.                                         |
| Lagavulin Distillers Edition             | Now requires review.                                                                                                                                                    | Peated holds 28 dated releases from 1997 to 2024 beside generic Bottle 44006. Same shape as M10.                                           |
| Mars Komagatake create                   | Brand is Entity 1953 with name `2022 Edition`; local catalog Entity 1953 and its Limited Edition siblings match production; the pack summary no longer asserts a Brand. | Identity model rule 1 names Mars Komagatake as a distillery line; production Bottle 44298.                                                 |
| High West Act 10 Scene 4, Act 12 Scene 9 | Act and scene move from the edition to the name; the release year is no longer required.                                                                                | `bottle-presentation.md`: act and scene are in the name; do not also require the release year.                                             |
| Highland Park Cask Strength No. 5        | `Cask Strength No. 5` (or the producer's `Release No. 5`) moves into the name; edition is empty.                                                                        | `bottle-presentation.md`: `Cask Strength No. 5` is the name.                                                                               |
| Heaven's Door Vol 3                      | `Volume III` moves into the name; edition is empty.                                                                                                                     | Producer heads each release `Volume III (2021)`; numbered release titles belong in the name.                                               |

Macallan Classic Cut 2021 Edition was left unchanged. Accepting `2021 Edition`
in either the name or the edition would let a result with no year in either
place pass, because the scorer checks the name and the edition separately. Its
failures were a missing release year, not naming.

Focused controlled runs, three each:

| Check                             | CI before (6 runs) | After (3 runs) | Remaining failure                                                      |
| --------------------------------- | -----------------: | -------------: | ---------------------------------------------------------------------- |
| Wild Turkey, web follow-up        |                0/6 |            3/3 | —                                                                      |
| Wild Turkey, text-only            |                0/6 |            3/3 | —                                                                      |
| Glenlivet Caribbean Reserve       |                0/6 |            3/3 | —                                                                      |
| Glen Breton 21 cask 665           |                0/6 |            3/3 | —                                                                      |
| Springbank 25                     |                0/6 |            3/3 | —                                                                      |
| Lagavulin Distillers Edition      |                0/6 |            3/3 | —                                                                      |
| Heaven's Door Vol 3               |                3/6 |            2/3 | one `no_match` for thin evidence                                       |
| Highland Park Cask Strength No. 5 |                1/6 |            1/3 | two `no_match` on the broad candidate; one old `Release No. 5` edition |
| Quinta Ruban 14                   |                0/6 |            0/3 | `no_match`: the candidate title's `4th Edition` suffix                 |
| TBWC Paul John 6                  |                0/6 |            0/3 | `no_match`: trusts the review's Batch 4 label                          |
| Mars Komagatake create            |                1/6 |            0/3 | Brand Mars with name `Komagatake`; distiller now right 3/3             |
| High West Act 10 Scene 4          |                0/6 |            0/3 | `no_match`: broad Act 10 candidate read as a conflict                  |
| High West Act 12 Scene 9          |                0/6 |            0/3 | `no_match`: broad Act 12 candidate read as a conflict                  |

The remaining failures are model judgment with verified expectations. Mars
needs the distillery-line Brand rule in the classifier's view; Highland Park and
Heaven's Door still meet prompt examples that put `No. 5` and `Vol. 3` in the
edition; High West and Highland Park show the broad-candidate refusal recorded
in the 2026-09-03 failure map.

## Full controlled run

One full run of both eval files on main `4b801dc04` plus both batches, before
C33 and C34, with `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high:

| File             |  Passed |
| ---------------- | ------: |
| Classifier       | 104/126 |
| Image extraction |    6/14 |
| Total            | 110/140 |

That is 78.6% against the 0.8 gate, up from 103/140 in the last CI run. C33
and C34 then passed their two target cases 3/3 each, which would make
112/140 (80.0%) with no margin. Four cases that passed every saved CI run
failed once here with a cautious `no_match` (Octomore 13.1, The Exclusive
Malts Islay, Macallan 18 1994, Macallan Classic Cut 2017 auction), so one run
moves by about three cases.

The PR's CI run scored 115/140 (82.1%). C33 was reverted afterward because a
phrase rule must not decide what a listing is; the Glenlivet sample set is a
model-judgment miss again.

## Open decisions

These failures are consistent, not variance, but fixing them changes a rule,
a prompt, or a production-miss expectation:

- **Cask strength from ABV.** `extractorInstructions.ts` lets a high-ABV single
  cask count as cask strength; `classifierTypes.ts` requires explicit wording.
  Willett, Pōkeno No. 71, and SMWS 1.285 expect `true` with no printed wording.
- **Compass Box as bottler from a label.** The identity model names Compass Box
  as a bottler, but the extractor leaves `bottler` empty without product
  evidence. Hedonism² expects `null`; Rogues' Banquet and Spice Tree expect
  `Compass Box`.
- **Annual `YYYY Edition` titles.** Whether Macallan Classic Cut's
  `2021 Edition` belongs in the name, like `2017 Release`, or the edition.
- **Prompt examples copy eval inputs.** `RETAILER_LABEL_EXAMPLES` holds the
  exact Heaven's Door, Highland Park, Lagavulin, Four Roses, Ardbeg,
  Octomore, and Skrewball inputs, against `model-checks.md`. Its Highland Park
  and Heaven's Door notes also contradict the naming rule.
- **Distillery-line Brands.** The identity model names Mars Komagatake as a
  distillery line Brand; the classifier prompt does not carry that rule.
- **Undefined `webEvidence` labels.** Only `supportive` is defined, yet
  `not_needed` alone grants the automatic match tier.
- **Stored Entity relationships read as conflicts.** The rule that one Entity
  filling several roles is not a conflict appears only in the audit policy.
- **Prompt and guard disagree on edition corrections.** The audit prompt
  allows one label plus the producer title; `bottlePatchEvidence.ts` does not.

Sources:

- [Laphroaig Càirdeas 2022 Warehouse 1](https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky)
- [SMWS RW6.5 Appley ever after](https://smws.com/appley-ever-after/)
- [Hombo: Mars Komagatake 2022 Edition](https://www.hombo.co.jp/en/product/mars-singlemalt-komagatake-2022-edition/)
- [Mars catalog research](../../../../docs/research/catalog/2026-09-16-mars.md)
- [Wild Turkey Rare Breed Rye](https://www.wildturkeybourbon.com/en-us/products/rare-breed-rye)
- [Pernod Ricard: The Glenlivet Caribbean Reserve launch](https://www.pernod-ricard.com/fr/node/828)
- [Glenmorangie The Quinta Ruban 14 Years Old](https://www.glenmorangie.com/products/the-quinta-ruban/)
- [Whisky Advocate: Glen Breton 21 cask 665](https://whiskyadvocate.com/Glen-Breton-21-year-old-cask-665-43)
- [That Boutique-y Whisky Company: Paul John](https://www.thatboutiqueywhiskycompany.com/whiskies/paul-john)
- [Hedonism Wines: Springbank 25 (2023 Release)](https://www.hedonism.co.uk/product/springbank-25-year-old-2023-release-whisky)
- [Heaven's Door Bootleg Series](https://www.heavensdoor.com/bootleg-series)
- [Product presentation rules](../../../../docs/features/bottle-presentation.md)
- [Whisky Identity Model](../../../../docs/architecture/whisky-identity-model.md)
