# C26: explain true, false, and unknown single-cask values

**Rejected and reverted.** The focused comparison improved, but the full suite
lost two passes, produced one unsupported creation, and cost 3.9% more than the
saved Luna-high baseline.

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

## Full-suite result

The focused gain required a full-suite check. This compares one Variant B run
with the saved current Luna-high baseline. Both are single live runs with
changing web results and one case without complete measurements.

| Measure                      | Saved baseline | Variant B | Difference |
| ---------------------------- | -------------: | --------: | ---------: |
| Complete passes              |         80/105 |    78/105 |         -2 |
| Unsupported accepted results |              0 |         1 |         +1 |
| Input tokens                 |      2,708,996 | 2,867,034 |      +5.8% |
| Output tokens                |        167,108 |   164,747 |      -1.4% |
| Reasoning tokens             |        120,782 |   116,482 |      -3.6% |
| Total tokens                 |      2,876,104 | 3,031,781 |      +5.4% |
| Model requests               |            379 |       393 |      +3.7% |
| Firecrawl calls              |            143 |       143 |          0 |
| Other tool calls             |            108 |       119 |     +10.2% |
| Estimated model cost         |      $0.336861 | $0.350127 |      +3.9% |
| Total measured case time     |      3,094.6 s | 2,189.6 s |     -29.2% |
| Median case time             |         17.9 s |    18.1 s |      +1.0% |

Willett passed in the full run. Proof and Wood carried both Boolean fields but
also proposed an unnecessary exact-age update, so it failed the complete
judgment. The unsafe result was the Glenglassaugh Batch 1 control. Its source
did not identify one of the batch's exact casks, but Luna borrowed cask 1810
from a search result and proposed a new exact-cask Bottle.

## Decision

Reject Variant B. The paired examples made the two target fields more reliable
in the focused set, but they did not improve the complete full-suite result.
The lower accuracy, unsupported creation, higher token use, and higher cost
fail the acceptance rule. The schema descriptions were restored. No prompt
example from this experiment remains in the classifier.
