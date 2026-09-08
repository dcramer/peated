## 1. Shared release-total owner

- [x] 1.1 Add integration tests for BottleSeries membership lookup, count changes, old undercounts, missing series, checking, and one-series repair.
- [x] 1.2 Add the small BottleSeries release-count module and make new BottleSeries rows start at zero.

## 2. Normal Bottle operations

- [x] 2.1 Use the shared owner for Bottle creation and shared series changes, with integration coverage for existing, new, old, and removed series.
- [x] 2.2 Use the shared owner for Bottle deletion, including deletion when the saved total is already wrong.
- [x] 2.3 Use the shared owner for same-series and cross-series Bottle merges.

## 3. Catalog merges

- [x] 3.1 Remove BottleSeries merge recount ownership and cover grouped and ungrouped Bottle moves.
- [x] 3.2 Remove Entity merge recount ownership and verify moved, combined, and unchanged BottleSeries totals.

## 4. Production repair

- [x] 4.1 Add and register a strict, unique BottleSeries release-total repair job.
- [x] 4.2 Queue the BottleSeries repair from the existing admin Bottle-count action and update its dispatch tests.

## 5. Verification

- [x] 5.1 Add focused overlap coverage proving concurrent Bottle changes and repair preserve the final total.
- [x] 5.2 Run focused backend tests, server and web typechecks, lint, formatting, terminology checks, and strict OpenSpec validation.
- [x] 5.3 Return a controlled conflict for an invalid BottleGroup representative during BottleSeries merge and cover rollback.
- [x] 5.4 Reject an Entity merge before catalog mutation when an affected Bottle has not completed BottleGroup migration.
