# Bottle classifier evaluation, September 2026

This study compared model settings, corrected unreliable checks, reviewed
specific failures, and tested twenty-two classifier changes. The detailed run
records live under
[`packages/bottle-classifier/evals`](../../packages/bottle-classifier/evals/README.md).

## Current measured baseline

The classifier now uses `gpt-5.6-luna` with high reasoning effort. The
[recorded baseline](../../packages/bottle-classifier/evals/baselines/2026-09-03-luna-high-current.json)
pins the source commit, test-case hashes, run settings, and raw report hash. The
latest live web run checked 105 cases:

| Measure                             | Result    |
| ----------------------------------- | --------- |
| Passed                              | 80/105    |
| Failed                              | 25/105    |
| Wrong existing Bottle selected      | 1         |
| Timeouts                            | 1         |
| Median time per case                | 17.90 s   |
| 95th percentile time                | 74.10 s   |
| Measured model cost                 | $0.336861 |
| Cases with model usage available    | 100/105   |
| Tokens in those 100 cases           | 2,876,104 |
| Firecrawl search or page-read calls | 143       |

The cost and token totals are lower bounds because the timed-out case did not
report usage. This is one live run with changing web results and model output.
It is the starting point for later work, not a production accuracy estimate.
The wrong selection was High West High Country: Luna chose a batch-specific
Bottle instead of the expected ongoing product.

The earlier Luna high web run passed 73 of 102 cases. The two totals are not a
direct accuracy comparison: the current set has three more cases, eight
corrections to the checks, and four accepted classifier changes. Future work
should compare against this 105-case baseline and report any changed answers,
not just the pass count.

## Changes we kept

Six changes solved a specific problem without adding broad instructions:

1. **Reject an unsupported cask-specific match.** Luna repeatedly matched a
   general product to a Bottle whose cask code appeared only in the candidate
   name. The classifier now rejects that assignment unless the source supports
   the same code. Two known unsafe shapes are covered, while batch, release,
   age, proof, ABV, and supported exact-cask matches remain allowed.
2. **Reuse an exact accepted Entity Reference.** When Luna chooses an Entity
   name that has one exact accepted local reference, the classifier attaches
   that Entity's ID and stored name. This corrected the Mars distillery in
   the saved run and left the other nineteen exact choices unchanged. It adds
   no model request.
3. **Skip Luna for an exact accepted Bottle Reference.** The server now returns
   the assigned Bottle directly when one active Bottle Reference matches the
   input exactly. Four saved Luna runs had spent 28,893 tokens and $0.003529 on
   two decisions already settled by Peated. This path uses no model tokens.
4. **Read one exact source page when a new Bottle lacks facts.** If a verified
   code establishes a new Bottle from title text, the classifier reads the
   supplied page before Luna runs. The SMWS case improved from 0/3 to 3/3 by
   recovering supported age and ABV. Nine controls passed, and the full suite
   made this extra read for only the intended case. The affected case added one
   Firecrawl request and an average $0.000156 in model cost.
5. **Preserve composed SMWS codes through final review.** The cask safety check
   discarded `1.285` after the image path had correctly composed it from
   separate society and cask numbers. Final review now uses the verified
   composed code. All deterministic controls passed, and the full Luna run
   matched Bottle 11940. The check adds no model work.
6. **Keep the raw label transcription.** Photo identification previously
   rebuilt evidence from structured fields and discarded the extractor's
   `rawLabelText`. It now passes that text through so a visible code is not lost
   merely because it was omitted from a structured identity field. This adds no
   model work and does not decide what the code means.

These rules contain no product names from the test cases. They rely on accepted
Peated references, exact identifiers, and the source URL already supplied with
the input.

## Changes we rejected

Broad prompt changes and broad source-page reading did not hold up:

- A general release-identity instruction reduced correct results and increased
  wrong matches.
- Asking Luna to read every incomplete source page kept accuracy flat, made
  more calls, caused one regression, and timed out once.
- Automatically reading pages for many weak inputs tried fourteen pages to
  improve one case; nine pages could not be read.
- A separate source-identity model pass increased cost by 58.7% and reduced
  correct results.
