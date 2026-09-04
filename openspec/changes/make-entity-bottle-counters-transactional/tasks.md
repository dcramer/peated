## 1. Shared Bottle Count Code

- [x] 1.1 List the Bottle write paths and define the saved Bottle links needed before and after a change.
- [x] 1.2 Update Entity Bottle counts in the Bottle transaction, and reject missing Entities or negative counts.
- [x] 1.3 Add a separate way to check and repair Entity Bottle counts.

## 2. Bottle Writes

- [x] 2.1 Update Bottle creation and editing transactions to maintain Entity Bottle totals.
- [x] 2.2 Update Bottle deletion and Bottle merge transactions to maintain Entity Bottle totals.
- [x] 2.3 Update Entity merge transactions to maintain target Entity Bottle totals.

## 3. Queue And Repair Code

- [x] 3.1 Stop Entity statistics jobs from recalculating Bottle totals while preserving the remaining tasting and location work.
- [x] 3.2 Leave the Entity CLI unchanged and keep check and repair code on the server.
- [x] 3.3 Repair wrong counts one Entity at a time while Bottle edits continue.
- [x] 3.4 Add a strict worker job and an admin-only route that starts one active repair.
- [x] 3.5 Add the repair action to the admin Automation screen with clear start and failure states.

## 4. Checks

- [x] 4.1 Add integration coverage for create, relationship update, delete, Bottle merge, duplicate roles, and concurrent changes.
- [x] 4.2 Test correct, wrong, zero, selected, and repaired Entity Bottle counts.
- [x] 4.3 Run focused tests, server typechecks, lint, formatting, and OpenSpec validation.
- [x] 4.4 Test the repair lock, worker retries, admin permission, and dispatch behavior.
- [x] 4.5 Run focused tests, server and web typechecks, lint, formatting, and OpenSpec validation for the repair job.
- [x] 4.6 Simplify count-change code, names, logs, admin copy, and matching documentation.
