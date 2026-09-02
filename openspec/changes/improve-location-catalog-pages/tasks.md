## 1. Production Location Data

- [x] 1.1 Add one distillery-based bottle-location rule and use it in country and region count jobs
- [x] 1.2 Add country and region production-location filters to the bottle list API
- [x] 1.3 Add a region category summary and align the country summary with the shared location rule
- [x] 1.4 Add or update server tests for origin, bottle filters, category summaries, and count jobs

## 2. Catalog Page Structure

- [x] 2.1 Add the smallest shared static distribution component needed by both location overviews, with focused tests or stories
- [x] 2.2 Add a Storybook catalog detail page example and a short maintainer pointer

## 3. Location Pages

- [x] 3.1 Refactor the location frame to use shared page components and explicit country or region inputs
- [x] 3.2 Add country Overview, Bottles, Distillers, and existing Regions sections under one route layout
- [x] 3.3 Add region Overview, Bottles, and Distillers sections under one route layout
- [x] 3.4 Add focused web tests for location tab and optional-section logic
- [x] 3.5 Reuse the homepage region cards on country overviews
- [x] 3.6 Add latest releases and the most recorded distilleries to country and region overviews
- [x] 3.7 Update location route fixtures and coverage for the added overview reads
- [x] 3.8 Align discovery sections with catalog page components while preserving the homepage region renderer

## 4. Verification

- [x] 4.1 Run focused server and web tests, typechecks, lint, and format checks
- [x] 4.2 Run Storybook and desktop/mobile browser QA for representative country and region pages
- [x] 4.3 Record the separate production count update without performing production writes
- [x] 4.4 Re-run focused web tests, typecheck, lint, format, and desktop/mobile browser QA
- [x] 4.5 Verify the catalog-aligned follow-up with focused checks and browser QA
