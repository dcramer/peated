# Catalog Maintenance

Use this workflow to fill gaps for one brand, series, distillery, or other
clearly defined set of Bottles. The
[Whisky Identity Model](../architecture/whisky-identity-model.md) defines what
makes a Bottle unique and what each field means.

## Goal

Finish with one checked record for every marketed release in the selected set.
Review every Bottle field that the API can update. Fill every fact supported by
evidence, attach the best usable image, and remove confirmed duplicates. Leave
unknown or disputed facts as `null`. A catalog is not complete only because
every release has a record.

## Build The Work List

1. Define the exact set to review. Find its Brand, series, distillery, and
   Bottle IDs before making changes.
2. Find a source independent of Peated that lists the complete set. Use it to
   detect missing and extra records. Do not treat the current Peated list as
   complete.
3. Match each release by stable facts such as distillery, vintage, stated age,
   ABV, edition, and cask number. Search alternate spellings and old distillery
   names.
4. Fetch all Peated pages and compare them with the independent list.
   Classify each expected release as create, update, merge, no change, or
   unresolved.
5. Keep one work list. For each release, record its expected identity, Peated
   IDs, planned changes, image source, source URL for each changed fact, and any
   decision about another public name or an import match. Mark uncertain
   records for review instead of guessing.

Prefer producer material, label images, and announcements from the time of the
release. A specialist archive or auction catalog can fill historical gaps when
it shows the exact Bottle. A readable label can verify facts printed on it.
Use a second source when a fact is not printed, a source is weak, or sources
conflict. An auction date, retailer publication date, or image filename is not
a release date.

## Review Every Field

Use the live OpenAPI Bottle schema as the complete checklist. Review at least:

- who made and named it: `brand`, `distillers`, `bottler`, `series`, `name`,
  `edition`, and `category`;
- Bottle facts: stated age or no age statement (NAS), ABV, vintage and bottling
  year, cask facts, maturation, natural color, chill filtration, and phenol
  level;
- release facts: release year, month, day, and outturn;
- content: description, description source, and image.

Then apply these rules:

- Set `brand`, `distillers`, `bottler`, and `series` from product evidence. Do
  not infer a bottler from the Brand owner or distributor.
- Keep `name` to the stable release name used by the producer. Do not append age, vintage
  year, release year, ABV, cask strength, cask number, outturn, package size, or
  package text to make it unique. Store those facts in their fields. Preserve
  wording only when the producer markets it as part of the expression. Use
  `edition` only for an explicit marketed release descriptor. Copy its wording
  from the producer's product title or visible label. Narrative prose can prove
  that a code identifies a release, but it cannot add generic words such as
  `Release`, `Edition`, `Batch`, or `Volume` that the title and label omit.
- Store only known date parts. Use `releaseYear`, then `releaseMonth`, then
  `releaseDay`. A month needs a year, and a day needs a month. Do not invent the
  first day of a month. Do not copy a distillation or bottling date into release
  fields.
- Store `outturn` only when a source gives the exact bottle count. A maximum
  case count does not prove an exact bottle outturn.
- Use an image only when age, vintage, ABV, edition, and other visible facts
  match the Bottle. Prefer the clearest, highest-resolution front label from a
  source Peated may store. Do not use a thumbnail, watermark, or similar-looking
  release when an exact image is available.
- Merge records only when they describe the same marketed release. Package
  volume and market packaging alone do not create a new Bottle. Different
  vintage, age, ABV, edition, or cask facts usually require separate Bottles.

Use `null` for unknown facts. Preserve a current value unless stronger evidence
shows that it is wrong.

## Review Names, Aliases, And References

Review the Bottle name, other public names, and saved import matches separately:

- Review `name` and `edition` separately from age, vintage, ABV, and other
  release facts. Do not accept a suggested public name that repeats these facts
  unless a source shows that the producer used that wording. When every release
  in a series uses the same label but features a different distillery, use the
  featured distillery as `name` if there is no other release name.
- `BottleAlias` stores another proven public name. Customers can see and search
  it. Add one only when producer material, a label, or another strong source
  shows that the producer used that name. Remove one when it is an automatic
  name, an error, or a name for another release.
- `BottleReference` stores accepted import text that can match one Bottle. Assign
  it only when the complete text identifies that exact release. Leave it
  unresolved when the text is wrong, unclear, automatic noise, or belongs to
  another release. Assigning it does not change imports that are already linked
  to a Bottle.

