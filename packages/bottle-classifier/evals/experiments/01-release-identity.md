# Experiment 01: release identity

**Rejected. The original prompt was restored.** The change produced fewer correct
decisions and more incorrect existing matches. Its small cost saving does not
offset that loss. A full-suite run was not warranted.

## Change and setup

The [tested patch](./01-release-identity.patch) replaced compatibility step 4. It
asked the model to compare traits in candidate names and structured fields, and
to establish whether a code describes a marketed release or an observation.

Both versions used Luna high, with Luna high for image extraction, two search
queries, and eight turns. Ten cases ran three times per version: 30 attempts
each, 60 total. Order was comparison case/change, change/comparison case, comparison case/change. Model
answers were fresh. Catalog inputs and expectations were fixed.

Both versions shared web recordings seeded from the earlier Luna high run. There
were 127 recordings initially and 193 afterward: 66 new successful requests were
recorded. Identical requests reused evidence; new requests were live. This limits
the timing comparison and means web evidence was not fully controlled.

## Results

| Measure                              | Unchanged case |   Change |
| ------------------------------------ | -------------: | -------: |
| All checks passed                    |          19/30 |    13/30 |
| Correct action and Bottle ID         |          21/30 |    18/30 |
| Incorrect existing matches           |              5 |        8 |
| Run errors / timeouts                |          0 / 0 |    0 / 0 |
| Estimated model-token cost           |       $0.09425 | $0.08921 |
| Estimated cost without caching       |       $0.19614 | $0.19669 |
| Input tokens, including cached input |        663,652 |  687,657 |
| Cached input tokens                  |        587,220 |  616,709 |
| Cache-write input tokens             |         76,147 |   70,663 |
| Output tokens, including reasoning   |         52,844 |   49,298 |
| Reasoning tokens                     |         40,020 |   36,523 |
| Model calls                          |             95 |       95 |
| Median case time                     |        23.32 s |  26.21 s |
| 95th-percentile case time            |        51.43 s |  42.19 s |
| Total measured case time             |       728.67 s | 682.23 s |
| Run time including startup/reporting |       740.08 s | 694.92 s |
| Search queries / page reads          |        39 / 15 |  37 / 17 |

Cost was available for every attempt. These are model-token estimates, not total
service bills: Firecrawl fees and provider billing adjustments are excluded.
Cached input and reasoning are subsets of the input and output totals, not extra
tokens. The change cost about 5% less with the observed cache usage, but almost
the same without caching. Its median was slower, while its slowest cases and
total time were faster. None of those savings compensate for worse decisions.

## What changed

| Case                           | Unchanged case passes | Change passes | Decision detail                                                            |
| ------------------------------ | --------------------: | ------------: | -------------------------------------------------------------------------- |
| Midwinter Act 10 Scene 4       |                   3/3 |           2/3 | Correct creation throughout; one edition punctuation difference            |
| Midwinter Act 12 Scene 9       |                   3/3 |           2/3 | Correct creation throughout; one result required manual review             |
| Release year in candidate name |                   1/3 |           0/3 | Correct creation throughout; calendar year disagreement                    |
| Elijah Craig 18                |                   0/3 |           0/3 | Incorrect matches increased from 1 to 2; other attempts declined           |
| Masterson's French Oak         |                   0/3 |           0/3 | Incorrect matches increased from 1 to 3; other unchanged attempts declined |
| Image-backed exact cask        |                   3/3 |           3/3 | Preserved                                                                  |
| High Country                   |                   0/3 |           0/3 | Incorrect batch match on every attempt                                     |
| SMWS exact code                |                   3/3 |           3/3 | Preserved                                                                  |
| Quinta Ruban 14                |                   3/3 |           0/3 | Change declined every valid match                                          |
| Retailer suffix noise          |                   3/3 |           3/3 | Preserved                                                                  |

“Correct action and Bottle ID” checks the action and required target ID. It does
not claim that every created field is correct. The full pass count retains field,
scope, confidence, and other checks. Safer refusals on the two barrel cases still
fail their required creation outcome.

The changed prompt sometimes found evidence describing the candidate, then
treated that as evidence connecting the source to it. In one Elijah Craig
attempt, corroborating barrel 4040 did not establish that the input identified
that barrel. Other attempts treated candidate barrel details as observations
without establishing that interpretation. High Country still treated extraction's
batch field as marketed identity. The extra instructions did not resolve these
questions and made the harmless Quinta Ruban suffix block matching.

The added year case preserves the source from the existing Woodford Reserve 2022
photo case but supplies only its 2017 candidate. Both versions correctly avoided
that candidate. Five attempts returned 2023 as the calendar release year after
reading a retailer's claim about a 2022 bottling. The producer's
[2023 announcement](https://www.woodfordreserve.com/woodford-reserve-double-double-oaked-returns-as-2023-winter-distillery-series/)
describes a 2023 release; it does not establish that the test case's 2022 label is
that release. Those disagreements remain failures in the results above.

After the experiment, the unverified calendar-year assertion was removed from
this new test case. The donor test case asserted a specific Bottle match, not a
calendar release year. The added test should check that the model rejects the
older candidate and creates the source release. The
[original test](./fixtures/01-release-year-in-candidate-name.json) is archived;
none of the original results were rescored. This test case correction is not an
accuracy gain for the classifier and does not affect the rejection decision.

## Evidence and next step

The [settings and decision](./01-release-identity.json) and
[per-attempt measurements](./01-release-identity-results.json) retain every
outcome, field difference, rationale, cost, and duration. Raw reports remain in
`.cache/classifier-experiment-01/`; their hashes and the two instruction-file
hashes are recorded. Eleven successful web recordings used by the new year case
were added to the package's replay evidence.

Do not keep expanding this instruction from these examples. A later identity
experiment would need to distinguish evidence describing a candidate from
evidence assigning the source to it, with comparison cases for ordinary lot codes. Entity
reuse and audit recovery remain separate experiments.
