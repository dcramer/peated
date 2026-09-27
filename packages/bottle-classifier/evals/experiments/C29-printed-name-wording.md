# C29: keep printed age, vintage, and cask wording in proposed names

**Pending.** Recorded before the runs.

## Problem

On 2026-09-27 the Whisky Advocate review backfill created 997 Bottles. In 467
of them the proposed `name` dropped printed title wording: age 350 times,
vintage 165, cask number 99, and featured distillery 35. Titles made of only a
Brand, an age, and style words became style-word names, such as `Single Malt
Scotch Whisky` for `Clynelish 14 year old, 43%`. Different releases then shared
one full name, which happened 55 times that day.

The `proposedBottle.name` field description told the model to omit traits
stored in other fields and to fall back to a style phrase. The
[Whisky Identity Model](../../../../docs/architecture/whisky-identity-model.md)
naming rule, settled 2026-09-16, says the name keeps printed age, vintage, cask
number, and strength wording. The classifier text was never updated.

## Hypothesis

A field description that states the identity-model rule makes proposed names
keep printed wording, without adding age words to names whose source prints
none.

## Exact change

Only the `ProposedBottleFields.name` description in
[`classifierTypes.ts`](../../src/classifierTypes.ts) changes. It now asks for
the common name as the producer's product title prints it, keeping the age,
vintage, cask number, and strength wording that the title prints, and adding
none that the title omits. Tools, limits, the decision policy, and validation
are unchanged.

## Test case corrections

These are measurement corrections, not classifier accuracy:

- Nine test cases written on 2026-08-31 expected the old rule. Their name
  checks now require the printed wording through
  `proposedBottleNameIncludes`. This reverses the M03 note that the shorter
  Creag Isle name remains correct; the 2026-09-16 naming rule supersedes it.
- Two new production-miss test cases: Macallan 12-year-old Double Cask at 43%
  and Glen Breton 21-year-old cask 665.
- Decision test cases without a local catalog now search their inspected
  Entities, as audit test cases already did. Only the new captured test cases
  use that path.

## Cases and decision rule

Control is the unchanged description (V0). Treatment is the new description
(V1). Both run the same test cases three times each, on GPT-6 Luna high, with a
fresh empty web replay directory per run.

Target cases, where the source prints age, vintage, or cask wording:

- review: Macallan 12-year-old Double Cask, 43%
- review: Glen Breton 21-year-old cask 665
- store listing: Shieldaig Speyside 21-year-old and 30-year-old
- store listing: Creag Isle 12-year-old Island Single Malt
- store listing: Black Label Islay Origin 12-year-old
- image-backed photo: The Exclusive Malts Islay 8-year-old 2007, cask 1661
  (the case with different values that tests whether the rule generalizes)

Comparison cases whose names must not change, because the source prints no age
or the marketed name is a style phrase:

- Watchpost `Whiskey`
- Woodford Reserve `Kentucky Straight Malt Whiskey`
- Compass Box `Hedonism²`
- Mars `Komagatake` 2022 Edition
- Russell's Reserve `Single Barrel Rye`
- Elijah Craig `Barrel Proof` Batch C923, whose title prints no age although
  its label does

Keep the change if target name checks pass at least 18 of 21 treatment runs
while the control fails most of them, the comparison cases pass as often as in
the control, incorrect existing matches do not rise, and cost and time stay
within 15% of the control. Run the full suite once if the focused result is a
net win.

## Run log

A first set of runs started at 22:05 UTC was stopped after one V2 run and
partial V0 and V1 runs, and is excluded. It showed two problems, fixed before
the recorded runs:

- The first wording said to keep "printed" age wording. V2 named Elijah Craig
  Barrel Proof Batch C923 `Barrel Proof 13-year-old`, taking the age from the
  label although the title prints none. The identity model and CLAUDE.md scope
  the rule to the title, so the wording now says so.
