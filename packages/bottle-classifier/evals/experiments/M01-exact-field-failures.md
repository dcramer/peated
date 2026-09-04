# M01: exact field failures

**Accepted.** This changes eval reporting only. It does not change classifier
instructions, inputs, model calls, decisions, or scores.

The creation check previously reduced every expected Bottle-field difference to:

```text
proposedBottle missing expected fields
```

It now reports each difference separately. For example:

```text
proposedBottle.brand.id expected 1169 but was missing
proposedBottle.distillers[0].id expected 1953 but got 238555
```

The comparison keeps the previous rules: expected objects and arrays are subsets,
extra actual fields are allowed, array positions remain significant, and `null`
is different from a missing value. Long values are shortened in the message.

| Measure                     |    Result |
| --------------------------- | --------: |
| Classifier accuracy         | Unchanged |
| Model calls                 |         0 |
| Model input / output tokens |     0 / 0 |
| Model cost                  |        $0 |
| Model time                  |       0 s |

Validation:

- Four focused tests cover extra fields, nested differences, missing fields,
  arrays, and `null`.
- All 394 package tests passed during the first verification run.
- The package typecheck and lint passed.
