# C28: parallel tool calls

**Rejected and reverted.** Letting the classification agent request several
tool calls in one turn did not make it faster, and accuracy did not improve.
With no speed gain there is no reason to accept the change.

## Problem

Production traces on 2026-09-26 showed each review classification spending
most of its time in sequential agent turns (median 30 s, 95th percentile 67 s
per agent run). Every catalog or web lookup cost a full model turn because
`parallelToolCalls` was `false`. The classification tools only read, and the
web budget counts searches and page reads in one synchronous step, so running
a turn's tool calls together is safe.

## Hypothesis and exact change

Allowing several lookups per turn should cut turns and wall time without
changing what the agent looks at. The only change was
`parallelToolCalls: true` on the reference classification agent in
`classifierRuntime.ts`. Bottle audits stayed serial because their proposal
limit assumes one tool call per turn.

## Settings

Both versions ran the full `src/classifier.eval.test.ts` suite once, at the
same time, from source commit `544aae3a9`: `gpt-6-luna` at high reasoning
effort for classification and image extraction, at most two web searches, the
production 18-turn limit, live Firecrawl web access, and separate empty
replay directories. No fixed evidence pack covers the suite, so both runs used
live web results.

## Results

| Measure                     | Unchanged | Parallel tool calls |
| --------------------------- | --------: | ------------------: |
| Passed                      |    80/105 |              77/105 |
| Wrong existing Bottle match |         2 |                   2 |
| Run errors                  |         0 |                   0 |
| Median case time            |    21.8 s |              22.3 s |
| 95th percentile case time   |    51.6 s |              49.9 s |
| Total case time             |   2,490 s |             2,455 s |
| Model requests              |       454 |                 438 |
| Tool calls                  |       325 |                 351 |
| Firecrawl calls             |       183 |                 188 |
| Input tokens                | 3,505,051 |           3,340,022 |
| Cached input tokens         | 3,160,226 |           3,004,103 |
| Output tokens               |   259,127 |             269,857 |
| Reasoning tokens            |   203,849 |             213,443 |
| Estimated model cost        |   $0.2004 |             $0.2012 |

Time and model requests barely moved: a turn's time is mostly the model's own
reasoning, not tool waits. Case-level results across the 103 reported cases:
eight passed only unchanged and four passed only with parallel calls. The
three lost existing matches (Elijah Craig Cask Strength, Trestle photo,
Laphroaig Càirdeas listing) returned `no_match`, not a wrong Bottle; the
Whistler Bodega Cask case created a Bottle where review was expected. Bottle
audits, which this change does not touch, scored 8/12 and 9/12, which shows
the size of run-to-run noise.

## Decision

Rejected: no measurable speed gain, and accuracy did not improve. The setting
stays `false`.
