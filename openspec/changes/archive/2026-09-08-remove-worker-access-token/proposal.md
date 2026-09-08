## Why

Production scraper workers authenticate to the Peated API with a seven-day human access token, so unattended imports stop persisting data when that credential expires. Workers already run as a trusted Peated server process with direct database and queue access, making the human HTTP credential both unreliable and the wrong identity boundary.

## What Changes

- Replace worker-to-API mutation calls with shared internal mutation capabilities.
- Attribute automated catalog and listing changes to the durable Peated system actor.
- Preserve the existing HTTP routes by having them use the same underlying capabilities after normal user authorization.
- Remove the worker's runtime dependency on `ACCESS_TOKEN` for scraper persistence.
- Keep each system capability narrow rather than introducing a general system superuser or non-expiring administrator token.

## Capabilities

### New Capabilities

- `worker-system-mutations`: Trusted worker jobs can perform the specific catalog, listing, review, image, and scraper-configuration mutations they own without a human API credential, with system attribution and existing validation preserved.

### Modified Capabilities

None.

## Impact

- Affects scraper orchestration and Whisky Advocate jobs in `apps/server`.
- Refactors the owning bottle, price, review, image, and external-site configuration logic so API routes and workers share it.
- Removes `ACCESS_TOKEN` as a required worker deployment secret; user-issued access tokens and public API behavior are unchanged.