- The Glen Breton case required `665` in the name. The model put `Cask 665` in
  `edition`, which is valid and keeps the full name distinct. The case now
  requires `21-year-old` in the name and still checks `caskNumber` 665.

## Focused result

Runs finished 2026-09-27 between 22:13 and 22:51 UTC. V0 and V1 ran
concurrently, so neither version ran first. V1's figures are its runs of the
same 13 test cases.

Name checks on the target cases, out of three runs each:

| Case                                     | Control (V0) name                           | Treatment (V1) name                            |  Control | Treatment |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------------- | -------: | --------: |
| Macallan 12 Double Cask at 43%           | `Double Cask`, one wrong match to Bottle 25 | `12-year-old Double Cask`                      |        0 |         3 |
| Glen Breton 21 cask 665                  | `21-year-old` once, `no_match` twice        | same                                           |        1 |         1 |
| Shieldaig Speyside 21 and 30             | `Speyside`                                  | `Speyside 21-year-old`, `Speyside 30-year-old` |      0/6 |       6/6 |
| Creag Isle 12                            | `Island Single Malt Scotch Whisky`          | `12-year-old`                                  |        0 |         3 |
| Black Label Islay Origin 12              | `Islay Origin`                              | `Black Label Islay Origin`, once `no_match`    |        0 |         0 |
| Exclusive Malts Islay 8, 2007, cask 1661 | `Islay`, once `no_match`                    | `Islay 8-year-old 2007`                        |        0 |         0 |
| **Target name checks**                   |                                             |                                                | **1/21** | **13/21** |

Comparison cases, passes out of three:

| Case                                    | Control | Treatment | Note                                                                            |
| --------------------------------------- | ------: | --------: | ------------------------------------------------------------------------------- |
| Russell's Reserve Single Barrel Rye     |       3 |         3 |                                                                                 |
| Elijah Craig Barrel Proof Batch C923    |       3 |         3 | `Barrel Proof` in every run; no age added                                       |
| Woodford Reserve Kentucky Straight Malt |       1 |         2 | Treatment kept `Whiskey` 3/3; control dropped it twice                          |
| Watchpost Whiskey                       |       0 |         0 | `no_match` in every run of both versions                                        |
| Compass Box Hedonism²                   |       0 |         0 | Age, bottling year, and relationship misses in both                             |
| Mars Komagatake 2022 Edition            |       0 |         0 | Treatment wrote the edition as `Edition 2022` 3/3; control wrote `2022 Edition` |

| Measure                    | Control (V0) | Treatment (V1) | Change |
| -------------------------- | -----------: | -------------: | -----: |
| Passed                     |         8/39 |          21/39 |    +13 |
| Incorrect existing matches |            1 |              0 |     -1 |
| Total tokens               |    2,236,148 |      2,293,997 |  +2.6% |
| Cached input tokens        |    1,943,220 |      1,962,469 |  +1.0% |
| Output tokens              |      145,105 |        155,099 |  +6.9% |
| Reasoning tokens           |      114,668 |        124,327 |  +8.4% |
| Model requests             |          245 |            250 |     +5 |
| Firecrawl calls            |          104 |            113 |     +9 |
| Estimated model cost       |    $0.110444 |      $0.119209 |  +7.9% |
| Total case time            |    1,506.5 s |      1,561.3 s |  +3.6% |
| Median case time           |       34.7 s |         38.7 s | +4.0 s |
| 95th percentile            |       65.0 s |         68.4 s | +3.4 s |

The treatment passed 13 of 21 target name checks, below the 18 recorded before
the runs. The remaining misses are consistent rather than random: the Black
Label name kept the range but not `12-year-old`, the Exclusive Malts name kept
age and vintage but put the cask only in `caskNumber`, and Glen Breton returned
`no_match` twice in both versions. The Komagatake edition wording changed in
every treatment run, a new difference in a case that fails in both versions.

## Full-suite run

Pending.
