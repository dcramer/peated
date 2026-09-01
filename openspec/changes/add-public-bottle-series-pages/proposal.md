## Why

Bottle Series are durable catalog records, but people can only encounter them as hidden Bottle metadata or an opaque Bottle catalog filter. Peated needs a public Series destination that explains the collection, lists its Bottles, and makes movement between one Bottle and the rest of its Series direct and predictable.

## What Changes

- Treat Bottle Series as permanent public catalog objects with canonical URLs and Peated IDs.
- Add a dedicated Series page with Brand context, description, Bottle count, and a paginated Bottle list.
- Link Series references and global search results to the dedicated page.
- Add an "Other bottles in this series" section to Bottle pages, built from existing Bottle rail and list components, with a link to the complete Series page.
- Preserve public Series identity when duplicate Series are merged. **BREAKING**: populated Series can no longer be deleted without a destination.

## Capabilities

### New Capabilities

- `bottle-series-catalog`: Public identity, routing, lifecycle, discovery, Series pages, and Bottle-page navigation for Bottle Series.

### Modified Capabilities

None.

## Impact

- Bottle Series schemas, serializers, API routes, search, Peated ID parsing, and catalog lifecycle behavior.
- Web catalog URLs, canonical routing, metadata, sitemaps, search results, Series pages, and Bottle overview composition.
- Database schema and generated migration metadata for Series tombstones.
- Focused server and web tests plus desktop and mobile UI verification.
