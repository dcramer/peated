## 1. Retrieval And Ranking

- [x] 1.1 Add an operator-safe prefix query helper with complete-match rank precedence.
- [x] 1.2 Apply prefix retrieval and stable identifier tie-breakers to Bottle and Entity routes.
- [x] 1.3 Exclude ignored aliases from Library exact-alias search.

## 2. Global Search

- [x] 2.1 Propagate available source failures and preserve unauthenticated user-search behavior.
- [x] 2.2 Promote exact matches and interleave remaining result sources deterministically.
- [x] 2.3 Prevent stale or failed client requests from presenting Bottle creation as a valid no-match action.

## 3. Index Freshness

- [x] 3.1 Persist a canonical initial search vector with new Bottles.
- [x] 3.2 Refresh related Bottle vectors when an Entity search name changes.

## 4. Verification

- [x] 4.1 Add focused route tests for prefix recall, complete-match ranking, blending, failures, stable pagination, and ignored aliases.
- [x] 4.2 Add creation and Entity-update tests for immediate and related index freshness.
- [x] 4.3 Run relevant tests, typechecks, lint, formatting, and OpenSpec validation.
