## Why

Peated cannot record whether a brand or producer is active, mothballed, closed, or discontinued. Its location can also be mistaken for a later headquarters or office instead of its origin.

## What Changes

- Add one optional status to every Entity.
- Allow `active`, `mothballed`, `closed`, and `discontinued`, with `mothballed` limited to Distilleries and `discontinued` limited to Brands.
- Show known status on Entity pages and allow moderators to edit it.
- Define Entity country, region, address, and coordinates as its origin, not a later headquarters or office.
- Allow Entity lists to filter by status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-identity`: Add Entity status and define the meaning of Entity location fields.

## Impact

- Entity database schema and generated migration.
- Entity API schemas, serializers, create and update paths, and list filters.
- Entity edit and detail interfaces.
- Entity tests, fixtures, API documentation, and identity documentation.
