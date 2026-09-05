---
name: peated-catalog
description: Catalogs or repairs Peated Bottle records directly for a named Bottle, brand, Series, distillery, bottler, or release set. Use for missing Bottles, wrong facts, Series membership, images, aliases, references, or duplicate review. Do not use for code changes or store-price queue moderation.
---

# Peated Catalog

Finish the named catalog target in production unless the user names another
environment or asks only for research or review. Follow any narrower target the
user gives.

## Read what applies

- Use `docs/operations/catalog-maintenance.md` for a full Bottle, brand, Series,
  distillery, bottler, or release-set review.
- Read `docs/architecture/whisky-identity-model.md` before deciding whether
  Bottles are distinct, related, or duplicates.
- Open only the linked guide needed for the current work.
- Use `pnpm cli auth` and `pnpm cli api` for production data. Do not use legacy
  database commands.

## Work

1. Name the target and environment. Resolve stored IDs with read-only API calls.
2. Before deciding what to change, build a list of current and past releases
   from sources outside Peated. Fetch every page of Peated results and compare
   the lists. The producer's current range does not define the catalog. Search
   every period and product family, including discontinued, one-off, and
   country-specific releases.
3. Use specialist catalogs, collector lists, old sites, and auction archives to
   find past releases. Verify each release and fact with producer pages,
   announcements from the time, readable labels, or exact auction records. If a
   search fails, try other names, languages, archives, and kinds of sources.
4. Track every release and Peated record as `create`, `update`, `merge`,
   `no change`, `unresolved`, or `out of scope`. Save the source for each change.
   Check each existing Bottle and possible missing release. Do not mark old
   records `unresolved` as a group because there are many or no current producer
   page exists. For each unresolved item, record the unanswered question and
   the sources or searches tried.
5. Review all fields, Series, the target Entity, images, aliases, and import
   references required by Catalog Maintenance.
6. Before writing, state the target and action counts. A direct catalog request
   allows supported creates and updates within that target. Ask before merges,
   deletes, uncertain identity changes, or work outside it.
7. Check the live OpenAPI schema. Re-fetch each record before changing it. Use
   exact IDs and send only supported fields. Stop if the record changed or the
   API returns a conflict or validation error.
8. Re-fetch every changed record. Check shared edits, images, aliases,
   references, and redirects when they apply.

## Rules

- One marketed release is one Bottle. Package size or packaging alone does not
  create another Bottle.
- Use the producer's stable product name. Keep age, year, ABV, edition, cask
  facts, and outturn in their fields.
- Use `null` for unknown or disputed facts. Keep an existing value unless a
  stronger source for the same Bottle proves it wrong.
- Use a Series only for a named product range. Add an alias only for a proven
  public name. Assign an import reference only when the full text identifies one
  Bottle.
- Use only an image of the exact Bottle. Save the page where it appears and its
  reuse terms, then inspect the stored image.
- Merge only proven copies of the same marketed release.

Completing one family or the current range does not complete the catalog.
Continue through every period and product family until each item has a final
status. Report the environment, sources and years covered, counts by status,
changed IDs, checks performed, and unresolved questions.
