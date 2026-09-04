## 1. Versioned rule contract

- [x] 1.1 Add strict version 2 value and scrape-rule schemas with bounded selector, fixed value, prefix filtering, joining, and literal cleanup or additions at either end
- [x] 1.2 Keep version 1 schema and interpretation frozen, and dispatch stored revisions by `rulesVersion`
- [x] 1.3 Add schema tests for valid operations, conflicting inputs, unsupported keys, and every size or count bound

## 2. Version 2 parsing

- [x] 2.1 Implement the documented value-operation order with case-insensitive literal matching and source-spelling preservation
- [x] 2.2 Report bounded errors for excessive joined matches and treat empty cleanup results as missing values
- [x] 2.3 Add parser fixtures for Whisky Study title and score layouts, Whisky Saga tasting paragraphs, and a fixed-volume prefixed price
- [x] 2.4 Prove existing version 1 parser fixtures produce unchanged output

## 3. Authoring and runtime

- [x] 3.1 Save new manual and AI revisions as version 2 while continuing to load and activate version 1 revisions
- [x] 3.2 Extend AI setup schemas, instructions, and checks to generate only supported version 2 operations
- [x] 3.3 Update the admin rules editor and revision display for version 2 rules without hiding the stored version
- [x] 3.4 Extend the local no-write preview input with `rulesVersion`, defaulting omitted input to version 1

## 4. Verification and pilots

- [x] 4.1 Run focused parser, service, runtime, route, CLI, typecheck, lint, and formatting checks
- [x] 4.2 Run local no-write full previews for Whisky Study and Whisky Saga and compare URLs, names, reviewers, dates, scores, review evidence, and item counts with stored records
- [ ] 4.3 Run a local no-write full preview for one small price source and compare names, prices, currency, volume, URLs, images, Bottle matches, and item count with its current scraper
- [ ] 4.4 Only after exact parity, create inactive production revisions, pass production previews, activate the pilot sources, restore their prior schedules, run once, and verify stored IDs and relationships remain unchanged
