# C26: explain true, false, and unknown single-cask values

**Inconclusive and reverted.** The focused comparison improved, but it cost
31.5% more and took 5.5% longer. The broad comparison was not controlled: its
saved baseline came from a different source commit, and each side ran only
once with changing web results. The schema wording remains reverted.

## Problem

The shared creation fields `singleCask` and `caskStrength` have no description.
The audit patch describes cask strength but does not explain a supported false
single-cask value. A saved Proof and Wood run correctly recorded
`caskStrength: true` but omitted `singleCask: false`, even though exact-product
evidence said the release blends approximately 20 barrels. A saved Willett run
omitted a source-supported true strength flag.

## Hypothesis

Put short examples beside both fields. For `singleCask`, an explicit
single-cask or single-barrel product is true; an explicit blend of multiple
casks or barrels is false; without either fact it stays null. For
`caskStrength`, cask strength, barrel strength, or barrel proof is true; false
needs explicit product evidence; otherwise it stays null. Variant A used only
those literal strength terms. Variant B also mirrors the existing extractor
rule: a visible single-cask or single-barrel label with a concrete number and
at least 55% ABV may count as cask strength. High ABV alone remains
insufficient.

This is a general field meaning, not a product example. It adds no field,
model request, tool, or validation pass.

## Cases and decision rule

Use fixed evidence with Luna high:

| Case                              | Role            | Required result                                                 |
| --------------------------------- | --------------- | --------------------------------------------------------------- |
| Willett barrel 4769               | Positive target | Keep `singleCask: true` and `caskStrength: true`                |
| Proof and Wood The Representative | Negative target | Add `singleCask: false` with `caskStrength: true`               |
| Cadboll Estate Batch 2            | Unknown control | Create the correct Bottle without inventing a single-cask value |

Run the unchanged version once first. Stop if both targets pass and Cadboll
stays correct. Otherwise run three alternating comparisons per version. Record
complete passes, target fields, invented flags, model requests, tools, tokens,
estimated model cost, and time.

Accept only if the target pass rate improves without an invented Cadboll flag
or another complete-result regression. A promising result requires a full
suite.

## Initial check and Variant A

The unchanged initial run passed 1/3. Willett kept `singleCask: true` but
returned `caskStrength: null`. Proof and Wood proposed only
`caskStrength: true` and omitted `singleCask: false`. Cadboll passed with both
values unknown.

Variant A passed 2/3. It fixed Proof and Wood and kept Cadboll unknown, but
Willett still left cask strength unknown because the label does not use a
literal strength term. Variant B adds the extractor's combined label rule
before the repeated comparison.

Variant A used 67,248 total tokens, cost $0.012485, and took 73.6 seconds. The
initial unchanged run used 84,893 tokens, cost $0.009523, and took 59.8
seconds. One run was enough to reject Variant A because it did not fix its
positive target.

## Variant B focused results

One unchanged run failed to return usable results for Willett and Cadboll. It
was retried and excluded from the measurements below.

| Version   | Run | Passes | Willett | Cadboll | Proof and Wood | Input tokens | Output tokens | Reasoning tokens | Total tokens | Model requests | Tool calls | Estimated model cost |   Time |
| --------- | --: | -----: | ------- | ------- | -------------- | -----------: | ------------: | ---------------: | -----------: | -------------: | ---------: | -------------------: | -----: |
| Unchanged |   1 |    1/3 | Fail    | Pass    | Fail           |       79,482 |         5,411 |            4,103 |       84,893 |             10 |          7 |            $0.009523 | 59.8 s |
| Variant B |   1 |    3/3 | Pass    | Pass    | Pass           |       36,753 |         3,631 |            2,696 |       40,384 |              5 |          2 |            $0.009948 | 40.9 s |
| Unchanged |   2 |    2/3 | Pass    | Pass    | Fail           |       52,581 |         2,789 |            1,572 |       55,370 |              7 |          4 |            $0.004823 | 33.1 s |
| Variant B |   2 |    2/3 | Pass    | Pass    | Fail           |       73,686 |         4,766 |            3,300 |       78,452 |              9 |          6 |            $0.009766 | 53.8 s |
| Unchanged |   3 |    3/3 | Pass    | Pass    | Pass           |       61,419 |         4,022 |            2,772 |       65,441 |              8 |          5 |            $0.006674 | 49.6 s |
| Variant B |   3 |    3/3 | Pass    | Pass    | Pass           |       77,888 |         4,619 |            3,096 |       82,507 |             10 |          7 |            $0.007927 | 55.7 s |

