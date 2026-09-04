# C07: establish catalog eligibility before the action

**Stopped without a code change.** Both target failures disappeared in the
unchanged initial check, and one ordinary comparison case showed an unrelated scope
failure. The initial check did not justify changing every structured answer.

## Hypothesis

Luna can treat a local Bottle or current assignment as enough reason to match an
additive-flavor product, even when product eligibility is unresolved. A small
required eligibility field may make that prerequisite explicit without another
model request.

## Initial check

Run the unchanged Luna high classifier once on six no-web cases. Continue only
if at least one Jameson Cold Brew target makes an unsafe match and the Ardbeg,
SMWS, and ordinary-match comparison cases pass.

| Case                                 | Role and required result                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Jameson Cold Brew listing            | Target: return `no_match` for unresolved product scope                               |
| Jameson Cold Brew current assignment | Target: current assignment must not override product scope                           |
| Skrewball Peanut Butter Whiskey      | Out-of-scope comparison case: keep rejecting the flavored product                    |
| Ardbeg Uigeadail current assignment  | In-scope comparison case: keep the current exact match                               |
| SMWS RW6.5 Appley ever after         | Name comparison case: flavor-like wording alone must not block an exact whisky match |
| 1792 Single Barrel                   | Ordinary comparison case: keep the existing exact match                              |

## Exact change

Add one required `catalogEligibility` object to the classifier's structured
answer. Its status is `in_scope`, `out_of_scope`, or `unresolved`, plus one short
reason. The model may match or create only when the product is `in_scope`. It
must return `no_match` when reliable evidence establishes `out_of_scope`, or
when additive flavor is plausible and eligibility remains unresolved. Words
that merely sound like flavors do not establish that additives were used.

The field is model reasoning data and is removed before the public result. The
existing extraction, candidate tools, evidence rules, action contract, turn
limit, and server checks stay unchanged. This change adds no model request.

## Run plan and decision rule

If the initial check passes, run all six cases three times per version in
unchanged/changed, changed/unchanged, unchanged/changed order with Luna high and
web search disabled. Record full passes, actions, matched IDs, incorrect
existing matches, tokens, cache use, model requests, tools, cost, and case time.

Reject immediately if Ardbeg, SMWS, or 1792 stops matching correctly. Accept the
focused result only if both Cold Brew cases return `no_match` reliably, no
comparison case regresses, and the resource increase is small. A promising focused
result requires one full Luna high suite and review of every changed result.

## Unchanged case result

The valid initial check used Luna high with web search disabled. It passed 5/6 full
expectations. Both Cold Brew cases returned `no_match`, as did Skrewball. Ardbeg
matched Bottle 630 and SMWS matched Bottle 43260. The 1792 unchanged run matched the
right Bottle 16051 but incorrectly labeled the identity as `exact_cask` instead
of product-level `Single Barrel`.

| Measure                         |    Result |
| ------------------------------- | --------: |
| Full eval passes                |       5/6 |
| Correct actions and Bottle IDs  |       6/6 |
| Incorrect existing matches      |         0 |
| Input tokens                    |    70,081 |
| Output tokens                   |     4,509 |
| Total tokens                    |    74,590 |
| Cached input                    |    55,922 |
| Cache write                     |    14,120 |
| Reasoning tokens                |     2,973 |
| Model requests                  |        13 |
| Tool calls                      |         3 |
| Total case time                 |   62.11 s |
| Median case time                |    9.31 s |
| 95th percentile case time       |   18.10 s |
| Observed model cost             | $0.010067 |
| Cost if all input were uncached | $0.019427 |

An initial sandboxed attempt could not resolve the AI gateway hostname. All six
cases failed before a model response, so it used no model tokens and has $0
model cost. The valid network-enabled check above owns the measurements.

## Decision

Stop without implementing the eligibility field. The initial check required at least one
unsafe Cold Brew match and stable comparison cases. It produced neither condition: both
targets were correct, while 1792 failed an unrelated identity-scope assertion.
The proposed change therefore has no demonstrated accuracy problem to solve in this
sample and would add output to every classification.

The [structured result](./C07-catalog-eligibility.json) records the initial check.
