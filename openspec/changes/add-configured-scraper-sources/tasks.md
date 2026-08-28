## 1. Data Model And Source Identity

- [x] 1.1 Add one scrape source per site, immutable revisions, and run links with one active revision
- [x] 1.2 Mark scraper targets, origins, and site mappings as managed by code or an admin
- [x] 1.3 Use composite foreign keys to keep runs, sites, sources, and revisions consistent
- [x] 1.4 Generate and inspect the replacement migration and run schema constraint tests
- [x] 1.5 Keep site keys dynamic and source kinds limited to code-supported values

## 2. Rules And Validation

- [x] 2.1 Define rules format 1 for review and price sources
- [x] 2.2 Read bounded detail links and fields without database or network access
- [x] 2.3 Parse review articles into the existing strict ingestion schema
- [x] 2.4 Parse store prices into the existing strict price schema
- [x] 2.5 Store typed test results without HTML or publisher prose
- [x] 2.6 Add synthetic parser tests for valid and broken pages

## 3. Revision And Admin Services

- [x] 3.1 Create a site and first source with conservative network defaults
- [x] 3.2 Create immutable revisions and list revision history
- [x] 3.3 Permit same-origin list URL changes through a new revision
- [x] 3.4 Require a passing test for activation and rollback
- [ ] 3.5 Add integration tests for authorization and route errors

## 4. Runtime Integration

- [x] 4.1 Pin collection and preview runs to one source revision
- [x] 4.2 Use the same governed request session and parser for preview and collection
- [x] 4.3 Send review and price observations to their existing sinks
- [x] 4.4 Keep preview isolated from product writes
- [x] 4.5 Show scrape source readiness in external-site health

## 5. AI Suggestions

- [x] 5.1 Use one stable prompt and a strict structured output schema
- [x] 5.2 Check source AI permission immediately before model access
- [x] 5.3 Store model and prompt provenance with valid draft rules
- [ ] 5.4 Add focused review and price suggestion eval fixtures

## 6. Admin API And UI

- [x] 6.1 Add admin routes for creation, list, draft, suggestion, preview, activation, rollback, and pause
- [ ] 6.2 Add route integration tests for authorization, validation, and conflicts
- [x] 6.3 Add an Admin Scrapers Add Site flow with review or price choice
- [x] 6.4 Add the Parsing tab with list URL, rules, preview, active revision, history, and rollback

## 7. Verification And Pilot

- [x] 7.1 Document terms, ownership, rules format, admin flow, and rollback
- [x] 7.2 Run focused tests, typechecks, lint, format, and OpenSpec validation
- [ ] 7.3 Run one manual admin smoke check without browser test coverage
- [ ] 7.4 Pilot one review source and one simple price source
