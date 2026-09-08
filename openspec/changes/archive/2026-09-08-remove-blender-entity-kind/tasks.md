## 1. Database cutover

- [x] 1.1 Generate a custom data migration that reclassifies every Blender as a Bottler
- [x] 1.2 Remove Blender from the Entity enum and generate the schema migration
- [x] 1.3 Verify the ordered migrations against the test database

## 2. Server and classifier contracts

- [x] 2.1 Remove Blender from shared Entity schemas, classifiers, jobs, CLI policy, and tests
- [x] 2.2 Remove the Blender list route, contract, mock route, router registration, and tests
- [x] 2.3 Remove the Blender global-search scope and statistics field from server contracts and implementations

## 3. Web application

- [x] 3.1 Remove the Blender catalog route, navigation, URL mapping, sitemap, and entity-page branches
- [x] 3.2 Update affected web mocks, stories, and tests for the four-kind contract

## 4. Documentation and verification

- [x] 4.1 Update the entity identity source of truth and affected OpenSpec references
- [x] 4.2 Run focused tests, server and web typechecks, lint, format, and OpenSpec validation
- [x] 4.3 Record the production Woven merge handoff from Entity 5761 into Entity 461
  - After deployment, merge source Entity `5761` (`Woven Whisky`) into survivor
    Entity `461` (`Woven`) through the existing moderator merge operation.
    This code change does not mutate production data directly.
