# C14: read the page before Luna for a verified creation

**Accepted.** The narrow condition restored the missing source facts 3/3 and made
exactly one preparation read in the full 105-check suite.

## Problem

C13 proved that the official SMWS page supplies missing age and ABV, but its
broad condition attempted 14 reads across the full suite and improved only this
test case. Nine pages failed to load. Russell's Reserve did not improve and
still sometimes lost `Rye` from its stable product name.

## Hypothesis

Read `reference.url` before Luna only when:

- Firecrawl and a source URL are available;
- web lookup is allowed;
- no reviewed search evidence is already supplied;
- the deterministic resolver has selected `create_bottle`; and
- identity came from title text.

A deterministic create settles Bottle identity but can still lack supported
creation facts. A deterministic match needs no enrichment. Structured input
already carries its source facts. If the optional page fetch fails, record the
error, restore the page-read allowance, and continue through the unchanged
agent path.

## Cases and decision rule

Run three Luna high attempts each for:

- text-only SMWS RW6.5 creation;
- structured SMWS RW6.5 creation;
- text-only SMWS RW6.5 exact local match; and
- text-only Elijah Craig Batch C923 creation as a non-deterministic comparison case.

Keep the change if SMWS age 6 and 56% ABV are restored 3/3, all comparison cases stay
correct without preparation reads, and resource cost is reasonable. C13's full
run already records every use of the broad condition; applying the narrower
condition to that list must select only the target test case.

## Exact change

The classifier reads `reference.url` before Luna only when verified local facts
support a title-derived `create_bottle` decision and no web evidence was supplied. It adds
the returned page passage to the normal evidence list and uses the existing
one-page allowance. A failed or empty read is recorded, its allowance is
restored, and classification continues.

The prompt, model settings, candidate lookup, and final validation are
unchanged. The focused runs used `gpt-5.6-luna` at high reasoning effort, live
Firecrawl, and at most two search queries and one page read per case.

## Focused result

The target comparison reuses C12's three valid unchanged runs. The three C14
changed runs used the same target plus three comparison cases. The resource table is
limited to the target because the new condition did not run for the comparison cases;
their independent agent tool choices would add unrelated variance.

| Measure                       | Unchanged case | Changed version |     Change |
| ----------------------------- | -------------: | --------------: | ---------: |
| Correct target attempts       |            0/3 |             3/3 |         +3 |
| Incorrect existing matches    |              0 |               0 |          0 |
| Run errors                    |              0 |               0 |          0 |
| Preparation page reads        |              0 |               3 |         +3 |
| Actual Firecrawl requests     |              0 |               3 |         +3 |
| All recorded tool calls       |              0 |               5 |         +5 |
| Model requests                |              3 |               5 |         +2 |
| Input tokens                  |         17,637 |          31,230 |    +13,593 |
| Cached input tokens           |         16,791 |          27,286 |    +10,495 |
| Cache-write tokens            |            837 |           3,929 |     +3,092 |
| Output tokens                 |          4,668 |           4,237 |       -431 |
| Reasoning tokens              |          3,756 |           2,994 |       -762 |
| Total tokens                  |         22,305 |          35,467 |    +13,162 |
| Estimated model cost          |      $0.006148 |       $0.006615 | +$0.000467 |
| Total case time               |        48.46 s |         53.44 s |    +4.98 s |
| Median case time              |        15.02 s |         15.93 s |    +0.91 s |
| 95th percentile, nearest rank |        19.52 s |         22.42 s |    +2.90 s |

The page consistently supplied age 6, 56% ABV, rye category, and the RW6.5
cask code. It did not supply a release year, and all three drafts correctly
left that field unknown. Model cost rose 7.6%, total tokens rose 59.0%, and
total target time rose 10.3%. Two runs chose one extra agent turn after seeing
the evidence. One tried another page read, which the shared page budget blocked
before an external request; one searched the local catalog.

All nine unchanged attempts passed. Structured SMWS input, the existing exact
SMWS match, and the non-deterministic Elijah Craig creation each passed 3/3 and
made no preparation read.

## Full-suite run

The live run passed 80 of 105 checks and failed 25. It made one
preparation read, for the intended text-only SMWS creation, and that case
passed. None of the 25 failures used the new path. Luna did not accept a Bottle
in any case that expected `no_match`, but it selected the wrong existing Bottle
in one match case, High West High Country. Russell's Reserve again lost `Rye`
from its stable product name, which remains a separate final name problem.

One unrelated image case timed out and reported 808.24 seconds. That makes the
full run unsuitable for a clean time comparison. Including the timeout, total
case time was 3,094.59 seconds, median time was 17.90 seconds, and the nearest-
rank 95th percentile was 74.10 seconds.

Usage was available for 100 checks: 2,708,996 input tokens, including 2,351,570
cached and 356,291 cache-write tokens; 167,108 output tokens, including 120,782
reasoning tokens; 2,876,104 total tokens; 379 model requests; and $0.336861
estimated model cost. These are lower bounds because the timeout has no usage.
The run recorded 143 Firecrawl tool calls, including the one new preparation
read, plus 108 local or proposal tool calls.

An initial full attempt inside the restricted network sandbox failed with
provider connection errors and was excluded. A one-case live connectivity
check passed before the valid full run; it is also excluded from the focused
three-run totals.

## Decision

Keep the narrow page read. It converts a repeatable incomplete creation
into a supported complete Bottle 3/3. The added work occurs only when local
deterministic identity is strong enough to create a Bottle but title extraction
lacks its creation facts. The focused overhead is one Firecrawl request and
$0.000156 average model cost per affected case. The comparison cases and full-suite run
show that the condition does not add source reads to other current cases.
