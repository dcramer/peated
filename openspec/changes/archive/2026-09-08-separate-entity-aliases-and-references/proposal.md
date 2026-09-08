## Why

Peated used EntityAlias for two different jobs. These names could match new
input to an Entity, but the product also used “alias” for names shown to users.
The two jobs need different rules.

## What Changes

- Rename the existing automatic-match names to EntityReference without changing
  their data or behavior.
- Add EntityAlias for other names shown to users and used in search.
- Keep `shortName` as the compact name used in Bottle names and include it in
  the Entity's alias list.
- Keep alias changes separate from automatic name matching.
- Update Entity search, merge, classifiers, API routes, and the alias page.
- **BREAKING**: EntityAlias now means a name shown to users. Existing exact
  names become EntityReference.

## Capabilities

### New Capabilities

- `entity-aliases`: Other names shown for an Entity, including its short name.
- `entity-references`: Names that can match input to one Entity automatically.

## Impact

- Entity schema and migrations.
- Entity create, update, merge, search, and matching.
- Classifier input, API routes, fixtures, and the Entity alias page.
