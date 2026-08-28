## Why

Peated adds and maintains one code adapter for each review or price source. This
does not scale to a large source catalog, and routine publisher markup changes
still require code changes. Administrators need one safe way to add a source,
preview its output, repair it, and roll back a bad change.

## What Changes

- Add versioned database configs for review and store-price collection.
- Keep the collection kind explicit so a later event scraper can reuse the
  same version and run lifecycle after its match and update rules are defined.
- Add one shared configured scraper that reads an active config and emits the
  existing strict review or store-price observation.
- Add draft preview and validation before activation. New and repaired configs
  use the same flow.
- Add an LLM helper that may create a draft config but cannot activate it or
  change fetch permissions.
- Add Admin controls to create a configured source, choose what it collects,
  preview draft output, activate a version, inspect history, roll back, and
  disable collection.
- Keep origins, robots rules, request limits, review publication policy, Bottle
  matching, and product persistence in their current owning boundaries.
- Keep existing code adapters working during an incremental migration.

## Capabilities

### New Capabilities

- `configured-scraper-sources`: Database-backed scraper config versions,
  validated review and store-price extraction, draft repair, activation,
  rollback, and the administrator workflow that controls them.

### Modified Capabilities

None.

## Impact

- Adds scraper config and config-version storage to the server database.
- Extends the scraper runtime with a generic configured adapter while retaining
  current source adapters.
- Adds moderator-only server routes and Admin UI for source setup, preview,
  activation, repair, history, rollback, and disablement.
- Adds an optional scraper-workload LLM call with strict output validation and
  provider storage disabled.
- Reuses existing external-review and store-price ingestion boundaries.
