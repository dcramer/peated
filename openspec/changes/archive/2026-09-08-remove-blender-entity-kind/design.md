## Context

Entity kind controls browse placement. It does not restrict whether an Entity
can fill a Bottle's Brand, Bottler, or Distiller field. Production has 11
Blender entities. Six have no Bottle relationships, and the five active rows
are already used mostly as Brands and sometimes as Bottlers. The application
still carries Blender through its database enum, schemas, classifiers, API,
search, statistics, web routes, and sitemaps.

The database enum cannot drop a value while rows still use it. The data change
must therefore run before the generated enum replacement.

## Goals / Non-Goals

**Goals:**

- Keep one useful top-level kind for every Entity.
- Reclassify every legacy Blender as a Bottler without changing Bottle links.
- Remove Blender from every public and internal contract.
- Keep `company` for parent organizations such as Diageo.
- Preserve existing Entity ids and consumer references.

**Non-Goals:**

- Do not add Blender as an Entity role, capability, or Bottle field.
- Do not infer or rewrite Brand, Bottler, or Distiller Bottle relationships.
- Do not use `company` as a fallback for former Blender rows.
- Do not implement a new duplicate merge path.

## Decisions

### Reclassify every Blender as a Bottler

The migration changes `kind = 'blender'` to `kind = 'bottler'`. This is a
deterministic hard cutover. Blender and Bottler describe the same useful Peated
browse cohort: release houses that work with spirit made elsewhere. Mapping
some rows to Brand would mix top-level identity with their current Bottle field
usage, which the Entity model explicitly keeps separate. Mapping historic or
small rows to Company would weaken Company's meaning as an ownership identity.

### Preserve Bottle relationships

The migration changes only `Entity.kind`. A Compass Box Bottle can continue to
use Compass Box as its Brand and Bottler. Kind remains browse placement and
does not become a relationship constraint.

### Remove the public Blender surface in one cutover

The `/blenders` collection, Blender global-search scope, Blender stats field,
web page, navigation item, and sitemap disappear together. The project does
not keep compatibility aliases because no retained workflow consumes a
Blender-specific resource.

### Use the existing Entity merge operation for Woven

Entity `5761` (`Woven Whisky`) duplicates Entity `461` (`Woven`). The schema
migration will preserve both ids and reclassify both rows. A moderator will
merge `5761` into `461` with the existing merge operation so all dependent
records and audit behavior stay at their owning boundary.

## Risks / Trade-offs

- [An enum migration runs before the data update] → Generate an ordered custom
  data migration first, then generate the schema migration that removes the
  enum value.
- [A hidden Blender consumer remains] → Search all application, package,
  documentation, mock, and OpenSpec consumers and run package typechecks.
- [External clients still request Blender resources] → Treat removal as an
  intentional breaking hard cutover and document it in the proposal.
- [The Woven duplicate remains after deployment] → Record its survivor and
  source ids in the deployment handoff and use the existing merge workflow.

## Migration Plan

1. Add a generated custom migration that changes all `blender` Entity kinds to
   `bottler`.
2. Remove `blender` from the schema enum and generate the enum migration.
3. Deploy the application and migrations together.
4. Verify that no Entity has the removed kind and that former Blender ids still
   resolve as Bottlers.
5. Merge Entity `5761` into Entity `461` through the existing moderator flow.

Rollback requires restoring `blender` to the enum and application contracts.
The uniform data update is intentionally not reversed automatically because
the old distinction has no product authority.

## Open Questions

None.
