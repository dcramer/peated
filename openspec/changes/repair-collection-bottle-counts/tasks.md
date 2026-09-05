## 1. Shared Collection count owner

- [x] 1.1 Add integration tests for count changes, old undercounts, missing Collections, checking, and one-Collection repair.
- [x] 1.2 Add the small Collection Bottle count module.

## 2. Membership operations

- [x] 2.1 Use the shared owner for Collection Bottle creation and deletion.
- [x] 2.2 Make failed image-upload cleanup change the count only when it removes the created membership.
- [x] 2.3 Use the shared owner for Bottle merge membership moves and duplicate cleanup.
- [x] 2.4 Verify status and image updates leave Collection counts unchanged.

## 3. Production repair

- [x] 3.1 Add and register a strict, unique Collection Bottle count repair job.
- [x] 3.2 Queue the Collection repair from the existing admin Bottle-count action and update its dispatch test.

## 4. Verification

- [x] 4.1 Add focused overlap coverage proving concurrent membership changes and repair preserve the final count.
- [x] 4.2 Run focused backend tests, server typecheck, lint, formatting, terminology checks, and strict OpenSpec validation.
