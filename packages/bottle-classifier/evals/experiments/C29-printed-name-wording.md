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

## Results

Pending.
