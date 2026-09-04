# C13: read the source page before Luna for weak input

**Rejected and narrowed.** The focused comparison improved, but the full-suite
list attempted 14 page reads to improve one test case. Nine pages failed to
load. The broad condition was replaced by the narrower C14 experiment.

## Problem

C12 proved that a direct instruction does not make Luna call the general page
tool when a title-only or missing extraction lacks complete creation facts. The
same two target cases failed 3/3 with and without that instruction, with zero
source page reads.

## Hypothesis

Before Luna runs, read `reference.url` when all of these are true:

- Firecrawl is configured;
- the input has a source URL;
- no deterministic local Bottle match exists; and
- identity came only from title text, or extraction returned no identity.

Do not read the page first when the caller supplied structured identity or a
verified local match already settles the Bottle. A verified creation can still need
the page because it settles identity without supplying age, ABV, or release
facts. The page read uses the existing single page allowance and is recorded as
classifier work.

This targets weak source evidence while avoiding an unconditional request for
the 71 decision test cases that carry URLs. Eighteen test cases begin with title-only
or explicitly missing identity before deterministic matches are considered.

## Cases and decision rule

Reuse C12's three valid unchanged runs, then run three changed
attempts with the same Luna high and live Firecrawl settings:

- text-only SMWS RW6.5 creation;
- Russell's Reserve Single Barrel Rye creation;
- structured SMWS RW6.5 creation as a comparison case that must not read the page first; and
- text-only SMWS existing exact-code match as a deterministic-match comparison case.

Keep the classifier change only if both incomplete-input cases improve reliably,
both comparison cases remain correct without page reads, and the accuracy gain is worth
the Firecrawl requests, extra model context, cost, and time. Review the fetched
passages and every output. A promising focused result still requires the full
Luna suite and regression review.

## Focused result

M08 removed the unsupported held-out release-year expectation before this
comparison was decided. Existing outputs were re-scored without another model
call. The changed version then passed all three text-only SMWS attempts because the
source page supplied the still-required age and ABV.

| Measure                             | Unchanged case | Changed version |     Change |
| ----------------------------------- | -------------: | --------------: | ---------: |
| Correct attempts                    |           8/12 |           11/12 |         +3 |
| Text-only SMWS creations            |            0/3 |             3/3 |         +3 |
| Russell's Reserve creations         |            2/3 |             2/3 |          0 |
| Complete-input comparison case      |            3/3 |             3/3 |          0 |
| Existing exact-code comparison case |            3/3 |             3/3 |          0 |
| Incorrect existing matches          |              0 |               0 |          0 |
| Run timeouts                        |              0 |               0 |          0 |
| Source page reads                   |              3 |               7 |         +4 |
| Web searches                        |              5 |               1 |         -4 |
| Total Firecrawl requests            |              8 |               8 |          0 |
| All tool calls                      |             11 |              12 |         +1 |
| Model requests                      |             23 |              18 |         -5 |
| Input tokens                        |        135,968 |         105,815 |    -30,153 |
| Cached input tokens                 |        114,329 |          93,310 |    -21,019 |
| Cache-write tokens                  |         21,570 |          12,451 |     -9,119 |
| Output tokens                       |         14,654 |          14,272 |       -382 |
| Reasoning tokens                    |         10,694 |          10,329 |       -365 |
| Total tokens                        |        150,622 |         120,087 |    -30,535 |
| Estimated model cost                |      $0.025278 |       $0.022116 | -$0.003162 |
| Total case time                     |       159.78 s |        155.44 s |    -4.35 s |
| Median case time                    |        14.47 s |         13.55 s |    -0.92 s |
| 95th percentile, nearest rank       |        21.93 s |         24.94 s |    +3.01 s |

The classifier made six planned page reads: one for each weak-input target attempt.
It made none for the three deterministic-match comparison cases. Luna independently
made one page read in a complete-input comparison case; this was not activated by the
automatic condition. Firecrawl request count stayed flat because starting with the
exact source page replaced four broader web searches.

The source evidence restored age 6 and 56% ABV in all three SMWS drafts and 52%
ABV in all three Russell's Reserve drafts. One Russell's Reserve run still
dropped `Rye` from the proposed stable product name, so that separate final
validation problem remains. The comparison case had one Russell's Reserve failure from
missing ABV instead. The focused accuracy gain therefore comes entirely from
the three supported SMWS fields.

The focused result was a net win on accuracy, model tokens, model cost, and
median and total time, so it proceeded to one full-suite run.

## Full-suite run

The suite now contains 105 checks. The first run passed 64 and failed 41. Nine failures came directly from an implementation error: a failed
automatic page read stopped classification. After source enrichment was made
optional and its page allowance was restored on failure, all nine affected
cases passed in a focused rerun. The corrected result is therefore 73/105.

The classifier attempted a preparation read for 14 cases:

- five pages returned usable evidence;
- nine page fetches failed;
- three of the five usable-page cases passed;
- Russell's Reserve and Quinta Ruban failed, but both were already failures in
  the saved Luna high web baseline; and
- only the text-only SMWS creation changed a saved failure into a pass.

The other successful reads were Glendalough Double Barrel and Laphroaig
Càirdeas 2022, which already passed, plus the two existing failures. The nine
failed fetches added no evidence. Their corrected rerun proved that fallback
preserved the expected decisions, but the attempted requests still add latency
and may consume Firecrawl credits.

## Decision

Reject the broad condition. Fourteen automatic requests for one improved test case is
not a clear net win, especially when nine source pages do not return usable
evidence. Keep the non-blocking fallback rule for the next narrower change,
but restrict automatic reads to deterministic creations from title text. The
full-suite run shows that this condition selects only the SMWS missing-Bottle
case in the current suite.