Combined results:

| Measure                        | Unchanged | Variant B | Difference |
| ------------------------------ | --------: | --------: | ---------: |
| Complete passes                |       6/9 |       8/9 |         +2 |
| Willett complete passes        |       2/3 |       3/3 |         +1 |
| Proof and Wood complete passes |       1/3 |       2/3 |         +1 |
| Cadboll complete passes        |       3/3 |       3/3 |          0 |
| Total tokens                   |   205,704 |   201,343 |      -2.1% |
| Model requests                 |        25 |        24 |         -1 |
| Tool calls                     |        16 |        15 |         -1 |
| Estimated model cost           | $0.021020 | $0.027641 |     +31.5% |
| Total time                     |   142.6 s |   150.4 s |      +5.5% |
| Median case time               |    14.6 s |    16.4 s |     +12.6% |

Variant B carried Willett's cask-strength flag in all three runs. It also
carried Proof and Wood's `caskStrength: true` and `singleCask: false` in all
three runs. The second Proof and Wood answer still failed because it proposed
unrelated age and maturation changes. Cadboll left both fields unknown in all
six runs.

## Broad-run observation

The focused gain required a broad check. The recorded comparison used the
saved Luna-high run from source commit
`8d9aed1785ac2478fccb48c589c3c632b982b364`. Variant B ran as an uncommitted
patch on `72b02bc53ce01a514f418273702ab764889840e0`. Those revisions are
different, and the later run includes other accepted changes. Both sides also
used live web results and ran only once. The table therefore describes two
observed runs; its differences do not measure the effect of Variant B.

| Measure                          | Saved baseline | Variant B | Difference |
| -------------------------------- | -------------: | --------: | ---------: |
| Complete passes                  |         80/105 |    78/105 |         -2 |
| Passes after M09-M10 corrections |         78/105 |    80/105 |         +2 |
| Unsupported accepted results     |              0 |         1 |         +1 |
| Input tokens                     |      2,708,996 | 2,867,034 |      +5.8% |
| Output tokens                    |        167,108 |   164,747 |      -1.4% |
| Reasoning tokens                 |        120,782 |   116,482 |      -3.6% |
| Total tokens                     |      2,876,104 | 3,031,781 |      +5.4% |
| Model requests                   |            379 |       393 |      +3.7% |
| Firecrawl calls                  |            143 |       143 |          0 |
| Other tool calls                 |            108 |       119 |     +10.2% |
| Estimated model cost             |      $0.336861 | $0.350127 |      +3.9% |
| Total measured case time         |      3,094.6 s | 2,189.6 s |     -29.2% |
| Median case time                 |         17.9 s |    18.1 s |      +1.0% |

The saved report SHA-256 is
`883a6bb90b362720c06f700b055800ccb812a8b5e0b6eabf3aefcd5d3faae990`.
The Variant B report SHA-256 is
`ecaaa282869c1f77b32d99f137c2637aef9cb45e49a6c00a74af238ded341799`.
The Variant B patch SHA-256 is
`c7d084e116150f741107cbe98a23ffaff029da975a8d65e280d5209ccb6993b7`.

Willett passed in the Variant B run. Proof and Wood carried both Boolean fields
but also treated a minimum age as an exact age update, so it failed the complete
judgment. The Glenglassaugh Batch 1 output was unsafe: its source did not name
one of the batch's exact casks, but Luna borrowed cask 1810 from a search result
and proposed a new exact-cask Bottle. The saved run also failed that case, but
returned the safer `no_match`. This is a valid safety concern in the Variant B
output. A comparison across different revisions cannot show that the examples
caused it.

## Review of apparent lost passes

The raw reports contain nine cases that passed in the saved run and failed in
the Variant B run. Seven failures use reviewed expectations. M09 and M10
correct two test cases whose name-only sources cannot identify the observed
release. A real miss in this table means the output conflicts with the checked
source or Peated's written rules; it does not mean Variant B caused the miss.

