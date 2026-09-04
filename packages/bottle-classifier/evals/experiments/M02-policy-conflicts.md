# M02: Cold Brew policy conflict

**Accepted as a measurement correction.** The classifier did not change. Two
test cases contradicted the existing rule that products made by adding flavor to
whisky are outside the whisky catalog.

## Policy decision

Jameson says Cold Brew combines Jameson Irish Whiskey with Arabica coffee.
Pernod Ricard lists the product at 30% ABV. The Irish Whiskey technical file
requires Irish Whiskey to be at least 40% ABV. Together, those sources establish
that Cold Brew is an additive-flavor spirit rather than an in-scope whisky.

- [Jameson Cold Brew](https://www.jamesonwhiskey.com/en-us/our-whiskey/jameson-cold-brew/)
- [Pernod Ricard Norway product catalogue](https://www.pernod-ricard.com/sites/default/files/inline-files/Pernod_Ricard_Norway_Produktkatalog_2.pdf)
- [Irish Whiskey technical file](https://www.marketaccess.agriculture.gov.ie/media/marketaccess/content/Irish%20Whiskey%20Technical%20File.pdf)

The two observed inputs, candidates, and current assignment were preserved. Both
now expect `no_match` and live under `ignore_or_reject`. An existing Peated
Bottle or assignment does not make an out-of-scope product eligible. The policy
also requires product evidence: a word such as coffee, chocolate, rum, or port
in a name is not enough by itself.

The architecture guide now states this scope rule. A separate Ardbeg Uigeadail
test case tests current-assignment automation with an in-scope whisky.

## Historical baseline correction

The 2026-09-03 baseline remains unchanged as a record of what the suite scored
at the time. Rescoring only these two outcomes gives:

| Setting              | Recorded pass count | Corrected pass count | Change | Incorrect matches before / after |
| -------------------- | ------------------: | -------------------: | -----: | -------------------------------: |
| Terra medium, no web |              74/102 |               76/102 |     +2 |                            1 / 1 |
| Luna high, no web    |              75/102 |               73/102 |     -2 |                            1 / 3 |
| Luna xhigh, no web   |              73/102 |               75/102 |     +2 |                            3 / 3 |
| Terra medium, web    |              76/102 |               78/102 |     +2 |                            2 / 2 |
| Luna high, web       |              73/102 |               75/102 |     +2 |                            3 / 3 |
| Luna xhigh, web      |              73/102 |               75/102 |     +2 |                            2 / 2 |

All settings except no-web Luna high returned `no_match` for both cases. Luna
high matched both when the product description was unavailable, then rejected
both when web evidence established the coffee addition and 30% ABV. The lower
no-web score is an honest limit of the available evidence, not a classifier
regression. These score changes are test case corrections and cannot count as an
accuracy gain.

Changing an expectation does not change the model input, so the Cold Brew cases
were not rerun. Their six original outputs are retained in the baseline reports.
The correction itself used zero model calls, tokens, cost, or model time.

## In-scope current-assignment check

The added Ardbeg case ran with Luna high, no web tools, and a fixed local Bottle
candidate. After removing an unrelated `referenceScope` assertion, it passed all
three repeats. Every attempt, including the setup attempt, matched Bottle 630
and derived the `auto` tier from the current assignment.

| Measure                              | Accepted repeats | Setup attempt |
| ------------------------------------ | ---------------: | ------------: |
| All checks passed                    |              3/3 |           0/1 |
| Correct action and Bottle ID         |              3/3 |           1/1 |
| Correct current-assignment tier      |              3/3 |           1/1 |
| Incorrect existing matches           |                0 |             0 |
| Run errors / timeouts                |            0 / 0 |         0 / 0 |
| Input tokens, including cached input |           33,849 |        11,283 |
| Cached input tokens                  |           33,831 |         6,119 |
| Cache-write input tokens             |                0 |         5,158 |
| Output tokens, including reasoning   |            2,163 |           675 |
| Reasoning tokens                     |            1,305 |           408 |
| Model calls                          |                6 |             2 |
| Estimated model-token cost           |        $0.003276 |     $0.002223 |
| Estimated cost without caching       |        $0.009365 |     $0.003067 |
| Median case time                     |          10.48 s |       10.25 s |
| 95th-percentile case time            |          11.34 s |       10.25 s |
| Total measured case time             |          31.20 s |       10.25 s |
| Web searches / page reads            |            0 / 0 |         0 / 0 |

The setup attempt failed only because the test case expected `referenceScope =
none`; Luna treated the noisy retailer title as a possible global alias. That
field is unrelated to current-assignment confidence and the model's value was
allowed by the contract, so the assertion was removed. The failed attempt and
all measurements remain in the [structured results](./M02-policy-conflicts.json).

Focused test case validation passed. The validation command currently runs all
package tests; all 394 passed. No full live suite was run because the classifier
did not change.
