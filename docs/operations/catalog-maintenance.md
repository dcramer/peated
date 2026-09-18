# Catalog Maintenance

Use this workflow to fill gaps for one brand, series, distillery, or other
clearly defined set of Bottles. The
[Whisky Identity Model](../architecture/whisky-identity-model.md) defines what
makes a Bottle unique and what each field means.

## What “Catalog This” Means

When someone asks to “catalog” a brand, series, distillery, bottler, or other
defined scope, complete that scope in production unless they name another
environment or ask only for a review. This is an outcome request, not a request
for a sample, a list of suggestions, or a research report.

By default, the work includes:

- building the best supported inventory of current and historical marketed
  releases in the scope;
- checking every existing Peated Bottle in the scope, not only missing Bottles;
- creating every missing Bottle whose identity is supported by evidence;
- filling supported Bottle facts and correcting facts shown to be wrong;
- reviewing BottleSeries membership and the Series records themselves;
- finding and attaching an exact, usable Bottle image when one is available;
- reviewing aliases, import references, and possible duplicates; and
- listing every release, fact, image, or duplicate that remains unresolved.

Do not stop after adding the easiest Bottles or after processing one convenient
source. Work until every expected release and every existing Peated Bottle in
scope has a final status.

## Goal

Finish with one checked record for every marketed release in the selected set.
Review every catalog field named in this guide. Fill every fact supported by
evidence, attach the best usable image, and identify confirmed duplicates.
Leave unknown or disputed facts as `null`. A catalog is not complete only
because every release has a record.

## Build The Work List

1. Define the exact set to review. Find its Brand, series, distillery, and
   Bottle IDs before making changes.
2. Build an independent release inventory. Start with a producer archive or
   another source that claims to cover the set. Check it against other producer
   pages, contemporary announcements, specialist archives, and exact auction
   records as needed. Current producer pages rarely prove the historical set is
   complete. Do not treat Peated or any single convenient source as complete.
   [Catalog Research](./catalog-research.md) lists productive archive entrances,
   source combinations, and traps found in earlier catalog sessions.
3. Record what time period, markets, release families, and source archives the
   inventory covers. If no source proves the full set, state the coverage limit
   and keep plausible missing releases unresolved instead of silently excluding
   them.
4. Match each release by stable facts such as distillery, vintage, stated age,
   ABV, edition, and cask number. Search alternate spellings and old distillery
   names.
5. Fetch every page of Peated results using each relevant Brand, distillery,
   bottler, and Series relationship. Search names and aliases for records that
   a relationship filter may miss. Compare both directions: every expected
   release needs a Peated status, and every Peated Bottle in scope needs an
   inventory status.
6. Keep one work list. Give each row a final status of create, update, merge,
   no change, unresolved, or out of scope. Record its expected identity,
   current and proposed Peated IDs and fields, planned changes, Series decision,
   image source and license, source URL for each changed fact, alias and import
   reference decisions, and post-write verification. Mark uncertain records for
   review instead of guessing.

Prefer producer material, label images, and announcements from the time of the
release. A specialist archive or auction catalog can fill historical gaps when
it shows the exact Bottle. A readable label can verify facts printed on it.
Use a second source when a fact is not printed, a source is weak, or sources
conflict. An auction date, retailer publication date, or image filename is not
a release date.

## Review Every Field

Use the live OpenAPI Bottle schema to confirm current request shapes. For
catalog completeness, review:

- who made and named it: `brand`, `distillers`, `bottler`, `series`, `name`,
  `edition`, and `category`;
- Bottle facts: `statedAge` or `noAgeStatement`, `abv`, `vintageYear`,
  `bottlingYear`, `singleCask`, `caskStrength`, `maturation`, `caskNumber`,
  `naturalColor`, `nonChillFiltered`, and `maltPhenolPpm`;
- release facts: `releaseYear`, `releaseMonth`, `releaseDay`, and `outturn`;
- content: `description`, `descriptionSrc`, and the Bottle image with its source
  and license.

Do not spend catalog time backfilling `flavorProfile`; it is not part of this
workflow. Producer tasting notes may be added when they are readily available,
but missing tasting notes do not block completion.

Then apply these rules:

