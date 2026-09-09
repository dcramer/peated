# Karuizawa — September 8, 2026

This production review covered every Bottle where Karuizawa (`E1098`) was the
Brand or an evidenced distillery. It included Karuizawa-branded single malts,
post-closure independent releases, cask samples, art and collector ranges, and
historical Ocean Whisky Co. and Mercian products supported by product evidence.
The point-in-time verification snapshot was fetched at 8:00 p.m. PDT on
September 8, 2026. Re-fetch records before using these IDs or counts later.

## Method

The work used separate outside-source and Peated inventories.

1. The Peated inventory was the union of every paginated Bottle returned for
   Brand `E1098` and distillery `E1098`. Each Bottle, its Series, image fields,
   aliases, and assigned references was fetched by stable ID.
2. The outside inventory was divided by distillation year from 1960 through
   2000, then by historical producer family and marketed collection. This kept
   repeated names such as `Vintage`, `Single Cask`, and `Cask Sample` from
   hiding distinct casks or bottlings.
3. Broad collector and catalog indexes supplied leads. Exact producer pages,
   contemporary announcements, readable front and back labels, auction lots,
   and auction catalog PDFs supplied Bottle facts. When page prose conflicted
   with a readable label, the label controlled the printed fact.
4. Every proposed identity was compared on Brand, distillery, age or NAS, ABV,
   vintage, bottling year, edition, cask number, and Series. Package size,
   ceramic or glass presentation, carton art, and label art alone were not used
   to create another Bottle.
5. Writes used explicit production IDs and the authenticated API. Each changed
   Bottle and uploaded image was read back. The final aggregate audit checked
   identity duplicates, Karuizawa relationships, age/NAS contradictions,
   barcode collisions, Series descriptions and membership counts, unsupported
   tasting data, and image source fields.

Temporary work included rendered PDF pages, downloaded source images, API
responses, request bodies, and comparison scripts. Those files are deliberately
not part of this archive. The reusable method belongs in
[Catalog Research](../../operations/catalog-research.md) and
[Catalog Maintenance](../../operations/catalog-maintenance.md).

## Source Coverage

No single source proved the complete Karuizawa catalog. The inventory was built
by overlapping sources:

