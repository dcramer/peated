## 1. Data Model and Contracts

- [x] 1.1 Add shared advanced-rating constants, bands, types, and deterministic band tests
- [x] 1.2 Add tasting score, user rating-system preference, and Bottle/BottleGroup advanced aggregate fields to database schemas
- [x] 1.3 Generate and inspect the Drizzle migration with score range and rating-system exclusivity constraints
- [x] 1.4 Extend tasting, user, Bottle, and BottleGroup API schemas and serializers with explicit advanced-rating documentation

## 2. Server Behavior

- [x] 2.1 Support creating, replacing, clearing, and validating advanced tasting scores independently from simple ratings
- [x] 2.2 Dispatch Bottle and BottleGroup score recomputation after tasting create, update, and delete operations
- [x] 2.3 Extend authoritative activity aggregation to exact-Bottle and BottleGroup advanced scores
- [x] 2.4 Persist and serialize the user's preferred rating system through the existing user update route
- [x] 2.5 Add independent bottle advanced-score sorting and minimum-score filtering
- [x] 2.6 Add integration tests for score validation, exclusivity, replacement, preferences, aggregate separation, and BottleGroup scope

## 3. Web Experience

- [x] 3.1 Add shared 100-point score display and input components with compact band guidance and accessible behavior
- [x] 3.2 Add Simple/100-point selection to the shared tasting form with preference and existing-tasting initialization
- [x] 3.3 Add the rating-system preference to account settings
- [x] 3.4 Display advanced scores on tastings and separate community score summaries on exact-Bottle and release-family pages
- [x] 3.5 Apply the uniform Peated score-band presentation to permitted native 100-point critic scores without combining aggregates
- [x] 3.6 Add a static public ratings-methodology page and link it from advanced rating inputs and relevant summaries
- [x] 3.7 Add focused web tests and manually verify the changed tasting workflow at desktop and mobile widths

## 4. Documentation and Verification

- [x] 4.1 Rewrite internal rating architecture and feature docs to match implemented coexistence behavior and add any new docs to AGENTS.md
- [x] 4.2 Run targeted formatting, lint, server/web typechecks, and relevant test suites; resolve all failures
