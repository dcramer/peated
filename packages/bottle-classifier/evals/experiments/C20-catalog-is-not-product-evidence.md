# C20: catalog data does not prove a marketed release

**Rejected and reverted.** This experiment changed one classifier instruction.

## Problem

C18 gave Luna a typed package-only batch code, but Luna still treated the
matching local Bottle as proof that the code was a marketed edition. In one C19
web run, Firecrawl returned the same malformed Peated row and Luna used that
circular result to create another batch-specific Bottle.

## Hypothesis

State that a local Bottle candidate or Peated page which repeats an observed
package code is catalog data. It cannot prove that the producer markets a
separate release. Luna may still use producer or independent product evidence
to overturn the extraction when that evidence establishes a real edition.

## Checks and decision rule

Remove C19's candidate filter and final rejection, so Luna again receives both
High Country candidates. Run the High Country case three times with Luna high
and Firecrawl available. Keep the C18 typed observation as the only structured
change from the failed 0/3 C18 comparison.

Accept only if all three runs match Bottle 12825, no run creates or matches the
batch-specific Bottle, and true marketed batch and exact-cask controls remain
correct. Record model requests, web calls, tokens, cost, and time.

## Result

Two of three runs matched Bottle 12825. The failed run again matched Bottle
44284 after web results described `23J12` as a release. Across the three runs,
the classifier used 84,991 input tokens, including 72,036 cached tokens, 4,872
output tokens, 3,629 reasoning tokens, 11 model requests, six web calls, and
eight total tool calls. Estimated model cost was $0.010524. Median time was
23.48 seconds and total time was 72.22 seconds.

## Decision

Revert the instruction. It did not reach the required 3/3 accuracy and more
wording did not settle conflicting producer, retailer, auction, and Peated
results reliably.
