# Claude Haiku 5.5 high versus GPT-6 Luna high

**Rejected. GPT-6 Luna high stays the production default, and the setup change
was reverted.** One full-suite run per model on the same day: Haiku 5.5 passed
48 of 115 checks and GPT-6 Luna passed 90. Haiku failed 17 runs outright,
picked the wrong existing Bottle five times against Luna's one, and cost 21.4%
more on the cases both models completed. It was about 2.6 times faster.

## Change tested

Vercel AI Gateway lists Claude Haiku 5.5 at the same price per token as GPT-6
Luna:

| Model            | Input | Cache read | Cache write | Output |
| ---------------- | ----: | ---------: | ----------: | -----: |
| GPT-6 Luna       | $0.10 |      $0.01 |      $0.125 |  $0.50 |
| Claude Haiku 5.5 | $0.10 |      $0.01 |      $0.125 |  $0.50 |

Prices are per million tokens, read from the gateway model list on 2026-10-10.

Haiku already runs through the classifier with
`BOTTLE_CLASSIFIER_MODEL=anthropic/claude-haiku-5.5`. The gateway translates
the OpenAI Responses format, so the OpenAI Agents library needs no change. The
[tested patch](./model-claude-haiku-5-5-2026-10-10.patch) made the comparison
fair and measurable:

- It added a Haiku 5.5 row to the cost table.
- It sent `caching: "auto"` on classifier requests. Anthropic models do not
  cache on their own. Without this field an identical 10,800-token prompt read
  nothing from cache on its second call; with it the whole prompt was read from
  cache.
- It sent the configured reasoning effort to Haiku 5 names, with no
  temperature, as for GPT-5 and GPT-6 names.

Prompts, tools, limits, and checks were unchanged. Both runs used the patched
code, so the Luna control also sent the caching field. Luna read 89.9% of its
input from cache and had no run errors.

Both runs used high reasoning effort for classification, GPT-6 Luna high for
image extraction, GPT 5.6 Luna medium as the eval judge, at most two search
queries, an 18-turn agent limit, live web evidence, and separate empty replay
directories. The two suites ran concurrently. Source commit `aee689069` plus
the patch.

## Full-suite results

| Measure                         | GPT-6 Luna high | Haiku 5.5 high | Difference |
| ------------------------------- | --------------: | -------------: | ---------: |
| Passed                          |          90/115 |         48/115 |        -42 |
| Run errors                      |               0 |             17 |        +17 |
| Wrong existing Bottle selected  |               1 |              5 |         +4 |
| False-positive accepted results |               0 |              2 |         +2 |
| False `no_match` results        |               8 |             17 |         +9 |
| Timeouts                        |               0 |              0 |          0 |
| Cases with model usage          |             111 |             94 |        -17 |
| Input tokens                    |       4,731,058 |      5,908,197 |     +24.9% |
| Cached input tokens             |       4,254,480 |      5,082,529 |     +19.5% |
| Cache write tokens              |         474,913 |        583,762 |     +22.9% |
| Output tokens                   |         326,523 |        199,775 |     -38.8% |
| Reasoning tokens                |         261,181 |         45,046 |     -82.8% |
| Total tokens                    |       5,057,581 |      6,107,972 |     +20.8% |
| Model requests                  |             555 |            382 |     -31.2% |
| Firecrawl calls                 |             214 |            116 |     -45.8% |
| Other tool calls                |             193 |            206 |      +6.7% |
| Estimated model cost            |       $0.265337 |      $0.247874 |      -6.6% |
| Estimate without caching        |       $0.636367 |      $0.690707 |      +8.5% |
| Median case time                |          35.2 s |         13.5 s |     -61.6% |
| 95th percentile case time       |          78.7 s |         36.7 s |     -53.4% |
| Total case time                 |         4,256 s |        1,822 s |     -57.2% |

