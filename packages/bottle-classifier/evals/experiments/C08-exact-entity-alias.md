# C08: prefer one exact source Entity alias

**Rejected and reverted.** The exact-alias rule corrected one completed Mars
decision, but one changed run timed out and Whiskyland regressed. The focused
comparison failed its registered no-regression condition.

## Hypothesis

C01 showed that extra retrieval-role wording was too broad. The narrower Mars
failure is deterministic: the extracted distillery text exactly equals an alias
on Entity 1953, while a similar duplicate also appears in the results.
When one inspected Entity has the exact source relationship text as its matched
alias, the final result check should reuse it instead of accepting a fuzzy Entity or a new
null-ID Entity.

## Exact change

Before validating Entity IDs in a creation draft, prefer one resolved Entity
only when all of these facts hold:

- the extracted Brand, bottler, or sole distillery text is available;
- exactly one resolved Entity has a `reference` equal to that text after normal
  Entity-name normalization;
- that Entity records an exact retrieval query for the same text; and
- for distillers, both the source and draft contain exactly one distiller.

Use that Entity's ID and stored name even if the model chose a null ID or a
different fuzzy result. If zero or multiple Entities qualify, preserve the
model's choice. Do not use similarity scores, substrings, or Entity kind. Series
handling does not change.

This is a check after Luna returns. It changes no prompt, tool, model request, or
token budget. The raw model decision remains recorded separately.

## Cases and decision rule

Use the same fixed evidence and four cases as C01, with three paired repeats per
version in unchanged/changed, changed/unchanged, unchanged/changed order.

| Case                           | Required result                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Mars Komagatake 2022 Edition   | Reuse distiller Entity 1953 in all changed runs                                          |
| Watchpost Whiskey              | Preserve Westland Distillery Entity 1987                                                 |
| Whiskyland Chapter Twenty Nine | Preserve Brand 365738, bottler 5775, and distiller 987 without repeating Brand as Series |
| SMWS RW6.5 Appley ever after   | Preserve Brand/bottler 4263 and distiller 127                                            |

Reject if any comparison case regresses or if the exact-alias rule selects more
than one possible Entity. Accept the focused result only if Mars improves
reliably, total passes improve, and time and cost remain effectively unchanged.
A promising result requires the full Luna high suite and review of every changed
final Entity choice.

## Results

The comparison used Luna high, the fixed C01 evidence pack, a two-query limit,
and the registered alternating run order. Fixed evidence made no live web
request.

| Measure                                  | Unchanged case | Changed version | Note                         |
| ---------------------------------------- | -------------: | --------------: | ---------------------------- |
| Full eval passes                         |           8/12 |           10/12 | +2                           |
| Incorrect existing matches               |              0 |               0 | unchanged                    |
| Run failures                             |              0 |               1 | one Mars timeout             |
| Cases with model usage                   |             12 |              11 | changed-run usage incomplete |
| Input tokens reported                    |        204,774 |         165,514 | not comparable               |
| Output tokens reported                   |         17,612 |          14,889 | not comparable               |
| Total tokens reported                    |        222,386 |         180,403 | not comparable               |
| Cached input                             |        185,318 |         150,624 | not comparable               |
| Cache write                              |         19,354 |          14,806 | not comparable               |
| Reasoning tokens                         |         12,404 |          10,206 | not comparable               |
| Model requests                           |             34 |              28 | one missing case             |
| Tool calls                               |             22 |              17 | one missing case             |
| Total case time                          |       185.02 s |        899.70 s | timeout included             |
| Median case time                         |        13.72 s |         12.02 s | -12.4%                       |
| 95th percentile case time                |        37.26 s |        768.40 s | timeout included             |
| Observed model cost                      |      $0.029700 |       $0.024598 | changed version incomplete   |
| Cost if all reported input were uncached |      $0.062089 |       $0.050970 | changed version incomplete   |

Mars failed 3/3 in the unchanged run. Its raw drafts chose fuzzy Entity 238555 twice and a
null ID once. Two changed attempts completed and both returned the stored
Entity 1953. In one, the model had already selected 1953; in the other, the
model returned a null ID and the exact-alias rule corrected it. The third
changed attempt timed out without usage.

SMWS passed 3/3 in both versions. Watchpost passed 2/3 in the unchanged run and 3/3 in
changed version; the miss in the unchanged run was an unrelated automation-tier result. Whiskyland
passed 3/3 in the unchanged run and 2/3 in changed version. Its failed changed draft repeated
Whiskyland as both Brand and Series, so the existing server rule correctly
downgraded it to `no_match`. The exact-alias rule did not activate there because
the resolved Entities had no matched alias.

## Decision

Reject and remove the result check. The direct Mars correction is useful
evidence, but the registered rule required no comparison-case regression and a reliable
Mars improvement. A Whiskyland regression and a Mars timeout leave neither
condition satisfied. The favorable aggregate cannot override those failures,
and the missing changed-run usage prevents a fair resource comparison. No full
suite was run.

The six paired runs cost $0.054297 in reported model usage. The
[structured result](./C08-exact-entity-alias.json) records the measurements.
