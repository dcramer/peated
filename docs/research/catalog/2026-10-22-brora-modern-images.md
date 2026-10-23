# Brora Modern Release Images

Scope: Bottle images for Brora releases from 2014 onward, including the last
Special Releases, Diageo one-offs, Triptych, Distillery Collection, Casks of
Distinction, and independent bottlings. Release identities and facts come from
the [October 20 Brora audit](./2026-10-20-brora.md); this pass only
looked for images.

The October 20 audit found exact photos for most of these Bottles but no
reuse grant. This pass used the producer-image rule in
[Review Images](../../operations/catalog-maintenance.md#review-images).

## Sources With Exact Images

- [Diageo Rare & Exceptional: Brora Triptych](https://www.diageorareandexceptional.com/us/rare-spirits/rare-whisky/brora-triptych-single-malt-scotch-whisky)
  has a separate 1200 × 1200 front shot of each decanter: Elusive Legacy
  (1972, 48 years), Age of Peat (1977, 43 years), and Timeless Original (1982,
  38 years). Each label shows the vintage, the 2021 bottling year, and the
  name. Use the files named `1972individual`, `1977individual`, and
  `1982individual`; the other carousel images show the set or the box.
- [Diageo Rare & Exceptional: Brora 39 Year Old](https://www.diageorareandexceptional.com/us/brora-39-year-old)
  shows Hidden Beneath in front of its box (`brora-39-yo-images_section-1`).
  Cropped to the box and bottle; the bottle base is cut off in the source. The
  lifestyle shot on the same page shows a "Not for retail" sample label.
- [Diageo Rare & Exceptional: Brora Iris](https://www.diageorareandexceptional.com/us/brora-iris)
  shows the 1.5-litre decanter in its limestone sculpture
  (`1_brora_iris_kv_hero_v2`, 1440 × 810). The decanter and sculpture are the
  product, so the full scene is the exact image.
- [Diageo feature: Introducing Brora 40-Year-Old, 200th anniversary limited edition](https://web.archive.org/web/20190905084259/https://www.diageo.com/en/news-and-media/features/introducing-brora-40-year-old-200th-anniversary-limited-edition/),
  14 August 2019, is gone from the live site. The Wayback capture holds a
  1874 × 2500 studio shot of the 1978, 40-year-old bottle in its open case
  (`/PR1346/aws/media/7991/brora-200th-anniversary.jpg`).

Each image above is now stored on its Bottle with the page above as its
source. Upload trims plain white margins, so the Triptych decanters are stored
as narrow portraits.

## Reuse Terms

- Diageo sites link to the
  [Diageo website conditions of use](https://legal.diageo.com/en-us/website-conditions-of-use).
  They prohibit reproduction except as allowed by law or by written
  permission. No press-kit license was found. Images from these pages are
  stored under the producer-image rule with that limit named in `license`.
- Openverse and Flickr searches for "brora whisky", "brora triptych",
  "brora distillery bottle", and "brora special release" found only the
  2013 Boutique-y Batch 1 label (CC BY-SA, outside this scope) and
  non-commercial tasting photos.

## Searches That Found No Producer Image

- **Untold Depths (1977, 44 years, 2024):** the Rare & Exceptional site has no
  page (`/us/brora-untold-depths` and `/us/brora-44-years-old` return 404).
  Launch coverage in trade press (The Spirits Business, Whisky Magazine,
  Tempus) carries Diageo photos on third-party pages. Trade sources disagree
  on the cask number (2367 or 2637).
- **Special Releases 2015 (37 years) and 2016 (1977, 38 years):** Wayback holds
  malts.com product pages (`/en-gb/products/single-malt-whisky/brora-37-year-old`
  and `brora-38-year-old-2016`, captured 2020–2021), but the pages are
  client-rendered and capture blank. No page-data or image capture was found.
  Diageo news captures start with the 2018 Special Releases.
- **Casks of Distinction:** private casks sold through Diageo's client program;
  no public product pages. Diageo's
  [2017 press release on cask 4817](https://www.diageo.com/en/news-and-media/press-releases/2017/one-of-the-worlds-rarest-whiskies-sells-at-auction-oldest-official-bottling-of-1972-brora-sold)
  confirms the 1972 bottle at 58.6% but has no bottle image in live or
  2019 captures.
- **World of Whiskies Exclusive (1972, 40 years, 2014) and the 2018 one-of-one
  35-year-old charity bottle:** no producer page found. Exact photos exist only
  on retailer and auction pages.
- **Hunter Laing Old & Rare (1982, 40 years) and The First Editions (1982,
  37 years):** [hunterlaing.com](https://hunterlaing.com/range/) has range
  pages only; its search and whisky sitemap list no Brora. No Wayback capture
  of hunterlaing.com or edition-spirits.com mentions Brora.
- **Lombard Jewels of Scotland (1982, 32 years):** lombardscotchwhisky.com
  blocks curl and the in-app browser with Cloudflare; this was not bypassed.
  Wayback captures of its Jewels of Scotland pages (2013 and July 2026) list
  no Brora. The only archived Brora page is a 2009 21-year-old.
- **Gordon & MacPhail Rare Old (1982, 2015, cask RO/15/01):** the current
  site lists no Brora product. G&M's public
  [brand asset library](https://brandassets.wearegordonandmacphail.com/web/974b5063f0a03a66/gordon---macphail/)
  holds about 3,000 recent product images but none for Brora. Archived G&M
  Brora images date from 2007 and show other bottlings. The press release
  list has no Brora release.

## Bottler Image Sources

- [That Boutique-y Whisky Company: Brora](https://www.thatboutiqueywhiskycompany.com/whiskies/brora)
  covers Batch 2 (September 2014, 42 bottles, 52.1%). It has a front-label
  artwork file and a bottle shot labelled "Batch 2" and "Bottle 11 of 42".
  The site footer reads "All rights reserved"; no reuse grant. The bottle shot
  is stored on the Bottle.
- G&M's brand asset library is public and is worth checking first for any G&M
  bottling from recent years.

## Open Questions

- Does Brora Iris have an official ABV? Peated stores 42%; WhiskyFun's tasting
  note reads 41.8%. Not changed in this pass.