- Set `brand`, `distillers`, `bottler`, and `series` with the six rules in
  [Who Is The Brand, Series, And Bottler](../architecture/whisky-identity-model.md#who-is-the-brand-series-and-bottler).
  An official Brand or distillery release has no bottler. Do not infer one
  from an owner, importer, distributor, or physical packer.
- `name` is the common name of the bottle: the expression as the producer's
  product title, the label, and the trade name it, without the Brand. Keep any
  age, vintage, cask number, or strength wording that the title or label
  prints, because that wording is how people know the bottle. Also store those
  facts in their fields. Do not add age, year, ABV, cask number, outturn, or
  package text that the producer does not print, and never build a name from
  fields to make it unique. A generic word such as `Single Malt` is a name
  only when the marketed name is exactly that. Use `edition` for an explicit
  marketed release descriptor such as `2022 Edition`, `Batch 24`, or a
  numbered collection entry. Copy its wording from the producer's product
  title or visible label. Narrative prose can prove that a code identifies a
  release, but it cannot add generic words such as `Release`, `Edition`,
  `Batch`, or `Volume` that the title and label omit.
- The server normalizes `name` on create and update: age wording such as
  `22 Years` or `Aged 7 Years` becomes `22-year-old` or `Aged 7-year-old`, so
  write `7-year-old` rather than `Aged 7 Years`. See
  [Bottle Reference Normalization](../architecture/bottle-reference-normalization.md)
  before writing names with ages or batch codes.
- Before changing a name, read the Bottle edit context. A name change is
  shared and updates every Bottle in the group. When a group has more than one
  member, give each member its own `edition` in the same pass so no sibling
  is left with a bare shared name.
- Store only known date parts. Use `releaseYear`, then `releaseMonth`, then
  `releaseDay`. A month needs a year, and a day needs a month. Do not invent the
  first day of a month. Do not copy a distillation or bottling date into release
  fields.
- Store `outturn` only when a source gives the exact bottle count. A maximum
  case count does not prove an exact bottle outturn.
- Merge records only when they describe the same marketed release. Package
  volume and market packaging alone do not create a new Bottle. Different
  vintage, age, ABV, edition, or cask facts usually require separate Bottles.
- Unaged new-make or new-pot spirit is not whisky and is out of scope. So is
  anything that is not a marketed release under the identity model's
  definition: visitor hand-fills, private casks never sold as labeled
  bottles, non-sale set components, and whisky poured only by the glass.
  Record each excluded item in the research file with the reason instead of
  creating a Bottle.

Use `null` for unknown facts. Preserve a current value unless stronger evidence
shows that it is wrong.

## Review Series And Related Entities

Review Series as catalog records, not only as a field on a Bottle:

- Use a Series only for a named range the Brand markets for its own products
  (identity model rules 1 to 4). A batch code, release year, or one-off
  edition is not a Series. A retailer's or importer's program name is an
  edition, not a Series. An owner's multi-distillery collection is a Brand,
  not a per-distillery Series.
- Inventory existing Series records for the Brand and look for missing or
  duplicate Series before creating one.
- Review the Series Brand, name, and description. Keep the name to the marketed
  range name without repeating the Brand.
- Assign every Bottle supported by the Series evidence. Do not infer membership
  from similar packaging or release dates alone.
- After Series changes, fetch the Series and its Bottles. Confirm its identity,
  membership, release count, and any redirects created by a merge.

When the requested scope is an Entity such as a Brand, distillery, or bottler,
also review the target Entity's catalog record. Create a distillery Entity for
a production site the producer names (identity model rule 6) before creating
its Bottles. Fill supported names, kind,
status, owner, description and source, establishment year, official website,
and origin country, region, address, and location. For a Distillery, location is
the production site. Do not use a later headquarters or office. Review aliases
and exact references. Follow
[Entity Images](./entity-images.md) for reusable images and attribution. Do not
expand the operation to unrelated owners, companies, or places merely because
the target links to them.

## Review Images

Try to find an image for every Bottle in scope. A missing image does not justify
using a similar release.

- Use an image only when age, vintage, ABV, edition, and other visible facts
  match the exact Bottle.
- Prefer the clearest, highest-resolution front label from a source Peated may
  store. Do not use a thumbnail, watermark, promotional composite, or another
  release when an exact image is available.
- Check the source site's reuse terms. Record the canonical source page in
  `sourceUrl` and the license or reuse terms in `license`. A direct image URL is
  not enough provenance.
- Record why no usable image was found when a Bottle remains without one.
- After upload, fetch and inspect the stored image and confirm its `sourceUrl`
  and `license` survived processing.

Use the authenticated image upload command:

```bash
pnpm cli api upload-image /bottles/123/image \
  --file /tmp/bottle-123.jpg \
  --source-url 'https://example.com/bottle-123' \
  --license 'CC BY-SA 4.0'
```

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
pnpm cli api get '/bottle-series?brand=366603&limit=100'
pnpm cli api get /bottles/123/edit-context
pnpm cli api get '/bottles/123/aliases'
pnpm cli api get '/bottle-references?bottle=123&limit=100'
```

When evidence proves an existing Bottle reference is wrong, correct it by its
stable reference ID. First read `GET /bottle-references/789`, then include its
current `bottleId` and `ignored` values as `expectedBottle` and
`expectedIgnored`. Set `bottle` to the verified replacement, or to `null` when
the name is ambiguous. Set `ignored` to `true` only for an unassigned name that
automated maintenance should not reconsider. The server rejects stale state and
preserves consumers assigned to another Bottle.

```json
{
  "expectedBottle": 123,
  "expectedIgnored": false,
  "bottle": 456,
  "ignored": false
}
```

Send that body with `PATCH /bottle-references/789`. Re-fetch the reference and
both Bottle reference lists after the write. Also verify exact-name prices and
reviews when any exist.

Follow `rel.nextCursor` until every page is loaded. Before a write, check the
live [full OpenAPI specification](https://api.peated.com/spec-full.json). Do not
rely on a stale checkout or an old request shape.

For a Bottle whose facts a moderator already checked, use the normal create
route and set `reviewed` to `true`. Only moderators and administrators can use
this option. The server updates search and counts, but it does not generate
details or start another automated check. Upload its image separately after
creation.

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

An Entity merge uses the same body and direction with
`POST /entities/111/merge` (moderator only). Merge Entities only when the
producer's own pages prove that two records describe one organization or one
production site. Keep as survivor the Entity that Bottles already use as
Brand, otherwise the older ID. The merge runs as a background job that
repoints Bottle relationships, groups, aliases, references, images, and
events to the survivor and leaves a redirect for the old ID. The survivor
keeps its own name, address, and location. Afterwards:

- fetch both IDs and confirm the old one resolves to the survivor;
- fetch the survivor's Brand, distiller, and bottler Bottle lists and compare
  the counts with the two lists from before the merge;
- fetch aliases and references and confirm nothing was dropped;
- patch the address and location if the retired record had the better ones,
  then read the Entity again, because geocoding can rewrite an address.

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

- A direct request to “catalog” a named scope authorizes evidence-backed Bottle
  creates and non-destructive Bottle, Series, Entity, and image updates inside
  that scope. Summarize the bounded scope and planned counts before writing.
  Get separate explicit authorization before merges, deletes, uncertain
  identity changes, or changes that affect records outside the named scope.
- Read every Bottle immediately before changing it. Stop if an ID, identifying
  fact, or current value differs from the work list.
- Read the Bottle edit context before every shared rename. Confirm the shared
  `name`, the release facts, and the number of Bottles that will change.
- Use `--yes` only after the requested or separately approved authorization.
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

- the source coverage and any known limits are recorded;
- every expected release and every existing Peated Bottle in scope has a final
  status;
- every verifiable missing Bottle was created;
- every catalog field in this guide was reviewed, including image, dates, and
  outturn;
- every Series in scope was reviewed, and its Bottle membership and release
  count were checked;
- the target Entity record was reviewed when the scope is a Brand, distillery,
  bottler, or company;
- every Bottle has a verified image with provenance or a recorded reason that
  no usable image was found;
- every alias in the selected set has a source for its public name;
- every import match in the selected set, other than the current full Bottle
  name, points to an evidence-backed exact Bottle or remains unresolved;
- every stored fact has a good source;
- every new or updated Bottle, Series, Entity, image, and merge was fetched and
  checked;
- the counts for expected, existing, created, updated, merged, unchanged,
  unresolved, and out-of-scope releases agree; and
- unresolved facts and releases are listed explicitly for later work.

## Research Records

Each pass leaves a dated research record under `docs/research/catalog/` that
says where the information for that scope lives (see
[Catalog Research](./catalog-research.md), "Write The Research Record").
Older records below were written as change logs before that rule was settled;
use them for their source links, not as a template. Records written before the
naming and Brand rules above were settled (September 16, 2026) may not follow
them: Yamazaki still carries age-only names such as `12-year-old`, some
retailer exclusives still carry the retailer as bottler, and some owner
collections still have per-distillery Series. Do not copy an older catalog's
shape as precedent without checking it against this guide and the identity
model.

- [Whisky Auctioneer catalog audit, September 2026](catalog-audits/2026-09-02-whisky-auctioneer/README.md)
- [Yamazaki catalog audit, September 2026](catalog-audits/2026-09-07-yamazaki/README.md) (predates the current naming rules)
- [Mars distilleries, September 16, 2026](../research/catalog/2026-09-16-mars.md) (follows the current naming and Brand rules)
- [Kanosuke, September 18, 2026](../research/catalog/2026-09-18-kanosuke.md) (source guide; the pass followed the six Brand, Series, and bottler rules)
