# C10: resolve a model-chosen exact Entity reference

**Accepted.** A code check after Luna now resolves the exact accepted Entity
Reference that Luna already chose. It changes no prompt, tool result shown to
the model, model request, or token use.

## Problem

In the saved Luna high Mars Komagatake failure, local Entity search returned:

- Entity 1953, stored name `Komagatake`;
- accepted Entity Reference `Mars Shinshu Distillery`;
- an exact-search marker; and
- the exact query `Mars Shinshu Distillery`.

Luna chose the same accepted reference text for the proposed distiller but left
its Entity ID null. The final check preserved the null ID even though the chosen
name had one exact accepted local resolution.

This differs from the Elijah Craig and Masterson's failures. Those Bottle
searches had no exact correct Bottle result. They returned narrower fuzzy or
text candidates, so exact-reference handling cannot fix them.

## Hypothesis

When the model has already chosen an Entity name, code can attach the
one exact accepted Entity without making another identity decision. Require all
of the following:

- exactly one resolved Entity has the chosen text as its stored name, short
  name, or accepted `reference` after normal name normalization;
- that Entity result includes `exact` retrieval;
- that Entity was retrieved for the same exact query; and
- no second resolved Entity satisfies the same conditions.

Use the Entity's ID and stored name. Do not change the chosen Bottle
relationship, substitute a different Entity name, use display-only aliases,
use fuzzy scores, or infer from search rank.

The classifier now records which exact query produced each Entity result.
That flag is omitted from agent input and tool output, so it cannot change
Luna's reasoning or token count. It exists only to check the final answer. Repeated
searches merge the flag without confusing an exact result for one query with a
fuzzy result for another query.

The first implementation passed its behavior tests and typecheck but failed
lint because it built the optional exact flag with conditional object spreads.
That version was not accepted. The final implementation uses one shared helper
that constructs the source record explicitly.

## Checks and decision rule

Replay the saved Mars shape and add comparison cases for stored names, accepted
references, fuzzy results, ambiguous exact results, a chosen name different
from the extracted name, and already-correct IDs. Scan the saved web-enabled
Luna high run for every activation before keeping the rule.

Accept only if the rule corrects the Mars null ID, leaves every already-correct
exact choice unchanged, and has no fuzzy or ambiguous activation. This is
post-model code, so model requests, tokens, model cost, and model time must stay
at zero.

## Result

The saved web-enabled Luna high run contained twenty model-chosen Entity names
with one exact accepted local resolution. Nineteen already used the correct ID.
The only change was the Mars distiller:

| Field     | Before                                  | After                  |
| --------- | --------------------------------------- | ---------------------- |
| Distiller | `Mars Shinshu Distillery`, no Entity ID | Entity 1953 Komagatake |

The extracted Brand was `Komagatake`, but Luna chose Mars as the Bottle Brand.
The rule preserved that semantic choice and its correct Entity 1169. A broader
rule based on extracted relationship text would have overwritten the Brand and
was rejected during analysis.

| Measure                                   |  Result |
| ----------------------------------------- | ------: |
| Saved exact Entity choices examined       |      20 |
| Correct choices left unchanged            |      19 |
| Incorrect or missing IDs corrected        |       1 |
| Fuzzy or ambiguous activations            |       0 |
| Saved all-judge pass change               |      +1 |
| Incorrect existing Bottle match change    |       0 |
| Model requests added                      |       0 |
| Input, output, and reasoning tokens added |       0 |
| Model cost added                          |      $0 |
| Model time added                          |     0 s |
| Classifier package tests                  | 419/419 |
| Package test time                         | 13.95 s |

The replay itself passed in 0.52 seconds. It applied the production result check
to every saved creation output and asserted that Mars was the only changed
Entity choice.

## Decision

Keep the rule. An accepted Entity Reference is globally unique and already
supports automatic Entity matching. This code only supplies the stored
ID for the exact name Luna selected. It does not choose a different Entity or
relationship.
