# C35: remove eval inputs copied into the extractor examples

**Decision: Accepted.** The model-checks policy requires the removal. The only
consistent change is Octomore 13.1, which the removed example had been
answering; it is left for a follow-up taught with other values.

## Problem

`docs/development/model-checks.md` forbids copying test case names, exact
inputs, expected answers, or distinctive phrases into a product prompt. The
label extractor's `RETAILER_LABEL_EXAMPLES` and `EXTRACTION_EXAMPLES` in
`src/extractorInstructions.ts` hold nine titles that are eval inputs, word for
word or with only a size suffix removed:

| Prompt example                                                       | Eval case                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Heaven's Door Bootleg Vol 3 Whiskey`                                | `heavens-door-bootleg-vol-3`                                                                                 |
| `Four Roses Limited Edition Small Batch 2017`                        | `four-roses-limited-edition-small-batch-2017`                                                                |
| `Highland Park Cask Strength No. 5`                                  | `highland-park-cask-strength-no-5`                                                                           |
| `Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky` | `store-listing-matches-an-existing-distillers-edition-2023-bottle`                                           |
| `Octomore 13.1`                                                      | `octomore-dot-expression`                                                                                    |
| `Ardbeg Uigeadail Single Malt Scotch Whisky`                         | `text-only-listing-strips-retailer-suffix-noise-and-matches-ardbeg-uigeadail`                                |
| `Jura 12-year-old Scotch Whisky`                                     | `text-only-listing-keeps-a-brand-led-age-statement-match-when-the-local-bottle-name-is-distillery-qualified` |
| `Skrewball Peanut Butter Whiskey`                                    | `store-listing-rejects-an-unsupported-novelty-flavored-whiskey-product`                                      |
| `Unknown Bottle Gift Set with 2 Glasses`                             | `store-listing-rejects-a-packaging-only-gift-set-without-bottle-identity`                                    |

While these copies stay, those cases measure memorized answers, not the rule.
The Highland Park and Heaven's Door examples also put `No. 5` and `Vol. 3` in
the edition, against the current naming rule.

Two related copies are out of scope here and left for a separate change: the
`4769` example in the extractor's cask-number guidance (a Willett eval value)
and `Chapter Thirty Two` in classifier rule 3 (the Whiskyland eval).

## Change

Remove the nine entries from both example lists. Add nothing in their place.
If a rule they taught turns out to be needed, a later experiment can teach it
with different values and a separate proving case.

## Expected effect

The policy requires the removal, so this measures its cost rather than
deciding whether to make it. Some target cases may get worse because the
model no longer sees its own answer. The change is accepted unless it causes a
wrong existing match or a regression in a comparison case; a target that
regresses becomes a candidate for a general rule taught with other values.

## Cases

Targets: the nine cases above. Seven run text extraction live on the source
title in the controlled lane; Highland Park and Lagavulin DE 2023 supply a
fixed extraction, so the change can only reach them through the classifier
prompt, which does not include these lists.

Comparison cases, which use the same rules with different values and must keep
working:

- `text-only-listing-creates-complete-elijah-craig-batch-c923-bottle` (batch
  edition)
- `macallan-classic-cut-2021-edition` (annual year)
- `talisker-distillers-edition-2001` (Distillers Edition with a leading year)
- `makers-mark-bourbon-brand-only` (brand-only name)
- `store-listing-rejects-jameson-cold-brew-as-additive-flavor-product`
  (flavored-whiskey exclusion)

## Settings and order

Controlled lane: `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high
for classification and extraction, a fresh copy of the committed recordings
per run. Variant A is `origin/main` at `c0f76b5da`; variant B is the same
commit plus this change. Three rounds; in each round A and B run at the same
time from separate checkouts, so neither version consistently runs first.

## Results

Three rounds per variant, 14 cases each.

| Case                                          | A (copies) | B (removed) |
| --------------------------------------------- | ---------: | ----------: |
| Octomore 13.1                                 |        3/3 |         0/3 |
| Four Roses Limited Edition Small Batch 2017   |        1/3 |         2/3 |
| Heaven's Door Bootleg Vol 3                   |        2/3 |         2/3 |
| Highland Park Cask Strength No. 5             |        0/3 |         0/3 |
| Lagavulin Distillers Edition 2023             |        3/3 |         3/3 |
| Ardbeg Uigeadail (text-only)                  |        3/3 |         3/3 |
| Jura 12 (text-only)                           |        3/3 |         3/3 |
| Skrewball (flavored product)                  |        3/3 |         3/3 |
| Packaging-only gift set                       |        3/3 |         3/3 |
| Elijah Craig Batch C923 (comparison)          |        1/3 |         1/3 |
| Macallan Classic Cut 2021 (comparison)        |        2/3 |         2/3 |
| Talisker 2001 Distillers Edition (comparison) |        2/3 |         1/3 |
| Maker's Mark brand-only (comparison)          |        3/3 |         3/3 |
| Jameson Cold Brew (comparison)                |        3/3 |         3/3 |
| **Total**                                     |  **32/42** |   **29/42** |

Neither variant made a wrong existing match. Four Roses, Talisker, and Elijah
Craig moved by one run in opposite directions, within the variance these cases
already show in CI (Talisker passed 6 of 9 earlier controlled runs).

Octomore regressed in every B run. Without the example, text extraction split
the title into series `Octomore 13` and edition `13.1`, twice with Brand
`Bruichladdich`, and the classifier returned `no_match` for insufficient
evidence. That is exactly what the removed note told the extractor not to do,
so the example was supplying this case's answer.

The removed Skrewball notes also stated the flavored-product rule, but the
extractor prompt states that rule separately, and both flavored cases held.

## Follow-up

Teach the dotted-release rule with a different producer, such as a Waterford
`1.1` release, and prove it with a new eval case that uses other values. Keep
the Octomore case unchanged as the original measurement.
