# C25: point an exhausted search to page reading

**Rejected and reverted.** The focused comparison lost two judgments, raised
estimated model cost by 6.6%, and made the median case 41.9% slower.

## Problem

In one saved Octomore 13.1 failure, Luna used both web-search queries, then
attempted a third search. The tool returned only that the search budget was
exhausted. Luna stopped with `no_match` even though its page-read allowance and
a relevant Bruichladdich result were still available.

## Change tested

When search was exhausted and a page read remained, the tool result said how
many reads remained and told Luna to use `firecrawl_read_page` on the most
promising exact-product result when its excerpt was insufficient. The change
did not alter the prompt, search results, budget, or final checks.

The comparison used Luna high and alternated the unchanged and changed code
three times. The cases were:

| Case                             | Purpose                      | Required result                                                   |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| Octomore 13.1                    | Target recovery              | Create Octomore 13.1, optionally with its supported five-year age |
| SMWS RW6.5 Appley ever after     | Supported exact-page control | Keep the supported exact-cask creation                            |
| Canadian Club Reserve 9-year-old | Unsafe-creation control      | Keep `no_match` while the stored Brand conflicts                  |

## Results

| Version   | Run | Passes | Octomore | SMWS | Canadian Club | Input tokens | Output tokens | Reasoning tokens | Total tokens | Model requests | Web calls | Estimated model cost |   Time |
| --------- | --: | -----: | -------- | ---- | ------------- | -----------: | ------------: | ---------------: | -----------: | -------------: | --------: | -------------------: | -----: |
| Unchanged |   1 |    3/3 | Pass     | Pass | Pass          |       76,109 |         6,813 |            5,166 |       82,922 |             12 |         7 |            $0.011034 | 88.2 s |
| Changed   |   1 |    2/3 | Pass     | Pass | **Fail**      |       89,468 |         5,995 |            4,162 |       95,463 |             13 |         7 |            $0.010492 | 73.2 s |
| Unchanged |   2 |    3/3 | Pass     | Pass | Pass          |       93,047 |         6,462 |            4,611 |       99,509 |             14 |         8 |            $0.010850 | 76.6 s |
| Changed   |   2 |    3/3 | Pass     | Pass | Pass          |       82,316 |         7,169 |            5,443 |       89,485 |             13 |         7 |            $0.011119 | 85.8 s |
| Unchanged |   3 |    3/3 | Pass     | Pass | Pass          |       76,165 |         6,156 |            4,464 |       82,321 |             12 |         6 |            $0.011423 | 70.3 s |
| Changed   |   3 |    2/3 | **Fail** | Pass | Pass          |       71,637 |         8,564 |            7,031 |       80,201 |             11 |         7 |            $0.013905 | 91.2 s |

Combined results:

| Measure                        | Unchanged |   Changed | Difference |
| ------------------------------ | --------: | --------: | ---------: |
| Complete passes                |       9/9 |       7/9 |         -2 |
| Octomore passes                |       3/3 |       2/3 |         -1 |
| Unsafe-creation control passes |       3/3 |       2/3 |         -1 |
| Input tokens                   |   245,321 |   243,421 |      -0.8% |
| Output tokens                  |    19,431 |    21,728 |     +11.8% |
| Reasoning tokens               |    14,241 |    16,636 |     +16.8% |
| Total tokens                   |   264,752 |   265,149 |      +0.2% |
| Model requests                 |        38 |        37 |         -1 |
| Web calls                      |        21 |        21 |          0 |
| Estimated model cost           | $0.033307 | $0.035516 |      +6.6% |
| Total time                     |   235.1 s |   250.2 s |      +6.4% |
| Median case time               |    24.3 s |    34.5 s |     +41.9% |

The unchanged classifier recovered Octomore in all three runs. In two runs it
read a page before the blocked extra search; in the third it created the right
Bottle from search evidence alone.

The new sentence appeared in only one changed run. Luna then read a page and
passed Octomore, but this was not an improvement over the unchanged result.
The two changed failures happened without showing the new sentence. Canadian
Club created an unsupported duplicate in run 1. Octomore used `Scottish
Barley` as the Bottle name and moved `13.1` into `edition` in run 3.

## Decision

Reject the change. The historical path was real, but it did not reproduce as a
current accuracy problem. The changed version produced no gain, lost two
judgments, and cost more. The focused gate failed, so no full-suite run was
made. The tool and its tests were restored to the unchanged version.
