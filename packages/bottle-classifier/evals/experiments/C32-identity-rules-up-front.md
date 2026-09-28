# C32: state the identity rules once, up front

**Pending.** Recorded before the runs.

## Problem

The classifier's naming rule lived only in the `proposedBottle.name` field
description, an 800-character paragraph, while related rules appeared in
several places with different wording: edition wording in both the identity
and evidence policies, the bottler definition in the identity policy and a
search-tool field, and generic style words in the evidence policy and the
`name` description. The Bottle search tool's `expression` input described
itself as the "core release name after removing brand, age, ABV, and generic
style words", the opposite of the naming rule.

Each naming fix changed the long description and shifted unrelated names. In
the one completed C31 repeat, the treatment named Glen Breton
`21-year-old (Cask 665)`, Elijah Craig `Barrel Proof (Batch C923)`, and
Talisker 2001 The Distillers Edition `2001`, and gave Whiskyland Glenturret an
unprinted `1990`.

Provider guidance says contradictory or redundant instructions hurt
instruction-following models most, because they spend effort reconciling
them ([OpenAI GPT-5 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)),
and that schema descriptions should carry field meaning while policy stays in
the system prompt ([OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
Peated's [agent design policy](../../../../docs/policies/agent-design.md) says
the same: decision rules in the prompt, field meaning in the schema.

## Hypothesis

A short block of identity rules stated once near the top, with duplicates
removed and field descriptions reduced to meaning, gives consistent names
without losing match, create, or relationship accuracy.

## Exact change

- `instructions.ts`: add `<identity_rules>` after the mission, used by the
  reference and audit prompts, with eight one-line rules for Bottle identity,
  relationships, name, independent-bottling names, edition, style phrases,
  `identityScope`, and unknown facts. Remove the edition-wording and style-word
  bullets from the evidence policy, the edition, observation, and
  `identityScope` restatements from decision step 1, and the parts of the Brand
  and bottler paragraphs the rules now state. The input map says that
  `extractedIdentity.expression` omits age and style words and is not the
  Bottle name.
- `classifierTypes.ts`: `proposedBottle.name` and `identityScope` become
  one-line definitions that point to the identity rules. The search tool's
  `expression` input becomes search text, not a Bottle name.
- The extractor prompt and tools are unchanged.

## Cases and decision rule

Control is the production prompt (V0, `main` at 3376c371). Treatment is this
change (V1). Both run the same test cases three times each on GPT-6 Luna high,
with a fresh empty web replay directory per run.

Naming target cases: the four C31 independent-bottling cases, Macallan 12
Double Cask 43%, Shieldaig Speyside 21 and 30, Creag Isle 12, Black Label Islay
Origin 12, and the Exclusive Malts Islay photo case.

Comparison cases: Glen Breton cask 665, Elijah Craig Barrel Proof Batch C923,
Talisker 2001 The Distillers Edition, Whiskyland Glenturret 35, Cadboll Estate
Batch 2, Russell's Reserve Single Barrel Rye, Woodford Reserve Kentucky
Straight Malt, High West High Country (match), Clynelish 14 and TBWC Paul John
(source-error matches), and The Whistler Bodega Cask (review).

Keep the change if target name checks improve over the control, no comparison
case loses a pass it had in the control, incorrect existing matches do not
rise, and cost and time stay within 15%. If the focused result is a net win,
run the full suite once with a same-day control before accepting.

## Run log

A first start was stopped before any repeat finished, after a review against
the rebuilt agent-design-review skill found two gaps in the change: the
`identityScope` rule had moved into its schema description, and the input map
did not say that the extracted `expression` is not the Bottle name. Both were
added to the exact change above before the recorded runs.

## Results

Pending.
