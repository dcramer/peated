# Classifier experiments

The [improvement checklist](./checklist.md) is the ordered queue. Mark an item
only after its result and decision are documented.

Use Luna high for accuracy experiments. Compare each change with an unchanged
run, using the same test cases, extraction settings, and tool limits. Change
one thing at a time. Keep unsuccessful experiments here with their exact change
and results.

## Measures and decisions

- **Accuracy:** report the full pass count, action and Bottle ID correctness,
  incorrect existing matches, missing or unsupported fields, and run errors.
  A safer `no_match` result is useful but does not pass a case requiring a supported
  match or creation. Review changed results, not just the total.
- **Cost:** estimate each model call from its actual model and token usage.
  Report cache use and the estimate without caching. Record web requests
  separately; model estimates do not include Firecrawl fees or billing changes.
- **Tokens:** report input and output totals, cached input, cache writes, and
  reasoning tokens. Cached tokens are part of input; reasoning tokens are part
  of output. Do not add either twice.
- **Time:** report measured per-case median and 95th percentile, plus total run
  time. Include failures. State when missing usage or timing prevents a complete
  comparison. Replayed web calls do not measure live-web latency.

Record the expected benefit, selected cases, exact change, settings, and run order
before seeing results. Run each focused case three times per version, alternating
which version runs first. Use comparison cases that must keep working and a
separate case with different values to check whether the rule generalizes.

Decide whether the measured accuracy gain is worth its cost and time. Do not
hide a regression behind an average or call a single lucky result a win. An
uncertain result stays uncertain. A promising result needs one full-suite run
and a review of new failures before acceptance. Rejected changes are reverted;
their records remain. Test-case corrections are separate from classifier changes.

## Results

| Experiment                                                                   | Change                                                                               | Decision                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [01: Release identity](./01-release-identity.md)                             | [Compare release traits in names and structured fields](./01-release-identity.patch) | Rejected: fewer correct decisions, more incorrect matches                      |
| [C01: Entity retrieval role](./C01-entity-retrieval-role.md)                 | Preserve the source field for each initial Entity lookup                             | Rejected: Mars improved, Whiskyland regressed, and time rose 12.1%             |
| [C02: Audit evidence rule](./C02-audit-evidence-rule.md)                     | Align the prompt with the populated-field guard                                      | Rejected: target improved, but comparison cases cost more and retried more     |
| [C03: Rejection recovery](./C03-rejection-recovery.md)                       | Stop resubmitting unsupported audit fields                                           | Stopped: fixed comparison case did not reproduce the historical failure        |
| [C04: Source identity](./C04-source-identity.md)                             | Record source traits before candidate choice                                         | Rejected: accuracy fell and observed cost rose 58.7%                           |
| [C05: Creation field review](./C05-creation-field-review.md)                 | Account for supported creation fields before choosing the action                     | Stopped: only one relevant omission reproduced                                 |
| [C06: Candidate relationship](./C06-candidate-relationship.md)               | Classify candidate coverage before choosing the action                               | Rejected: focused gain failed safety and full-suite checks                     |
| [C07: Catalog eligibility](./C07-catalog-eligibility.md)                     | Establish product scope before matching or creating                                  | Stopped: target failure did not reproduce in the initial check                 |
| [C08: Exact Entity alias](./C08-exact-entity-alias.md)                       | Prefer one exact source alias over approximate or new Entity choices                 | Rejected: direct fix worked, but a comparison case regressed and one timed out |
| [C09: Cask-code match guard](./C09-unverified-cask-code-match.md)            | Block a match when a candidate-only exact-cask code is unverified                    | Accepted: both unsafe shapes blocked; focused comparison cases unchanged       |
| [C10: Exact Entity reference](./C10-model-chosen-exact-entity-reference.md)  | Correct an exact accepted Entity Reference after Luna chooses it                     | Accepted: corrected Mars; nineteen other exact choices unchanged               |
| [C11: Exact Bottle Reference](./C11-bottle-reference-fast-path.md)           | Skip Luna when one accepted Bottle Reference matches exactly                         | Accepted: same accuracy with zero model work for this identity shape           |
| [C12: Source page first](./C12-source-page-first.md)                         | Tell Luna to read an incomplete input's supplied source URL first                    | Rejected: same accuracy, more calls, one regression, and one timeout           |
| [C13: Read pages for weak input](./C13-read-weak-source-page.md)             | Read source pages before Luna for weak title or missing identity input               | Rejected: 14 reads improved one test case; nine pages failed                   |
| [C14: Read page for a verified creation](./C14-read-verified-create-page.md) | Read the source only when exact local facts support creating a new Bottle            | Accepted: target improved 0/3 to 3/3; full suite made one targeted read        |

C09 and C10 add narrow checks after Luna, and C11 removes model work for an
identity Peated has already accepted. The measurement and test-case corrections
below make comparisons more accurate and repeatable.

## Measurement changes

| Item                                                           | Decision                                                       |                                           Model cost |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------: |
| [M01: Exact field failures](./M01-exact-field-failures.md)     | Accepted: clearer failures, unchanged scores                   |                                                   $0 |
| [M02: Cold Brew policy conflict](./M02-policy-conflicts.md)    | Accepted: two expectations corrected; classifier unchanged     | $0 correction; $0.005499 including the initial check |
| [M03: Names and categories](./M03-names-and-categories.md)     | Accepted: verified test case corrections; classifier unchanged |          $0 correction; $0.039408 focused validation |
| [M06: Fixed image extraction](./M06-fixed-image-extraction.md) | Accepted: controlled audit input; classifier unchanged         |                                $0.003839 smoke check |
| [M07: Null vs. missing](./M07-null-vs-missing.md)              | Accepted: correct explicit-null scoring; classifier unchanged  |                                                   $0 |
| [M04: Supported audit extras](./M04-supported-audit-extras.md) | Accepted: exact reviewed operation sets; classifier unchanged  |                                                   $0 |
| [M05: Fixed web evidence](./M05-fixed-evidence.md)             | Accepted: controlled evidence lane; classifier unchanged       |                       $0.014501 total Luna high work |
| [M08: Held-out release year](./M08-held-out-release-year.md)   | Accepted: removed an unsupported held-out SMWS year            |                                                   $0 |
