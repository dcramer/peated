# Benromach catalog sources

Research date: 22 October 2026. Scope: the Benromach distillery record and
official Benromach releases. The second pass on the same day covered the
Contrasts family (including the pre-2020 Contrast Range and wood finishes),
the Cask Strength Vintage family, the 40 Year Old releases, and the 18 Year
Old. This guide does not claim full coverage of past releases.

## Producer site

The [current range](https://www.benromach.com/whisky/current-range) lists
the Signature ages (10, 12, 15, 21, and 25 years), the current Cask
Strength Vintage batch, the Contrasts series, limited releases, single
casks, and the Ultra Aged range. The
[archive](https://www.benromach.com/whisky/archive) lists past Cask Strength
Vintage batches from 2009 to 2014, past Contrasts releases, single casks,
market exclusives, and releases from before the 2020 rebrand, including
Heritage single casks from 1973, 1975, and 1977. Each card links to a
product page at `/whisky/<slug>` with ABV, vintage, cask type, and often
the distillation and bottling years.

The site calls the distillery both "Benromach" and "Benromach Distillery".
They are one site in Forres, owned by Gordon & MacPhail since 1993.

## Older producer site (Wayback)

The [Wayback CDX index](https://web.archive.org/cdx/search/cdx?url=benromach.com/*&from=2012&to=2020&collapse=urlkey&fl=timestamp,original)
lists the 2012–2020 pages. Most captures hold only the age gate, so they
prove page names and grouping, not specs.

- May 2014: the Sassicaia page is titled "The Benromach Contrasts
  Collection" (`/whiskies/benromach-contrasts/wood-sassicaia`, 45%, vintage
  2005).
- 2015: `/whiskies/benromach-contrasts/` holds Château Cissac, Hermitage,
  Organic, Peat Smoke, and Sassicaia.
- 4 September 2017: news post "Benromach Expands Portfolio with a new
  Contrast Expression" launches Triple Distilled, a 2009 vintage bottled
  that year at 50%, about 1,300 cases.
- 2017–2019: the same site sometimes files Triple Distilled and Sassicaia
  2009 and 2011 under `/the-classic-benromach/`; by November 2019 Triple
  Distilled sits under `/benromach-contrasts/`.

## Access

WebFetch gets a 403 from benromach.com. Normal page loads in a browser work,
and so does an in-page `fetch()` of `/whisky/<slug>` from a benromach.com
tab. Whisky Auctioneer past-auction search and lot pages also work through
in-page `fetch()`; lot photos load from `assets.whiskyauctioneer.com` and can
be zoomed in the browser. Whiskybase shows a bot check; it was skipped.

## How the producer titles releases

- Contrasts releases are titled `Contrasts: <name>`, such as
  `Contrasts: Unpeated`, `Contrasts: Wine Finish` (Côte Rôtie casks), or
  `Contrasts: Double Matured` (Bordeaux wine casks). Retailers add the cask
  to the name ("Wine Finish Côte-Rôtie Cask", "Double Matured Bordeaux Wine
  Cask Finish"); the producer's product titles do not. The site calls them
  "the Benromach Contrasts series". Before 2020 the same range was the
  "Contrast Range" or "Contrasts Collection", and its labels and titles had
  no prefix: `Organic`, `Peat Smoke`, `Sassicaia`, `Hermitage`,
  `Château Cissac`, `Triple Distilled`. The archive pages now title some of
  them with the prefix (`Contrasts: Organic`); the pre-2020 labels do not
  print it.
- Pre-2020 Organic and Peat Smoke labels print the product name with
  `Distilled <year>` and `Bottled in <year>` fields and no age. Organic
  2010 was bottled in several years (2015, 2016, 2017, 2018).
- The 2012 Contrasts: Peat Smoke exists in two casks: the label read for
  one says `Sherry Cask Matured` (producer title
  `Contrasts: Peat Smoke Sherry Cask Matured`); The Whisky World sells a
  pale `Contrasts: Peat Smoke Bourbon 2012`, 9 years old.
- Wood finishes before the Contrasts name (Sassicaia, Tokaji, Port) print
  `Wood Finish`. The 2010 Château Cissac label prints `Wood Finish` large
  and `Château Cissac Bordeaux` in the band.
- Single casks are titled with their vintage: `Single Cask (2003)`,
  `Single Cask 2011`, `Single Cask Bordeaux 2012`. The cask number appears
  in the description.
- Cask Strength Vintage releases are titled `Cask Strength Vintage` with
  `Vintage <year> - Batch <n>`. Labels bottled in 2019 print
  `Cask Strength`, `Batch 1`, and `Distilled 2008`; labels from 2022 on
  print `Vintage 2014 Cask Strength Batch 02`.
- The 40 Year Old labels print `Aged 40 Years` with the release:
  `2021 Release` (57.1%), `2022 Release` (57.6%, "Limited Release of 1,132
  Bottles"), and `2022 Batch 2 Release` (56.5%, 1,098 bottles). A 2019
  bottling at 43% has no release wording in the auction titles.
- `Small Batch Edition #1` is "the first edition of the Benromach Small
  Batch series". It is a 22 Years Old, distilled in 2003 and bottled in 2025.

## Sources for the second pass

| Source                                                                                                                                                                                                                                                                                                                                                                     | Established                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producer pages `/whisky/cask-strength-vintage-2014-batch2`, `-2014-batch3`, `-3`, `-2`, `cask-strength-vintages`, `-2010-batch-1`, `-2009-batch-4`, `-1`, `cask-strength-vintage`, `-pre-2020`                                                                                                                                                                             | Cask Strength Vintage batches with ABV: 2014 B2 59.7%, 2014 B3 60.6%, 2013 B1 59.7% (distilled 2013, bottled 2023), 2012 B3 59.6%, 2012 B1 60.2%, 2010 B1 58.5%, 2009 B4 57.2%, 2009 B2 57.1% |
| Producer pages `/whisky/contrasts-*`, `organic`, `peat-smoke`, `peat-smoke-sherry-cask-matured`, `sassicaia`, `château-cissac-bordeaux`, `triple-distilled`                                                                                                                                                                                                                | Contrasts titles, vintages, ABV; Contrasts: Organic 2015 distilled 2015, bottled 2024, 9 years                                                                                                |
| Producer pages `/whisky/aged-40-years`, `/whisky/benromach-aged-40-years`                                                                                                                                                                                                                                                                                                  | 2022 Release Batch 2, 56.5%, 1,098 bottles; 2021 Release, 57.1%                                                                                                                               |
| [Whisky Auctioneer past auctions](https://whiskyauctioneer.com/search/past-auctions?keyword=benromach) searched for organic, contrasts, peat smoke, cask strength, 40 year, triple distilled, 18 year, sassicaia, hermitage, tokaji, cissac, port, wood finish, cara gold, 2009, 2010                                                                                      | Release lists with bottling year and ABV (below)                                                                                                                                              |
| Whisky Auctioneer lot photos 5164163 (Organic 2010, b2017), 5057521 (Organic 2011, b2019), 5173710 (Cask Strength 2008 Batch 1, 57.9%), 5178196 (Cask Strength 2009 Batch 1, 58.8%), 8198040 (2014 Batch 02), 7040142 (40 Year Old 2022 Release), 8215816 (2022 Batch 2 Release), 5070424 (2012 Contrasts: Peat Smoke, Sherry Cask Matured), 5214600 (Château Cissac 2010) | Printed label wording quoted in this guide                                                                                                                                                    |
| Retailer listings on Peated price records (The Whisky World, Master of Malt, Fine Drams, Mission Liquor, Wooden Cork)                                                                                                                                                                                                                                                      | Bottling years for Contrasts releases; the 2012 bourbon Peat Smoke                                                                                                                            |

Release lists from the auction archive (bottling year, ABV):

- Organic: no-age `Organic` 2006–2014, 43%; `Organic Special Edition`
  bottled 2009 and 2011, 43%; 2010 bottled 2015–2018, 43%; 2011 bottled
  2019, 43%; `2013 Contrasts: Organic` bottled 2022, 46%.
- Peat Smoke: 2000 (b2007); 2002 Batch 2 (b2008), Batch 3 (b2010),
  Batch #4; 2004; 2005 (b2014); 2006 (b2016); 2007 (b2016); 2008 (b2017);
  2009 (b2018); 2010 Sherry Cask Matured (b2018, 59.9%); 2012 Contrasts
  (b2021). All 46% unless noted.
- Cask Strength: 2001 (b2010, 59.9%); 2002 (b2012, 59.9%); 2003 (b2013,
  58.2%); 2007 Batch 1 (b2018, 75cl, 58.2%); 2008 Batch 1 (b2019, 57.9%);
  2009 Batch 1 (b2019, 58.8%), Batch 2 (b2019, 57.1%), Batch 04 (b2020,
  57.2%); 2010 Batch 01 (b2021); 2012 Batch 01 and 03 (b2022); 2013
  Batch 01 (b2023); 2014 Batch 02 (b2023); Taiwan 12 Year Old Cask Strength
  2017 Batch 1 (58.9%) and 2018 Batch 1 (58.7%); 1981 Cask Strength (b2006,
  b2007).
- 40 Year Old: 2019 (43%), 2021 Release (57.1%), 2022 Release (57.6%),
  2022 Release Batch 2 (one lot title says 57.6%; the producer and label
  say 56.5%), 2023 Release (53.8%, one lot).
- Wood finishes: Sassicaia 5 Year Old (b2006), 2002 (b2009), 2004 (b2013),
  2005 (b2012), then `Sassicaia` 2006 (b2015), 2007 (b2016), 2009 (b2017),
  2010 (b2018), 2011 (b2019); Hermitage 2001 (50%), 2005 (b2014 and b2015),
  2007 (b2016); Château Cissac 2006 (b2014), 2009 (b2017), 2010 (b2018);
  Tokaji Wood Finish 21 Year Old (b2004) and 5 Year Old (b2006); Port Wood
  Finish 19, 22, and 28 Year Old (b2002, b2005, b2010) and 2000 (b2012).
- 18 Year Old, 40%: labels from 1998–2003 and 2003–2005.

## Conflicts and page errors

- The producer page `/whisky/cask-strength-vintage` reads "Batch 1 - 2009,
  57.9%". The 2008 Batch 1 label prints 57.9% and the 2009 Batch 1 label
  prints 58.8%, so the page mixes the two.
- The producer's `/whisky/triple-distilled` archive page carries text about
  a 1973 single cask. Its title and 50% ABV are right.
- Contrasts: Organic 2015: the producer says bottled 2024; Master of Malt and
  The Whisky World say bottled 2025. Peated treats it as one release
  (Bottle 46998) and leaves `bottlingYear` empty.
- Whisky Auctioneer lot text for Organic 2010 says "bottled in 2018" on lots
  whose labels say 2017 and 2015. Trust the label.
- Stored ages on several old Peated Bottles were arithmetic, not printed
  (for example 15 years for Peat Smoke 2005 bottled 2014). They were cleared
  where the label or the distilled and bottled years proved them wrong.

## Results of the 22 October 2026 pass (production)

Naming follows the rule in `whisky-identity-model.md`, "Bottle Name,
Edition, And Cask Number", as settled in commit fd838c0f0 on branch
`claude/bottle-naming-review-b97d76` (dcramer/peated#1436, not merged on
22 October 2026). When the label prints the vintage apart from the title,
the year follows the expression (`Peat Smoke 2008`, `Cask Strength 2008`);
a printed title that already ends in the year stays as printed
(`Hermitage 2007`). Post-2020 releases keep `Contrasts:`, Bottles that
share a title carry their vintage, and no vintage name adds an age. All Contrasts and Contrast
Range releases from 2014 on are in Series S0136 "Contrasts".

| Status            | Bottles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merged (approved) | 61944 → 56629 (Organic 2011); 14327 → 3053 (Triple Distilled 2009); 62807 → 46998 (Contrasts: Organic 2015); 63627 → 18509 (18-year-old)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Updated           | 57076, 2698 `Organic 2010`; 56629 `Organic 2011`; 47056 `Contrasts: Organic 2012`; 46998 `Contrasts: Organic 2015`; 3975, 3411, 2696, 2697 `Peat Smoke 2005/2006/2008/2010`; 61935, 1647, 45898 `Contrasts: Peat Smoke 2009/2012/2014`; 3053 `Triple Distilled 2009`; 56380 `Contrasts: Triple Distilled`; 45569 `Contrasts: Double Matured`; 45863 `Contrasts: Wine Finish`; 46145 `Contrasts: Virgin Oak`; 47053 (Series); 1345 `Contrasts: Cara Gold Malt`; 63880 (Series, bottled 2018); 3686 `Hermitage 2005`; 15909 (facts, Series); 18516 (45%, bottled 2005); 2343 `Cask Strength 2008` Batch 1; 1971 `Cask Strength 2009`; 1346 `Cask Strength 2012`; 57075 `Cask Strength 2007` Batch 1; 62806 `Cask Strength 2014` Batch 2; 47057 `40-year-old 2022 Release` Batch 2 (1,098 bottles); 47058 `40-year-old 2022 Release` (1,132 bottles); 18509 (40%) |
| Created           | 68303–68305 `Cask Strength 2009` Batch 1, 2, 4; 68306 `Cask Strength 2010` Batch 1; 68307, 68308 `Cask Strength 2012` Batch 1, 3; 68309 `Cask Strength 2013` Batch 1; 68310 `Cask Strength 2014` Batch 3; 68311 `40-year-old 2021 Release`; 68312 `40-year-old` (2019, 43%)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| No change         | 1173 `Organic` (no-age 2006–2014 release); 47052, 47054, 47055                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Unresolved        | See below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Unresolved

- 1971 `Cask Strength 2009` and 1346 `Cask Strength 2012` have no ABV or
  batch, so each may duplicate one of the new batch Bottles. 1346 could also
  be the 2002 vintage bottled in 2012. Needs a reference, price, or tasting
  photo that shows the batch.
- 1647 `Contrasts: Peat Smoke 2012`: its reference matches the sherry-cask
  auction title, but its price link is the bourbon release. Which one is it?
- 17965 `Peat Smoke` (no facts): which vintage?
- 2697 `Peat Smoke 2010`: bourbon (producer vintage list) or the 2010 Sherry
  Cask Matured at 59.9%? Its stored age of 10 is unverified.
- 3687 `2008 Organic`: no Organic distilled in 2008 was found on the producer
  site or at auction. It may be a bottling year or the Organic Special
  Edition. Left unchanged.
- 14453 `Sassicaia Wood Finish 2009`: the 2002 vintage bottled 2009 or the
  2009 vintage bottled 2017?
- 63620 `Sassicaia Wood Finish` 5 years: Peated stores vintage 2006, but
  auction records say bottled 2006. The label photo was unreadable. It
  predates the 2014 Contrasts evidence, so it has no Series.
- 18236 `Tokaji Finish`: the 21 Year Old (b2004) or the 5 Year Old (b2006)?
- 1345 `Contrasts: Cara Gold Malt` stores 10 years; one auction title says
  11 Year Old. 57075 stores 11 years; the US label was not read.
- 1173 `Organic` (2006–2014) has no Series: no source shows it in the
  Contrasts collection before 2014.
- Not created, recorded for a later pass: Organic Special Edition (b2009,
  b2011); Organic 2010 bottled 2016 and 2018; Contrasts: Organic 2013
  (b2022); Contrasts: Peat Smoke Sherry Cask Matured (2012, if 1647 is the
  bourbon one); Peat Smoke 2000, 2002 batches, 2004, 2007, 2009 (b2018) and
  2010 Sherry Cask Matured; Cask Strength 2001, 2002, 2003 and the Taiwan
  12 Year Old batches; 40 Year Old 2023 Release (53.8%, one auction lot
  only); Sassicaia, Hermitage, Château Cissac, Tokaji, and Port vintages not
  in Peated.
- Images were not reviewed in this pass. Several Contrasts Bottles carry
  images uploaded from store listings with no source page or license.
- Renames did not rewrite generated descriptions. Five that stated a
  disproven age were cleared to regenerate (3975, 3686, 3053, 2343, 2698).
  The rest still use the old names in their text.
- Distillery-exclusive and retailer single casks, such as single bourbon
  barrels, are not on the producer site. Use auction records or label
  photos.
