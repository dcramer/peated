# C02: align audit evidence instructions

**Rejected and reverted.** The stricter sentence removed wasted proposals on the
isolated target, but shifted that work to the supported-change comparison cases. Overall
tokens were flat, observed cost rose 11.2%, and median time rose 20.5%.

## Hypothesis

The audit prompt says one readable label plus a producer title can correct a
populated name or edition. The proposal tool and patch guard reject every
replacement of an existing value unless a matching structured Bottle observation or
two agreeing label images support it. Removing the prompt exception should stop
Luna from attempting work the tool cannot accept, without weakening the guard.

## Exact change

Change the audit instruction so every replacement of an existing value, including
name and edition, requires a matching structured Bottle observation or two
agreeing label images. Keep the existing rule that one image may fill a missing
field. The proposal description, rejection text, and deterministic guard already
state this rule and will not change.

## Cases and success conditions

| Case                   | Role                                               | Required result                            |
| ---------------------- | -------------------------------------------------- | ------------------------------------------ |
| North Pier Ember 7     | Target                                             | No edition update and no rejected proposal |
| Dramfool Octomore 9.3  | Structured-observation comparison case for edition | Keep the supported edition correction      |
| Harbor Ledger Batch 24 | Structured-observation comparison case for ABV     | Keep the supported ABV correction          |

The existing deterministic guard test is the two-image comparison case: two independent
agreeing label extractions must still authorize a populated replacement.

North Pier Ember 7 is synthetic. Its stored edition is `Release 7`; one fixed
label and a matching producer title say `7`; it has no structured observation
or second image. Mannochmore is retained for C03 because its missing
`caskNumber` makes it unsuitable for this populated-field comparison.

Use Luna high, the same fixed evidence, model settings, two-query limit, and
eight-turn limit for both versions. Run each case three times per version in
unchanged/changed, changed/unchanged, unchanged/changed order. Record full
scores, proposal-tool rejections, run errors, tokens, cost, tools, and time.
Accept only if the target becomes more reliable without either comparison case
regressing or material cost growth.

## Initial comparison

The first pair used exact-product fixed web evidence that named cask 173445.
Luna then proposed filling the missing `caskNumber`, which the test case does not
expect. This changed the question from populated-field replacement to field
completion, so both runs were discarded.

The second pair replaced that source with neutral company evidence. The image
extractor still returned materially different facts from the same image:

- the unchanged run read cask 7445 and a first-fill sherry wine barrel;
- the changed run read cask 7445, 57.4% ABV, a 2024 bottling year, and a first-fill
  bourbon barrel;
- earlier attempts read no cask number, or a refill bourbon barrel and 2025.

The comparison case proposed filling the missing cask number and added a conflict
finding. The changed run eventually failed because it cited
`imageEvidence.fieldCandidates.abv`, a path that was not collected in this audit
input. Neither result isolates the populated name/edition instruction.

The two structured-observation comparison cases remained valid in the neutral pair:
Dramfool and Harbor Ledger both passed for unchanged and changed versions. The prompt was
restored until M06 fixed image extraction.

## Controlled retry

The retry used Luna high and fixed web and image evidence. It ran each version
three times in the registered unchanged/changed, changed/unchanged,
unchanged/changed order.

| Measure                         | Unchanged case | Changed version |     Change |
| ------------------------------- | -------------: | --------------: | ---------: |
| Full eval passes                |            6/9 |             7/9 |         +1 |
| Input tokens                    |        206,650 |         206,829 |       +179 |
| Output tokens                   |          7,586 |           7,743 |       +157 |
| Total tokens                    |        214,236 |         214,572 |       +336 |
| Cached input                    |        200,640 |         194,549 |     -6,091 |
| Cache write                     |          5,929 |          12,199 |     +6,270 |
| Reasoning tokens                |          4,305 |           4,515 |       +210 |
| Model requests                  |             27 |              27 |          0 |
| Tool calls                      |             18 |              18 |          0 |
| Rejected proposals              |              5 |               4 |         -1 |
| Time                            |       117.58 s |        336.23 s |  +218.65 s |
| Median case time                |        11.39 s |         13.72 s |    +2.34 s |
| Observed model cost             |      $0.014614 |       $0.016249 | +$0.001634 |
| Cost if all input were uncached |      $0.050433 |       $0.050657 | +$0.000224 |

On North Pier, unchanged attempted the forbidden edition update in all three
runs. Changed version made no rejected proposal in all three. It cut target tokens
from 79,212 to 39,530, tool calls from 7 to 2, requests from 10 to 5, cost from
$0.006464 to $0.004340, and time from 53.40 to 35.90 seconds. Both versions
returned no operation. Unchanged case returned one finding in all three runs;
the changed run returned a finding in two, so the target's full score improved from
0/3 to 1/3.

Dramfool and Harbor Ledger returned the required operation in all six comparison case
runs and all six changed runs. Their combined rejected proposals rose from 2
to 4, and their tokens rose from 135,024 to 175,042. Most rejections were bad
evidence citations that Luna corrected on a later turn. The changed version therefore
moved the saved work from the target into the comparison cases instead of reducing
total work.

One changed Harbor Ledger call stalled for 231.52 seconds. Without that
outlier, changed-run time would be 104.71 seconds, but the measured duration is
still part of the result. The median also rose, so the time result is not
explained only by the stall.

## Initial setup spend

Four three-case attempts were run before stopping. Eleven cases reported usage;
the errored changed Mannochmore run did not report token or cost data.

- Reported input: 348,551 tokens.
- Reported output: 48,058 tokens.
- Reported reasoning: 41,289 tokens.
- Reported estimated model cost: $0.075026.
- Wall time across the four eval reports: about 789.8 seconds.

Those invalid attempts cost $0.075026. The valid retry cost another $0.030863
and took 453.80 seconds. Across the invalid setup and valid retry, reported model
cost was $0.105888.

## Decision

Reject the sentence and restore the current prompt. The target improvement is
real, but it is not a net win across accuracy, tokens, cost, and time. The
supported-change comparison cases kept their final accuracy while doing more rejected
work, and the target still failed its no-finding expectation in two of three
changed runs. A full-suite run was not warranted after the focused
no-regression rule failed.

The [structured result](./C02-audit-evidence-rule.json) keeps both the invalid
setup and the controlled retry.
