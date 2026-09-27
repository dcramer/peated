# C28: confirm a one-fact difference before creating a Bottle

**Uncertain; reverted.** Duplicate creates on the two targets fell from 4/6 to
1/6, but mostly because the model returned `no_match`; it matched the right
Bottle once in six. One comparison case, a real new cask release, lost its only
create. By the rule recorded before the runs, the change is not kept.

## Problem

Related releases can differ only in ABV, batch, or year, and the classifier
correctly creates a Bottle when evidence shows such a release exists. Sources
also make mistakes. On 2026-09-27 the review backfill created duplicates from
two such mistakes:

- Whisky Advocate lists a 2012 Clynelish 14-year-old review at 43%. The
  official Clynelish 14 has been 46% in every market since its launch, and the
  only 43% Clynelish 14 was the Flora & Fauna bottling, discontinued before 2012. Production created a copy of Bottle 18758.
- Whisky Advocate names Batch 4 for a 54.7% That Boutique-y Whisky Company
  Paul John 6-year-old. Master of Malt, Whiskybase, and a second Whisky
  Advocate review put the 54.7% release in Batch 2. Production created a copy
  of Bottle 15878.

In both runs the model inspected the existing Bottle, saw the one differing
fact, and created a Bottle without asking whether a release with the source
value exists. In the Paul John run its own search returned the Batch 2 page.

## Hypothesis

Asking the model to confirm the differing release from evidence beyond the
source, and to match when other evidence places the release at the existing
Bottle's value, turns these creates into matches without blocking real
market or batch releases.

## Exact change

Decision policy step 7 in [`instructions.ts`](../../src/instructions.ts) gains
two sentences:

> When the source differs from an inspected candidate in only one fact, such as
> ABV, batch, or year, first confirm from evidence beyond the source that a
> release with the source value exists. If other evidence places the source's
> release at the candidate's value and none shows a release at the source
> value, treat the source value as a source error and match the candidate.

Everything else is unchanged. Both versions include the C29 name change.

## Cases and decision rule

Control is C29's treatment (V1). Treatment adds this change (V2). Both run the
same test cases three times each, on GPT-6 Luna high, with a fresh empty web
replay directory per run.

Target cases:

- review: Clynelish 14-year-old at a mistaken 43% (expects a match to 18758)
- review: TBWC Paul John 6-year-old with a mistaken batch (expects a match to 15878)

Comparison cases that must keep their outcome:

- review: Macallan 12-year-old Double Cask at 43%, a real US release beside a
  40% Bottle (expects a new Bottle)
- review: Glen Breton 21-year-old cask 665 (expects a new exact-cask Bottle)
- store listing: Cadboll Estate Batch 2 beside Batch 1 (expects a new Bottle)
- text-only listing: Elijah Craig Barrel Proof Batch C923 (expects a new Bottle)
- image-backed photo: High West High Country Batch 23J12 (expects a match)
- The Whistler Bodega Cask, where producer and exact-product ABVs disagree
  (expects review)

A match passes a target case. The record also counts duplicate creates and
`no_match` results separately: `no_match` is safe but does not pass.

Keep the change if duplicate creates on the targets fall from the control,
matches rise, no comparison case loses a pass it had in the control, incorrect
existing matches do not rise, and cost and time stay within 15%. Run the full
suite once if the focused result is a net win.

## Run log

A first run started at 22:05 UTC was stopped and is excluded, because the C29
name wording it shared was revised (see C29). In that one excluded V2 run,
Clynelish, Paul John, and the real 43% Macallan all returned `no_match`.

## Results

Runs finished 2026-09-27 between 22:13 and 22:51 UTC. V1 and V2 ran
concurrently, so neither version ran first.

Target outcomes over three runs each:

| Case                      | Control (V1)           | Treatment (V2)                  |
| ------------------------- | ---------------------- | ------------------------------- |
| Clynelish 14 at 43%       | 2 `no_match`, 1 create | 3 `no_match`                    |
| TBWC Paul John, "Batch 4" | 3 create               | 1 create, 1 match, 1 `no_match` |
| Duplicate creates         | 4/6                    | 1/6                             |
| Correct matches           | 0/6                    | 1/6                             |

Comparison cases, passes out of three:

| Case                                 | Control | Treatment | Note                                                         |
| ------------------------------------ | ------: | --------: | ------------------------------------------------------------ |
| Macallan 12 Double Cask at 43%       |       3 |         2 | Created 3/3 in both; one treatment name missed `12-year-old` |
| Glen Breton 21 cask 665              |       1 |         0 | Treatment returned `no_match` 3/3                            |
| Cadboll Estate Batch 2               |       3 |         3 |                                                              |
| Elijah Craig Barrel Proof Batch C923 |       3 |         3 |                                                              |
| High West High Country Batch 23J12   |       1 |         1 | Both chose Bottle 44284 in other runs                        |
| The Whistler Bodega Cask             |       0 |         1 |                                                              |

| Measure              | Control (V1) | Treatment (V2) |  Change |
| -------------------- | -----------: | -------------: | ------: |
| Passed               |        11/24 |          11/24 |       0 |
| Total tokens         |    1,703,304 |      1,639,223 |   -3.8% |
| Cached input tokens  |    1,456,585 |      1,394,335 |   -4.3% |
| Output tokens        |      109,804 |         98,733 |  -10.1% |
| Reasoning tokens     |       89,587 |         79,496 |  -11.3% |
| Model requests       |          168 |            160 |   -4.8% |
| Firecrawl calls      |           68 |             66 |      -2 |
| Estimated model cost |    $0.086570 |      $0.081567 |   -5.8% |
| Total case time      |    1,044.3 s |        904.0 s |  -13.4% |
| Median case time     |       38.7 s |         33.8 s |  -4.9 s |
| 95th percentile      |       75.1 s |         64.9 s | -10.2 s |

## Decision

Not kept. The rule made the model more cautious rather than better informed:
it stopped most duplicate creates, but it rarely found the evidence to match,
and it declined a real cask release that the control created once. That
breaks the recorded condition that no comparison case loses a pass. Three runs
cannot separate the Glen Breton loss from noise, since the control also
returned `no_match` twice there.

The two target test cases stay in the suite as known failures. A next attempt
should give the model a concrete way to look for the differing release, such as
a search that omits the disputed value, and should be measured with more runs
on the real-release comparison cases.
