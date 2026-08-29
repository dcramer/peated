## 1. Data Model And Source Identity

- [x] 1.1 Add one scrape source per site, immutable revisions, and run links with one active revision
- [x] 1.2 Mark scraper targets, origins, and site mappings as managed by code or an admin
- [x] 1.3 Use foreign keys to pin each run to a source and one of its revisions
- [x] 1.4 Generate and inspect the replacement migration and run schema constraint tests
- [x] 1.5 Keep site keys dynamic and source kinds limited to code-supported values

## 2. Rules And Validation

- [x] 2.1 Define rules version 1 for review and price sources
- [x] 2.2 Read a limited number of detail links and fields without database or network access
- [x] 2.3 Parse review articles into the existing validated review format
- [x] 2.4 Parse store prices into the existing strict price schema
- [x] 2.5 Store typed test results without HTML or publisher prose
- [x] 2.6 Add synthetic parser tests for valid and broken pages

## 3. Revision And Admin Services

- [x] 3.1 Create a site and first source with conservative network defaults
- [x] 3.2 Create immutable revisions and list revision history
- [x] 3.3 Permit same-origin list URL changes through a new revision
- [x] 3.4 Require a passing test for activation and rollback
- [x] 3.5 Add integration tests for authorization and route errors
- [x] 3.6 Derive the internal site key and initial list page from the website URL

## 4. Runtime Integration

- [x] 4.1 Pin collection and preview runs to one source revision
- [x] 4.2 Use the same request controls and parser for preview and collection
- [x] 4.3 Send review and price results to their existing storage paths
- [x] 4.4 Keep preview isolated from product writes
- [x] 4.5 Show scrape source readiness in external-site health

## 5. AI Suggestions

- [x] 5.1 Use one stable set of AI instructions and a strict output schema
- [x] 5.2 Check source AI permission immediately before AI access
- [x] 5.3 Store the AI model name and instructions version with each valid inactive revision
- [x] 5.4 Add an end-to-end review suggestion eval fixture
- [x] 5.5 Add an end-to-end price suggestion eval fixture
- [x] 5.6 Let one AI request choose from the main page and up to four likely pages on the same website
- [x] 5.7 Parse up to three current detail pages before saving AI-generated rules
- [x] 5.8 Require a second AI response with fixed fields to review parsed fields against the HTML
- [x] 5.9 Cover code rejection and run both live suggestion evals

## 6. Admin API And UI

- [x] 6.1 Add admin routes for creation, list, revision, suggestion, preview, activation, rollback, and pause
- [x] 6.2 Add route integration tests for authorization, validation, and conflicts
- [x] 6.3 Add an Admin Scrapers Add Site flow with review or price choice
- [x] 6.4 Add the Parsing tab with list URL, rules, preview, active revision, history, and rollback
- [x] 6.5 Remove the short-name and list-page decisions from the Add Site form
- [x] 6.6 Default new sources to allow AI-generated parsing rules

## 7. Verification And Pilot

- [x] 7.1 Document terms, ownership, rules version, admin flow, and rollback
- [x] 7.2 Run focused tests, typechecks, lint, format, and OpenSpec validation
- [x] 7.3 Run one manual admin smoke check without browser test coverage
- [ ] 7.4 Pilot one review source and one simple price source
- [x] 7.5 Run focused tests, both live suggestion evals, typecheck, lint, format, and OpenSpec validation

## 8. Guided AI Setup And Pagination

- [x] 8.1 Remove the AI opt-out and queue AI setup when an admin adds a site
- [x] 8.2 Add an optional next-page selector with a code-owned five-page limit
- [x] 8.3 Prove pagination with parser, runtime, route, and live eval coverage
- [x] 8.4 Update the admin flow and plain-language documentation
- [x] 8.5 Run focused tests, both live evals, typecheck, lint, format, and OpenSpec validation
