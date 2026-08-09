# Reference Classifier Baseline

Date: 2026-08-09

## Scope

The classifier source is commit
[`0a26cb202b709a81ef06312eebf35477282a54c1`](https://github.com/dcramer/peated/tree/0a26cb202b709a81ef06312eebf35477282a54c1).
The baseline evidence is
[GitHub Actions run 31330141477](https://github.com/dcramer/peated/actions/runs/31330141477)
at commit `4a3bf3bee2c1e66c75741fbc5c0e76da07fd99d2`. That commit did not
change the classifier prompt or runtime behavior.

The reference classifier has 88 executable cases:

- `decision-cases`: 69 cases.
- `new-bottles`: 19 cases.

Issue #566 calls this a 92-fixture set. The runner does not contain 92
reference cases at the frozen commit. The count in the issue is stale. The full
eval command also runs 9 Bottle audit cases and 12 image extraction cases. Those
21 cases are not part of the reference classifier measurements below.

The raw fixture and runtime outcomes stay separate in this report. In
particular, `ignored` is not silently counted as `no_match`. A future
three-result comparison can normalize the five ignored cases to No Match and
get the requested 41 Match, 40 Create Bottle, and 7 No Match expectations.

## Expected Outcomes

| Raw outcome      | Cases |
| ---------------- | ----: |
| `match`          |    41 |
| `create_bottle`  |    40 |
| `no_match`       |     2 |
| `ignored` status |     5 |

## Live Result

The run used `openai/gpt-5.6-terra` with medium reasoning. Two cases reported
no model usage. The other 86 cases reported the model and token usage.

The classifier eval gate passed 63 of 88 cases (**71.6%**). The model run and
artifact upload succeeded. The workflow failed when the report publisher
applied its 80% minimum pass rate.

### Outcome Confusion

Rows are expected outcomes. Columns are actual outcomes.

| Expected \ Actual | `match` | `create_bottle` | `no_match` | `repair_bottle` | `ignored` |  Total |
| ----------------- | ------: | --------------: | ---------: | --------------: | --------: | -----: |
| `match`           |      34 |               2 |          4 |               1 |         0 |     41 |
| `create_bottle`   |       3 |              26 |         10 |               1 |         0 |     40 |
| `no_match`        |       0 |               2 |          0 |               0 |         0 |      2 |
| `ignored`         |       0 |               0 |          0 |               0 |         5 |      5 |
| **Actual total**  |  **37** |          **30** |     **14** |           **2** |     **5** | **88** |

An incorrect Match is an actual Match when the fixture expects another outcome
or a different Bottle. There were 4 incorrect Matches among 37 actual Match
results. The false-Match rate is **10.8%**. Three should have created a Bottle.
One selected the wrong Bottle for a Match fixture.

A false No Match is `match` -> `no_match`. There were 4 false No Match results
among 41 expected Matches (**9.8%**). The matrix also shows two expected Matches
that became Create Bottle and one that became Repair Bottle.

## Candidate Recall Before the Model

The expected Match target was present in the initial candidates for 38 of 41
Match cases. Candidate recall was **92.7%**.

The initial candidates did not contain the expected target in these cases:

- `current-assignment-a-bottle-correction-stays-review-only-even-when-the-new-match-is-highly-confident`
- `store-listing-uses-web-evidence-plus-local-follow-up-search-to-recover-the-right-bottle`
- `text-only-listing-extracts-and-recovers-wild-turkey-rare-breed-rye-from-the-title`

These cases can use local follow-up search after the model starts. This measure
only covers candidates available before the model run.

## Cost And Operations

These totals cover the 88 reference classifier cases only.

| Measurement                | Result                       |
| -------------------------- | ---------------------------- |
| Tool calls                 | 88                           |
| Total time                 | 1,139.5 seconds              |
| Median time per case       | 12.9 seconds                 |
| 95th percentile per case   | 22.3 seconds                 |
| Input tokens               | 1,586,406                    |
| Output tokens              | 78,320                       |
| Total tokens               | 1,664,726                    |
| Suggested Change precision | 0/2 (**0.0%**)               |
| Review rate                | Missing: no consumer context |

The eval runner reports model results, usage, timing, tool calls, and Suggested
Change scoring. It does not run one specific automated consumer. A single
review rate is therefore not defined. Add Bottle is user-confirmed, while an
automated price flow applies its own review gate.

The analysis paired each recorded input with the exact source fixture in the
same scenario order. It rejected the result if the recorded input did not equal
the fixture input. It then read the actual output and native usage data from
`vitest-results.json`. No production monitoring or permanent aggregation code
was added for this baseline.