The Haiku totals leave out its 17 failed runs, which recorded no usage. Those
runs still cost tokens and web calls, so the totals understate Haiku. On the 94
cases with usage in both runs, Luna cost $0.204256 and Haiku $0.247874, 21.4%
more. Haiku sends more input per case and that outweighs its smaller output.
Firecrawl fees are not in either estimate.

| Slice             | Cases | GPT-6 Luna | Haiku 5.5 |
| ----------------- | ----: | ---------: | --------: |
| New bottles       |    48 |         34 |        14 |
| Match existing    |    41 |         35 |        18 |
| Corrections       |     1 |          1 |         1 |
| Ignore / no match |    13 |         12 |        10 |
| Bottle audits     |    12 |          8 |         5 |

The suite has grown from 105 to 115 cases since the
[GPT-6 Luna baseline](../baselines/2026-09-22-gpt-6-luna-high-current.json),
and the classifier has changed, so Luna's 90 is not comparable with the
recorded 79.

## Changed outcomes

Both models passed 42 cases and both failed 19. Haiku gained six cases that
Luna failed:

- Lagavulin Distillers Edition and Woodford Reserve Double Double Oaked in new
  bottles.
- The store listing that resolves Black Label kept the 12-year-old wording.
- The Glenlivet Caribbean Reserve store listing matched its Bottle.
- The age-mismatch rejection kept `product` identity scope.
- The malformed Laphroaig audit retired the record.

Haiku lost 48 cases that Luna passed:

| Reason                                                   | Cases |
| -------------------------------------------------------- | ----: |
| Run error: result did not fit the output schema          |    12 |
| Run error: 18 turns used without a result                |     2 |
| `create_bottle` expected, returned `no_match`            |     7 |
| New Bottle expected, identity not finalized              |     3 |
| `match` expected, returned `no_match`                    |     3 |
| `match` expected, returned `create_bottle`               |     1 |
| `create_bottle` expected, matched an existing Bottle     |     1 |
| `no_match` expected, matched an existing Bottle          |     2 |
| Matched a different Bottle ID                            |     1 |
| Correct match, but sent to review or the wrong next step |     7 |
| Wrong name, category, or scope field                     |     5 |
| Audit operations or findings                             |     4 |

The five wrong existing Bottle selections by Haiku were the 43% Macallan
12-year-old review, High West High Country, Laphroaig Càirdeas, the
out-of-scope Jameson current assignment, and the Springbank Open Day photo that
requires review. Luna's one was High West High Country.

The usual three focused repeats of each safety-relevant case were skipped. A
42-case gap with four more wrong existing matches does not depend on one flaky
case.

## Why Haiku fell short

These are observations from one run, not controlled findings.

- **Results outside the schema.** In 15 runs Haiku returned a result with
  invented or misplaced fields, such as `confidenceBasis_dummy`,
  `action_placeholder`, a top-level `webEvidence`, or `confidenceBasis` that was
  not an object. Result validation rejects these. The gateway does not hold
  Haiku to the strict output schema the way it holds Luna. Fixing all 15 would
  leave Haiku at 63 of 115 at most.
- **Little reasoning.** Haiku recorded zero reasoning tokens in 78 of its 94
  measured cases at high effort. Luna reasoned in all 111. On a test prompt,
  effort `none` turned Haiku's reasoning off, and `low` through `xhigh` all
  produced about the same amount, so the effort setting does not raise it.
- **Prompts tuned on Luna.** Every earlier experiment in this log shaped the
  instructions against Luna.

Forcing a reasoning budget for Haiku is untested. It is the one change that
might close some of the gap.

## Decision

Keep GPT-6 Luna high. Haiku 5.5 is less accurate, less safe, and costs more per
completed case at the same list price. Its only advantage is speed, which does
not offset 42 fewer passed checks. The patch was reverted because nothing in
production needs it; apply it again to repeat the comparison with a later
model.

Raw reports and recordings were local artifacts under
`.cache/classifier-haiku-comparison-2026-10-10/`; their hashes are in the
[record](./model-claude-haiku-5-5-2026-10-10.json).
