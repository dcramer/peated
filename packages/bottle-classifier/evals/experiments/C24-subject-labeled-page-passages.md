# C24: label product and component passages

**Stopped after the first control.** The unchanged classifier passed both
Watchpost targets when it received the exact producer page.

## Problem

The Watchpost producer page describes the complete blended whiskey beside two
component whiskies. The unchanged Luna high classifier copied the component
age and MGP relationship into whole-Bottle fields in both the text and photo
cases.

The classifier prompt already says to distinguish complete-Bottle facts from
component facts. The page tool still returns one flat excerpt, so Luna must
recover that distinction from prose.

## Hypothesis

Return the original page excerpt plus exact page passages sorted into
`wholeProduct` and `components`. Do not ask Firecrawl to infer Bottle fields.
Drop any extracted passage that does not occur in the page excerpt.

This should keep component-only ages and relationships out of the Bottle while
preserving a real whole-product age in a comparison case.

## Checks and decision rule

The planned comparison covered:

- the real Watchpost photo case, which must create Watchpost Whiskey with no
  stated age and only the supported Westland distiller;
- the text Watchpost case, which must keep the same whole-Bottle result; and
- a separate age-stated blend comparison, which must keep its stated age.

Use reviewed fixed web evidence so both versions receive the same page text.
Record model requests, web calls, input, cached input, cache writes, output,
reasoning tokens, estimated model cost, and time. The fixed calls measure Luna
only. Also record that a live Firecrawl page read rises from one credit for
highlights to five credits when JSON passage sorting is enabled.

Accept only if both Watchpost cases improve without losing the whole-product
age comparison. A promising focused result still requires the full suite.

## Control result

The unchanged classifier passed both Watchpost cases. It created the Bottle
with no stated age and kept only the expected Westland distiller. It did this
from the same flat page excerpt used before this experiment.

Hedonism² failed because Luna left both the 23-year age and 2023 bottling year
null. It did retain all three expected component distilleries. This is the
opposite subject error: the page says that the youngest whiskies in the blend
are 23 years old, and Luna treated that as component detail instead of the
Bottle's Scotch age statement.

Across the three cases, the control passed 2/3. It used 124,299 input tokens,
including 97,589 cached tokens and 26,662 cache-write tokens, plus 7,709 output
tokens and 5,733 reasoning tokens. It made 16 model requests and 13 tool calls.
Estimated model cost was $0.017878. Total time was 75.75 seconds and median
case time was 20.45 seconds.

The fixed calls do not measure live Firecrawl time or fees. A live highlights
read costs one Firecrawl credit. Adding JSON passage sorting would raise that
to five credits. Three exploratory structured reads took 4.46, 5.10, and 3.88
seconds. The first two also inferred wrong fields; only the last, passage-only
shape avoided field inference.

## Decision

Do not change the page evidence contract. The target failure did not reproduce
once the exact producer page was supplied, so subject labels had no Watchpost
accuracy to recover. The proposed runtime would also make page reads cost five
times as many Firecrawl credits. The controlled result points to exact-page
retrieval and source selection instead.
