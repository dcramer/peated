# M06: fixed image extraction

**Accepted as measurement infrastructure.** Controlled audit evals can now store
one reviewed extraction for each test case image. Both classifier versions receive
that exact result, and the eval does not call the image model.

## Why this was needed

C02 used fixed web evidence, but repeated Luna image reads of the same
Mannochmore image returned different cask, maturation, ABV, and year fields.
Those differences were larger than the prompt change being tested, so the
comparison was stopped.

Each fixed-evidence case may now include `imageResults`, keyed by image URL. The
eval runner installs the fixed extractor only when the case has reviewed image
results. Tracking parameters are ignored when matching URLs. An unreviewed URL
cannot fall through to a live image request.

## End-to-end check

The Luna high smoke check used the one-image Mannochmore audit and fixed company
web evidence. The audit context contained the stored reviewed extraction:
cask 7445, 53% ABV, 2024 release, and red-wine-barrique maturation. The trace had
three classifier requests and no image-extraction request.

| Measure              |    Result |
| -------------------- | --------: |
| Full eval score      |      0.67 |
| Grounding score      |      1.00 |
| Operation score      |      1.00 |
| Finding score        |      0.00 |
| Input tokens         |    23,427 |
| Output tokens        |     2,473 |
| Total tokens         |    25,900 |
| Cached input         |    21,674 |
| Cache write          |     1,744 |
| Reasoning tokens     |     1,961 |
| Model requests       |         3 |
| Tool calls           |         2 |
| Time                 |   34.74 s |
| Estimated model cost | $0.003839 |

The full eval failed because Luna returned two cautionary findings while the
test case expects none. It proposed no catalog operation, and the operation and
grounding checks both passed. This result is recorded as a failed smoke check;
it does not count as an accuracy improvement.

## Decision

Keep the fixed image lane. It comparison cases the input needed for audit prompt
comparisons and removes one model request per image. M06 changes only the eval
test runner and evidence data. Production extraction is unchanged.

The Mannochmore test case remains unsuitable as C02's main target because its
stored `caskNumber` is missing and the reviewed extraction supplies one. C02
will use a separate synthetic case where the only disagreement is a populated
edition. The real Dramfool and synthetic Harbor Ledger comparison cases remain.

## Verification

- Fixed evidence, classifier, and proposal tests: 82 passed.
- Full deterministic package suite after adding the synthetic case: 402 passed.
- Package typecheck and lint: passed.

The [structured result](./M06-fixed-image-extraction.json) records the smoke
check measurements.
