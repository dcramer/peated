# C37: define the classifier's decision vocabulary

**Decision: Entity rule accepted (B3); `webEvidence` definitions rejected
(B4).** Run alone, the Entity rule scored 191 of 213 against 189, held Canadian
Club Reserve 9 and Springbank 25 at 3/3, and added no wrong match. The
`webEvidence` definitions alone scored 185 against 191: the model chose `weak`
for local matches, which sends them to review. The first two bundled variants
were rejected; see each Results section.

## Problem

M11 left two undefined words in the classifier's decision contract.

- `webEvidence` has five values, but the output schema only says when to use
  `supportive`. Code treats `not_needed` and `supportive` as match anchors
  (`deriveAutomationTier`), so the model's reading of `not_needed` decides
  whether a match can be automatic. Nothing says what `not_needed`,
  `not_used`, or `weak` mean.
- Decision step 4 says "a conflicting populated field makes that candidate
  unsafe", but does not say which fields. The code's conflict check
  (`getBottleFieldConflicts`) only compares typed identity fields. In runs the
  model also treats stored Entity relationships as conflicts, such as a Brand
  that is also the distillery, and declines a match to the same marketed
  Bottle.

## Change

One change: define both words, with no examples.

- The `webEvidence` description gives one sentence per value. `not_needed`
  means local, label, or stored-reference evidence alone settles the action.
  `not_used` means web evidence could matter but none was gathered.
  `supportive` means web evidence other than the source listing supports the
  match or create. `weak` means web evidence was gathered but does not settle
  the action. `conflicting` means it contradicts the action.
- Step 4 names the typed identity fields that can conflict (category, age,
  ABV, vintage, bottling or release year, cask number, the cask-strength or
  single-cask flag, and edition). A stored Brand, bottler, or distillery
  relationship that looks wrong is catalog cleanup for Bottle Review, not a
  conflict. Name wording is left out on purpose; step 4's scope rules already
  cover it.

## Expected effect

Matches to the same marketed Bottle stop failing on stored Entity roles
(Trestle, Wild Turkey, Quinta). Tier choices that depend on `not_needed`
become steadier. Typed-field refusals and review-tier cases do not change.

Rejected if any wrong existing match appears, a typed-field refusal case turns
into a match, or a review-tier case moves to automatic.

## Cases

71 classifier cases: every `match_existing` and `ignore_or_reject` case, the
correction case, and every new-Bottle case with an expected tier. Targets:
Basil Hayden, Tomatin, Wild Turkey (both), Trestle, Quinta Ruban, and
Glenlivet Caribbean Reserve. The rest serve as comparison and safety cases.

## Settings and order

