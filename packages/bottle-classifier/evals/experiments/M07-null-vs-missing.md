# M07: keep null distinct from missing

**Accepted as a measurement correction.** The classifier is unchanged.

## Problem

M01 made creation failures precise by passing the actual and expected
`proposedBottle` values to a subset-difference helper. Its call site used nullish
coalescing, so an actual `proposedBottle: null` became `undefined`. A test case
that explicitly expected null then failed with `proposedBottle expected null but
was missing` even though the returned value was correct.

C06's first comparison case exposed this on Canadian Club Reserve 9-year-old. The model
returned the required `no_match`, `matchedBottleId: null`, and
`proposedBottle: null`. The other checks passed.

## Change

Pass `result.decision.proposedBottle` directly to the difference helper. The
helper already treats null and missing as different JSON values. Add a direct
null-versus-null assertion beside the existing nested null checks.

Three current decision test cases explicitly expect `proposedBottle: null`. The
change can only correct their field comparison; it does not alter a model input,
output, action, or classifier decision.

## Verification

- Exact-field difference tests: passed.
- Full deterministic package suite: 402 passed.
- Package typecheck: passed.

The invalid C06 initial report remains setup evidence and will not be used in
the C06 comparison. Its observed model cost is recorded with that experiment.
