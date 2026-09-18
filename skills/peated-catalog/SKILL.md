---
name: peated-catalog
description: Catalogs or repairs Peated Bottle records directly for a named Bottle, brand, Series, distillery, bottler, or release set. Use for missing Bottles, wrong facts, Brand or Series decisions, images, aliases, references, duplicate review, or a dry-run inventory of such a set. Do not use for code changes or store-price queue moderation.
---

# Peated Catalog

Finish the named catalog target in production unless the user names another
environment or asks only for a dry run, research, or review. Follow any
narrower target the user gives.

## Read what applies

| Read                                         | For                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `docs/operations/catalog-maintenance.md`     | The full workflow, every field to review, and the create, patch, merge, and image procedures   |
| `docs/architecture/whisky-identity-model.md` | What counts as a release, the six Brand, Series, and bottler rules, and when Bottles are one   |
| `docs/operations/catalog-research.md`        | Where releases hide and the traps earlier work hit; read before building the outside inventory |
| `pnpm cli auth`, `pnpm cli api`              | Production data. Do not use legacy database commands.                                          |

## Work

1. Name the target and environment. Resolve stored IDs with read-only API
   calls.
2. Build the outside inventory before deciding anything: current and past
   releases from producer archives, dated announcements, specialist catalogs,
   collector lists, old sites, and auction records. The producer's current
   range is not the catalog. Search every period and product family, including
   discontinued, one-off, and country-specific releases. For a distillery
   scope, also search former owner and house brands. If a search fails, try
   other names, languages, archives, and kinds of sources.
3. Fetch every page of Peated results by Brand, distiller, bottler, Series,
   and name search. Compare both directions: every outside release needs a
   Peated status and every Peated record needs an inventory status.
4. Give each row one status: `create`, `update`, `merge`, `no change`,
   `unresolved`, or `out of scope`. Save the source for each changed fact. Do
   not mark old records `unresolved` as a group because there are many or no
   producer page survives; for each one, record the open question and the
   searches tried.
5. Review every field, Series, the target Entity, images, aliases, and import
   references that Catalog Maintenance lists.
6. Before writing, state the target and the counts by status. A direct
   catalog request allows evidence-backed creates and updates inside that
   target. Ask before Bottle or Entity merges, deletes, Brand changes, or work
   outside the target.
7. Check the live OpenAPI schema. Re-fetch each record before changing it. Use
   exact IDs and send only supported fields. Stop if the record changed or the
   API returns a conflict or validation error.
8. Re-fetch every changed record and check shared edits, images, aliases,
   references, and redirects where they apply.
9. Before reporting, write the research record under
   `docs/research/catalog/YYYY-MM-DD-short-name.md`: a guide to where the
   information for this scope lives, for the next person who researches it.
   Do not append to a shared or monthly report. Update
   `docs/operations/catalog-research.md` only for a reusable method, access
   limit, or recurring trap.

## Research record

| Keep                                                                       | Leave out                                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Each source with its link, the families and years it covers, and its limit | Production IDs, counts, and per-Bottle field lists         |
| Sites that block tools or need a browser, and pacing limits                | Raw API replies, request files, tokens, downloaded images  |
| Conflicts between sources and which value was used                         | Working notes with no later use                            |
| Searches and sites that found nothing                                      | Claims that a source is complete when it does not prove it |
| Image reuse terms per site                                                 |                                                            |
| Releases and facts still unknown, with the open question                   |                                                            |

Peated's change history records the writes; the report to the user carries
the counts and IDs.

## Rules

- One marketed release is one Bottle. The same liquid in another size, box,
  label, or market name is the same Bottle; add the name as a reference.
- Set Brand, Series, and bottler with the six rules in the identity model.
  In short: a distillery's own line and an owner's multi-distillery
  collection are Brands; an independent bottler's label is Brand and bottler;
  a retailer's, importer's, or festival's selection of an official bottling
  keeps the producer Brand, has no bottler, and carries the program name in
  `edition`. Do not clear an existing bottler only because a source omits it.
- `name` is the producer's title without the Brand, keeping printed age,
  vintage, or cask wording. Store age, years, ABV, edition, cask facts, and
  outturn in their fields as well; never build a name from them, and do not
  fall back to a generic `Single Malt`.
- Read the edit context before a shared rename; it changes every Bottle in
  the group.
- Use `null` for an unknown or disputed fact. Keep an existing value unless a
  stronger source for the same Bottle proves it wrong.
- Add an alias only for a proven public name. Assign an import reference only
  when its full text identifies one Bottle.
- Use only an image of the exact Bottle. Record its source page and reuse
  terms, then inspect the stored image; a direct image URL is not provenance.
- Merge only proven copies of the same marketed release.

One family or the current range does not complete the catalog; continue until
every item has a final status. Report the environment, sources and years
covered, counts by status, changed IDs, checks performed, research records
changed, and unresolved questions.
