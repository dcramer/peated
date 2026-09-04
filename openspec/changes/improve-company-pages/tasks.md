## 1. Company Portfolio API

- [x] 1.1 Add a cycle-safe recursive Company descendant query that returns portfolio Entities, direct Company children, exact totals, stable sorting, and bounded pagination
- [x] 1.2 Add the Company portfolio contract, route, router registration, serializers, and focused integration tests for direct, nested, deep, empty, and stable-order results
- [x] 1.3 Add representative Company portfolio responses to the mock API for ordinary, sparse, and nested ownership pages

## 2. Company Bottle Scope

- [x] 2.1 Add a Company filter to the Bottle list contract and implement distinct matching through the Company itself and every descendant Entity used by a Bottle
- [x] 2.2 Add Bottle list integration tests for indirect ownership, direct Company relationships, several matching descendants, inactive Bottles, exact totals, sorting, and pagination
- [x] 2.3 Add representative recursive Company Bottle responses to the mock API

## 3. Company Page Structure

- [x] 3.1 Update Entity page data helpers to expose Company Portfolio and Bottle tabs from computed totals without changing non-Company tabs
- [x] 3.2 Make the Brands and Distilleries previews recursive, add an optional Bottlers preview, and move direct Companies into a Companies in this group section using existing Entity rows and section states
- [x] 3.3 Add the nested Company Portfolio page with kind filters, exact totals, deterministic sorting, pagination, and immediate-owner path context
- [x] 3.4 Update the existing Company Bottles page to use the recursive Company scope under the shared Entity header
- [x] 3.5 Add focused web tests for Company tabs, categorized preview totals and links, directly owned Companies, sparse content, and local loading or error states

## 4. Verification

- [x] 4.1 Run focused server and web tests, server and web typechecks, lint, and formatting for the affected files
- [x] 4.2 Run desktop and mobile browser QA for Suntory-like nested ownership, a direct-only Company, a Company with direct Bottles, and an empty Company
- [x] 4.3 Verify recursive query plans and response sizes for representative small and large Company trees
- [x] 4.4 Confirm the final diff contains no migration, production data write, ownership-model change, or unrelated visual-system change
