# Luna high failure map, 2026-09-03

This historical map starts from the saved web-enabled Luna high run and applies the M02,
M03, and M04 expectation decisions. It reviews the model output, collected
evidence, selected candidates, and tool use for every remaining failed case.
It is diagnostic evidence, not a new baseline run.

The accepted test case corrections remove six historical failures: two Jameson
Cold Brew cases, Maker's Mark, Black Label Islay Origin, Laphroaig Càirdeas, and
SMWS 10.258. Twenty-three failures remain: sixteen creations, three existing
matches, and four audits.

## Exact local identity

C10 now attaches the unique accepted Entity Reference for the Entity name Luna
already chose. C11 resolves literal accepted Bottle References at the shared
server boundary without a Luna call and preserves the exact reference when
candidate sources merge. Entity and Bottle Aliases remain display and search
evidence because their text is not globally unique.

## Unsafe existing matches

| Case                                   | Exact failure                                                                                                                               | Owning layer             | Specific action                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elijah Craig 18-year-old Single Barrel | Luna matched uncoded source product to barrel 4040 because the candidate's code exists only in `fullName`; it repeated this 3/3 times.      | Final validation         | **C09 accepted:** parse explicit cask codes in candidate names and downgrade when the source does not establish the same code.                                                                                                                                                                          |
| Masterson's French Oak Finish          | Luna said barrel F2-038 was unstructured and matched it anyway; it repeated this 3/3 times.                                                 | Final validation         | **C09 accepted:** the same cask-code guard blocks this assignment.                                                                                                                                                                                                                                      |
| High West High Country                 | Image extraction put ordinary lot `Batch No. 23J12` in `edition`; Luna therefore preferred the batch-specific row over the ongoing product. | Historical catalog state | C17 through C20 were rejected. Extraction and candidate filtering did not produce a reliable web-enabled result. Bottle 44284 is now retired, its URL resolves to 12825, and production candidate queries exclude tombstoned Bottles. Model current catalog state before another classifier experiment. |

## Creation decisions and fields

| Case                                | Exact failure                                                                                                                                                                                                | Owning layer                    | Specific action                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Highland Park Cask Strength No. 5   | Luna created the right product with the right edition and ABV. Only `releaseYear: 2024` was absent. The captured evidence showed an article date, not an explicit product release year.                      | Expectation/evidence            | Verify the year expectation first. If a product-specific source states 2024, add it to the fixed evidence; otherwise remove the unsupported expected field.                                           |
| Lagavulin Distillers Edition        | Luna found that Distillers Edition has annual releases and refused to assign the generic candidate from an underspecified title.                                                                             | Identity expectation            | Verify whether Peated intentionally treats the generic row as an ongoing Bottle. This is a catalog-policy decision before a classifier change.                                                        |
| Octomore 13.1                       | Luna made two focused searches. Firecrawl returned a collection page and unrelated producer pages, and Luna never received an exact product page.                                                            | Retrieval                       | Test exact-product page recovery: read a high-ranked exact producer result automatically, and return a clear read failure when the exact page is unavailable.                                         |
| The Whistler Bodega Cask            | The producer page said 86 proof while retailer evidence said 46% ABV. Luna returned `no_match` because it could not establish whether these were separate market releases.                                   | Expectation/evidence            | Verify whether 43% and 46% releases are separate Bottles. Preserve `no_match` if the observed source cannot identify the release.                                                                     |
| Watchpost text case                 | Web evidence described an eight-year Westland component and an MGP component. Luna promoted the component age and both component makers into whole-Bottle fields.                                            | Web evidence shape              | Test structured page facts with an explicit subject: `whole_product` or `component`. The classifier should receive the role with the fact instead of recovering it from prose.                        |
| Watchpost image case                | Luna repeated the component error: it set Bottle age to eight and added MGP as a second distiller. The expected Bottle keeps the age unknown and only Westland as the resolved distiller.                    | Web evidence shape              | Use the same component/whole-product experiment as the text case; these are two inputs for one failure mechanism.                                                                                     |
| Compass Box Hedonism²               | Luna found age, bottling year, ABV, and outturn, but omitted all three component distilleries in one run. Other focused attempts alternated between the individual facts and the distilleries.               | Evidence retention/final output | Test a list of supported facts plus one draft check that names supported facts omitted from the final creation. It must not add facts automatically.                                                  |
| Midwinter Act 12 Scene 9            | Luna read the complete scene from the image, then treated broader `Act 12` candidates as the same Bottle needing repair. C06's general candidate-disposition field helped here but regressed the full suite. | Candidate comparison            | Test a narrow, code-derived edition comparison in candidate context: exact, broader, narrower, or conflicting based on structured edition fields. Do not infer the final action in code.              |
| Mars Komagatake 2022                | `search_entities` returned Entity 1953 with accepted Entity Reference `Mars Shinshu Distillery`; Luna chose that name but omitted its ID.                                                                    | Final Entity check              | **C10 accepted:** resolve the exact accepted Entity Reference for the name Luna already chose. The saved run now uses Entity 1953 without changing the Brand or adding a model call.                  |
| Willett barrel 4769                 | The input explicitly carried `cask_strength: true`; Luna returned `caskStrength: null`. Other identity fields were present.                                                                                  | Final output                    | Include this in the structured evidence-ledger/draft-check experiment. First verify that the source evidence truly establishes cask strength rather than only high proof.                             |
| Creag Isle 12                       | Luna created the right Bottle but retained generic suffix `Scotch Whisky` in `name`; the reviewed stable name is `Island Single Malt`.                                                                       | Final name check                | Test a narrow stable-name check only for category wording already represented by a structured category. Use a second producer as a comparison case and preserve wording when it is marketed identity. |
| Russell's Reserve Single Barrel Rye | The exact source page restored the missing 52% ABV, but Luna still sometimes returned `Single Barrel` and dropped `Rye` from the stable product name.                                                        | Final name check                | Test the proposed name against an exact source title or accepted reference. Preserve deliberate short names and never build the name from age, ABV, year, or other fields.                            |
| Whiskyland Chapter Twenty Nine      | Luna found the right chapter, age, ABV, vintage, bottling year, and outturn, but made Decadent Drinks the Brand and repeated Whiskyland as Series.                                                           | Evidence role/entity choice     | Extend structured web facts to state the consumer label, bottler, and distiller roles. C01 showed that adding broad retrieval wording is insufficient.                                                |
| SMWS RW6.5 creation                 | The exact-code path created the right identity and reused all Entities, but it never read the supplied source page and omitted age, ABV, and release year.                                                   | Tool routing                    | Include this official-URL case in the source-page-first experiment. Exact code resolution should settle identity, not suppress available field evidence.                                              |

