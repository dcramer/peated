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

Distillery-exclusive and retailer single casks, such as single bourbon
barrels, are not on the producer site. Use auction records or label photos.

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

- Producer pages for Cask Strength Vintage batches
  (`/whisky/cask-strength-vintage-2014-batch2`, `-2014-batch3`, `-3`, `-2`,
  `cask-strength-vintages`, `-2010-batch-1`, `-2009-batch-4`, `-1`,
  `cask-strength-vintage`, `-pre-2020`): batch and ABV. 2014 Batch 2 59.7%,
  2014 Batch 3 60.6%, 2013 Batch 1 59.7% (distilled 2013, bottled 2023),
  2012 Batch 3 59.6%, 2012 Batch 1 60.2%, 2010 Batch 1 58.5%, 2009 Batch 4
  57.2%, 2009 Batch 2 57.1%.
- Producer pages `/whisky/contrasts-*`, `organic`, `peat-smoke`,
  `peat-smoke-sherry-cask-matured`, `sassicaia`, `château-cissac-bordeaux`,
  and `triple-distilled`: Contrasts titles, vintages, and ABV. Contrasts:
  Organic 2015 was distilled 2015 and bottled 2024 at 9 years.
- Producer pages `/whisky/aged-40-years` and `/whisky/benromach-aged-40-years`:
  2022 Release Batch 2 at 56.5% with 1,098 bottles, and 2021 Release at 57.1%.
- [Whisky Auctioneer past auctions](https://whiskyauctioneer.com/search/past-auctions?keyword=benromach),
  searched for organic, contrasts, peat smoke, cask strength, 40 year, triple
  distilled, 18 year, sassicaia, hermitage, tokaji, cissac, port, wood finish,
  cara gold, 2009, and 2010: the release lists below, with bottling year and
  ABV.
- Whisky Auctioneer lot photos, for the printed label wording quoted in this
  guide: 5164163 (Organic 2010, bottled 2017), 5057521 (Organic 2011, bottled
  2019), 5173710 (Cask Strength 2008 Batch 1, 57.9%), 5178196 (Cask Strength
  2009 Batch 1, 58.8%), 8198040 (2014 Batch 02), 7040142 (40 Year Old 2022
  Release), 8215816 (2022 Batch 2 Release), 5070424 (2012 Contrasts: Peat
  Smoke, Sherry Cask Matured), and 5214600 (Château Cissac 2010).
- Retailer listings on Peated price records (The Whisky World, Master of Malt,
  Fine Drams, Mission Liquor, Wooden Cork): bottling years for Contrasts
  releases, and the 2012 bourbon-cask Peat Smoke.

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
  The Whisky World say bottled 2025. Peated treats it as one release and
  leaves the bottling year empty.
- Whisky Auctioneer lot text for Organic 2010 says "bottled in 2018" on lots
  whose labels say 2017 and 2015. Trust the label.
- One auction title calls Contrasts: Cara Gold Malt an 11 Year Old; Peated
  stores 10 years. Not settled.
- Older Peated Bottles held ages worked out from the distilled and bottled
  years (for example 15 years for Peat Smoke 2005 bottled 2014). Pre-2020
  Organic and Peat Smoke labels print no age, so do not store one.

## Names and Series

Names follow "Bottle Name, Edition, And Cask Number" in
[the identity model](../../architecture/whisky-identity-model.md). For
Benromach that gives `Peat Smoke 2008` and `Cask Strength 2008` (the label
prints the vintage apart from the title), `Hermitage 2007` (the title already
ends in the year), and `40-year-old 2022 Release`. Releases from 2020 on keep
the `Contrasts:` prefix. The batch goes in `edition`.

All Contrasts and Contrast Range releases from 2014 on belong to the Contrasts
Series. Older releases, such as the no-age Organic (2006–2014) and the
Sassicaia 5 Year Old, have no Series: no source shows them in the collection
before 2014.

## Unresolved

- Two older Peated records, `Cask Strength 2009` and `Cask Strength 2012`,
  have no ABV or batch. Each may duplicate one of the batch releases. The 2012
  record could also be the 2002 vintage bottled in 2012. Needs a reference,
  price, or tasting photo that shows the batch.
- Contrasts: Peat Smoke 2012 exists in sherry and bourbon casks. One Peated
  record has a reference that matches the sherry-cask auction title and a
  price link to the bourbon release. Which is it?
- Peat Smoke 2010: bourbon (the producer's vintage list) or the 2010 Sherry
  Cask Matured at 59.9%? A stored age of 10 is unverified.
- A `Peat Smoke` record with no facts: which vintage?
- `2008 Organic`: no Organic distilled in 2008 was found on the producer site
  or at auction. It may be a bottling year or the Organic Special Edition.
- `Sassicaia Wood Finish 2009`: the 2002 vintage bottled 2009, or the 2009
  vintage bottled 2017?
- Sassicaia Wood Finish 5 years: Peated stores vintage 2006, but auction
  records say bottled 2006. The label photo was unreadable.
- `Tokaji Finish`: the 21 Year Old (bottled 2004) or the 5 Year Old (bottled
  2006)?
- The US label of Cask Strength 2007 Batch 1 was not read, so its 11-year age
  is unconfirmed.
- Releases with sources but not in Peated on 22 October 2026: Organic Special
  Edition (bottled 2009 and 2011); Organic 2010 bottled 2016 and 2018;
  Contrasts: Organic 2013 (bottled 2022); Contrasts: Peat Smoke Sherry Cask
  Matured 2012, if the record above is the bourbon one; Peat Smoke 2000, the
  2002 batches, 2004, 2007, 2009 (bottled 2018), and 2010 Sherry Cask Matured;
  Cask Strength 2001, 2002, 2003, and the Taiwan 12 Year Old batches; 40 Year
  Old 2023 Release (53.8%, one auction lot only); and the Sassicaia,
  Hermitage, Château Cissac, Tokaji, and Port vintages in the lists above.

## Images

Images were not reviewed. Several Contrasts Bottles carry images uploaded from
store listings with no source page or license.