- A general candidate-relationship field improved the small selected set but
  failed safety checks and lost six earlier passes in the full run.
- Removing ordinary lot codes from `edition` corrected extraction 3/3 but did
  not change the classifier's wrong choice.
- A separate typed package-code field still selected the wrong Bottle 3/3.
- Filtering the lot-specific candidate passed without web tools, but a
  web-enabled run created a duplicate; the result was correct only 2/3.
- Telling Luna that catalog data is not product evidence was also correct only
  2/3 and selected the wrong Bottle once.
- A positive and negative Bottle-name pair fixed one name but stripped a word
  from a different producer-backed name. Full accuracy stayed 3/5.
- A narrower pair based on producer versus retailer authority made two names
  more consistent, but full accuracy stayed 10/15. It lost the only Creag Isle
  pass and changed Black Label's correct category in two runs.
- Telling Luna to read a result after exhausting search produced no Octomore
  gain. The unchanged version passed 9/9 focused judgments; the changed version
  passed 7/9, cost 6.6% more, and made the median case 41.9% slower.
- Short true, false, and unknown examples for strength and single-cask fields
  improved focused results from 6/9 to 8/9, while focused cost rose 31.5% and
  time rose 5.5%. A later broad run returned 78/105 beside a saved 80/105 run.
  Correcting ambiguous Whistler and Woodford expectations makes the scores
  78/105 and 80/105, but the runs used different source revisions and still
  cannot measure the examples. The later run did contain an unsupported
  exact-cask creation.

These results favor small code checks for facts Peated already knows. Extra
prompt text and extra model passes need a stronger measured gain.

## Corrections to the checks

Ten measurement changes make later comparisons more trustworthy. They show
the exact field that failed, keep an expected `null` distinct from an omitted
value, allow reviewed audit outcomes without accepting unrelated edits, and
give compared versions the same reviewed web and image evidence. We also fixed
expectations for Jameson Cold Brew, several product names and categories, an
unsupported SMWS release year, and two name-only sources that cannot identify a
complete release. These corrections are not classifier gains.

## What remains

The expensive audit traces did not support a shorter run. Dramfool corrected
one missing target citation and passed. Laphroaig corrected two different
rejections before recording an update. Its remaining error was choosing an
update instead of a duplicate merge. A shorter turn limit would remove useful
recovery rather than solve that choice.

The flat-page hypothesis did not survive its first control. The unchanged
classifier handled both Watchpost inputs correctly when it received the exact
producer page: it left the component age off the Bottle and kept the expected
Westland distiller. Structured Firecrawl JSON would raise each page read from
one credit to five, so there was no target gain to justify it.

The old Octomore 13.1 retrieval failure did not reproduce consistently. The
unchanged classifier passed Octomore in all three new runs by reading a page or
using strong search evidence. Extra page-read guidance appeared in only one
changed run, produced no gain, and did not prevent two other failures. The
change was reverted without a full-suite run.

Paired Boolean examples remain inconclusive. They reliably carried the target
cask-strength and multi-barrel facts in focused runs, but used more money and
time. A broad run borrowed an exact cask from web evidence for a source that
named only a broader batch, producing an unsupported Glenglassaugh creation.
Its saved control came from different code, so that output cannot be assigned
to the examples. The schema wording was reverted pending a same-revision
comparison.

Other repeated problems have separate causes:

- stable Bottle naming still varies, but two general example pairs did not
  improve complete results safely;
- some web passages mix whole-product facts with component facts;
- changing catalog state can make a historical wrong-candidate case obsolete;
- changing retailer pages can disagree with an older expected release; and
- several audit runs omit supported changes or spend too many turns retrying.

Each needs its own test and controls. A result should be kept only when the
accuracy gain is worth its model cost, Firecrawl use, tokens, and time.

## Limits on generalization

The accepted rules are broader than the individual examples because they use
exact references and identifiers rather than brand-specific wording. Each was
checked against cases that must remain unchanged, and the source-page change
was checked in the full suite. Still, the source-page accuracy gain comes from
one distinct new-Bottle case. A second product with the same input shape would
provide stronger evidence that this last rule generalizes.
