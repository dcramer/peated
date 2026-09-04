# C09: reject an unverified cask-code match

**Accepted.** The deterministic guard blocks both recorded unsafe match shapes
without changing model calls, tokens, or model time.

## Problem

Luna high repeatedly matched an uncoded source Bottle to a narrower existing
Bottle whose name carries a marketed barrel code:

- Elijah Craig 18-year-old Single Barrel was matched to Bottle 16142, which is
  specifically barrel 4040, in all three web-baseline attempts.
- Masterson's French Oak Finish was matched to Bottle 16442, which is
  specifically barrel F2-038, in all three web-baseline attempts.

The candidate rows have no structured `caskNumber`, so the existing populated
field conflict check cannot see the narrower identity stored in their names.

## Hypothesis

A narrow post-model guard can prevent these unsafe assignments without asking
the model to reason again. When the chosen candidate has an explicit cask or
barrel code in its accepted name, require the same code in the source title,
structured extraction, observation, or reviewed image extraction. Otherwise,
downgrade `match` to `no_match`.

This guard may only reject the model's selected target. It cannot select another
Bottle or turn the result into a creation. It must not treat batch numbers,
release numbers, ages, proof, or ABV as cask codes.

## Checks and decision rule

Use ordinary tests for the parser and result check because the proposed
behavior is deterministic after the model response. Replay the two recorded
wrong model decisions through the result check, then check exact-cask, batch,
release-number, and ordinary single-barrel comparison cases.

Also scan every current classification test case for candidates that the rule can
affect and review each result against its expected action. Run the package test
suite and typecheck. This change makes no model calls, so its model cost,
token use, and model time are zero.

Accept only if both unsafe matches are downgraded, all supported exact-cask and
batch matches remain possible, and the test-case scan finds no unexplained target.
The all-judge pass count will remain unchanged when a required creation becomes
`no_match`; the measured gain is fewer incorrect existing matches.

## Result

The first parser attempt failed three focused tests because it read
`18-year-old` as a cask code and stopped after a non-code use of `Barrel`. That
attempt was not accepted. The parser now requires a digit-bearing code, skips
age wording, and continues past non-code uses of `cask` and `barrel`.

The first test-case scan then showed that the parser also treated dotted product
releases such as Laphroaig Elements 2.0 and Octomore 13.1 as cask codes. That
version was not accepted either. Dotted codes now require a single-cask or
known exact-cask-program context; explicit `Cask 173445` and structured
`caskNumber` values still work.

The final checks passed:

| Measure                                               |  Result |
| ----------------------------------------------------- | ------: |
| Recorded unsafe match shapes downgraded               |     2/2 |
| Exact source cask-code comparison cases preserved     |     3/3 |
| Dotted release, batch, age, strength comparison cases |     5/5 |
| Focused deterministic tests                           |   46/46 |
| Full package tests                                    | 414/414 |
| Run failures                                          |       0 |
| Model requests                                        |       0 |
| Input, output, and reasoning tokens                   |       0 |
| Model cost                                            |      $0 |
| Focused test time                                     |  0.46 s |
| Full package test time                                | 10.66 s |

The classification test-case scan found seven unique test case/candidate/code
combinations. The three expected-match cases carry the selected SMWS code in
the source. The remaining four code-bearing candidates are narrower
alternatives in creation tests: Elijah Craig barrels 4040, 42, and 13, and
Masterson's barrel F2-038. No batch number, release number, age, proof, or ABV
was classified as a cask code.

For the saved web Luna high decisions, the guard changes the Elijah Craig and
Masterson's actions from unsafe `match` results to `no_match`. Both cases still
fail their required creation outcome, so the all-judge pass count does not
change. Incorrect existing matches fall by two in that saved run and by six
across the three recorded repeats for those cases.

## Decision

Keep the guard. It enforces an explicit source/candidate contradiction at the
post-model boundary and only downgrades. It adds no model work and cannot select
or create a Bottle. The initial failed parser checks remain documented above.