- The Japanese collector [Karuizawa index](https://yabejojo.jimdoweb.com/karuizawa/)
  supplied year-by-year release and cask leads, including Japanese-market
  labels and cask samples. These pages were treated as collector evidence, not
  as a producer-complete catalog.
- The surviving [Karuizawa Whisky archive](https://karuizawa-whisky.com/en_us/)
  supplied official post-closure product pages, collection membership, and
  images.
- Whisky Auctioneer's [Karuizawa distillery index](https://whiskyauctioneer.com/learn/explore-whisky/distilleries/karuizawa),
  [36 Views of Mount Fuji](https://whiskyauctioneer.com/learn/explore-whisky/series/karuizawa-36-views-mount-fuji),
  [Geishas](https://whiskyauctioneer.com/learn/explore-whisky/series/karuizawa-geishas),
  and [Last Masterpieces](https://whiskyauctioneer.com/learn/explore-whisky/series/karuizawa-last-masterpieces)
  pages supplied historical leads, exact lots, readable labels, and range
  boundaries.
- Wealth Solutions' [Karuizawa Gardens](https://en.wealth.pl/our-projects/karuizawa-gardens/)
  and other project pages supplied collection membership and presentation
  evidence. Exact labels overruled project-page errors.
- Sotheby's [Scenes of Japan](https://www.sothebys.com/en/buy/auction/2023/scenes-of-japan-the-ultimate-karuizawa-collection),
  Bonhams and Spink catalog PDFs, Christie's, Whisky.Auction, The Whisky
  Exchange, Master of Malt, Distilia, dekanta, and other exact retailer or
  auction pages filled label, cask, strength, outturn, and historical Ocean or
  Mercian gaps.
- [Whiskybase's Karuizawa index](https://www.whiskybase.com/whiskies/distillery/173/whiskies)
  and Spirit Radar were used as manually reviewed lead indexes. They were not
  copied as authority. Both can mix duplicate catalog records, package
  variants, samples, and bottles whose Karuizawa association is wrong.

The check covered the known 1960–2000 distillation years, the older domestic
Ocean and Mercian families found in Japanese and auction sources, and the
post-closure collections visible in producer, bottler, retailer, collector, and
auction archives through September 8, 2026. It does not claim that every
private cask or unreleased sample has surviving public evidence.

## Production Result

The final production scope contained 818 Bottles: 755 single malts, 55 blends,
and 8 blended malts. Karuizawa was the Brand on 748; 70 used another evidenced
Brand. Every Bottle retained Karuizawa as a distillery.

- All 818 Bottles had descriptions. ABV was present on 817, vintage year on
  600, bottling year on 631, maturation on 487, cask number on 593, and outturn
  on 386. Unknown values remained `null`.
- The scope used 107 BottleSeries. Evidence supported Series membership for
  707 Bottles; 111 were intentionally unassigned. Every Series had a
  description, included Karuizawa as a distillery, and had a Karuizawa member
  count matching the scoped Bottle inventory.
- Bottler was assigned to 397 Bottles. The other 421 were official releases or
  lacked evidence of an independent selector and releaser. Owners, importers,
  distributors, physical packers, retailers, bars, and private-barrel customers
  were not treated as Bottlers merely because they appeared on a label.
- Fifty-seven Bottles held 60 barcodes. No barcode was assigned to more than
  one Bottle.
- The final identity audit found no duplicate Peated IDs, exact structured
  identity duplicates, missing Karuizawa distillery relationships, age/NAS
  contradictions, or unsupported flavor-profile or tasting-note data.

The audit also corrected high-risk edge cases rather than filling them by
analogy. `B53193` is the 61.4% Karuizawa Five Decades release, with its
no-age-statement status, 2015 release year, 200-bottle outturn, Series `S0578`,
and exact image. Ocean Whisky Co. Ship Bottle `B56079`, Victory `B56083`, Ocean
Whisky `B56119`, and Hiroshima Toyo Carp `B56120` were kept as their own
marketed identities. The lighthouse-shaped container on `B56119` is packaging,
not a separate edition.

## Images And Provenance

There were 763 exact stored Bottle images and 55 Bottles without an exact
image. Every stored image had a source value, but the quality of the provenance
metadata is not uniform: 63 source values are direct image assets rather than a
canonical source page, and none of the 763 stored images had an explicit image
license value. These are provenance gaps, not evidence that the images depict
the wrong Bottle.

The 55 exact-image gaps were 36 Cask Sample releases, 14 Vintage Single Cask
Malt Whisky releases, 3 Bottles with no Series, 1 Number One Single Cask, and 1
Rouge Cask Series release. A similar bottle, another bottling from the same
cask, or a small crop without enough label identity was not used as a
substitute.

## Unresolved And Rejected Leads

- `B53616`, Karuizawa Vintage Single Cask Malt Whisky — Private Barrel of
  Hideki Kurosaki, remains without an ABV. Its label supports 25 years and cask
  6359 but does not print a strength. Hideki Kurosaki is an edition descriptor,
  not a Bottler; no evidence shows an independent whisky release business.
- Four unassigned production references matched the exact query `Karuizawa` at
  final follow-up: reference `12893` (`Karuizawa 1981`), reference `14631`
  (`Karuizawa 1981 Vintage - Single Cask Malt Whisky`), reference `14037`
  (`Karuizawa 1984 Vintage - Single Cask Malt Whisky`), and reference `12901`
  (`Karuizawa Spirit of Asama`). Each can identify more than one structured
  Bottle and therefore remains unassigned.
- A `Karuizawa 100% Grain` lead was rejected because the exact bottle is
  Kawasaki grain whisky; its Karuizawa association in a broad catalog was
  wrong.
- An Imperial Hotel lead remained unsupported by an exact label or independent
  corroboration. A single catalog row did not establish a marketed release.
- Lucky Ocean leads had contradictory identities and were not proven to use
  Karuizawa whisky. They were not added merely because Ocean later owned
  Karuizawa.
- A private experimental WWCP item was not proven to be a marketed Bottle.
- A 35% Ocean Carp lead lacked an exact label or facts that distinguished it
  from the supported Carp release, so it was not created.

The final state is a point-in-time, evidence-bounded catalog. Later discoveries
should add or correct records only after the exact Bottle and every changed
fact are re-verified.
