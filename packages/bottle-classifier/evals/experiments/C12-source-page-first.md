# C12: read the supplied source page first

**Rejected and reverted.** Accuracy stayed at 8/12. The instruction caused
unnecessary page reads, traded one target gain for another target regression,
and more than doubled median time.

## Problem

Two saved Luna high failures had a product URL in `reference.url` and lacked
facts required for a complete creation:

- the text-only SMWS RW6.5 case made no web call and omitted age, ABV, and
  release year;
- Russell's Reserve Single Barrel Rye sometimes read a related page instead of
  its supplied retailer page and omitted the expected 52% ABV.

Octomore 13.1 has no supplied URL and belongs to a later search-result recovery
experiment.

## Hypothesis and exact change

One sentence was added after the existing explanation of `reference.url`:

> When `reference.url` is present and the source identity still lacks a fact
> needed for the decision or a complete creation, read that source page before
> web search; do not spend the page-read allowance on another URL first.

No tool, schema, budget, or classifier behavior changed. The focused cases were:

- text-only SMWS RW6.5 creation;
- Russell's Reserve Single Barrel Rye creation;
- structured SMWS RW6.5 creation as a complete-input comparison case; and
- text-only SMWS existing exact-code match as a local-match comparison case.

All valid calls used `gpt-5.6-luna` at high reasoning effort, live Firecrawl
access with automatic replay recording, and at most two web searches. Run order
was changed 1, unchanged 1, unchanged 2, changed 2, unchanged 3, changed 3.

The first attempted three runs per version did not load the main checkout's
`.env.local`, so Firecrawl was absent. Those runs are retained in the local eval
cache but excluded from the decision. The valid rerun explicitly loaded the key
and confirmed page calls in the transcript.

## Result

| Measure                             | Unchanged case | Changed version |          Change |
| ----------------------------------- | -------------: | --------------: | --------------: |
| Correct attempts                    |           8/12 |            8/12 |               0 |
| Text-only SMWS creations            |            0/3 |             1/3 |              +1 |
| Russell's Reserve creations         |            2/3 |             1/3 |              -1 |
| Complete-input comparison case      |            3/3 |             3/3 |               0 |
| Existing exact-code comparison case |            3/3 |             3/3 |               0 |
| Run timeouts                        |              0 |               1 |              +1 |
| Source page reads                   |              3 |              10 |              +7 |
| Web searches                        |              5 |               4 |              -1 |
| Local Bottle searches               |              3 |               6 |              +3 |
| All tool calls                      |             11 |              21 |             +10 |
| Model requests                      |             23 |              32 |      +9 partial |
| Input tokens                        |        135,968 |         201,428 | +65,460 partial |
| Cached input tokens                 |        114,329 |         165,818 | +51,489 partial |
| Cache-write tokens                  |         21,570 |          35,514 | +13,944 partial |
| Output tokens                       |         14,654 |          19,399 |  +4,745 partial |
| Reasoning tokens                    |         10,694 |          14,444 |  +3,750 partial |
| Total tokens                        |        150,622 |         220,827 | +70,205 partial |
| Estimated model cost                |      $0.025278 |  $0.035493 min. | +$0.010215 min. |
| Total case time                     |       159.78 s |        633.96 s |       +474.18 s |
| Median case time                    |        14.47 s |         26.44 s |        +11.97 s |
| 95th percentile, nearest rank       |        21.93 s |        330.17 s |       +308.24 s |

Changed version token, request, and cost totals cover 11 of 12 attempts. The timed-out
attempt returned no usage, so the reported increases are lower bounds. Firecrawl
billing is not included in model cost.

The instruction did make exact source evidence available. It recovered all
three missing SMWS facts once. Another run recovered age and ABV but still
missed release year; the first timed out before returning an answer. For
Russell's Reserve, it recovered 52% ABV in all three runs but dropped `Rye` from
the stable product name twice. The unchanged classifier passed that case twice
and failed once after reading the wrong related producer page.

The changed version also read the source page in the already complete structured
comparison case 3/3 times and in the safe exact-match comparison case 2/3 times. Those five reads
could not improve the correct decisions. One changed structured-input run made
three tool calls despite having all expected source fields before the run.

## Decision

Reject the instruction. It did not improve total accuracy, introduced a target
regression and a timeout, and increased every meaningful resource measure. The
source pages themselves are useful: ReserveBar exposed the missing 52% ABV, and
SMWS exposed age 6 and 56% ABV. The next experiment should make that evidence
available only for weak source input after a deterministic local match has been
ruled out. It must separately protect stable product-name tokens such as `Rye`.
