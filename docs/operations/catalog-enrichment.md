# Catalog Enrichment

Use this workflow to fill gaps for a brand, series, distillery, or other bounded
set of Bottles. The [Whisky Identity Model](../architecture/whisky-identity-model.md)
owns Bottle identity and field meaning.

## Goal

Finish with one verified record for every marketed release in scope. Review
every writable Bottle field, fill every fact supported by evidence, attach the
best usable image, and remove confirmed duplicates. Unknown or disputed facts
stay null. A catalog is not complete only because every release has a row.

## Build The Inventory

1. Define the catalog boundary. Resolve its Brand, series, distillery, and
   Bottle IDs before making changes.
2. Find an independent source that lists the complete set. Use it to detect
   missing and extra records. Do not treat the current Peated list as complete.
3. Match each release by stable facts such as distillery, vintage, stated age,
   ABV, edition, and cask number. Search alternate spellings and old distillery
   names.
4. Fetch all Peated pages and compare them with the independent inventory.
   Classify each expected release as create, update, merge, no change, or
   unresolved.
5. Keep a manifest with the expected identity, Peated IDs, proposed changes,
   image source, and source URL for each changed fact. Mark uncertain rows for
   review instead of guessing.

Prefer producer material, label images, and contemporary announcements. A
specialist archive or auction catalog can fill historical gaps when it shows
the exact expression. A readable label can verify facts printed on that label.
Use a second source when a fact is not printed, a source is weak, or sources
conflict. An auction date, retailer publication date, or image filename is not
a release date.

## Review Every Field

Use the live OpenAPI Bottle schema as the complete checklist. Review at least:

- identity: `brand`, `distillers`, `bottler`, `series`, `name`, `edition`, and
  `category`;
- product facts: stated age or NAS, ABV, vintage and bottling year, cask facts,
  maturation, natural color, chill filtration, and phenol level;
- release facts: release year, month, day, and outturn;
- content: description, description source, and image.

Then apply these rules:

- Set `brand`, `distillers`, `bottler`, and `series` from product evidence. Do
  not infer a bottler from the Brand owner or distributor.
- Keep Bottle names free of package facts such as `70cl release`, gift box, or
  export carton. Use `edition` only for a marketed release descriptor.
- Store only known date parts. Use `releaseYear`, then `releaseMonth`, then
  `releaseDay`. A month needs a year, and a day needs a month. Do not invent the
  first day of a month. Do not copy a distillation or bottling date into release
  fields.
- Store `outturn` only when a source gives the exact bottle count. A maximum
  case count does not prove an exact bottle outturn.
- Use an image only when age, vintage, ABV, edition, and other visible facts
  match the Bottle. Prefer the highest-resolution clear front label from a
  source Peated may store. Do not use a thumbnail, watermark, or similar-looking
  release when an exact image is available.
- Merge records only when they describe the same marketed release. Package
  volume and market packaging alone do not create a new Bottle. Different
  vintage, age, ABV, edition, or cask facts usually require separate Bottles.

Use `null` for unknown facts. Preserve a current value unless stronger evidence
shows that it is wrong.

## Use The Production API

The CLI uses `https://api.peated.com` by default. It adds `/v1` to API paths.

```bash
pnpm cli auth status
pnpm cli api get '/entities?query=Rare%20Malts%20Selection&limit=25'
pnpm cli api get '/bottles?brand=366603&limit=100&sort=name'
```

Follow `rel.nextCursor` until every page is loaded. Before a write, check the
live [OpenAPI specification](https://api.peated.com/spec.json). Do not rely on a
stale checkout or an old request shape.

Put each patch in a temporary JSON file. Send only the fields supported by the
evidence.

```json
{
  "releaseYear": 1998,
  "releaseMonth": 10
}
```

```bash
pnpm cli api patch /bottles/123 --input /tmp/bottle-123.json
pnpm cli api get /bottles/123
```

For a reviewed merge, this example merges Bottle `111` into survivor `222`:

```json
{
  "other": 222,
  "direction": "mergeInto"
}
```

```bash
pnpm cli api post /bottles/111/merge --input /tmp/bottle-merge.json
```

## Batch Safety

- Read every target immediately before the batch. Stop if an ID, identity, or
  current value differs from the manifest.
- Get explicit authorization for the write scope. Use `--yes` only after that
  authorization.
- Patch explicit IDs in small batches. Do not derive write targets from result
  order or an unverified search result.
- Stop on validation errors, conflicts, or changed identity. Re-read the record
  before retrying.
- Re-fetch every changed Bottle. Compare the stored values with the manifest
  and confirm that unrelated fields did not change.
- Re-fetch each uploaded `imageUrl` and inspect the stored image. Confirm that
  it still shows the expected release after server processing.
- After a merge, fetch both IDs. Confirm that the old ID resolves to the chosen
  survivor and that references, facts, and the best image were preserved.
- Report the target environment, changed count, verified count, sources, and
  rows skipped for missing or conflicting evidence.

## Completion Gate

The operation is complete only when:

- every inventory row has a final status;
- every writable field was reviewed, including image, dates, and outturn;
- every stored fact has adequate source evidence;
- every create, update, image, and merge was read back and verified;
- expected, stored, merged, and unresolved counts reconcile; and
- unresolved facts and releases are listed explicitly for later work.
