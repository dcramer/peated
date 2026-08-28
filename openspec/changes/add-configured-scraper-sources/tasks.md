## 1. Data Model And Source Identity

- [x] 1.1 Add one configured scraper per external site and immutable config-version tables with one active version pointer
- [x] 1.2 Add admin ownership to scraper targets, origins, and site mappings so code definition sync preserves admin rows
- [x] 1.3 Pin configured scraper and config version ids on durable scraper runs
- [x] 1.4 Generate and inspect the database migration and add schema constraint tests
- [x] 1.5 Add bounded dynamic site keys while retaining a narrow registered-source type for code adapters

## 2. Config Interpreter And Validation

- [x] 2.1 Define the version 1 common, review, and store-price config schemas
- [x] 2.2 Implement shared HTML field reading and bounded detail-link discovery without database or network access
- [x] 2.3 Implement review article parsing into the existing strict ingestion schema
- [x] 2.4 Implement store-price parsing into the existing strict price schema
- [x] 2.5 Add typed production validation results
- [x] 2.6 Add synthetic parser tests for single and repeated reviews, products, invalid fields, unrelated markup, and selector changes

## 3. Version And Administration Services

- [x] 3.1 Add moderator-owned site and configured scraper creation with conservative target defaults and robots enforcement
- [x] 3.2 Add draft creation, list, details, disablement, and immutable history services
- [x] 3.3 Add preview storage that contains structured output and warnings but no fetched HTML or publisher prose
- [x] 3.4 Add atomic activation and rollback that require current passing validation
- [ ] 3.5 Add integration tests for permissions, ownership, version immutability, activation, rollback, and sync preservation

## 4. Runtime Integration

- [x] 4.1 Resolve code-owned or configured source definitions at run creation and pin the configured version
- [x] 4.2 Execute preview and normal collection through the governed scraper session with the same parser and validator
- [x] 4.3 Route review observations to external-review ingestion and price observations to external-site-id price ingestion
- [x] 4.4 Keep preview isolated from product writes and add run, replay, deferral, and failure tests
- [x] 4.5 Surface configured scraper readiness and validation failures through external-site health

## 5. LLM Draft Generation

- [x] 5.1 Add the stable prompt and strict output contract for one-call config generation
- [x] 5.2 Enforce per-collection LLM permission immediately before model access and disable provider storage
- [x] 5.3 Store valid output as a draft with model, prompt, and engine provenance and redact fetched content from failures
- [ ] 5.4 Add deterministic boundary tests and a focused eval fixture set for review and price config generation

## 6. Moderator API And Admin UI

- [x] 6.1 Add moderator routes for site creation and configured scraper creation, listing, draft generation, preview, activation, rollback, and disablement
- [ ] 6.2 Add route integration tests for authorization, validation, conflicts, and preview isolation
- [x] 6.3 Add an Admin Scrapers Add Site flow with review or store-price collection choice
- [x] 6.4 Add the site Parsing tab with active version, drafts, generation, preview, activation, disablement, history, and rollback controls

## 7. Verification And Pilot

- [x] 7.1 Document the configured scraper ownership boundaries, config format, admin procedure, and rollback path
- [x] 7.2 Run targeted server and web tests, server and web typechecks, lint, and formatting
- [ ] 7.3 Run one manual admin smoke check for add, generate, preview, activate, run, repair, disable, and rollback
- [ ] 7.4 Pilot one new review source and one simple store source while keeping existing code adapters unchanged
- [x] 7.5 Validate the OpenSpec change and record any measured follow-up instead of expanding the first config language speculatively
