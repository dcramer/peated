## 1. BottleGroup Count Owner

- [x] 1.1 Add an independent BottleGroup Bottle-count check to the existing BottleGroup statistics module.
- [x] 1.2 Add a one-group repair that locks and rechecks before saving only the Bottle total.
- [x] 1.3 Cover correct, wrong, empty, missing, and repeated repairs with integration tests.

## 2. Catalog Writes

- [x] 2.1 Change Bottle deletion to lock the BottleGroup before its member Bottles and preserve its existing checks and results.
- [x] 2.2 Verify creation, field updates, deletion, same-group merges, and cross-group merges keep totals correct.
- [x] 2.3 Cover repair overlapping a normal group write without losing the committed total.

## 3. Admin Repair

- [x] 3.1 Add and register a strict, unique BottleGroup count repair job.
- [x] 3.2 Start the job from the existing admin action and use general plain-language Maintenance copy.
- [x] 3.3 Cover worker input, repeat-safe repair, administrator permission, and unique dispatch.

## 4. Checks

- [x] 4.1 Run focused tests, server and web typechecks, lint, formatting, and strict OpenSpec validation.
