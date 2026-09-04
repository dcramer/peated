# C19: exclude a candidate built from an observed package code

**Rejected and reverted.** This experiment used the typed C18 observation
before and after the model decision.

## Problem

Luna selected the batch-specific High Country Bottle in all three C18
classifier runs even though image evidence explicitly marked the matching code
as a package observation.

## Hypothesis

When the source has no marketed `edition` and image extraction supplies an
observed batch or lot code, remove an initial candidate whose edition is exactly
that code. This does not select another Bottle. Luna still decides among the
remaining candidates. If a later search returns the excluded shape and Luna
selects it, final review downgrades the match to `no_match`.

## Checks and decision rule

Use deterministic tests to prove that the package-code candidate is removed,
the ongoing candidate remains, marketed editions are unchanged, and a matching
candidate returned later is rejected. Then run the controlled High Country case
three times with Luna high.

Accept only if all three runs select Bottle 12825, there are no incorrect
existing matches, and the change adds no model requests, web requests, or
material token and time cost compared with the C18 runs.

## Result

The first implementation filtered only initial candidates. Luna called
`search_bottles`, received Bottle 44284 again, selected it, and final review
changed the result to `no_match`. Applying the filter to tool results produced
three correct no-web runs.

With Firecrawl available, only two of three runs matched Bottle 12825. The
other run created a new batch-specific Bottle. Across the web-enabled runs the
classifier used 131,169 input tokens, including 116,658 cached tokens, 6,206
output tokens, 4,372 reasoning tokens, 17 model requests, seven web calls, and
14 total tool calls. Estimated model cost was $0.013406. Median time was 26.81
seconds and total time was 103.66 seconds.

A full no-web check passed 75/105 cases, used 1,681,287 tokens and $0.243542,
and had a 12.61-second median. It is not comparable to the saved web-enabled
80/105 baseline. It did confirm the SMWS and High Country targets and showed no
wrong existing-Bottle selection.

## Decision

Revert the filter and final rejection. They prevented the known wrong match,
but one web run created a duplicate and the filter trusted fallible extraction
strongly enough to hide a possibly valid marketed batch candidate.
