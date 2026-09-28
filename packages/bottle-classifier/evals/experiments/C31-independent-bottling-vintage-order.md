# C31: name independent bottlings as distillery, vintage, then age

**Pending.** Recorded before the runs.

## Problem

After C29 shipped, new review-backfill Bottles for independent bottlings kept
their printed vintage but in no consistent shape: `Rosebank 10-year-old, 1989
Vintage`, `Glenlivet 1968 Vintage 35-year-old`, `Cragganmore 15-year-old, 1989
vintage`. One, a Gordon & MacPhail Cask Strength Rosebank 1991, was named
`Rosebank 12-year-old`: an age that neither the source title nor the trade
listing prints, and no vintage.

Retailers, auction houses, and Whiskybase name these bottles distillery, then
vintage, then age, without the word `vintage`: `Glenlivet 1968 35 Year Old`
(The Whisky Exchange), `Rosebank 1991 Signatory Vintage 14 Year Old` (Whisky
Auctioneer), `Glenlivet 1968 DT` (Whiskybase). The identity model now states
that shape for a uniform label that features a distillery.

## Hypothesis

Stating that order and wording in the name field produces the trade name for
independent bottlings without changing names of official releases or of
independent bottlings whose label prints no vintage.

## Exact change

In the `ProposedBottleFields.name` description in
[`classifierTypes.ts`](../../src/classifierTypes.ts), the independent-bottling
sentence changes from "use that distillery with the title's age wording" to
"use that distillery followed by the vintage year and then the age that the
title or label prints, such as `Distillery 1990 20-year-old`; write the year
without the word `vintage`." Nothing else changes.

## Cases and decision rule

Control is the shipped C29 description (V0). Treatment adds this change (V1).
Both run the same test cases three times each, on GPT-6 Luna high, with a fresh
empty web replay directory per run. The four target cases come from saved
production runs read through `GET /audits/runs`.

Target cases:

- review: G&M Rosebank 1989 10-year-old (`Rosebank 1989 10-year-old` or
  `Rosebank 1989`)
- review: G&M Cask Strength Rosebank 1991, cask 1535 (`Rosebank 1991`, no age)
- review: Duncan Taylor Glenlivet 1968 35-year-old
- review: Signatory Cragganmore 1989 15-year-old (the case with different
  values that tests whether the rule generalizes)

Comparison cases that must keep their outcome:

- review: TBWC Paul John 6-year-old, an independent bottling with no printed
  vintage
- store listing: Whiskyland Glenturret 35-year-old, likewise
- review: Glen Breton 21-year-old cask 665, an official single cask
- review: Macallan 12-year-old Double Cask at 43%
- store listing: Creag Isle 12-year-old
- text-only listing: Elijah Craig Barrel Proof Batch C923, whose name must not
  gain an age
- Talisker 2001 The Distillers Edition, an official release that keeps its
  vintage

Keep the change if the target name checks pass at least 9 of 12 treatment runs
while the control passes at most half, no comparison case loses a pass it had
in the control, incorrect existing matches do not rise, and cost and time stay
within 15%. Run the full suite once if the focused result is a net win.

## Run log

A first run was stopped after one repeat of each version and is excluded. The
four target cases failed before the model ran in both versions: saved
production Entities can carry an empty `shortName`, which the eval harness
passed into a schema that requires a non-empty value. The harness now treats an
empty short name as missing, in both versions, and the runs restarted.

## Results

Pending.
