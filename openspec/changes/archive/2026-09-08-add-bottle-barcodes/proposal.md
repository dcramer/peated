## Why

Peated cannot currently retain or resolve the retail barcodes printed on bottle
packages. Adding canonical barcode mappings now creates a durable lookup key for
scanning and prepares the catalog for later evidence-backed source imports.

## What Changes

- Store multiple normalized GTIN barcodes against one exact Bottle.
- Validate supported GTIN lengths and check digits before persistence.
- Expose public barcode listing and exact barcode-to-Bottle lookup operations.
- Allow moderators to add and remove canonical barcode mappings.
- Prevent one normalized GTIN from being assigned to more than one Bottle.

## Capabilities

### New Capabilities

- `bottle-barcodes`: Canonical GTIN storage, lookup, and moderator management for exact Bottles.

### Modified Capabilities

None.

## Impact

- Adds a database table and generated migration under `apps/server`.
- Adds barcode normalization utilities, schemas, serializers, and oRPC routes.
- Adds backend tests for validation, authorization, uniqueness, listing, lookup,
  creation, and deletion.
- Does not import third-party barcode data or model raw source evidence; those
  remain a follow-up catalog-evidence change.