Controlled lane: `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high,
a fresh copy of the committed recordings per run. Variant A is `origin/main`
at `aa91f7f79`; variant B is the same commit plus this change. Three rounds;
in each round A and B run at the same time from separate checkouts.

## Results

Three rounds per variant over the 71 cases. Cases not listed passed every run
in both variants, including Tomatin and both Wild Turkey cases.

| Case                                       |    A (main) |  B (change) |
| ------------------------------------------ | ----------: | ----------: |
| Trestle Spirit of Eclipse (image)          |         1/3 |         3/3 |
| Ardbeg auction cask title                  |         1/3 |         2/3 |
| Macallan Classic Cut 2017 auction title    |         2/3 |         3/3 |
| Web evidence plus local candidate          |         2/3 |         3/3 |
| Basil Hayden dropped possessive            |         1/3 |         1/3 |
| 70-year-old sample auction title           |         1/3 |         0/3 |
| Retailer suffix text-only listing          |         3/3 |         2/3 |
| **Canadian Club Reserve 9 (review)**       |     **3/3** |     **0/3** |
| **Springbank 25 name-only (no annual)**    |     **3/3** |     **1/3** |
| Quinta Ruban, Clynelish 14, Paul John, ... |         0/3 |         0/3 |
| **Total**                                  | **188/213** | **186/213** |

The Entity sentence did what it said, in both directions:

- Trestle: variant A declined because the stored bottler was not shown on the
  label. B matched it, as expected.
- Canadian Club: the case expects review because the stored Brand is
  `Canadian`, not `Canadian Club`, and the case says the Brand must be fixed
  before assignment. B matched in every run, citing the new sentence ("Brand
  relationship cleanup is for Bottle Review and does not block assignment").

The typed-field sentence was read too broadly. In Springbank 25, B matched
the plain 25-year-old Bottle because it had "no conflicting populated identity
fields", passing over the annual-release ambiguity that step 4's scope rules
and the release-ambiguity risk are meant to catch. Naming the only fields that
can conflict made "no typed conflict" sound like enough to match.

The `webEvidence` definitions showed no separate effect in this slice.

## Open decision

Trestle and Canadian Club ask the same question with opposite answers: does a
stored Brand or bottler that the evidence does not support block a match to
the same marketed Bottle? The code leaves Brands to the agent
(`docs/architecture/bottle-classifier.md`, the `compareBottleFields`
paragraph), and neither the identity model nor the classifier doc says which
way the agent should go. A narrower retry depends on that answer.

## Retry plan

Owner decision (dcramer, 2026-10-25): a stored Brand, bottler, or distillery
relationship blocks a match only when evidence contradicts it. A relationship
the label does not show is not a conflict. Canadian Club stays review; Trestle
should match.

Variant B2 keeps the `webEvidence` definitions and replaces both step 4
sentences with: "A stored Brand, bottler, or distillery relationship conflicts
only when evidence contradicts it. A relationship the source does not show is
not a conflict." The typed-field list and the Bottle Review sentence are gone.

Same 71 cases, settings, and order as the first run, with A rerun beside B2.
Rejected on the same terms; Canadian Club and Springbank 25 must hold at 3/3.

## Retry results

Three rounds per variant over the same 71 cases. Cases not listed passed every
run in both variants.

| Case                                    |    A (main) |          B2 |
| --------------------------------------- | ----------: | ----------: |
| Canadian Club Reserve 9 (review)        |         3/3 |         3/3 |
| **Springbank 25 name-only (no annual)** |     **3/3** |     **2/3** |
| Penelope exact batch                    |         3/3 |         2/3 |
| Trestle Spirit of Eclipse (image)       |         2/3 |         2/3 |
| Ardbeg auction cask title               |         1/3 |         1/3 |
| Ordinary Ardbeg Ten auction title       |         2/3 |         2/3 |
| Whiskyland create                       |         2/3 |         2/3 |
| Basil Hayden dropped possessive         |         1/3 |         1/3 |
| Quinta Ruban 14                         |         1/3 |         0/3 |
| Hedonism², Clynelish 14, Paul John, ... |         0/3 |         0/3 |
| **Total**                               | **189/213** | **186/213** |

- Canadian Club: the narrower rule kept it at review in every run.
- Trestle: no B2 run cited the stored bottler. Its one B2 failure declined
  because the label calls the contents "spirits distilled from grain and
  hops", which is a category question, not the rule under test. Main's A run
  failure still cited the bottler.
- Springbank 25: the one B2 miss matched Bottle 469 with `webEvidence: weak`
  and no unresolved risk. `weak` is not an anchor, so code would send it to
  review rather than automatic, but the action is still wrong. Main passed
  this case 6 of 6 across both A/B runs; the two changed variants passed 3 of 6. Both variants carried the `webEvidence` definitions, so this change may
  be the cause, but the two changes were not run separately.
- Penelope: the one B2 miss declined because the batch sits in the stored
  name rather than `edition`; that is unrelated to either change.

The retry broke the experiment rule of one change at a time: it bundled the
`webEvidence` definitions with the Entity rule. Running each one alone is the
way to find which one moves Springbank 25.

## Split plan

Two single-change variants, run one after the other, each against main
(`aa91f7f79`) with the same 71 cases, settings, and three-round order.

- B3: the Entity rule alone, the B2 step 4 sentences without the
  `webEvidence` definitions.
- B4: the `webEvidence` definitions alone, with step 4 unchanged.

Each is rejected on the same terms as before: any wrong existing match, a
review case moving to automatic, or Canadian Club or Springbank 25 below 3/3.
B3 should keep Canadian Club at review and remove the stored-bottler reason
from Trestle. If Springbank 25 slips under B4 but not B3, the `webEvidence`
definitions caused it.

## Split results

Each variant ran three rounds beside a fresh main run. Cases not listed
passed every run in both.

### B3: Entity rule alone

| Case                                    |    A (main) |          B3 |
| --------------------------------------- | ----------: | ----------: |
| Canadian Club Reserve 9 (review)        |         3/3 |         3/3 |
| Springbank 25 name-only (no annual)     |         3/3 |         3/3 |
| Trestle Spirit of Eclipse (image)       |         1/3 |         2/3 |
| Cadboll Estate Batch 4                  |         1/3 |         3/3 |
| 70-year-old sample auction title        |         0/3 |         1/3 |
| Ardbeg auction cask title               |         2/3 |         2/3 |
| Basil Hayden dropped possessive         |         2/3 |         2/3 |
| Ordinary Ardbeg Ten auction title       |         3/3 |         2/3 |
| Lagavulin Distillers Edition 2023       |         3/3 |         2/3 |
| Hedonism², Clynelish 14, Paul John, ... |         0/3 |         0/3 |
| **Total**                               | **189/213** | **191/213** |

B3 added no wrong existing match. Its misses were declines, one Basil Hayden
review tier, and the same failures main shows: the 70-year-old sample case
matches Bottle 65654, Paul John creates a duplicate in every run, and
Clynelish 14 sometimes does (one B3 run; one main run in the B4 round). One of
the two Trestle misses still said the stored bottler was "not supported by
the label", so the rule does not settle Trestle every time.

### B4: `webEvidence` definitions alone

| Case                                    |    A (main) |          B4 |
| --------------------------------------- | ----------: | ----------: |
| Springbank 25 name-only (no annual)     |         3/3 |         3/3 |
| Canadian Club Reserve 9 (review)        |         3/3 |         3/3 |
| Basil Hayden dropped possessive         |         3/3 |         1/3 |
| Glenglassaugh age mismatch (no create)  |         3/3 |         2/3 |
| Cadboll Estate Batch 4                  |         3/3 |         2/3 |
| Ordinary Ardbeg Ten auction title       |         3/3 |         2/3 |
| Ardbeg auction cask title               |         2/3 |         1/3 |
| Trestle Spirit of Eclipse (image)       |         1/3 |         0/3 |
| Lagavulin Distillers Edition 2023       |         2/3 |         3/3 |
| Hedonism², Clynelish 14, Paul John, ... |         0/3 |         0/3 |
| **Total**                               | **191/213** | **185/213** |

- Basil Hayden: both B4 misses matched the right Bottle but labeled the web
  evidence `weak`, so the tier fell from automatic to review. Under the new
  wording, "gathered but does not settle the action" also fits a match that
  local evidence already settles.
- Glenglassaugh: one B4 run created a Bottle from the source title alone,
  where the case expects review.
- Springbank 25 held 3/3 under both B3 and B4. Its earlier slips came only
  from the bundled variants, so neither change alone reproduces them.

## Outcome

The Entity rule stays in decision step 4, and the owner's decision is recorded
in `docs/architecture/bottle-classifier.md` beside the `compareBottleFields`
paragraph. The `webEvidence` description is unchanged. A later attempt should
say that `weak` applies only when the action depends on web evidence.
