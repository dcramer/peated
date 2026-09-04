## 1. Shared Location Count Code

- [x] 1.1 Read each active Bottle's distinct Country and Region sets and apply before-and-after count changes.
- [x] 1.2 Add independent checks and one-location repair functions for Country and Region Bottle totals.
- [x] 1.3 Repair an old undercount inside the current catalog transaction instead of blocking a valid decrease.

## 2. Catalog Writes

- [x] 2.1 Update Bottle creation and shared Distillery edits to maintain location Bottle totals.
- [x] 2.2 Update Bottle deletion and Bottle merges to maintain location Bottle totals.
- [x] 2.3 Update Distillery location edits and verify Entity merges use the same Bottle write rule.

## 3. Queue And Admin Repair

- [x] 3.1 Stop Country and Region statistics jobs from recalculating Bottle totals while preserving Distillery totals.
- [x] 3.2 Add a strict, unique location repair job that repairs one Country or Region per transaction.
- [x] 3.3 Start both Bottle-count repairs from the existing admin action and update its plain-language copy.

## 4. Checks

- [x] 4.1 Cover Bottle creation, Distillery updates, deletion, merges, and duplicate locations with integration tests.
- [x] 4.2 Cover Distillery location moves, concurrent changes, and old undercounts with integration tests.
- [x] 4.3 Cover independent checks, repairs, worker input, admin permission, and unique dispatch.
- [x] 4.4 Run focused tests, server and web typechecks, lint, formatting, and strict OpenSpec validation.
