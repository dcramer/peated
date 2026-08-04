## Why

Full store-price classifier runs already return Bottle findings and proposed operations, but most callers discard them because linked Bottle-check persistence is opt-in. Initial ingestion and bulk retries should retain the same review evidence as individual retries without requiring each caller to know about a feature flag.

## What Changes

- Persist a linked Bottle check after every full store-price classifier run, including initial ingestion and bulk or individual retries.
- Commit the primary proposal, match attempt, and linked check together before automation can begin.
- Remove the `generateBottleCheck` option from store-price resolution and job payloads.
- Keep the store-price match proposal as the authoritative pricing decision while exposing supplemental Bottle operations through the existing Incoming Listings review flow.
- Leave deterministic alias matches, source identity, image capture ordering, post-create audits, and other classifier consumers unchanged.

## Capabilities

### New Capabilities

- `store-price-bottle-checks`: Defines when store-price classification persists linked Bottle review evidence and how it relates to the primary price-match proposal.

### Modified Capabilities

None.

## Impact

This affects the store-price match resolver, its background-job and retry callers, targeted server tests, and the store-price matching feature documentation. It does not require a database migration, classifier prompt change, or new review UI.
