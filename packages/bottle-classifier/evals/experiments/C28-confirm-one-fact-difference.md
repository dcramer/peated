# C28: confirm a one-fact difference before creating a Bottle

**Pending.** Recorded before the runs.

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

Pending.
