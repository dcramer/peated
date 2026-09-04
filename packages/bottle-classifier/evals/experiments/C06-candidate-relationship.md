# C06: distinguish different Bottles from same-Bottle repairs

**Rejected and reverted.** The focused fixed-evidence comparison improved, but
the full suite failed two current safety expectations and lost more historical
passes than it gained.

## Hypothesis

Luna often establishes the source identity and identifies why a local candidate
is unsafe, then chooses the wrong consequence. A cask-specific or broad candidate
does not cover a distinct, fully supported source Bottle, so the classifier
should create. A malformed row for the same exact marketed Bottle needs review,
so the classifier should return no match. Making that relationship explicit in
the structured answer may align the action without another model request.

## Exact change

Add one required `candidateDisposition` object before the normal decision fields
in the model's structured answer. It contains a disposition, the relevant local
Bottle IDs, and one short note. The allowed dispositions are:

- `exact_safe_candidate`: the same marketed Bottle is safe to match;
- `same_bottle_needs_repair`: the same Bottle exists but a populated conflict
  needs catalog review;
- `only_different_bottles`: inspected candidates are siblings, broader, or more
  specific Bottles and do not cover the complete source identity;
- `identity_unresolved`: evidence cannot establish the exact source Bottle;
- `no_candidates`: no plausible local candidate exists.

The instruction ties safe exact candidates to match, same-Bottle repairs and
unresolved identity to no match, and different Bottles to creation when the
source identity is complete. The field is model reasoning data and is removed
before the public result. The existing evidence rules, tools, turn limit, and
server checks remain unchanged.

## Cases

| Case                                | Role and required result                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Masterson's French Oak Finish       | Target: create the uncoded finish beside a barrel-specific candidate               |
| Elijah Craig 18-year-old            | Target: create the uncoded product beside barrel 4040                              |
| Midwinter Act 12 Scene 9            | Target: create the complete scene beside a broader Act 12 row                      |
| Canadian Club Reserve 9-year-old    | Same-Bottle repair comparison case: keep `no_match` for the malformed Brand        |
| Compass Box Spice Tree Extravaganza | Same-Bottle repair comparison case: keep `no_match` for the malformed existing row |
| Penelope Batch 11                   | Exact-match comparison case: keep matching the exact batch                         |

The source evidence is fixed and reviewed for every case. Run three repeats per
version in unchanged/changed, changed/unchanged, unchanged/changed order with
Luna high and a two-query limit. Record full passes, actions, matched IDs,
incorrect existing matches, tokens, cache use, requests, tools, cost, and time.

Reject immediately if either same-Bottle repair comparison case creates a Bottle or the
exact-match comparison case stops matching. Accept only if target creations and total
passes improve materially without a comparison case or incorrect-match regression, and
the gain is worth the added output and time. A promising focused result requires
one full Luna high suite before the change can be kept.

## Focused result

The comparison used Luna high, the fixed C06 evidence pack, a two-query limit,
and unchanged/changed, changed/unchanged, unchanged/changed order. Fixed evidence
made no live web request.

| Measure                      | Unchanged case | Changed version | Change |
| ---------------------------- | -------------: | --------------: | -----: |
| Full eval passes             |          12/18 |           15/18 |     +3 |
| Incorrect existing matches   |              0 |               0 |      0 |
| Run failures                 |              1 |               0 |     -1 |
| Input tokens reported        |        182,334 |         189,593 |  +4.0% |
| Output tokens reported       |         16,556 |          18,367 | +10.9% |
| Total tokens reported        |        198,890 |         207,960 |  +4.6% |
| Cached input                 |        161,912 |         168,308 |  +4.0% |
| Cache write                  |         20,339 |          21,201 |  +4.2% |
| Reasoning tokens             |         11,408 |          12,135 |  +6.4% |
| Model requests               |             28 |              28 |      0 |
| Classifier tool calls        |             11 |              10 |     -1 |
| Total case time              |       531.92 s |        222.08 s | -58.3% |
| Median case time             |        12.92 s |         13.19 s |  +2.1% |
| 95th percentile case time    |       300.00 s |         18.08 s | -94.0% |
| Observed model cost          |      $0.028207 |       $0.030724 |  +8.9% |
| Adjusted observed model cost |      $0.029737 |       $0.030724 |  +3.3% |
| Adjusted fully uncached cost |      $0.058908 |       $0.059959 |  +1.8% |

One Masterson's unchanged attempt timed out without usage. It remains a run
failure in the accuracy and time totals. A separate unchanged attempt
passed in 10.45 seconds, used 6,981 tokens, and cost $0.001530. Adding only that
usage to the unchanged run gives the adjusted cost rows and a 1.0% increase
in total tokens. It does not replace the timed-out result.

The change moved Masterson's from 0/3 to 3/3. Midwinter, Penelope, Spice
Tree, and Canadian Club passed 3/3 in both versions. Elijah Craig created the
right 18-year Bottle in all six attempts, but every proposed name omitted the
age and therefore failed. No registered safety case regressed, so the
focused result qualified for the full suite.

## Full-suite result

The full changed suite used Luna high with web search disabled. It ran 105
cases once. This suite includes 93 classifications and 12 audits; the candidate
relationship field applied only to classifications.

| Measure                         | Full changed run |
| ------------------------------- | ---------------: |
| Full eval passes                |           72/105 |
| Classifier passes               |            66/93 |
| Audit passes                    |             6/12 |
| Timed-out classifier cases      |                2 |
| Cases with model usage          |              101 |
| Input tokens                    |        1,527,153 |
| Output tokens                   |          149,350 |
| Total tokens                    |        1,676,503 |
| Cached input                    |        1,332,379 |
| Cache write                     |          194,042 |
| Reasoning tokens                |          108,169 |
| Model requests                  |              244 |
| Tool calls                      |              112 |
| Total case time                 |       3,633.77 s |
| Median case time                |          14.44 s |
| 95th percentile case time       |          97.60 s |
| Observed model cost             |        $0.254524 |
| Cost if all input were uncached |        $0.484651 |

The two classifier timeouts were Shieldaig 30-year-old and the sampler bundle.
Two other cases were rejected before a model run, which explains the four cases
without usage.

The changed version failed two current `no_match` safety expectations. It matched the
out-of-scope Jameson Cold Brew product and proposed a new Glenglassaugh Bottle
despite an unresolved age and exact-cask conflict. Among 74 completed cases with
an explicit action expectation, it also returned `no_match` for five required
creations and matched two required creations to existing Bottles.

The saved no-web Luna high baseline predates three added cases and several
test case corrections, so its 75/102 score is not a direct comparison case. On 95 cases
whose names can be matched directly, the changed version gained three historical
passes and lost six. Lost passes included Macallan Classic Cut 2021, Black Label
Islay Origin, Maker's Mark, and a sampler-bundle timeout. This historical check
supports rejection but does not replace a paired full-suite comparison case.

## Decision

Reject and remove the required candidate relationship. The fixed-evidence gain
did not generalize to the no-web suite, and the changed version failed current safety
expectations. Its focused median time rose 2.1%, and its adjusted token and cost
increases were small, but those resource costs cannot justify worse safety and
fewer comparable passes.

The full suite was necessary because the focused result appeared positive. The
total reported model cost for C06 was $0.326950: $0.011965 for the invalid setup
run that exposed M07, $0.058930 for the paired comparison, $0.001530 for the
timeout sensitivity run, and $0.254524 for the full changed suite.

The [structured result](./C06-candidate-relationship.json) records the
measurements. The fixed evidence remains useful for later experiments.