Do not add old automatic full names, package text, spelling mistakes, or search
phrases as public aliases. A public alias does not prove that import text is
safe to match. A proven public name can be both an alias and an import match,
but check each use separately.

After a rename, review the Bottle's aliases and references that differ from its
current full name. For an SMWS single-cask Bottle, an unchanged Society code
shows that an old subtitle belongs to the same Bottle. The old full name can
remain as an import match. Add the old subtitle as a public alias only when a
source shows that SMWS used both titles. For a numbered batch, keep the release
title in `name` and the complete `Batch N` value in `edition`. Do not add the old
automatic combined name as an alias.

## Use The Production API

The CLI normally uses `https://api.peated.com`, but `.env.local` can override
the target. Run `pnpm cli auth status` and confirm the target before any write.
The CLI adds `/v1` to API paths.

```bash
pnpm cli auth status
pnpm cli api get '/entities?query=Rare%20Malts%20Selection&limit=25'
pnpm cli api get '/bottles?brand=366603&limit=100&sort=name'
pnpm cli api get /bottles/123/edit-context
pnpm cli api get '/bottles/123/aliases'
pnpm cli api get '/bottle-references?bottle=123&limit=100'
```

Follow `rel.nextCursor` until every page is loaded. Before a write, check the
live [full OpenAPI specification](https://api.peated.com/spec-full.json). Do not
rely on a stale checkout or an old request shape.

For a Bottle whose facts a moderator already checked, use the normal create
route and set `reviewed` to `true`. Only moderators and administrators can use
this option. The server updates search and counts, but it does not generate
details or start another automated check.

Include the option with the reviewed Bottle fields:

```json
{
  "name": "Reviewed release",
  "brand": 123,
  "reviewed": true
}
```

```bash
pnpm cli api post /bottles --input /tmp/reviewed-bottle.json
pnpm cli api get /bottles/123
```

Leave out `reviewed` for manual entry. Do not set it when the source facts or
Bottle identity are uncertain.

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

For a merge you have checked, this example merges Bottle `111` into the Bottle
that will remain, `222`:

```json
{
  "other": 222,
  "direction": "mergeInto"
}
```

```bash
pnpm cli api post /bottles/111/merge --input /tmp/bottle-merge.json
```

To add a verified public alias, send only the name:

```json
{
  "name": "Verified public name"
}
```

```bash
pnpm cli api post /bottles/123/aliases --input /tmp/bottle-alias.json
pnpm cli api delete /bottles/123/aliases/789
```

## Make Changes Safely

- Read every Bottle immediately before changing it. Stop if an ID, identifying
  fact, or current value differs from the work list.
- Before changing a name, read the Bottle edit context. Confirm the shared
  `name`, the release facts, and the number of Bottles that will change. A name
  change is shared and can update every Bottle in the group.
- Get explicit authorization for the set of changes. Use `--yes` only after that
  authorization.
- Update known IDs in small groups. Do not choose IDs from result order or an
  unchecked search result.
- Stop on validation errors, conflicts, or changed identifying facts. Read the
  record again before retrying.
- Fetch every changed Bottle again. Compare the stored values with the work list
  and confirm that unrelated fields did not change.
- After a name change, fetch the Bottle edit context and Bottle again. Confirm
  that the shared name is the producer's name, `name` and `fullName` are short,
  and all release facts are unchanged.
- Fetch each uploaded `imageUrl` again and inspect the stored image. Confirm that
  it still shows the expected release after server processing.
- After a merge, fetch both IDs. Confirm that the old ID resolves to the chosen
  survivor and that references, facts, and the best image were preserved.
- After a name change or merge, fetch aliases and references again. Confirm that
  verified public names remain visible and active references point to the
  expected Bottle.
- Report whether the changes were local or in production. Include the number
  changed, the number checked, the sources, and any records skipped because
  evidence was missing or conflicting.

## When The Work Is Complete

The operation is complete only when:

- every release on the work list has a final status;
- every field that can be changed was reviewed, including image, dates, and
  outturn;
- every alias in the selected set has a source for its public name;
- every import match in the selected set, other than the current full Bottle
  name, points to an evidence-backed exact Bottle or remains unresolved;
- every stored fact has a good source;
- every new record, update, image, and merge was fetched and checked;
- the counts for expected, stored, merged, and unresolved releases agree; and
- unresolved facts and releases are listed explicitly for later work.

## Completed Audits

- [Whisky Auctioneer catalog audit, September 2026](catalog-audits/2026-09-02-whisky-auctioneer/README.md)
