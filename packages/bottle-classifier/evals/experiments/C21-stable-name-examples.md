# C21: show both sides of stable Bottle naming

**Rejected and reverted.** The pair traded one corrected name for one new wrong
name. Full accuracy stayed 3/5, while token use and median time increased.

## Problem

Luna has dropped `Rye` from Russell's Reserve Single Barrel Rye even when the
producer uses it in the product heading. It has also retained the generic
`Scotch Whisky` suffix in Creag Isle's proposed name. The prompt already says
to preserve the stable marketed expression and ignore generic style words, but
it does not show how source authority changes that decision.

## Hypothesis and exact change

Add one stable, fictional pair after the Bottle evidence policy:

- A producer heading that includes `Single Barrel Rye` keeps those words in the
  Bottle name even though Rye Whisky is also the structured category.
- A retailer title ending in `Scotch Whisky 700ml` drops that type and package
  text when producer evidence gives a shorter stable product title.

The examples state the same rule in both directions: a structured category does
not decide which words belong in `name`; reviewed product naming does. No tool,
schema, field rule, turn limit, or check after Luna changes. The pair is part of
the static prompt prefix so it remains cacheable.

## Cases and run plan

Use Luna high and the reviewed fixed evidence pack
`evals/evidence/stable-name-examples.json`. Run each version three times in
unchanged/changed, changed/unchanged, unchanged/changed order.

| Case                                | Required behavior                                    |
| ----------------------------------- | ---------------------------------------------------- |
| Russell's Reserve Single Barrel Rye | Keep `Single Barrel Rye` and create the rye Bottle   |
| Creag Isle 12                       | Use `Island Single Malt` without `Scotch Whisky`     |
| Woodford Reserve Straight Malt      | Keep the marketed `Kentucky Straight Malt Whiskey`   |
| Maker's Mark core bourbon           | Use the producer heading without the retailer suffix |
| Black Label Islay Origin            | Keep the full marketed expression and resolved Brand |

Full expectation scores are primary. Record name correctness separately so an
unrelated Entity or category miss does not hide the prompt effect. Record
incorrect existing matches, actions, tokens, cache use, model requests, tools,
cost, median and 95th-percentile time, and every changed answer.

Reject the pair if it strips marketed type wording, changes a correct action,
adds an incorrect match, or produces no repeatable target gain. A promising
focused result must pass the full suite before acceptance.

## Result

The unchanged version failed Creag Isle by retaining `Scotch Whisky` and Black
Label by dropping `Black Label`. The changed version fixed Black Label but kept
the Creag Isle error and newly removed `Whiskey` from Woodford Reserve's exact
producer-backed name. Russell's Reserve and Maker's Mark passed in both runs.
All five actions remained correct creations, with no incorrect existing match.

| Measure                       | Unchanged | With examples |     Change |
| ----------------------------- | --------: | ------------: | ---------: |
| Full passes                   |       3/5 |           3/5 |          0 |
| Correct actions               |       5/5 |           5/5 |          0 |
| Incorrect existing matches    |         0 |             0 |          0 |
| Input tokens                  |   115,328 |       118,236 |     +2,908 |
| Cached input tokens           |    88,718 |        93,356 |     +4,638 |
| Cache-write tokens            |    26,559 |        24,829 |     -1,730 |
| Output tokens                 |     9,690 |         9,758 |        +68 |
| Reasoning tokens              |     7,091 |         7,163 |        +72 |
| Total tokens                  |   125,018 |       127,994 |     +2,976 |
| Model requests                |        17 |            17 |          0 |
| Tool calls                    |        11 |            11 |          0 |
| Estimated model cost          | $0.020052 |     $0.019794 | -$0.000258 |
| Total case time               |  113.54 s |      121.25 s |    +7.71 s |
| Median case time              |   20.70 s |       25.74 s |    +5.04 s |
| 95th percentile, nearest rank |   35.53 s |       32.85 s |    -2.68 s |

The small measured cost decrease came from cache variation, not less work. The
changed prompt used more total tokens. The first unchanged attempt could not
reach the model endpoint and is recorded as an infrastructure failure with no
usage; it is excluded from this comparison.

## Decision

Reject after the first valid pair because the predeclared stopping rule was
met: the example removed producer-marketed wording from a comparison case. More
repetitions cannot make that regression acceptable. The failure shows that an
example about generic type text can be applied too broadly unless both examples
turn on the same word and differ only in whether the producer heading keeps it.
