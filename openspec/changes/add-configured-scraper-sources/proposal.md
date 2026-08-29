## Why

Peated has one code adapter for each review publisher or store. This does not
scale to a large source catalog. Routine page changes also require a deploy.
Admins need a safe way to add a source, test its parsed output, repair it, and
return to an older revision.

## What Changes

- Store scrape sources and immutable parsing-rule revisions in PostgreSQL.
- Support `review` and `price` as explicit source kinds. Reserve `event` until
  event match and update rules exist.
- Run all saved sources through one shared parser and the existing request,
  review, and price controls.
- Require a passing preview before an admin can activate a revision.
- Allow AI parsing suggestions by default for new sources, with an admin
  opt-out. Code tests proposed rules against current pages, and a second AI
  request checks the parsed fields before an inactive revision is saved. AI cannot
  activate revisions or change network access.
- Add admin controls to create a site and source, edit the list URL and parsing
  rules, preview a revision, activate it, view history, roll back, and pause it.
- Keep existing code sources available.

## Capabilities

### New Capabilities

- `configured-scraper-sources`: Saved scrape sources, versioned parsing rules,
  preview, activation, rollback, AI suggestions, and admin controls.

### Modified Capabilities

None.

## Impact

- Adds source, revision, and run-link tables.
- Marks scraper targets, origins, and site mappings as managed by code or an
  admin.
- Lets scraper runs load saved sources.
- Adds admin-only routes and UI.
- Reuses the existing review and price storage code.
