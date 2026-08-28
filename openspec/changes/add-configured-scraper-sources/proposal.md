## Why

Peated has one code adapter for each review publisher or store. This does not
scale to a large source catalog. Routine page changes also require a deploy.
Admins need a safe way to add a source, test its parsed output, repair it, and
return to an older revision.

## What Changes

- Store scrape sources and immutable parsing-rule revisions in PostgreSQL.
- Support `review` and `price` as explicit source kinds. Reserve `event` until
  event match and update rules exist.
- Run all database sources through one shared parser and the existing request
  controls and product sinks.
- Require a passing preview before an admin can activate a revision.
- Let AI suggest a draft only for an allowed source. AI cannot activate it or
  change network access.
- Add admin controls to create a site and source, edit the list URL and parsing
  rules, preview a revision, activate it, view history, roll back, and pause it.
- Keep existing code sources available.

## Capabilities

### New Capabilities

- `configured-scraper-sources`: Database-backed scrape sources, revisioned
  parsing rules, preview, activation, rollback, AI suggestions, and admin
  controls.

### Modified Capabilities

None.

## Impact

- Adds source, revision, and run-link tables.
- Marks scraper targets, origins, and site mappings as managed by code or an
  admin.
- Adds a database source resolver to the scraper runtime.
- Adds admin-only routes and UI.
- Reuses the existing external-review and store-price ingestion boundaries.
