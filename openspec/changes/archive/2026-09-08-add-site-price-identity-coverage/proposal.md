## Why

Source-identity quality differs by retailer, so a global catalog total can hide a broken or incomplete scraper. Administrators and API clients need one small read-only endpoint that reports the current identity coverage for a specific external site.

## What Changes

- Add an administrator-only API endpoint for one external site's StorePrice identity coverage.
- Return live counts for visible listings, exact Bottle assignments, unresolved listings, stable source product ids, and source fingerprints.
- Keep row inspection on the existing StorePrice list API.
- Add no persistence, background work, UI, percentages, or historical event tracking.

## Capabilities

### New Capabilities

- `site-price-identity-coverage`: Per-site, API-driven StorePrice identity coverage for administrators.

### Modified Capabilities

None.

## Impact

- Adds one oRPC route under the external-site price API.
- Reads `external_site` and `store_price` only.
- Adds focused server integration coverage and route registration.
