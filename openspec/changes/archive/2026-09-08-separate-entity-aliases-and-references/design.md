## Context

The old `entity_alias` table stores globally unique names. A row can point to
one Entity, and assigned rows can match new input without a classifier. Entity
names, short names, and names without a leading “The” are added to this table.
These are references, not aliases shown to users.

`Entity.shortName` has a separate job. It is the compact name used in Bottle
names and search results. It remains an Entity field.

## Goals

- Rename the old automatic-match names to EntityReference without losing data.
- Use EntityAlias for other names shown to users and used in search.
- Include `shortName` in alias reads without storing a second copy.
- Keep automatic matching separate from aliases.

This change does not remove `shortName`, add alias metadata, or change Entity
identity rules.

## Decisions

### Rename the old table

Rename `entity_alias` to `entity_reference`. Keep its nullable Entity id,
case-insensitive global uniqueness, and creation time. Do not keep old names in
application code.

### Add Entity aliases

The new `entity_alias` table stores the Entity id, displayed name, normalized
name, moderator, and timestamps. A normalized name is unique within one Entity.
The same alias can belong to different Entities.

Alias changes do not change references. Reference changes do not change stored
aliases.

### Include the short name in alias reads

Alias reads add the current `shortName` and mark it as the short name. It cannot
be deleted through the alias route. Editing the Entity changes it.

The short name is not copied into alias storage. It remains a reference because
Peated can match that name automatically.

### Use each name set for its job

Search uses aliases and references. Automatic matching uses Entity fields and
references, never aliases. Classifier input can combine both sets as
`otherNames` when their source does not affect the decision.

### Keep names during a merge

References move to the surviving Entity under the existing global uniqueness
rule. Stored aliases also move. Duplicate aliases and aliases equal to the
survivor's name or short name are removed.

## Migration

1. Rename `entity_alias` to `entity_reference` with its existing rows.
2. Create the new empty `entity_alias` table.
3. Update all application consumers in the same release.
