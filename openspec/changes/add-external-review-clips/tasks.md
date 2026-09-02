## 1. Clip Storage And Generation

- [x] 1.1 Add the nullable external review clip column and generate its database migration
- [x] 1.2 Add and test the bounded Luna clip function with the global off switch and null failure result
- [x] 1.3 Extend the review observation and storage shapes without persisting complete review text

## 2. Scraper Ingestion

- [x] 2.1 Pass each supported adapter's per-review text through the shared observation
- [x] 2.2 Generate clips during shared ingestion and preserve existing clips when generation fails
- [x] 2.3 Test successful, missing, disabled, and failed clip generation during ingestion

## 3. Public Display

- [x] 3.1 Return the nullable clip from the external review API
- [x] 3.2 Show clips on Bottle review cards and prefer them in the community feed
- [x] 3.3 Test API and web behavior with and without a stored clip

## 4. Documentation And Verification

- [x] 4.1 Update the external review guide and remove stale source-specific AI permission language
- [x] 4.2 Run tests, live model checks, typechecks, lint, formatting, and OpenSpec validation
- [x] 4.3 Manually check a Bottle review card at desktop and mobile widths
