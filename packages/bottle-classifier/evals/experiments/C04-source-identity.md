# C04: establish source identity before candidate choice

**Rejected and reverted.** The candidate-blind pass described the source
identity correctly, but it reduced full passes from 11/15 to 9/15 while raising
tokens, cost, and time.

## Hypothesis

Luna can first reason from a candidate and then use evidence about that
candidate as if it described the source. A separate candidate-blind model pass
could classify each source detail as a marketed release trait, observed-only
fact, or unresolved fact before the existing classifier sees local candidates.
The main classifier would receive that record with its evidence.

This adds a model pass, so it needs a clear reduction in unsupported existing
matches. It must also preserve valid coded-release matches.

## Initial check

First give the current classifier the same reviewed source evidence for the
three known failures:

| Case                          | Required result                                                     |
| ----------------------------- | ------------------------------------------------------------------- |
| Elijah Craig 18-year-old      | Create the uncoded product; do not match barrel 4040                |
| Masterson's French Oak Finish | Create the uncoded finish; do not match barrel F2-038               |
| High West High Country        | Match ongoing Bottle 12825; treat 23J12 as observed lot information |

Run one Luna high unchanged attempt per case with the fixed C04 evidence pack. If
all three pass, stop because fixed evidence already resolves the failures. If
at least two still make unsupported matches, build the candidate-blind pass and
compare three repeats per version.

The initial check passed High Country. Elijah Craig stopped making the unsafe match and
correctly chose creation, but omitted `18-year-old` from the proposed name.
Masterson's still made the unsafe barrel F2-038 match. Two of three therefore
failed the full expectation, and one remained an incorrect existing match.

## Exact change

For references with at least one local candidate, run one candidate-blind Luna
high call before the existing classifier. It receives the reference, extracted
identity, image evidence, and fixed web evidence. It returns a list of source
traits, each marked `marketed_release`, `observed_only`, or `unresolved`, with a
plain evidence note. The existing classifier receives this record with its
normal candidates and tools.

The classifier instruction says an observed-only trait cannot select a coded
Bottle, an unresolved trait cannot support a match or creation, and a
candidate-only release or cask code remains unsupported when the source record
does not establish it as marketed identity. The first pass has no catalog tools,
so it cannot see or choose a candidate.

Run three paired repeats of these five cases:

| Case                          | Role                                       |
| ----------------------------- | ------------------------------------------ |
| Masterson's French Oak Finish | Unsafe barrel-specific match target        |
| Elijah Craig 18-year-old      | Uncoded creation and complete-name target  |
| High West High Country        | Observed-only lot-code target              |
| Penelope Batch 11             | Valid marketed-batch match comparison case |
| Cadboll Estate Batch 4        | Valid marketed-batch match comparison case |

Use the same fixed evidence pack and alternate unchanged/changed,
changed/unchanged, unchanged/changed. Reject the pass if either valid batch
comparison case regresses. Because the change adds a request to every candidate case,
accept only if it removes the unsafe Masterson's match reliably and produces a
material net accuracy gain that justifies its measured cost and time.

The full comparison must also include differently named valid coded-release
comparison cases. Record wrong existing matches separately from field-level failures,
plus tokens, cache, requests, tools, cost, and time. Accept only a substantial
wrong-match reduction that justifies the extra pass and has no coded-release
regression.

## Results

The comparison used Luna high, the fixed C04 evidence pack, a two-query limit,
and the registered unchanged/changed, changed/unchanged, unchanged/changed run
order. No live web request was made. Fixed evidence does not measure Firecrawl
latency or cost.

| Measure                         | Unchanged case | Changed version |             Change |
| ------------------------------- | -------------: | --------------: | -----------------: |
| Full eval passes                |          11/15 |            9/15 |                 -2 |
| Incorrect existing matches      |              0 |               0 |                  0 |
| Input tokens                    |        171,372 |         181,578 |            +10,206 |
| Output tokens                   |         17,562 |          27,003 |             +9,441 |
| Total tokens                    |        188,934 |         208,581 |    +19,647 (10.4%) |
| Cached input                    |        148,971 |         131,890 |            -17,081 |
| Cache write                     |         22,317 |          41,480 |            +19,163 |
| Reasoning tokens                |         12,855 |          17,495 |             +4,640 |
| Model requests                  |             28 |              41 |                +13 |
| Classifier tool calls           |             13 |              11 |                 -2 |
| Total case time                 |       262.93 s |        312.78 s |   +49.84 s (19.0%) |
| Median case time                |        10.84 s |         18.79 s |    +7.95 s (73.4%) |
| 95th percentile case time       |        64.83 s |         33.84 s |          -30.996 s |
| Observed model cost             |      $0.029650 |       $0.047053 | +$0.017403 (58.7%) |
| Cost if all input were uncached |      $0.055349 |       $0.068719 | +$0.013370 (24.2%) |

All nine valid coded-release comparison cases passed in both versions: High West High
Country, Penelope Batch 11, and Cadboll Estate Batch 4 each passed 3/3. The
The changed run therefore did not trigger the registered hard stop.

Elijah Craig failed 3/3 in both versions. Unchanged case returned `no_match` twice and
then created a Bottle whose name omitted `18-year-old`. Changed version did the same.
The separate source pass correctly marked the brand, Single Barrel expression,
18-year age, 45% ABV, and single-barrel status as marketed facts in all three
runs. It did not make the final creation complete.

Masterson's passed 2/3 in the unchanged run and 0/3 in the changed run. The changed run's
source record correctly identified French Oak Finish as a marketed expression
in all three runs. The main classifier still returned `no_match`, reasoning that
the barrel-specific local candidate should be reviewed before a new uncoded
Bottle could be created. This is the opposite of the existing rule that a broad
or over-specific candidate does not cover a distinct supported Bottle.

The comparison case's slowest case took 64.83 seconds, so the changed run had the lower 95th
percentile in this small sample. Its median and total time both increased. The
observed cost increase was larger than the token increase because the new pass
had little reusable cached input.

## Decision

Reject the separate pass and restore the prior classifier. It supplied accurate
facts but did not fix the decision that used them. Accuracy fell 13.3 percentage
points, and every resource measure except the noisy 95th percentile worsened. A
full-suite run was not warranted.

C05 should address the final decision directly. A creation needs both a complete
supported field set and a clear rule that rejecting an over-specific candidate
does not block creation of the distinct, supported product.

The [structured result](./C04-source-identity.json) records the measurements.
