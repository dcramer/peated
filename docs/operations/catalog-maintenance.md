# Catalog Maintenance

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
   image source, source URL for each changed fact, and any alias or reference
   decision. Mark uncertain rows for review instead of guessing.

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
- Keep `name` to the stable marketed expression. Do not append age, vintage
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
  match the Bottle. Prefer the highest-resolution clear front label from a
  source Peated may store. Do not use a thumbnail, watermark, or similar-looking
  release when an exact image is available.
- Merge records only when they describe the same marketed release. Package
  volume and market packaging alone do not create a new Bottle. Different
  vintage, age, ABV, edition, or cask facts usually require separate Bottles.

Use `null` for unknown facts. Preserve a current value unless stronger evidence
shows that it is wrong.

## Review Names, Aliases, And References

Review these as separate records with separate authority:

- Review `name` and `edition` apart from the exact fields. Reject a proposed
  display name that repeats structured facts without evidence that the producer
  markets that wording as part of the expression. For a uniform label that
  features a different distillery on each release, use the featured distillery
  as `name` when there is no separate expression name.
- A BottleAlias is a verified alternate marketed name that customers can see
  and search. Add one only when producer material, a label, or another strong
  source proves that the release was marketed under that name. Remove one when
  evidence shows that it is generated text, an error, or a name for another
  release.
- A BottleReference is an accepted input string that can match new ingestion
  directly to one Bottle. Verify it only when the complete string identifies
  that exact release. Quarantine it when it is wrong, ambiguous, generated
  noise, or belongs to another release. Quarantine does not move consumers that
  are already assigned.

Do not add old generated full names, package text, spelling mistakes, or search
phrases as display aliases. Do not use a display alias to grant matching
authority. A useful alternate marketed name can be both an alias and a
reference, but each decision needs its own evidence.

After a rename, review the Bottle's aliases and noncanonical references. For an
SMWS single-cask Bottle, an unchanged Society code proves that an old subtitle
belongs to the same Bottle, so the old canonical name can remain a reference.
Add the old subtitle as a display alias only when evidence shows that SMWS
marketed the Bottle under both titles. For a numbered batch, keep the stable
expression in the name and the complete `Batch N` value in `edition`; do not
add the old generated combined name as an alias.

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
pnpm cli api get '/admin/bottle-reference-audit?reviewState=unreviewed&limit=50'
```

Follow `rel.nextCursor` until every page is loaded. Before a write, check the
live [OpenAPI specification](https://api.peated.com/spec.json). Do not rely on a
stale checkout or an old request shape.

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

To add a verified display alias, send only the marketed name:

```json
{
  "name": "Verified alternate marketed name"
}
```

```bash
pnpm cli api post /bottles/123/aliases --input /tmp/bottle-alias.json
pnpm cli api delete /bottles/123/aliases/789
```

Reference review uses the current `stateToken` returned by the list or audit
endpoint. Choose `verify` to keep exact matching or `quarantine` to stop future
matching:

```json
{
  "action": "quarantine",
  "stateToken": "current-state-token"
}
```

```bash
pnpm cli api post /bottle-references/456/review --input /tmp/reference-review.json
```

## Batch Safety

- Read every target immediately before the batch. Stop if an ID, identity, or
  current value differs from the manifest.
- Before a name patch, read the Bottle edit context. Confirm the shared `name`,
  exact fields, and number of affected Bottles. A name patch is a shared edit
  and can update every Bottle in the group.
- Get explicit authorization for the write scope. Use `--yes` only after that
  authorization.
- Patch explicit IDs in small batches. Do not derive write targets from result
  order or an unverified search result.
- Stop on validation errors, conflicts, or changed identity. Re-read the record
  before retrying.
- Re-fetch every changed Bottle. Compare the stored values with the manifest
  and confirm that unrelated fields did not change.
- After a name patch, re-fetch the Bottle edit context and the Bottle. Confirm
  the shared name is the stable expression, the Bottle `name` and `fullName`
  are concise, and every exact field is unchanged.
- Re-fetch each uploaded `imageUrl` and inspect the stored image. Confirm that
  it still shows the expected release after server processing.
- After a merge, fetch both IDs. Confirm that the old ID resolves to the chosen
  survivor and that references, facts, and the best image were preserved.
- After a name change or merge, re-fetch aliases and references. Confirm that
  verified display names remain visible and quarantined references no longer
  appear in the active reference list.
- Treat a stale reference `stateToken` as changed state. Re-fetch and review it
  again instead of retrying the old decision.
- Report the target environment, changed count, verified count, sources, and
  rows skipped for missing or conflicting evidence.

## Completion Gate

The operation is complete only when:

- every inventory row has a final status;
- every writable field was reviewed, including image, dates, and outturn;
- every in-scope alias has evidence for its marketed name, and every in-scope
  reference other than the current full Bottle name was verified, quarantined,
  or marked unresolved;
- every stored fact has adequate source evidence;
- every create, update, image, and merge was read back and verified;
- expected, stored, merged, and unresolved counts reconcile; and
- unresolved facts and releases are listed explicitly for later work.