| Case                                              | Variant B output                                                                                       | Review                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four Roses 2017 Limited Edition Small Batch       | Created the right product but stored `2017` in both `edition` and `releaseYear`.                       | Real exact-field miss. Peated uses the release year for this annual identity and leaves `edition` empty.                                                                                                       |
| Maker's Mark Kentucky Straight Bourbon            | Added `Whisky` to the stable Bottle name.                                                              | Real naming miss. M03 checked the producer heading and recorded `Whisky` as a type word.                                                                                                                       |
| The Whistler Bodega Cask                          | Returned `no_match` because the producer page says 86 proof while other product evidence says 46% ABV. | Correct result. M09 changed this fixture to require review because the input has no ABV and cannot identify which version it observed.                                                                         |
| Woodford Reserve Double Double Oaked              | Returned `no_match` because producer evidence describes separate yearly releases.                      | Correct result. M10 changed this fixture to require review because its name-only input cannot identify one of those releases.                                                                                  |
| High West A Midwinter Night's Dram Act 12 Scene 9 | Returned `no_match` despite the readable full edition on the label.                                    | Real decision miss under Peated's identity rules. Act and scene identify the release, and the broader Act 12 candidates are incomplete.                                                                        |
| Creag Isle 12-year-old Island Single Malt         | Created the right product with the name `Island`.                                                      | Real naming miss. M03 reviewed the product title and kept `Island Single Malt` as the stored name. The Bottle identity and action were otherwise right.                                                        |
| Trestle Spirit of Eclipse                         | Rejected the sole exact candidate because its Brand also fills the stored bottler relationship.        | Real decision miss. The label, aliases, and candidate identify the same Bottle. Peated's rules say that a repeated Entity or an omitted source relationship is not evidence that a populated bottler is wrong. |
| Glenlivet Caribbean Reserve                       | Rejected the exact product candidate for the same bottler reason.                                      | Real decision miss. The candidate's missing facts are enrichment gaps, and the populated Glenlivet relationship is not a source conflict.                                                                      |
| Glenmorangie Quinta Ruban 14                      | Rejected the reviewed existing Bottle for the same bottler reason.                                     | Real decision miss. The fixture records the official page and production Bottle as the same marketed product; `4th Edition` in the display name does not prove a separate release.                             |

Of the seven remaining misses, four changed the action incorrectly: Midwinter,
Trestle, Glenlivet, and Quinta Ruban. Three chose the right product and action
but stored a reviewed field or name incorrectly: Four Roses, Maker's Mark, and
Creag Isle. The latter three are real suite failures, but they are less serious
than choosing the wrong action or Bottle.

This review used Peated's
[match and bottler rules](../../../../docs/architecture/bottle-classifier.md),
[release identity examples](../../../../docs/features/bottle-presentation.md),
the [reviewed naming decisions](./M03-names-and-categories.md), and the stored
case evidence for
[Midwinter](../../src/eval-fixtures/decision-cases/new_bottles/image-backed-photo-creates-complete-high-west-midwinter-act-12-scene-9-bottle.json),
[Trestle](../../src/eval-fixtures/decision-cases/match_existing/image-backed-photo-matches-trestle-spirit-of-eclipse.json),
[Glenlivet](../../src/eval-fixtures/decision-cases/match_existing/store-listing-glenlivet-caribbean-reserve-reaches-bottle-verification-confidence-when-reliable-web-evidence-confirms-the-family.json),
and
[Quinta Ruban](../../src/eval-fixtures/decision-cases/match_existing/store-listing-matches-quinta-ruban-14-despite-stored-edition-suffix.json).

The raw 80/105 versus 78/105 total is the net of nine apparent losses and seven
apparent gains. After M09 and M10 correct the two ambiguous expectations, the
saved run scores 78/105 and Variant B scores 80/105, with seven losses and nine
gains. Several gains came from classifier and fixture work that was absent from
the saved source commit. Neither the overall score nor the individual changes
can be assigned to these field examples.

## Decision

Do not accept Variant B from this evidence. The paired focused runs show a
promising field gain, but they also show 31.5% higher cost and 5.5% more time.
The broad run cannot establish an accuracy or safety change because its control
used different code and both versions ran only once. The schema descriptions
were restored, so no prompt example from this experiment remains in the
classifier.

If this wording is reconsidered, compare an unchanged control and the variant
from the same commit, with the same fixed evidence and more than one run. Keep
the complete-result score, but report the two target fields separately so an
unrelated age or name error does not hide whether the examples did their job.
Use the corrected Whistler and Woodford expectations in that gate.
