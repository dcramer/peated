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
2. For a full catalog, build a release list from sources outside Peated, fetch
   every page of Peated results, and compare both lists. Prefer producer pages,
   labels, and release announcements. Use exact archive or auction records for
   historical gaps.
3. Track every release and Peated record as `create`, `update`, `merge`,
   `no change`, `unresolved`, or `out of scope`. Save the source for each change.
4. Review all fields, Series, the target Entity, images, aliases, and import
   references required by Catalog Maintenance.
5. Before writing, state the target and action counts. A direct catalog request
   allows supported creates and updates within that target. Ask before merges,
   deletes, uncertain identity changes, or work outside it.
6. Check the live OpenAPI schema. Re-fetch each record before changing it. Use
   exact IDs and send only supported fields. Stop if the record changed or the
   API returns a conflict or validation error.
7. Re-fetch every changed record. Check shared edits, images, aliases,
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

Do not stop after a sample. Finish every item in the target or list why it is
unresolved. Report the environment, sources and years covered, counts by status,
changed IDs, checks performed, and unresolved items.