## Existing-match `no_match` results

| Case                         | Exact failure                                                                                                                                                               | Owning layer                | Specific action                                                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Springbank 25                | The live retailer page had changed to the 2023 release, while the test case expected the ongoing Bottle. M05 already isolated this with fixed evidence.                     | Changing source             | No classifier change. Keep controlled evidence for comparisons and measure current live retrieval separately.                                                                             |
| Glenmorangie Quinta Ruban 14 | The candidate stores `4th Edition` only in its name while its structured `edition` is null. Luna treated that name-only trait as a possible separate release and abstained. | Catalog context/expectation | Verify whether `4th Edition` is valid marketed identity or malformed catalog text. If malformed, expose name-only traits as unverified catalog data; Bottle Review should repair the row. |

## Audits

| Case                              | Exact failure                                                                                                                                                                                  | Owning layer                    | Specific action                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One-image populated-field audit   | The historical run repeated unsupported proposals until the eight-turn limit. C03's controlled rerun did not reproduce it.                                                                     | Tool rejection recovery         | Record repeated rejected proposals and their reasons in logs. Test a code-level duplicate-rejection stop only when a current comparison case reproduces the loop.                    |
| Hibiki 21 ABV                     | The producer page and exact follow-up search did not expose ABV, so Luna made no update.                                                                                                       | Evidence/expectation            | Add reviewed exact-product ABV evidence or remove the expected repair. More instruction cannot supply a missing fact.                                                                |
| Pōkeno Single Cask                | Luna proposed the required 2019 vintage and supported outturn, then added findings about the name, series, and maturation. M04 fixed the operation scoring, but the extra findings still fail. | Expectation/finding policy      | Review each finding against the label and stored Bottle. Add supported expected findings or reject them with a clear code-based evidence reason; do not suppress all extra findings. |
| Proof and Wood The Representative | Luna proposed `caskStrength: true` but omitted `singleCask: false`, although collected evidence described a blend of about twenty barrels.                                                     | Evidence retention/final output | Include negative Boolean facts in the structured evidence record and draft check. Use this unchanged audit case for the Hedonism/Willett creation experiment.                        |

## Ordered next work

The strongest next experiments are tied to repeated traces and have clear
boundaries:

1. **Stable product name check:** test Russell's Reserve and Creag Isle with
   exact source titles and accepted references. Include deliberately short
   producer names and category words that are part of marketed identity.
   C21's broad positive/negative pair was rejected after it fixed Black Label
   but stripped producer-marketed `Whiskey` from Woodford Reserve.
   C22 protected that producer wording, but full accuracy stayed flat while
   Creag Isle and Black Label's category regressed. Do not add more general
   naming examples from these cases.
2. **Bound expensive audit work:** inspect the malformed Laphroaig and Dramfool
   traces. The latest run spent 87,044 and 49,187 tokens on those cases. Test a
   narrow stop or missing-operation check only after locating the repeated work.
3. **List supported facts before the final draft:** C26 first tested the
   smaller prompt-only version on Willett and Proof and Wood. It fixed the
   target Boolean fields, but the full suite lost accuracy and produced an
   unsupported exact-cask creation. Do not add more field examples. Any future
   draft check must keep source scope explicit and pass the same safety case.
4. **Whole-product versus component facts:** test both Watchpost inputs and a
   true age-stated blend comparison case. This belongs in the web evidence contract.

Expectation reviews for Highland Park, Lagavulin, Whistler, Quinta Ruban,
Hibiki, and Pōkeno should happen before spending model tokens on those cases.

C12 through C14 completed the source-page work. The broad versions were
rejected; the accepted version reads one exact page only when verified local
facts support creating a new Bottle from title text.
