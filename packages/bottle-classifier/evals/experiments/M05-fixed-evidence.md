# M05: fixed web evidence

**Accepted as measurement infrastructure.** The classifier instructions and
production model did not change. Controlled evals can now give each version the
same reviewed source evidence, keyed by test case ID. Live web remains a separate
check.

## Why replay was insufficient

The existing Firecrawl replay is keyed by tool name and arguments. A prompt
version can phrase a different query, which can select a different recording or
miss replay entirely. Strict replay therefore prevents a network request but
does not guarantee that two versions see the same facts.

A fixed evidence pack now does two things:

- supplies its reviewed search evidence before the model starts;
- returns only the reviewed search and page results if the model calls a web
  tool. An unreviewed page returns an error and never calls the live executor.

The first pack covers the Black Label Islay Origin test case with reviewed
producer launch evidence. Its summaries are stored as reviewed paraphrases, not
as raw Firecrawl output.

## Validation case

The smoke check used Luna high and the Black Label Islay Origin test case. This
case was chosen because the fixed producer evidence directly supports the
expected `blended_malt` category. The controlled and live runs used the same
test case, model, reasoning effort, extraction settings, test catalog data, turn
limit, and two-query limit.

The initial fixed executor implementation was incomplete. Luna did not call a
web tool, so it received no fixed evidence and failed the category check. The
corrected implementation supplies the evidence at the start. We kept this
failed attempt in the record because it exposed a real test runner flaw.

| Run                               | Score |  Input | Output | Cached input | Cache write | Reasoning | Model requests | Tool calls | Live web |    Time | Estimated model cost |
| --------------------------------- | ----: | -----: | -----: | -----------: | ----------: | --------: | -------------: | ---------: | -------: | ------: | -------------------: |
| Initial executor only             |   0/1 | 11,589 |  1,531 |        5,537 |       6,046 |     1,138 |              2 |          1 |        0 | 18.02 s |            $0.003461 |
| Fixed evidence, supplied at start |   0/1 | 24,644 |  2,399 |       22,923 |       1,709 |     1,881 |              4 |          3 |        0 | 27.88 s |            $0.003767 |
| Current live web                  |   0/1 | 47,177 |  3,624 |       38,560 |       8,599 |     2,954 |              6 |          5 |        2 | 42.52 s |            $0.007273 |

“Live web” counts Firecrawl tool calls. The live run made one search call with
two queries and one page-read call. The fixed run made no Firecrawl request; its
three tools were one Bottle search and two Entity searches. Estimated model
cost excludes Firecrawl fees.

Both corrected runs still chose `blend` instead of `blended_malt`. Both selected
`create_bottle`, the right Brand, stable name, and age. Both treated the evidence
as supportive. The live run also found 42% ABV. This is a consistent classifier
category error, rather than evidence that one source path fixed the case.

The controlled run used 23,758 fewer tokens, cost $0.003506 less, and finished
14.64 seconds sooner than the live run. This one case is a test runner smoke check,
not a general estimate of Firecrawl overhead.

At Luna's uncached input and output rates, the three model attempts would have
cost $0.025747 without cache discounts. Their measured estimate was $0.014501.
Together they used 83,410 input tokens, 7,554 output tokens, and 88.43 seconds.

One setup command used the full displayed test title as a filter. Vitest matched
no test, skipped all 104 cases, and made zero model calls. It had no accuracy,
token, cost, or model-time result.

## Decision

Keep the fixed-evidence lane. It removes source selection as a variable in a
focused comparison and fails closed for pages that were not reviewed. Every
classifier experiment will use the same fixed pack for unchanged and changed versions,
then run a separate live-web check if the focused result is promising.

This item claims no accuracy gain. Its first run instead isolated a category
reasoning failure for later classifier work.

## Verification

- Fixed executor and replay tests: 7 passed in 0.88 seconds.
- Classifier, fixed executor, and replay tests: 70 passed in 2.21 seconds.
- Package typecheck, lint, and formatting: passed.

The [structured results](./M05-fixed-evidence.json) retain every attempt and the
exact measurements.
