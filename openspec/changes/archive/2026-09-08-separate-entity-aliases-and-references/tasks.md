## 1. Contract

- [x] 1.1 Define EntityReference, EntityAlias, and short-name behavior.
- [x] 1.2 Update owning Entity identity and classifier documentation.

## 2. Storage And Exact Resolution

- [x] 2.1 Rename current EntityAlias schema and automatic matching services to EntityReference.
- [x] 2.2 Add EntityAlias storage with per-Entity normalized uniqueness and moderator ownership.
- [x] 2.3 Generate and inspect the lossless schema migration.

## 3. Alias And Reference Operations

- [x] 3.1 Move existing moderator matching-name routes to EntityReference terminology.
- [x] 3.2 Add moderator alias create, delete, and list behavior.
- [x] 3.3 Include `shortName` in alias reads and prevent alias deletion.
- [x] 3.4 Preserve references and aliases during Entity merge.

## 4. Consumers

- [x] 4.1 Update Entity create, update, Bottle resolution, and collision consumers.
- [x] 4.2 Update search indexing and classifier evidence to use the correct name collection.
- [x] 4.3 Update fixtures, API mocks, and the Entity alias page.

## 5. Verification

- [x] 5.1 Add or update focused schema, service, route, search, and merge tests.
- [x] 5.2 Run focused tests, server and web typechecks, lint, and format checks.
