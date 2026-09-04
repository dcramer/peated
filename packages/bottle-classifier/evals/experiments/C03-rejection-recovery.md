# C03: recover from rejected audit proposals

**Stopped after the initial check; no classifier change.** The historical
turn-limit failure did not reproduce with fixed image and web evidence, so a
comparison would not measure the proposed recovery rule.

## Hypothesis

The proposal tool currently tells the model to fix the stated reason before
retrying every rejection. That is correct for a missing target citation or bad
argument, but misleading when the field lacks enough evidence. In that case the
model can resubmit the same unsupported field until it reaches the turn limit.

The proposed change would distinguish the two cases:

- retry a mechanical argument or citation error once after correcting it;
- after an evidence-threshold rejection, collect qualifying evidence or omit
  the rejected field; never resubmit it with the same evidence.

The rule will appear in the audit instructions and the proposal result
description. The evidence guard and turn limit will not change.

## Cases and success conditions

| Case                        | Role                                                        | Required result                                                                   |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Mannochmore one-image audit | Target                                                      | No repeated evidence-threshold proposal and no turn-limit error                   |
| Dramfool Octomore 9.3       | Mechanical-citation and structured-evidence comparison case | Keep the supported edition correction; a corrected citation retry remains allowed |
| Harbor Ledger Batch 24      | Structured-evidence comparison case                         | Keep the supported ABV correction                                                 |

The deterministic two-image test remains the guard comparison case: two independent
agreeing images still authorize a populated replacement.

Use Luna high and the fixed C02 evidence pack so both versions receive the same
web and image facts. First run Mannochmore once in the unchanged run. Continue to three
paired repeats only if the comparison case repeats an evidence-threshold proposal or
hits the turn limit. Otherwise stop and record that the historical failure was
not reproduced under controlled inputs.

Record final scores, run errors, proposal results and reasons, tokens,
cache, cost, tools, requests, and time. Accept only if the target improves
without losing a supported comparison case or blocking a corrected mechanical retry.

## Unchanged case result

The fixed Mannochmore comparison case passed every judge. Luna made one local Bottle
search, proposed no operation, returned no finding, and finished without a tool
rejection or run error.

| Measure              |    Result |
| -------------------- | --------: |
| Full eval score      |      1.00 |
| Input tokens         |    15,385 |
| Output tokens        |     1,321 |
| Total tokens         |    16,706 |
| Cached input         |    15,034 |
| Cache write          |       345 |
| Reasoning tokens     |     1,052 |
| Model requests       |         2 |
| Tool calls           |         1 |
| Rejected proposals   |         0 |
| Time                 |   15.93 s |
| Estimated model cost | $0.001973 |

The historical Luna run used uncontrolled image extraction and exceeded eight
turns. Its trace reported attempts to change populated fields without enough
evidence. The fixed extraction does not recreate that behavior, which means the
old failure cannot serve as a controlled baseline for this wording change.

## Decision

Do not apply or test the recovery sentence yet. C03 is unproven rather than
rejected on accuracy. Reopen it only with a fixed case that repeats the same
evidence-threshold proposal in the unchanged run. The proposed change, supported comparison cases,
and stop condition above remain registered for that case.

The [structured result](./C03-rejection-recovery.json) records the initial check.
