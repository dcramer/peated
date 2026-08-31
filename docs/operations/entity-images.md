# Catalog Image Maintenance

Use this workflow to add or replace Bottle and Entity images in production. The
image APIs and database schemas own the exact runtime contract.

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

An Entity's primary image appears at `16:10`. Secondary Entity images appear at
`4:3`. Prepare primary images at `1600 x 1000` and secondary images at
`1600 x 1200`. This avoids an unintended square crop in the current upload
processor. Keep each source file below the 20 MiB upload limit.

Bottle images are resized to fit within `1024 x 1024`. Prefer a clean product
view that remains legible on a white background.

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

Entity image rows use `caption`, `sourceUrl`, and `license`. Bottle image rows
use `imageUrl`, `sourceUrl`, `license`, and `isPrimary`. Bottle images do not
have captions. The Bottle API returns the primary row's source and license as
`imageSourceUrl` and `imageLicense`. It still returns `bottle.imageUrl` until
all image readers use Bottle image rows.

Do not put a source URL or license in `caption`. Peated shows these fields below
the caption so long URLs do not compete with the description.

```text
Ardbeg Distillery on Islay's south coast. Photo: ErikRombaut.
```

Use the creator name and license text from the source record. Do not normalize
a username into a person's name. Keep the caption within 500 characters. Check
the caption and attribution at desktop and mobile widths.

## Record Attribution

Record each external image in the attribution ledger below. The ledger is the
durable audit record because image processing removes source metadata. Store
the same canonical source and license on the image record.

| Entity        | Source                                                                                                               | Creator          | License                                                        | Checked    |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- | ---------- |
| Ardbeg        | [Ardbeg distillery.jpg](https://commons.wikimedia.org/wiki/File:Ardbeg_distillery.jpg)                               | ErikRombaut      | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2026-08-31 |
| Ardnahoe      | [Ardnahoe distillery](https://commons.wikimedia.org/wiki/File:Ardnahoe_distillery_-_geograph.org.uk_-_6990092.jpg)   | Andrew Abbott    | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | 2026-08-31 |
| Bowmore       | [Bowmore Distillery](https://commons.wikimedia.org/wiki/File:Scotland_Argyll_Bute_Islay_Bowmore_Distillery_01.jpg)   | MSeses           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2026-08-31 |
| Bruichladdich | [Bruichladdich-Islay.jpg](https://commons.wikimedia.org/wiki/File:Bruichladdich-Islay.jpg)                           | Fumaro           | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | 2026-08-31 |
| Bunnahabhain  | [Bunnahabhain distillery.jpg](https://commons.wikimedia.org/wiki/File:Bunnahabhain_distillery.jpg)                   | ErikRombaut      | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2026-08-31 |
| Caol Ila      | [Caol Ila Distillery](https://commons.wikimedia.org/wiki/File:Scotland_Argyll_Bute_Islay_Caol_Ila_Distillery_01.jpg) | MSeses           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2026-08-31 |
| Kilchoman     | [Kilchoman 01.jpg](https://commons.wikimedia.org/wiki/File:Kilchoman_01.jpg)                                         | yashima          | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | 2026-08-31 |
| Lagavulin     | [Lagavulin Distillery](https://commons.wikimedia.org/wiki/File:2019-05-05_Lagavulin_Distillery.jpg)                  | Charlie Marshall | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)       | 2026-08-31 |
| Laphroaig     | [Laphroaig Distillery](https://commons.wikimedia.org/wiki/File:2019-05-06_Laphroaig_Distillery.jpg)                  | Charlie Marshall | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)       | 2026-08-31 |
| Port Ellen    | [Port Ellen Distillery Warehouse](https://commons.wikimedia.org/wiki/File:Port_Ellen_Distillery_Warehouse.jpg)       | Karynmcghee      | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2026-08-31 |

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
