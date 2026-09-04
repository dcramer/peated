# M03: disputed names and categories

**Accepted as test case corrections.** The classifier did not change. Four
disputed expectations were checked against product evidence; three test case
facts changed and one remained as written.

## Decisions

| Case                                    | Evidence                                                                                                                                                                                      | Decision                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Johnnie Walker Black Label Islay Origin | The producer's launch release says Islay Origin is made exclusively from Islay single malts, including Lagavulin and Caol Ila.                                                                | Change `category` from `blend` to `blended_malt` in the extracted evidence and expected Bottle. Keep `Black Label Islay Origin` as the stable Bottle name.                                       |
| Compass Box Hedonism²                   | The photographed label says `BLENDED GRAIN SCOTCH WHISKY`. The commissioned retailer describes grain whiskies from North British, Port Dundas, and Girvan. Whiskybase records `Bottled 2023`. | Change the extracted and expected category from `blend` to `blended_grain`. Move 2023 from `releaseYear` to `bottlingYear`. Keep the exact `Hedonism²` name and the three expected distilleries. |
| Maker's Mark core bourbon               | The producer's product heading is `Maker's Mark Kentucky Straight Bourbon`. `Whisky` appears in legal and footer copy as a type descriptor.                                                   | Change the expected full identity from `Maker's Mark Kentucky Straight Bourbon Whisky` to `Maker's Mark Kentucky Straight Bourbon`.                                                              |
| Creag Isle 12                           | The product title and Scotch verification record use `Creag Isle 12YO Island Single Malt Scotch Whisky`. The classifier contract removes brand, age, and generic style words from `name`.     | Keep the expected Bottle name `Island Single Malt`. `Scotch Whisky` remains a type descriptor, so Luna's longer `Island Single Malt Scotch Whisky` result is still a field failure.              |

Sources:

- [Johnnie Walker Black Label Origin launch release](https://www.prnewswire.com/news-releases/decouvrez-les-saveurs-de-l-ecosse-avec-la-gamme-johnnie-walker-black-label-origin-891724152.html)
- [Hedonism² product page](https://hedonism.co.uk/products/compass-box-hedonism-exclusive-to-hedonism-wines)
- [Hedonism² Whiskybase record](https://www.whiskybase.com/whiskies/whisky/226721/hedonism-23-year-old-cb)
- [Maker's Mark product page](https://www.makersmark.com/en-us/bourbons/makers-mark)
- [Creag Isle product page](https://www.totalwine.com/spirits/scotch/single-malt/creag-isle-12yr-island-single-malt-scotch-whisky/p/189848750)
- [Creag Isle Scotch verification listing](https://customs.hmrc.gov.uk/sdvlookup/searchBrand.action%3Bjsessionid%3D6Yif9rruj2h%2BdqVVXEd06sYw?pageNumber=82)
- [checked-in Hedonism² bottle photo](../../src/eval-fixtures/assets/photo-add-bottle-misses/compass-box-hedonism-squared.jpg)

The current public Peated records and local sibling test cases still use the
broader `blend` category for Black Label Origin products. They were observed as
catalog inputs and were not rewritten. Producer evidence takes precedence in
the expected classification result.

## Historical score correction

The table below applies the name and category expectation changes to the saved
outputs. It starts with the M02-adjusted counts. It does not replay the two
corrected extracted inputs, so it is an expectation-only rescore.

| Setting              | Recorded baseline | After M02 | After M03 | M03 change |
| -------------------- | ----------------: | --------: | --------: | ---------: |
| Terra medium, no web |            74/102 |    76/102 |    74/102 |         -2 |
| Luna high, no web    |            75/102 |    73/102 |    71/102 |         -2 |
| Luna xhigh, no web   |            73/102 |    75/102 |    73/102 |         -2 |
| Terra medium, web    |            76/102 |    78/102 |    78/102 |          0 |
| Luna high, web       |            73/102 |    75/102 |    77/102 |         +2 |
| Luna xhigh, web      |            73/102 |    75/102 |    74/102 |         -1 |

The M03 changes are explainable per case:

- The saved no-web runs used `blend` for Black Label and retained `Whisky` for
  Maker's Mark, so both now fail.
- Web Terra changed Maker's Mark to the verified name but kept Black Label as
  `blend`; one pass is gained and one is lost.
- Web Luna high used the verified values in both cases, adding two passes.
- Web Luna xhigh retained `Whisky`; its Black Label run timed out, so it loses
  one pass.
- Hedonism² remains a full-check failure in every saved run because other
  required fields were missing or the run errored.

These changes are scoring corrections, not classifier accuracy gains. They add
no incorrect existing matches. The correction itself made no model calls.

## Focused Luna high validation

Black Label and Hedonism² changed model-visible test case evidence, so both were
checked with Luna high. Web runs used up to two searches in replay `auto` mode;
some requests were live and later identical requests could replay.

| Measure                              | Black Label, web | Black Label, no web | Hedonism², web |
| ------------------------------------ | ---------------: | ------------------: | -------------: |
| All checks passed                    |              3/3 |                 0/1 |            0/3 |
| Correct action                       |              3/3 |                 1/1 |            3/3 |
| Correct name and category            |              3/3 |                 0/1 |            3/3 |
| Incorrect existing matches           |                0 |                   0 |              0 |
| Run errors / timeouts                |            0 / 0 |               0 / 0 |          0 / 0 |
| Input tokens, including cached input |          150,065 |              11,589 |        137,497 |
| Cached input tokens                  |          136,364 |               5,537 |        113,613 |
| Cache-write input tokens             |           13,641 |               6,046 |         23,839 |
| Output tokens, including reasoning   |           10,221 |               1,416 |          7,858 |
| Reasoning tokens                     |            8,002 |               1,004 |          5,905 |
| Model calls                          |               20 |                   2 |             15 |
| Estimated model-token cost           |        $0.018415 |           $0.003323 |      $0.017671 |
| Estimated cost without caching       |        $0.042278 |           $0.004017 |      $0.036929 |
| Median case time                     |          54.42 s |             15.20 s |        28.25 s |
| 95th-percentile case time            |          58.79 s |             15.20 s |        46.55 s |
| Total measured case time             |         145.17 s |             15.20 s |       101.91 s |
| Web searches / page reads            |            4 / 5 |               0 / 0 |          4 / 2 |

The no-web Black Label attempt returned the right action, name, and Brand but
copied the stale `blend` category from the local siblings. Producer evidence
made the corrected category reliable in all three web runs.

Hedonism² kept the verified name and `blended_grain` category in all three
runs. It still failed the complete Bottle check:

- attempt 1 omitted age, bottling year, and all three distilleries;
- attempt 2 included age and bottling year but omitted all three distilleries;
- attempt 3 included all three distilleries but omitted age and bottling year,
  which also forced review.

Those expectations remain because the retailer and bottle record support them.
The alternating omissions are classifier failures for the later Entity and
creation-field experiments. The seven focused attempts cost an estimated
$0.039408 with observed caching, used 299,151 input and 19,495 output tokens,
and took 262.28 seconds. Full per-attempt measurements are in the
[structured results](./M03-names-and-categories.json).

Test case validation passed. A full live suite was not run because the classifier
did not change.
