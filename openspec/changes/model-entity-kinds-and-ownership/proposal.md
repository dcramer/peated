## Why

Peated stores Brand, Distiller, and Bottler as an Entity `type` list. Those
values show how Bottles use an Entity, but the Entity page presents them as the
answer to what the Entity is. Peated also cannot record simple ownership, such
as Diageo owning Lagavulin.

## What Changes

- Keep one Entity record for each whisky identity or owning company.
- Give each Entity one kind: Brand, Distillery, Bottler, Blender, or Company.
- Expose each kind as its own top-level API collection. Do not expose a generic
  Entity collection endpoint.
- Find Brand, Bottler, and Distiller use from Bottle links instead of copying
  those values onto Entity.
- Let an Entity point to one current owner. Owner links can form a company
  chain, such as Pernod Ricard → Irish Distillers → Jameson.
- Show the kind and current owner on Entity pages. Show owned Entities on owner
  pages.
- Backfill every existing Entity through the normal Entity API before kind
  becomes required.
- **BREAKING**: replace Entity `type` with `kind` in server, web, CLI,
  classifier, and generated API contracts. Replace the generic Entity
  collection API with dedicated Brand, Distillery, Bottler, Blender, and
  Company endpoints. Bottle fields use global Entity search without storing or
  filtering by Entity roles.

## Capabilities

### New Capabilities

- `entity-identity`: One Entity kind, Bottle-based Brand/Bottler/Distiller use,
  current ownership, Entity presentation, and the existing-data migration.

### Modified Capabilities

None.

## Impact

- Entity database schema, generated migrations, serializers, API schemas,
  search, merge behavior, and moderation.
- Bottle create and edit, Entity browse pages, Entity details, and owner pages.
- CLI and classifier schemas, local catalog data, fixtures, and tests.
- A reviewed API backfill for existing Entity kinds and known current owners.
- Entity and classifier documentation.
