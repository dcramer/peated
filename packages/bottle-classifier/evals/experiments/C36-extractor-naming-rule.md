# C36: align the extractor's name fields with the naming rule

**Decision: Accepted.** 107 of 132 checks against 99, with no wrong existing
match and batch codes kept in `edition`. Octomore 13.1 now extracts whole but
still fails at the classifier; see Results.

## Problem

The identity model's single naming rule keeps a release number or title that
people use as the bottle's name: a numbered release, a volume, a chapter, or
an act and scene. The label extractor still told the model the opposite:

- `expression` was "the core release name after removing" words;
- the `series` guidance used a producer's yearly release generation as its
  example of a range, and also named an eval family;
- the `edition` guidance listed a volume number as an example edition.

C35 showed the cost: once the copied Octomore example left the prompt, text
extraction split `Octomore 13.1` into series `Octomore 13` and edition `13.1`
in every run, and the classifier declined.

## Change

One change, in the extractor's field guidance only (the extraction output
schema carries no field descriptions, so this guidance is its whole contract):

- `expression` is the name people use after the brand, as the title and label
  print it, and keeps a release number or title whole.
- `series` is only a named range the producer markets above several different
  releases; a release-counting number, batch code, or release year is not a
  series.
- `edition` holds batch, selection, market, or release-code facts that are not
  part of the name. The volume example and "numbered edition" are removed.

No examples are added. The classifier prompt, which already follows the naming
rule, is unchanged.

## Expected effect

Octomore 13.1 recovers without its copied example. Numbered and annual
releases keep their release words in `expression`. Batch editions (Elijah
Craig C923) and store-pick codes stay in `edition`. Plain names, ignores, and
SMWS codes do not change.

Rejected if a comparison case regresses consistently, a batch moves out of
`edition`, or any wrong existing match appears.

## Cases

All 30 classifier cases whose text extraction runs live in the controlled lane
(captured extractions and image cases are fixed, so this change cannot reach
them), plus the 14 image-extraction checks, which always read images live.

## Settings and order

Controlled lane: `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high
for classification and extraction, a fresh copy of the committed recordings
per run. Variant A is `origin/main` at `bc45ab38b`; variant B is the same
commit plus this change. Three rounds; in each round A and B run at the same
time from separate checkouts.

## First attempt (discarded)

The first variant also edited three field descriptions that turned out to
belong to the classifier's `search_bottles` tool input, not the extraction
schema. That changed the classifier's tool contract as well as the extractor,
so its result (96 of 132 against 101) could not be attributed to either change.
The tool descriptions were restored and the A/B was run again with the
extractor guidance alone. The tool's `series` description still names an eval
family (`Distillers Edition`); that is left for a separate change.

## Results

Three rounds per variant over the 30 live-text classifier cases and the 14
image checks. Cases not listed passed every run in both variants.

| Case                                                   |   A (main) |  B (change) |
| ------------------------------------------------------ | ---------: | ----------: |
| Macallan Classic Cut 2021 Edition                      |        1/3 |         3/3 |
| Elijah Craig Barrel Proof Batch C923                   |        1/3 |         2/3 |
| Quinta Ruban 14                                        |        0/3 |         1/3 |
| Talisker 2001 The Distillers Edition                   |        2/3 |         1/3 |
| Octomore 13.1                                          |        0/3 |         0/3 |
| Image: Compass Box Hedonism²                           |        0/3 |         3/3 |
| Image: John Crabbie (ABV)                              |        0/3 |         3/3 |
| Image: Beauchamp (ABV)                                 |        0/3 |         1/3 |
| Image: Willett barrel 4769                             |        2/3 |         1/3 |
| Image: SMWS 95.71                                      |        3/3 |         2/3 |
| Image: Rogues' Banquet, Spice Tree, Pōkeno, SMWS 1.285 |        0/3 |         0/3 |
| **Total**                                              | **99/132** | **107/132** |

The two ABV image gains are probably not caused by this change, which does not
touch ABV reading; treat them as run variance. Talisker, Willett, and SMWS
95.71 moved by one run each, within their history.

Octomore 13.1 now extracts as expression `13.1` (or `Octomore 13.1`) with no
series split, as intended. The classifier still returns `no_match` for
insufficient evidence: the case gives it no local candidates and an empty
evidence pack, and the classifier rules say a source title alone is not enough
to create a Bottle. Under that rule the case's `create_bottle` expectation is
questionable. Production now holds Octomore 13.1, so a production-shaped
version of the case would include the existing Octomore Bottles as candidates.

## Review fix

The PR's first CI run passed the gate at 81.6%. Review then found a
normalization rule later in the extractor prompt that still told the model to
split "a stable family phrase followed by a numbered or coded variant label"
into `expression` and `edition`, which contradicts the new `expression`
guidance for numbered releases. The rule now covers only batch, selection,
market, and release codes that are not part of the name, and says a release
number people use as the name stays whole in `expression`.

## Follow-up

- Decide the Octomore 13.1 expectation (review for a bare title, or a
  production-shaped case with local candidates).
- The classifier's `search_bottles` tool still names an eval family as its
  `series` example.
