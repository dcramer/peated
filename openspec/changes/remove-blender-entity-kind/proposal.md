## Why

Peated has 11 production Blender entities, and the kind changes only browse
placement. It does not change Bottle identity or another user workflow, so the
separate kind adds classification and API complexity without useful behavior.

## What Changes

- **BREAKING** Remove `blender` from the Entity kind list and from entity
  creation, update, classifier, and review contracts.
- **BREAKING** Remove the dedicated Blender list and search scopes from the API
  and web application.
- Reclassify each production Blender as a Bottler. Keep `company` for parent
  organizations such as Diageo, not operating release houses.
- Merge the duplicate Woven entity through the existing Entity merge workflow.
- Remove Blender counts, browse pages, sitemap entries, copy, tests, and
  documentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-identity`: Limit an Entity to Brand, Distillery, Bottler, or Company,
  and remove the dedicated Blender collection and browse behavior.

## Impact

This changes the Entity database enum, generated migration, shared schemas,
entity classifiers, API contracts and routes, global search, statistics, web
navigation and routing, sitemaps, mock fixtures, tests, and entity identity
documentation. The existing Entity merge operation remains the authority for
the Woven duplicate.
