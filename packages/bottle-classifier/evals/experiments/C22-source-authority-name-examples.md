# C22: contrast producer and retailer name authority

**Rejected and reverted.** The pair made two names more consistent but did not
improve full accuracy. Creag Isle and Black Label each regressed on another
required field.

## Hypothesis and exact change

Add one fictional pair after the Bottle evidence policy:

- Keep `Whiskey` when it appears in the producer's exact product heading.
- Drop `Canadian Whisky` and package volume when they appear only as a generic
  retailer suffix after a distinctive expression.

The pair does not use any fixture Brand, expression, category, or exact wording.
It changes no tool, schema, field rule, turn limit, or check after Luna. It stays
in the static prompt prefix.

## Cases and decision rule

Use Luna high and `evals/evidence/stable-name-examples.json` with the same five
cases and measures as C21. First run the changed version once against C21's
valid unchanged run. Stop immediately for any new name or action regression.
If the result improves without a regression, complete three attempts per case
in unchanged/changed, changed/unchanged, unchanged/changed order.

Accept only for a repeatable target gain with no loss on Woodford Reserve,
Maker's Mark, Black Label, or the actions. A promising focused result still
requires a full-suite run.

## Result

Both versions passed 10/15 complete expectations and returned the correct
creation action in all 15 attempts. The examples changed which fields failed:

- Black Label's name improved from 1/3 to 3/3, but its required category fell
  from 3/3 to 1/3.
- Woodford Reserve's name improved from 2/3 to 3/3.
- Creag Isle's name fell from 1/3 to 0/3.
- Russell's Reserve and Maker's Mark stayed correct 3/3.

| Measure                       | Unchanged | With examples |     Change |
| ----------------------------- | --------: | ------------: | ---------: |
| Full passes                   |     10/15 |         10/15 |          0 |
| Correct names                 |     10/15 |         12/15 |         +2 |
| Correct actions               |     15/15 |         15/15 |          0 |
| Incorrect existing matches    |         0 |             0 |          0 |
| Input tokens                  |   309,993 |       278,457 |    -31,536 |
| Cached input tokens           |   269,660 |       247,573 |    -22,087 |
| Cache-write tokens            |    40,195 |        30,761 |     -9,434 |
| Output tokens                 |    28,333 |        25,837 |     -2,496 |
| Reasoning tokens              |    21,119 |        18,945 |     -2,174 |
| Total tokens                  |   338,326 |       304,294 |    -34,032 |
| Model requests                |        46 |            41 |         -5 |
| Tool calls                    |        28 |            23 |         -5 |
| Live Firecrawl calls          |         0 |             0 |          0 |
| Estimated model cost          | $0.049469 |     $0.043671 | -$0.005798 |
| Total case time               |  319.81 s |      334.95 s |   +15.14 s |
| Median case time              |   19.47 s |       21.89 s |    +2.42 s |
| 95th percentile, nearest rank |   36.64 s |       33.39 s |    -3.25 s |

The examples used 10.1% fewer total tokens and cost 11.7% less in these runs,
but that resource change did not buy an accuracy gain. Median time rose 12.4%.
The fixed evidence pack prevented live-web differences between versions.

## Decision

Reject. More consistent output on two names does not offset a complete miss on
Creag Isle and two new Black Label category misses. This boundary depends on
the authority and shape of the supplied product evidence. A small prompt pair
did not make Luna apply it reliably without moving another judgment.
