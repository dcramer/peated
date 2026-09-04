# C05: account for supported creation fields

**Stopped without a code change.** Five of six unchanged drafts carried all targeted
fields correctly. The remaining relevant failure was one incomplete
Bottle name, so the initial check did not justify adding a checklist to every answer.

## Hypothesis

The classifier already receives reliable source facts and is told to carry them
into a creation draft. Luna still sometimes omits a supported field, leaves a
supported age out of the Bottle name, or promotes a component fact. Requiring a
short field review immediately before the action may make the final draft
complete without adding another model request.

## Initial check

Run the unchanged Luna high classifier once on six fixed-evidence cases. Continue
only if at least two target cases still fail because of a missing supported
creation field, an incomplete Bottle name, or a component fact used as Bottle
identity.

| Case                         | Role and required result                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Elijah Craig 18-year-old     | Target: create the uncoded product and include the age in the Bottle name              |
| Mars Komagatake 2022 Edition | Target: create with edition, release year, 50% ABV, and established Entity IDs         |
| Willett barrel 4769          | Target: create with age, ABV, cask-strength, single-cask, and barrel identity          |
| Midwinter Act 12 Scene 9     | Target: create with the complete scene and 49.3% ABV                                   |
| Watchpost Whiskey            | Exclusion comparison case: keep 42.5% ABV and leave the component's eight-year age out |
| Cadboll Estate Batch 2       | Ordinary creation comparison case: keep age and edition                                |

Full expectation scores remain primary. Separately record whether a failed
creation contains every expected age, year, strength, and category field so unrelated Entity selection or
action failures do not hide the field result.

## Exact change

Add a nullable `creationFieldReview` immediately before `action` in the model's
structured answer. For `create_bottle`, it partitions the Bottle fields into:

- `used`: supported complete-Bottle fields carried into `proposedBottle`;
- `unknown`: fields with no reliable complete-Bottle value;
- `excluded`: observed component or source facts that must not enter the draft,
  each with a short reason.

The instruction requires every creation field to appear exactly once across the
three lists. A used field must have a non-null draft value. An unknown or
excluded field must remain null. For match and no-match decisions, the review is
null. The review is reasoning data only and is removed before the public result.
The existing decision, tools, evidence rules, model, turn limit, and final
server checks remain unchanged.

## Run plan and decision rule

Use Luna high, the same fixed evidence, model settings, and two-query limit for
both versions. Run all six cases three times per version in unchanged/changed,
changed/unchanged, unchanged/changed order. Record full passes, field-complete
creations, incorrect existing matches, actions, tokens, cache use, model
requests, tools, cost, and case time.

Reject if Watchpost promotes the component age or Cadboll loses a correct
creation. Accept only if the target field-complete creation rate and full passes
improve materially without an incorrect-match regression, and the gain is worth
the added output, cost, and time. Run the full suite only after that focused
result.

## Initial result

The unchanged Luna high classifier ran once on all six cases with fixed evidence.
It created a Bottle in every case and passed 4/6 full expectations.

| Measure                         |    Result |
| ------------------------------- | --------: |
| Full eval passes                |       4/6 |
| Creations with expected scalars |       5/6 |
| Incorrect existing matches      |         0 |
| Input tokens                    |    89,477 |
| Output tokens                   |     8,072 |
| Total tokens                    |    97,549 |
| Cached input                    |    77,453 |
| Cache write                     |    11,982 |
| Reasoning tokens                |     5,587 |
| Model requests                  |        14 |
| Tool calls                      |         8 |
| Total case time                 |   99.40 s |
| Median case time                |   13.67 s |
| 95th percentile case time       |   35.64 s |
| Observed model cost             | $0.014239 |
| Cost if all input were uncached | $0.027582 |

Midwinter, Willett, Watchpost, and Cadboll passed. Willett included its five-year
age, 64.2% ABV, cask-strength flag, single-cask flag, and barrel edition.
Watchpost kept 42.5% ABV and left the component age null. Mars included its 2022
Edition, 2022 release year, and 50% ABV; it failed only because it created a new
distiller instead of selecting Entity 1953. A creation-field review would not
address that C01 Entity-resolution failure.

Elijah Craig included stated age 18, 45% ABV, and both single-barrel flags, but
its proposed name was only `Single Barrel`. The expected stable Bottle name must
also include `18-year-old`. This was the only missing creation identity field in
the initial check.

## Decision

Stop without implementing or testing the change. The planned check required
at least two relevant failures. Adding a required structured checklist would
increase output for every classification while the current classifier handled
the broader completeness set correctly. Keep the existing prompt and schema.

The [structured result](./C05-creation-field-review.json) records the initial run.
