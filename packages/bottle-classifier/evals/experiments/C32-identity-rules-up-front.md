# C32: state the identity rules once, up front

**Focused result recorded; full suite not yet run.** V1d is the version on
the branch.

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

The first full focused run (V1a) lost two comparison cases the control
passed. All three V1a runs marked Glen Breton cask 665 and the Exclusive Malts
single cask as `product`: rule 7 named only an SMWS code as an example of an
exact cask. All three V1a runs created The Whistler Bodega Cask with a null ABV
instead of requiring review: rule 8 said to leave unsupported facts null but not
what to do when a disputed fact decides the Bottle. Rule 7 now names a
numbered single-cask release as well, and rule 8 says to return `no_match` when
a disputed fact decides which Bottle the source is. V1b reruns the treatment
against the same control runs; the control prompt did not change.

The Exclusive Malts test case, written for C29, required cask `1661` in the
name. The identity model now puts a printed cask number in `edition` or
`caskNumber`, so the case now requires `Islay`, `8-year-old`, and `2007`. This
correction was made after seeing the V1a result.

V1b passed 46 of 63 checks to the control's 27, with Glen Breton and The
Whistler back to the control's 2 of 3. It still broke the decision rule. Cadboll
Estate fell from 3 to 2 when one run took `Batch No. 2` from narrative prose.
The deleted evidence bullet had said that prose cannot change edition wording.
V1b also put category and retailer wording back into names:
`12-year-old Island Single Malt Scotch Whisky`,
`Speyside Single Malt 21-year-old Scotch Whisky`, and the retailer typo
`Speyside Sin Malt 30-year-old`. The test cases did not check for this. The old
`name` description had excluded category words and retailer titles, and rule 3
had dropped both. V1c adds them back to rule 3 and adds the prose limit to rule 5. The Creag Isle and Shieldaig cases now exclude `Single Malt`, `Scotch`, and
`Sin Malt`. Every control name for these cases passes the new checks, so the
control score does not change.

## Results

Three runs of the 20 focused cases per version, GPT-6 Luna high. Pass counts
use the corrected Exclusive Malts, Creag Isle, and Shieldaig checks; the
control's names pass the tightened checks, so its count does not change.

| Version | Passed | Cost      | Time   |
| ------- | ------ | --------- | ------ |
| V0      | 29/63  | $0.190075 | 2864 s |
| V1a     | 37/63  | +11.1%    | +7.5%  |
| V1b     | 46/63  | +10.5%    | +7.4%  |
| V1c     | 43/63  | +10.1%    | +13.9% |
| V1d     | 45/63  | +12.5%    | +11.1% |

V1d against the control:

- Target name checks rose from 13 of 30 to 27 of 30. Glenlivet 1968,
  Rosebank 1989, and Cragganmore 1989 went from 0 to 3; Rosebank 1991 from 0
  to 2; Black Label Islay Origin from 0 to 2; Exclusive Malts from 2 to 3.
- Talisker 2001 The Distillers Edition rose from 1 to 3, Glen Breton from 2 to
  3, and Elijah Craig from 2 to 3.
- Wrong existing matches held at 3 (High West twice, Macallan once).
- The Whistler fell from 2 to 1 and Woodford Reserve from 3 to 2, for the
  reasons in the run log.
- High West, Clynelish 14, TBWC Paul John, and Whiskyland fail in every
  version.

## Decision

V1d does not meet the strict rule: two comparison cases each lost one run.
Neither loss is in naming, and The Whistler varies from 0 to 3 across versions
on three runs. Every other condition holds. The branch ships V1d. The full
suite with a same-day control remains required before this record is marked
accepted.

V1c passed 43 of 63 checks. Its names were clean: `12-year-old`,
`Speyside 21-year-old`, and Cadboll `Batch 2` in all runs. It still broke the
decision rule. Russell's Reserve Single Barrel Rye fell from 3 to 1, named
`Single Barrel` in two runs, because rule 3 stripped every category word,
including one that tells a Brand's rye from its bourbon. Glen Breton (2 to 1)
and Woodford Reserve (3 to 2) each lost one run to `no_match`; the control
also returned `no_match` once for Glen Breton. V1d moves the category-word
limit to rule 6 and keeps a category word that tells the Bottle apart from the
Brand's other Bottles.

This is the fourth treatment measured against one control, so a focused win may
fit these cases. A full-suite run with a same-day control is required before
accepting any version.

V1d passed 45 of 63 checks at +12.5% cost and +11.1% time. Russell's Reserve
returned to 3 of 3 and Glen Breton reached 3 of 3. Names stayed clean except
one `12-year-old Island`. It still broke the decision rule on two cases. The
Whistler fell from 2 to 1: two runs created the Bottle with a null ABV instead
of requiring review. This case has scored 2, 0, 2, 3, and 1 across the control
and the four treatments, so three runs cannot separate these versions on it.
Woodford Reserve fell from 3 to 2 when one run chose the Entity
`Woodford Reserve Distillery` as distiller; the naming rules do not cover that
choice.
