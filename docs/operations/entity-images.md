# Entity Images

Use this workflow to add or replace Entity images in production. The image API
and database schema own exact behavior.

## Select Images

- Use an image only when Peated owns it, has permission, or can comply with its
  reuse license.
- Prefer a clear exterior as the primary image. It must identify the place at a
  glance and work without its caption.
- Use production equipment, warehouses, malt floors, and other specific details
  as secondary images.
- Do not use product shots, logos, promotional composites, tourist portraits,
  or several images of the same view.
- Review the exact source page. A reusable host or collection does not make
  every image reusable.

## Prepare Files

Entity images appear at `16:10`. Prepare them at `1600 x 1000` to avoid an
unintended crop in the current upload processor. Keep each source file below the
20 MiB upload limit.

The server converts uploads to WebP and removes embedded metadata. Do not rely
on EXIF or IPTC fields for attribution.

## Write Captions

Start with one short, verified description of what the image shows. Use the
place name when it helps distinguish the view. Do not add tasting language,
marketing claims, or facts that the image does not prove.

Keep the source and license separate from the descriptive caption:

- Put a short description in `caption`.
- Add the creator credit to `caption` when the license requires it.
- Put the canonical page where the image was found in `sourceUrl`.
- Put the license name or reuse terms in `license`.

Entity image rows use `caption`, `sourceUrl`, and `license`.

Do not put a source URL or license in `caption`. Peated shows these fields below
the caption so long URLs do not compete with the description.

```text
Ardbeg Distillery on Islay's south coast. Photo: ErikRombaut.
```

Use the creator name and license text from the source record. Do not normalize
a username into a person's name. Keep the caption within 500 characters. Check
the caption and attribution at desktop and mobile widths.

## Record Attribution

Store the source page, license, and required creator credit on the image record.
The database is the lasting attribution record because image processing removes
embedded metadata. The original August 2026 source review is in
[Entity Image Source Audit](../research/entity-image-source-audit-2026-08.md).

## Apply And Verify

- Read the target Entity immediately before upload. Stop if its identity or
  current images differ from the reviewed manifest.
- Upload explicit files to explicit Entity IDs. The first image becomes primary
  unless another primary already exists.
- Read each Entity after upload. Confirm the stored caption, source, license,
  primary flag, and image count.
- Fetch and inspect the stored image. Confirm that processing preserved the
  intended subject and crop.
- Report the target environment, changed Entity IDs, verified image count,
  sources, and every skipped or blocked record.
