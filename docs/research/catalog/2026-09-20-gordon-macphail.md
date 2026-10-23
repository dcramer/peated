# Gordon & MacPhail catalog sources

Research dates: 20 and 29 September 2026. Scope: current and historical marketed
Gordon & MacPhail releases, including independent bottlings and house labels.
This source guide does not establish exhaustive historical coverage.

## Producer archive

The [producer sitemap](https://www.gordonandmacphail.com/sitemap.xml) is a much
broader entrance than the [visible whisky list](https://www.gordonandmacphail.com/our-whiskies).
It retains individual pages for discontinued and market-specific releases.
The [vault](https://www.gordonandmacphail.com/our-whiskies/our-vault) identifies
historical ranges but its range links are not themselves complete release lists.
Read individual pages and match distillery, vintage, bottling date, strength,
cask and range. Multiple URLs can describe the same liquid.

The product page's `Range` field is not sufficient for Series assignment.
Recollection releases can say `Private Collection` there while the bottle
label explicitly names `The Recollection Series #2` or `#3`. Inspect each
label and compare the launch announcement. This affects, among others,
Convalmore 1984, Imperial 1990, North Port 1981 and Glenlochy 1979 in the
[third series announcement](https://www.gordonandmacphail.com/corporate/press-releases/gordon-macphail-unveils-forgotten-masterpieces-in-third-recollection-series).
The older Recollection labels can print both range names; the specific
Recollection membership and its printed edition identify the marketed release.

The current site uses several product layouts. Some product titles are H2
headings rather than H1 headings. Cask and outturn fields can be absent or
commented out. Missing values are unknown. A URL's batch code is not evidence
that the code appeared on the marketed label. Some pages give a full bottling
date; that is not the release date.

Direct Python HTTP requests returned 403. Normal browser navigation and paced
same-site reads from the browser worked. Stop on access errors; do not bypass
site protections. The former
[retail archive collection](https://retail-gordonandmacphail.com/collections/archive-exclusive)
redirected to the current range overview, losing the historical collection list.

## Conflicts to resolve from labels

- [Bunnahabhain 57.6%](https://www.gordonandmacphail.com/our-whiskies/24092-cc-cs-bunnahabhain-2009-576)
  has 2009 in its URL but 2007 in its displayed title. Its displayed bottling
  date is 11 March 2024. Do not settle the vintage from the URL alone.
- [Dallas Dhu cask 628](https://www.gordonandmacphail.com/our-whiskies/pc-dallas-dhu-1971-628-437)
  has 1971 in its URL but 1969 in its displayed heading. It gives 43.7%,
  150 bottles and a bottling date of 8 November 2021. Exact label evidence
  is needed before assigning the vintage or equating it with another range.
- Port Ellen 1981, cask 290, bottled in 2023 at 52.5%, has conflicting
  outturns on the producer's [archive page](https://www.gordonandmacphail.com/our-whiskies/pc-port-ellen-1981-525)
  and [newer page](https://www.gordonandmacphail.com/our-whiskies/port-ellen-1981):
  181 and 60 respectively. These are not evidence for two separate releases.
- [Miltonduff 1984, 23/022](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-miltonduff-distillery-1984-23-022)
  displays 38% strength. Verify the label before creating a Scotch whisky
  record from that value.
- Scores such as `89/100` can appear beside producer titles. They are not
  batch codes. A year-like prefix on a batch code also does not establish a
  bottling date.
- Caperdonich 1979 cask 1105 has a retailer age conflict: Whisky Shop describes
  it as 44 but gives March 1979 and January 2023 dates. The
  [Whisky Vault listing](https://www.thewhiskyvault.com/caperdonich-1979-43-year-old-gordon--macphails-private-collection---recollection-series-cask-1105-27223-p.asp)
  explicitly states 43, matching other exact-cask listings and compatible
  dates. The producer label confirms Recollection Series #2.
- The producer's [second Recollection announcement](https://www.gordonandmacphail.com/corporate/press-releases/gordon-macphail-port-ellen-whisky-spearheads-latest-recollection-series)
  currently shows a January 2020 publication timestamp. Contemporary
  [2023 reporting](https://www.forbes.com/sites/joemicallef/2023/08/02/the-lost-distilleries-gordon--macphails-2023-recollection-series/)
  identifies the actual launch year. Do not use the migrated page timestamp
  as a release date.

## Cask Strength range

The producer's [Cask Strength archive](https://www.gordonandmacphail.com/our-whiskies/ranges/cask-strength)
identifies this as a separate range retired in spring 2018. Do not assign it
to Signatory's Cask Strength Collection.

The [Whisky Shop auction listing](https://www.whiskyshop.com/auctions/a13437-caol-ila-2004-gordon-macphail-cask-strength)
and [contemporary review](https://singlemaltwallonie.blogspot.com/2016/06/caol-ila-20042016-gordon-macphail-593.html)
identify Caol Ila 2004/2016 at 59.3%, including the four refill-sherry casks.
[Abbey Whisky](https://www.abbeywhisky.com/products/caol-ila-11-year-old-2005-cask-strength-gordon-macphail-aw01802)
identifies the 2005/2016 bottling at 57.3% and its four casks. Retailer age
wording alone may be calculated from years; inspect the label before treating
it as a stated age. Whisky Auctioneer returned an access block during this
research and was not used to settle these facts.

## Historical cross-checks

[Whiskyfun](https://www.whiskyfun.com/) has distillery indexes linking to dated
reviews and label photographs. Search Gordon & MacPhail, MacPhail, and G&M
within each index. These cover earlier Connoisseurs Choice labels, CASK,
licensed bottlings, regional exclusives and discontinued ranges. Review dates
and approximate years marked `+/-` do not establish release or bottling dates.
The old Malt Maniacs Monitor link from
[Ye Auld Pages](https://www.whiskyfun.com/Ye-Auld-Pages.html) redirected to the
Whiskyfun homepage during this research.

[The Whisky Exchange's historical guide](https://www.thewhiskyexchange.com/wanted/gm)
explains Connoisseurs Choice label periods and the CASK and Book of Kells
families. It is a discovery guide, not an exhaustive release inventory.

Spirit Radar's public Gordon & MacPhail index appeared useful for discovery,
but its [terms](https://app.spiritradar.com/terms-and-conditions/) explicitly
exclude collecting product listings and automated data extraction. Do not
use it as an automated inventory source. Whiskybase likewise must not be
collected automatically; see Peated's existing source-access audit.

Earlier Peated research provides additional source paths for
[Brora](2026-09-07-brora.md), [Talisker](2026-09-20-talisker.md),
[Dalmore](2026-09-20-dalmore.md), and
[Ledaig](2026-09-20-ledaig-independent.md). Check the exact cited evidence;
an earlier catalog decision is not new producer evidence.

Search historical export names separately. An
[iDealwine Caol Ila listing](https://www.idealwine.com/uk/acheter-vin/B2222825-762-1-Bottle-Caol-Ila-1975-Jas-Gordon-Co-bottled-1990-Brown.jsp)
identifies Jas. Gordon & Co. as a Gordon & MacPhail subsidiary used for
importer distribution. A different stored bottler name therefore needs
investigation, not automatic exclusion or merging. Conversely, Gordon &
Company's Pearls of Scotland, Gordon Graham, and the Charles Gordon
Collection are unrelated search hits.

The [Whisky-Online Spirit of Scotland collection](https://www.whisky-online.com/collections/spirit-of-scotland)
describes the range's revival in 2025 and lists recent single casks. This
family needs a contemporary retailer inventory as well as historical review
searches; its absence from the main producer product pages does not establish
that it is discontinued.

[Mark Littler's Book of Kells guide](https://marklittler.com/book-of-kells-series/)
provides historical label and bottle examples. Compare each release with its
label: Book of Kells artwork also appears on the newer Dram Takers collection,
and shared artwork alone does not establish identical range membership.

## Convalmore historical evidence

The [Whiskyfun Convalmore index](https://www.whiskyfun.com/Convalmore.html),
[Whisky Exchange](https://www.thewhiskyexchange.com/p/25649/convalmore-1969-bot1991-connoisseurs-choice),
and auction records distinguish the early age-stated brown labels from later
vintage releases with different bottling years. Do not compute a stated age
from those years. Some collector indexes mark calculated ages with an asterisk.

[Master Quill's date-code guide](https://masterquill.com/2012/09/14/gordon-macphail-codes/)
documents codes that disagree with the printed bottling year, including a
Convalmore 1969/1991 label. A decoded code alone is not enough to override a
printed date.

The [1975 Rare Old bottled in 2015](https://www.abbeywhisky.com/products/convalmore-1975-rare-old-gordon-macphail)
has a lot identifier, RO/15/06. Do not treat it as a cask number or infer a
bottling month from it. The earlier
[1975 bottled in 2008](https://www.thewhiskyexchange.com/p/10788/convalmore-1975-bot2008-gordon-macphail-rare-old)
is 43% and refill sherry matured. Master of Malt's page for that earlier
release has conflicting prose about 48%, bourbon maturation and 202 bottles;
that prose was not used. Its age remains unconfirmed.

[My Annoying Opinions](https://myannoyingopinions.com/2020/11/27/convalmore-21-1984-gordon-macphail/)
provides an owned-bottle photograph and facts for the 1984 Reserve cask 1798,
bottled in 2006 for the American market. This is distinct from the later
Connoisseurs Choice and Recollection releases of the same vintage.

## Current Heritage ranges

The producer distinguishes the [Connoisseurs Choice Heritage Range](https://www.gordonandmacphail.com/connoisseurs-choice-1968-longmorn),
which revives its black label, from the [Heritage Collection](https://www.gordonandmacphail.com/connoisseurs-choice-heritage-collection),
which revives the map label. Similar names do not justify merging these series.
The former page documents Longmorn 1968 cask 5833 and Talisker 1987 cask 22601101.
The latter markets a five-bottle collection; establish whether its components
were independently offered before treating each as a separate marketed release.

The [Anniversary Series page](https://www.gordonandmacphail.com/anniversary-series)
provides another discovery path for Longmorn 1966, Glen Grant 1976, Miltonduff
1986 and Linkwood 1996. Compare their liquid identity with earlier bottlings;
a new commemorative label alone does not establish a new release.

## Discovery evidence

The producer's individual Discovery pages retain dated entries for
[Tormore 13-year-old](https://www.gordonandmacphail.com/our-whiskies/may-2019-disco-tormore-13yo-43)
and [Balblair 12-year-old](https://www.gordonandmacphail.com/our-whiskies/may-2019-disco-balblair-12yo-43),
both showing a 2019 bottling year. General range pages and image filenames
are not evidence of a particular bottling year. Compare dated archive entries
with general expressions before creating further records.

[Bunnahabhain 11-year-old](https://www.gordonandmacphail.com/our-whiskies/discovery-from-bunnahabhain-distillery-11-years-old)
is the purple, sherry-matured expression. The separate
[10-year-old](https://www.gordonandmacphail.com/our-whiskies/august-2019-discovery-bunnahabhain-10yo-430)
has a grey label stating “Smoky with Peat.” Its producer page says sherry,
while other accounts describe bourbon maturation; maturation remains unsettled.
[Fine Drams](https://www.finedrams.com/bunnahabhain-10-year-old-discovery-gordon-macphail.html)
also contradicts itself on chill filtration between its prose and structured
fields. Do not copy either filtration value without stronger evidence.

Tomatin has both a [2007 vintage bottled in 2018](https://www.finedrams.com/tomatin-2007-bottled-2018-discovery-gordon-macphail.html)
and a [2008 vintage bottled in 2018](https://www.masterofmalt.com/whiskies/tomatin/tomatin-2008-bottled-2018-discovery-gordon-and-macphail-whisky/).
Do not treat those vintages as a transcription error. A further
[2008 entry bottled in 2019](https://www.thewhiskyexchange.com/p/55019/tomatin-discovery-2008-bot2019-gordon-macphail)
needs comparison with the 2018 bottling before deciding whether it represents
a separate marketed release. Retailer calculations such as “around 11 years”
are not stated ages.

## Glenrothes archive labels

Several producer Connoisseurs Choice pages have an incorrect “1997” heading.
Their own readable bottle photographs resolve the vintage, age, batch, cask,
strength, bottling date, outturn, colour and filtration facts:

- [Batch 24/095](https://www.gordonandmacphail.com/our-whiskies/24095-cc-cs-glenrothes-2009-551)
  is vintage 2009, not 1997.
- [Batch 24/135](https://www.gordonandmacphail.com/our-whiskies/24135-cc-cs-glenrothes-2007-419)
  is vintage 2007, not 1997.
- [Batch 24/013](https://www.gordonandmacphail.com/our-whiskies/24013-cc-cs-glenrothes-1988-578)
  is vintage 1988, not 1997.
- [Batch 23/136](https://www.gordonandmacphail.com/our-whiskies/23136-cc-cs-glenrothes-2007-618-usa)
  is vintage 2007, not 1997. The URL says USA while the market field says UK;
  neither is reliable evidence of an exclusive edition.

The Private Collection pages for [1969](https://www.gordonandmacphail.com/our-whiskies/pc-glenrothes-1969-483)
and [1974](https://www.gordonandmacphail.com/our-whiskies/pc-glenrothes-1974-495)
provide cask numbers, bottling years and outturns. Their front labels emphasize
vintage; do not calculate a stated age from the years alone.

For the 1974 cask 18440, [The Whisky Exchange](https://www.thewhiskyexchange.com/p/47006/glenrothes-1974-44-year-old-gm-private-collection)
calls it 44 years old, while [WhiskyNotes](https://www.whiskynotes.be/2018/glenrothes/glenrothes-1974-gordon-macphail/)
and other contemporary accounts call it 43. The producer's front label does
not state an age; leave that field unknown until a producer age statement is
found. The vintage, bottling year, cask and outturn agree across these sources.

For [1988 batch 19/002](https://www.gordonandmacphail.com/our-whiskies/19002-cc-cs-glenrothes-1988-585-worldwide),
several retailers mislabel the batch as a cask number. Keep those fields
separate. The label for [1988 batch 21/010](https://www.gordonandmacphail.com/our-whiskies/21010-cc-upper-cs-glenrothes-1988-579)
explicitly identifies refill American hogshead 16546; the Whisky Exchange's
description of it as a sherry hogshead conflicts with that primary evidence.

For historical Glenrothes, [The Whisky Vault](https://www.thewhiskyvault.com/glenrothes-49-c.asp),
[Scotch Whisky Auctions](https://www.scotchwhiskyauctions.com/auctions/198-the-153rd-auction/727998-glenrothes-1956-connoisseurs-choice-75cl/)
and [The Whisky Exchange](https://www.thewhiskyexchange.com/p/2637/glenrothes-1956-bot1980s-connoisseurs-choice)
document a 1956 Connoisseurs Choice at 40%. Approximate phrases such as
“30-odd years” and “1980s” do not establish an age statement or bottling year.
The Whisky Exchange explicitly guesses sherry maturation from colour, so that
description is not adequate cask evidence. Reports of a 46% brown-label 1956
and of a 1957 bottling need exact label and auction or producer corroboration.

## Centenary Reserve and older Glenrothes

The 1995 Centenary Reserve range includes Balblair 1973, Benrinnes 1978,
Caol Ila 1966, Glenburgie 1948, Glenrothes 1978, Highland Park 1970,
Mortlach 1984 and St. Magdalene 1980. The [Whisky Auctioneer range archive](https://whiskyauctioneer.com/learn/explore-whisky/series/gordon-macphail-centenary-reserve)
is useful but does not list every member. Individual sources include
[Benrinnes](https://www.thewhiskyexchange.com/p/9680/benrinnes-1978-bot1995-centenary-reserve-gordon-macphail),
[Balblair](https://www.masterofmalt.com/whiskies/balblair/balblair-1973-bottled-1995-centenary-reserve-gordon-macphail-whisky/),
[Caol Ila](https://whisky.auction/auctions/lot/27105/caol-ila-1966-centenary-reserve),
[Glenburgie](https://www.whiskyfun.com/Glenburgie.html),
[Glenrothes](https://www.thewhiskyexchange.com/p/9694/glenrothes-1978-bot1995-centenary-reserve-gordon-macphail),
[Highland Park](https://www.thewhiskyvault.com/highland-park-1970-gordon--macphail-1995-centenary-reserve-13750-p.asp),
[Mortlach](https://whiskyauctioneer.com/learn/explore-whisky/bottles/mortlach-1984-centenary-reserve)
and [St. Magdalene](https://whisky.auction/auctions/lot/103928/st-magdalene-1980-centenary-reserve).
These sources establish 40% strength and 1995 bottling. Calculated ages in
retailer titles do not establish printed age statements. Miniatures and
full-size bottles do not alone constitute separate releases.

The older cream-label Glenrothes-Glenlivet 8-year-old at 40% is documented by
[Whisky.Auction](https://whisky.auction/auctions/lot/61915) and
[The Whisky Exchange](https://www.thewhiskyexchange.com/p/6592).
A retailer's estimated bottling decade does not establish an exact year.

## Glenburgie producer archive

Check the exact label as well as each archive page. The URL for
[batch 21/199](https://www.gordonandmacphail.com/our-whiskies/21199-cc-cs-glenburgie-2009-564-1)
says 2009 and 56.4%, but its page, label and producer product sheet identify
1995, 26 years, 57.1%, cask 9914, bottled in 2021. The URL is wrong.

The labels for [batch 24/127](https://www.gordonandmacphail.com/our-whiskies/24127-cc-cs-glenburgie-2008-574)
and [batch 24/185](https://www.gordonandmacphail.com/our-whiskies/24185-cc-cs-glenburgie-2000-587)
show 2008 at 15 years and 2000 at 23 years respectively. Their printed
vintages and ages belong in the common names. Other individually identified
casks include [23/206](https://www.gordonandmacphail.com/our-whiskies/23206-cc-cs-glenburgie-1995-582),
[21/112](https://www.gordonandmacphail.com/our-whiskies/21112-cc-cs-glenburgie-2008-585),
[21/003](https://www.gordonandmacphail.com/our-whiskies/21003-cc-upper-cs-glenburgie-1988-538),
[19/011](https://www.gordonandmacphail.com/our-whiskies/19011-cc-cs-glenburgie-1989-532-row)
and [20/051](https://www.gordonandmacphail.com/our-whiskies/20051-cc-upper-cs-glenburgie-1990-520-1).
A batch prefix does not establish the bottling year: 21/003 was bottled in
December 2020, and [1986 cask 10307](https://www.gordonandmacphail.com/our-whiskies/cc-upper-glenburgie-1986-10307)
prints batch 24/016 with a bottling date in April 2025.

The labels for [19/010](https://www.gordonandmacphail.com/our-whiskies/19010-cc-cs-glenburgie-1989-499-row)
and [18/066](https://www.gordonandmacphail.com/our-whiskies/18066-cc-cs-glenburgie-1988-504)
provide batch numbers but no cask numbers. Do not put the batch code in the
cask field. The latter's 30-year age, 50.4% strength and 96-bottle outturn
are corroborated by [Passie voor Whisky](https://www.passievoorwhisky.nl/nl/whisky/schotse-whisky/single-malt-whisky/speyside/glenburgie-whisky-distillery/28174-glenburgie-30-years-1988-2018-cask-strength.html).

Further Glenburgie labels distinguish the 1994 casks
[21/183](https://www.gordonandmacphail.com/our-whiskies/21183-cc-cs-glenburgie-1994-549),
[21/207](https://www.gordonandmacphail.com/our-whiskies/21207-cc-cs-glenburgie-1994-545),
[20/021](https://www.gordonandmacphail.com/our-whiskies/20021-cc-cs-glenburgie-1994-555)
and [23/211](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-glenburgie-distillery-1994-23-211).
Their cask numbers, strengths, ages and bottling dates differ. The same care
is needed for [1998 batch 19/026](https://www.gordonandmacphail.com/our-whiskies/19026-cc-cs-glenburgie-1998-553),
[1998 batch 21/055](https://www.gordonandmacphail.com/our-whiskies/21055-cc-cs-glenburgie-1998-570),
[1997 batch 19/023](https://www.gordonandmacphail.com/our-whiskies/19023-cc-cs-glenburgie-1997-564-row)
and [1997 batch 18/095](https://www.gordonandmacphail.com/our-whiskies/18095-cc-cs-glenburgie-1997-599).
Do not treat an unprinted cask number as known because a batch code is present.

The 2021 labels identify [1995 cask 9916](https://www.gordonandmacphail.com/our-whiskies/21148-cc-cs-glenburgie-1995-536),
[1996 cask 5807](https://www.gordonandmacphail.com/our-whiskies/21047-cc-cs-glenburgie-1996-553)
and [1996 cask 5806](https://www.gordonandmacphail.com/our-whiskies/21208-cc-cs-glenburgie-1996-556).
The [1995 cask 6349](https://www.gordonandmacphail.com/our-whiskies/22090-cc-cs-glenburgie-1995-568)
and [1990 cask 12524](https://www.gordonandmacphail.com/our-whiskies/22006-cc-cs-glenburgie-1990-529)
labels state 26 and 31 years respectively. For
[1989 cask 14143](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-glenburgie-distillery-1989-23-015),
the page says first-fill sherry, but the exact label says refill sherry
hogshead. Prefer the label; do not overwrite refill with the page's value.

[2004 batch 18/104](https://www.gordonandmacphail.com/our-whiskies/18104-cc-glenburgie-2004-46)
is a 14-year-old at 46%, bottled in 2018 from four first-fill bourbon barrels,
with 1,164 bottles. It is distinct from
[2004 Distillery Labels](https://www.gordonandmacphail.com/our-whiskies/august-2019-dl-glenburgie-2004-43-wwusa),
bottled in 2019 at 43% from refill sherry butts.

The [non-vintage 21-year-old Distillery Labels](https://www.gordonandmacphail.com/our-whiskies/june-2018-dl-glenburgie-21yo-43-roweuropeuk)
has primary evidence, but its relationship to a review-derived record titled
1990 21-year-old remains unresolved. Do not invent a vintage or duplicate the
review record without resolving that identity. The 25-year-old Distillery
Labels and 1989 33-year-old records also require duplicate review across their
retailer sources before any merge.

## Benrinnes Connoisseurs Choice

The producer's exact labels identify [2001 batch 18/093](https://www.gordonandmacphail.com/our-whiskies/18093-cc-cs-benrinnes-2001-54)
as 17 years old, bottled in 2018 at 54%, with 246 bottles from a refill sherry
hogshead; [2004 batch 19/108](https://www.gordonandmacphail.com/our-whiskies/19108-cc-cs-benrinnes-2004-582-europe)
as 14 years old, bottled in 2019 at 58.2%, with 185 bottles from a refill bourbon
barrel; and [1994 batch 19/122](https://www.gordonandmacphail.com/our-whiskies/19122-cc-cs-benrinnes-1994-498-europe)
as the Symposion 25th Anniversary bottling, aged 25 years, bottled in 2019 at
49.8%, with 196 bottles from a first-fill sherry hogshead. These batch numbers
are not cask numbers.

[1990 batch 20/053](https://www.gordonandmacphail.com/our-whiskies/20053-cc-upper-cs-benrinnes-1990-551)
is 30 years old, bottled in 2020 at 55.1%, with 227 bottles from first-fill
sherry hogshead 18600301. Some retailer fields incorrectly call the batch
number its cask number.

[1994 batch 24/014](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-benrinnes-distillery-1994-24-014)
is 29 years old, 53.3%, with 556 bottles from first-fill sherry puncheon 7938.
The producer image appears to retain a 2020 date inconsistent with the age
and vintage. The producer page gives 2024; [Delia Whisky](https://deliawhisky.de/en-en/products/benrinnes-1994-2024-29)
corroborates bottling on 18 April 2024 and the same cask, batch, strength and
outturn. Use the corroborated 2024 year, not the artwork's conflicting date.

## Balblair Connoisseurs Choice

The producer labels distinguish these releases. Batch numbers are
separate from cask numbers; do not put a batch number in the cask field.

| Vintage and age                                                                                                           | Batch  | Bottled | ABV   | Cask        | Bottles |
| ------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ----- | ----------- | ------- |
| [1993, 24 years](https://www.gordonandmacphail.com/our-whiskies/april-2018-cccs-balblair-1993-516-row)                    | 18/006 | 2018    | 51.6% | Not printed | 624     |
| [1989, 30 years](https://www.gordonandmacphail.com/our-whiskies/19007-cc-cs-balblair-1989-536-usa)                        | 19/007 | 2019    | 53.6% | Not printed | 167     |
| [1993, 26 years](https://www.gordonandmacphail.com/our-whiskies/19078-cc-cs-balblair-1993-53-usa)                         | 19/078 | 2019    | 53%   | Not printed | 179     |
| [1990, 29 years](https://www.gordonandmacphail.com/our-whiskies/20017-cc-upper-cs-balblair-1990-584)                      | 20/017 | 2020    | 58.4% | 4166        | 469     |
| [1995, 25 years](https://www.gordonandmacphail.com/our-whiskies/20058-cc-cs-balblair-1995-560)                            | 20/058 | 2020    | 56%   | 1686        | 106     |
| [1989, 31 years](https://www.gordonandmacphail.com/our-whiskies/21011-cc-upper-cs-balblair-1989-542)                      | 21/011 | 2021    | 54.2% | 211         | 134     |
| [1990, 30 years](https://www.gordonandmacphail.com/our-whiskies/21066-cc-upper-cs-balblair-1990-565)                      | 21/066 | 2021    | 56.5% | 4175        | 131     |
| [1994, 27 years](https://www.gordonandmacphail.com/our-whiskies/21170-cc-cs-balblair-1994-488)                            | 21/170 | 2021    | 48.8% | 3963        | 49      |
| [1998, 23 years](https://www.gordonandmacphail.com/our-whiskies/21195-cc-cs-balblair-1998-505)                            | 21/195 | 2021    | 50.5% | 1075        | 170     |
| [1998, 23 years](https://www.gordonandmacphail.com/our-whiskies/21201-cc-cs-balblair-1998-506)                            | 21/201 | 2021    | 50.6% | 1078        | 187     |
| [1991, 31 years](https://www.gordonandmacphail.com/our-whiskies/23003-cc-u-balblair-1991-518)                             | 23/003 | 2023    | 51.8% | 3371        | 260     |
| [1997, 25 years](https://www.gordonandmacphail.com/our-whiskies/23188-cc-cs-balblair-1997-554)                            | 23/188 | 2023    | 55.4% | 1882        | 154     |
| [1994, 29 years](https://www.gordonandmacphail.com/our-whiskies/23214-cc-cs-balblair-1994-538)                            | 23/214 | 2023    | 53.8% | 3955        | 180     |
| [1993, 30 years](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-balblair-distillery-1993-24-021) | 24/021 | 2024    | 54.2% | 1963        | 481     |

The page headings for batches 23/003 and 23/214 incorrectly say 1997. Their
exact labels say 1991 and 1994 respectively. The two 1998 releases have
different casks, outturns, dates and strengths. The 1991 31-year-old also has
a retailer-derived record lacking a cask number that needs duplicate review
before any merge.

Kirsch's exact bottle photographs establish [1993 cask 1961](https://kirschwhisky.de/balblair-1993-2024-31-y.o.-g-m-cc-upper-1961-122062)
as a 31-year-old, batch 24/020, bottled 29 August 2024 at 49.5%, with 549 bottles.
Its label states cask strength, despite a conflicting supplier checkbox.
The supplier's [Gordon & MacPhail listing](https://kirschwhisky.de/marken/gordon-macphail/)
also provides the exact 1996 cask 413 photograph: 28 years, batch 24/070,
bottled 13 August 2024 at 50.4%, 127 bottles, refill bourbon barrel.
[Whisky-Online's product text](https://www.whisky-online.com/products/balblair-1996-2024-28-year-old-gordon-macphail-connoisseurs-choice-single-cask-413)
corroborates those facts, but its linked photograph is a Fettercairn bottle.
Do not use that mismatched image as evidence or a catalog image.

The historical 1964 Connoisseurs Choice releases include distinct
[15-year-old](https://www.just-whisky.co.uk/product/balblair-15-years-old-1964-gm-connoisseurs-choice-1347734),
[17-year-old](https://www.whisky-online.com/products/balblair-1964-17-year-old-connoisseurs-choice-1980s-gordon-and-macphail-highland-single-malt-scotch-whisky-html),
[18-year-old](https://www.thewhiskyexchange.com/p/39075/balblair-1964-18-year-old-connoisseurs-choice)
and [20-year-old](https://www.scotchwhiskyauctions.com/auctions/101-the-63rd-auction/105468-balblair-1964-20-year-old-cc-75cl/)
bottlings. The 15-year-old label states 70 British proof (40% ABV); the others
are listed at 40%. Do not turn approximate bottling dates into exact years or
calculate a year from the age and vintage. The 18-year-old is also corroborated
by Cannes auction's December 2012 catalog, lot 712.

A later [1964 map-label bottle](https://whisky.auction/auctions/lot/70042/balblair-1964)
has no age statement or bottling year on the pictured front label. Its
relationship to dated 1964 licensed bottlings still needs investigation.
[Whiskyfun's Balblair index](https://www.whiskyfun.com/Balblair.html) provides
further leads for licensed bottles and private casks, but each requires exact
identity and series checks. In particular, the 1964/1985 21-year-old at 57.8%
is associated with Intertrade and must not automatically be branded Gordon &
MacPhail just because it was drawn from their stock.

The dated licensed-label bottles include [1964 bottled in 1999](https://whisky.auction/auctions/lot/47240/balblair-1964)
and [1966 bottled in 2006](https://www.maltwhiskymarket.de/p/balblair-1966-40-jahre-bot-2006-gm-gordon-macphail).
Their neck labels establish the bottling years; neither pictured label states
an age. Retailer-calculated ages do not establish an age statement. Their
precise historical series remains uncertain.

The [1973 Private Collection](https://www.scotchwhiskyauctions.com/auctions/197-the-152nd-auction/724931-balblair-1973-private-collection-gordon--macphail/)
label explicitly states 32 years, March 2006, 45%, casks 3184 and 3185, and
385 bottles. It is a two-cask release. Published ages calculated from calendar
years conflict with the printed age.

[The Whisky Exchange's 1986 Whisky Show: Old & Rare release](https://www.thewhiskyexchange.com/p/37139/balblair-1986-gordon-macphail-for-whisky-show-old-rare)
provides January 2017, cask 12649, 49.5%, 48 bottles and refill sherry hogshead.
[Continental's exact bottle photograph](https://www.continentalws.com/products/g-m-balblair-1986-cask-strength-31-yr-old-49-5)
confirms the vintage-only title and Cask Strength packaging, including natural
colour and no chill filtration. Its URL's 31-year description conflicts with
the 30 years in retailer text; no age was taken from that URL.

The [2017 Balblair 1993 cask 1964 review](https://peatedperfection.blogspot.com/2018/04/gordon-macphail-balblair-1993-whisky.html)
records 49.6%, first-fill Oloroso sherry puncheon, natural colour and no chill
filtration. [Whiskyfun's independent review and bottle image](https://www.whiskyfun.com/2018/A-few-Balblair.html)
corroborate vintage, bottling year, cask, strength and the older Cask Strength
series. Neither supports a printed age statement or an exact outturn.

The [1993 cask 1962 auction photographs](https://www.scotchwhiskyauctions.com/auctions/141-the-100th-auction/323650-balblair-1993-cask-strength-gordon--macphail/)
show the separate 53.4% Cask Strength release, first-fill sherry puncheon,
natural colour and no chill filtration. [The Whiskyphiles](https://thewhiskyphiles.com/2017/02/07/balblair-21-years-old-1993-cask-strength/)
records bottling on 10 November 2014. Its calculated 21 years does not appear
as an age statement on the pictured bottle.

[Delia Whisky's 1997 Kirsch release](https://deliawhisky.de/en/products/balblair-1997-2023)
includes readable front and rear photographs: 26 years, batch 23/190, cask
1884, 54.1%, 153 bottles, refill bourbon barrel, bottled 20 November 2023.
The label explicitly names Kirsch Import's German selection and states
natural colour, no chill filtration and cask strength. This is distinct from
the 25-year-old 1997 cask 1882.

The producer's [Balblair page](https://www.gordonandmacphail.com/our-whiskies/distilleries/balblair)
explicitly places Balblair in The MacPhail's Collection. Fine Drams has exact
photographs and product facts for the [21-year-old](https://www.finedrams.com/balblair-21-year-old-the-macphails-collection-gordon-macphail.html)
and [10-year-old](https://www.finedrams.com/balblair-10-year-old-the-macphails-collection-gordon-macphail.html),
both at 43%. These are Gordon & MacPhail-branded bottles. The 21-year-old
label has no vintage, despite calculated vintage descriptions elsewhere.
Fine Drams states natural colour and chill filtration for both.

The relationship between the 10-year-old MacPhail's Collection and older
43% licensed-label releases needs more evidence; matching age and strength
alone do not settle whether this was only a packaging change. Existing
Distillery Labels import references should not be reassigned without
resolving that question. The MacPhail's Collection must also be distinguished
from the separate MacPhail's unnamed-distillery malt brand; catalog entries
for named distilleries under that brand need individual review.

## Arran

Gordon & MacPhail's producer pages and exact label artwork establish these
Connoisseurs Choice releases:

| Producer source                                                                                | Printed age | Batch  | Bottled | Strength | Outturn | Cask information                          |
| ---------------------------------------------------------------------------------------------- | ----------- | ------ | ------- | -------- | ------- | ----------------------------------------- |
| [Arran 1996](https://www.gordonandmacphail.com/our-whiskies/april-2018-cccs-arran-1996-492-uk) | 22          | 18/023 | 2018    | 49.2%    | 283     | Refill sherry hogshead; no number printed |
| [Arran 1999](https://www.gordonandmacphail.com/our-whiskies/19047-cc-cs-arran-1999-46-europe)  | 19          | 19/047 | 2019    | 46%      | 449     | Two refill bourbon barrels                |
| [Arran 2009](https://www.gordonandmacphail.com/our-whiskies/cc-arran-2009-76)                  | 15          | 25/004 | 2025    | 58.1%    | 201     | Refill bourbon barrel 76                  |

All three labels state natural colour and no chill filtration. The 1999
URL contains `cs`, but the label instead identifies a two-cask vatting at
46%; URL fragments alone do not establish cask strength.

[Abbey Whisky's 2006 release](https://www.abbeywhisky.com/products/arran-2006-connoisseurs-choice-bottled-2015)
establishes Connoisseurs Choice, 2015 bottling, 46% and first-fill bourbon
barrels, without a printed age. [Arran's own distillery history](https://www.arranwhisky.com/news/347-how-lochranza-distillery-changed-the-narrative-of-the-whisky-industry)
identifies Lochranza as the distillery that began producing Arran in 1995.
Preserve the printed Arran bottle name while using the distillery identity.
The producer's currently indexed pages do not cover all older Arran vintages
or private selections.

[The Whisky Vault's 1998 US import](https://www.thewhiskyvault.com/arran-1998-8-year-old-gordon--macphail-connoisseurs-choice-2007-bottling---us-import-25735-p.asp)
has an explicit eight-year age statement, 2007 neck label and 46% ABV.
The [2007 43% version](https://whiskyauctioneer.com/learn/explore-whisky/bottles/arran-1998-connoisseurs-choice-0)
has no age printed on its photographed front label. Do not transfer the
US bottle's age statement or strength to it.

[McTear's January 2026 lot, reproduced by Lot-Art](https://www.lot-art.com/auction-lots/ARRAN-1998-GORDON-and-MACPHAIL-CONNOISSEURS-CHOICE-ISLAND-SINGLE-MALT/206-arran_1998_gordon-14.1.26-mctear)
records a later 1998 vintage bottled in August 2008 at 43%, with refill
sherry hogsheads. Its photograph confirms the vintage-only name and strength;
Whiskybase independently records those dates. Its listed nine years is not
printed on the front label.

[The Whisky Barrel's Arran 2000](https://www.thewhiskybarrel.com/products/arran-2000-connoisseurs-choice)
records 2013 bottling, 46% and refill bourbon barrels, corroborated by
[Whisky Hammer's archived lot](https://www.whiskyhammer.com/item/159192/Arran/Arran---2000-Gordon-and-MacPhail-Connoisseurs-Choice.html).
Whisky Hammer returns HTTP 403 to direct requests; indexed lot text remains
available. Whisky Auctioneer sometimes returns HTTP 406 to direct requests;
use accessible indexed pages or another auction's exact bottle evidence.

[Nemoto's own release announcement](https://nemoto-shouten.com/products/arran-2009-gm-c-choice-cask-str-for-ichiyamanemoto-2009)
and exact photographs document its Japanese Arran 2009 exclusive: 15 years,
cask 77, batch 24/083, 58.7%, 211 bottles, refill bourbon barrel, bottled
10 June 2024. The label states natural colour, no chill filtration and cask
strength. It is distinct from the following year's cask 76.

Further Arran leads include the 1999 vintage at 43% bottled in 2010 and 2011.
Whiskybase and Spirit Radar distinguish the dates; [Quebec Whisky](https://quebecwhisky.com/connoisseur-choice-gordon-macphail-arran-1999-sherry-cask/)
confirms a 43% sherry release without establishing which bottling date.
Exact dated labels or independent retailer records remain needed before
splitting these leads into records.

## Blair Athol

The producer archive documents [1997 batch 18/010](https://www.gordonandmacphail.com/our-whiskies/april-2018-cccs-blair-athol-1997-545-europeuk),
[1997 batch 18/073](https://www.gordonandmacphail.com/our-whiskies/18073-cc-cs-blair-athol-1997-568),
[1995 batch 20/097](https://www.gordonandmacphail.com/our-whiskies/20097-cc-cs-blair-athol-1995-509)
and [2008 batch 24/104](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-blair-athol-distillery-2008-24-104).
Inspect the exact labels for age, bottling date and batch. The 2008 page's
sherry-butt description conflicts with its label's first-fill sherry hogshead;
[Whisky Online](https://www.whisky-online.com/products/blair-athol-2008-2024-16-year-old-gordon-macphail-connoisseurs-choice-single-cask-18601602)
corroborates the label. [The Whiskyphiles' contemporary review](https://thewhiskyphiles.com/2018/06/05/blair-athol-20-years-old-1997-connoisseurs-choice/)
identifies the 20-year-old 1997 release as cask 5720.

[Fine Drams](https://www.finedrams.com/blair-athol-2006-bottled-2015-connoisseurs-choice-gordon-macphail.html)
provides the exact 2006/2015 label and producer text identifying a first-fill
sherry butt and refill sherry hogshead. The Whisky Barrel's simpler description
omits the first-fill butt. Its [2005 listing](https://www.thewhiskybarrel.com/products/blair-athol-2005-connoisseurs-choice)
and [2008 listing](https://www.thewhiskybarrel.com/products/blair-athol-2008-connoisseurs-choice)
have dated labels for 2014 and 2017 respectively. None prints an age statement.
[McTear's lot mirrored on Lot-Art](https://www.lot-art.com/auction-lots/BLAIR-ATHOL-1993-GORDON-and-MACPHAIL-CONNOISSEURS-CHOICE-HIGHLAND-SINGLE-MALT/190-blair_athol_1993-14.1.26-mctear)
has a legible 2006 neck label on the 1993 vintage at 43%.

[Still Spirit's 14-year-old 2008](https://www.stillspirit.com/en-us/products/blair-athol-2008-g-m-cc)
has the full label for UK Exclusive batch 23/095, cask 18601603, bottled
22 February 2023. [The Whisky Exchange](https://www.thewhiskyexchange.com/p/73161/blair-athol-2008-14-year-old-connoisseurs-choice)
corroborates the identity. Master of Malt's title has the correct cask but its
structured cask field says 1000000; do not use that field.

The Whisky Barrel also has dated labels for [2007/2016](https://www.thewhiskybarrel.com/products/blair-athol-2007-connoisseurs-choice)
and [1997/2013](https://www.thewhiskybarrel.com/products/blair-athol-1997-connoisseurs-choice).
For 2007, it describes first-fill and refill sherry hogsheads, while collector
records say refill only; sherry hogsheads is the supported common detail.
[Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/blair-athol-1995-connoisseurs-choice)
and [Whisky.com](https://www.whisky.com/whisky-database/details/blair-athol-6.html)
corroborate the 1995/2009 release at 43%.
[Quebec Whisky's 1997 review](https://quebecwhisky.com/connoisseur-choice-gordon-macphail-blair-athol-1997/)
and [Chris Goodrum's contemporary tasting record](https://chriswhiskyman.wordpress.com/category/scotch-whisky-a-g/blair-athol/)
both date the 43% release to July 2010. The latter identifies refill sherry
hogshead maturation; its parenthesized age is not a printed age statement.

Blair Athol questions remaining after producer, specialist retailer, auction,
and contemporary review searches:

- 1993/2007 at 43% is listed by Whiskybase and Malt Maniacs, but an exact dated
  label or independent commercial record remains needed.
- 1993/2008 at 43% and 1995/2010 at 43% appear in collector inventories; printed
  ages and exact dates remain unverified. A McTear's search snippet apparently
  supporting 1993/2008 actually describes Glendullan elsewhere on the page.
- 1997/2012 at 46% appears in Whiskybase and Spirit Radar; the retailer's
  surviving photograph documents 2013 instead.
- [Quebec Whisky's claimed Reserve cask 4837](https://quebecwhisky.com/connoisseur-choice-gordon-macphail-blair-athol-15-ans/)
  describes 1995/2010 at 46%, but illustrates a Connoisseurs Choice bottle.
  The Series, stated age and exact cask identity need a matching source.
- The American 9-year-old at 46% and a collector-listed 2005/2026 21-year-old
  need dated producer or retailer evidence and comparison with vintage releases.

## Aultmore

The producer archive contains exact labels for these Connoisseurs Choice batches:

- [19/050](https://www.gordonandmacphail.com/our-whiskies/19050-cc-cs-aultmore-2005-552-uk)
- [21/191](https://www.gordonandmacphail.com/our-whiskies/21191-cc-cs-aultmore-2005-538)
- [19/094](https://www.gordonandmacphail.com/our-whiskies/19094-cc-cs-aultmore-2005-57-row)
- [21/025](https://www.gordonandmacphail.com/our-whiskies/21025-cc-cs-aultmore-2005-543)
- [21/198](https://www.gordonandmacphail.com/our-whiskies/21198-cc-cs-aultmore-2005-592)
- [18/072](https://www.gordonandmacphail.com/our-whiskies/18072-cc-cs-aultmore-2000-570)
- [19/036](https://www.gordonandmacphail.com/our-whiskies/19036-cc-cs-aultmore-2005-555)

These cover the 2000 and 2005 vintages bottled in 2018–2021. Labels establish
printed ages, strengths, outturns and bottling dates. Some early labels lack a
cask number; do not infer one from neighboring releases.

[Home of Malts' cask 4679](https://www.homeofmalts.com/en/24541/aultmore-15-year-old-1st-fill-bourbon-barrel-4679-gordon-macphail-connoisseurs-ch.)
provides photographs of the 2009 15-year-old, batch 24/079, bottled 5 March 2025.
The batch prefix is not its bottling year. Kirsch Whisky's indexed distributor
page corroborates the core facts but its live product URL returned HTTP 404.

Historical Aultmore Connoisseurs Choice labels survive at
[Whisky.Auction for 1989/2001](https://whisky.auction/auctions/lot/199568/aultmore-1989),
[Passion for Whisky for 1995/2007](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/speyside/aultmore-whisky-distillery/39597-aultmore-1995-2007.html),
[Fine Drams for 2000/2012](https://www.finedrams.com/aultmore-2000-bottled-2012-connoisseurs-choice-gordon-macphail.html),
[The Whisky Barrel for 2000/2014](https://www.thewhiskybarrel.com/products/aultmore-2000-connoisseurs-choice),
and [Fine Drams for 2005/2016](https://www.finedrams.com/aultmore-2005-bottled-2016-connoisseurs-choice-gordon-macphail.html).
The photographed titles contain vintages but no age statements. The 1995 back
label identifies refill bourbon barrels and September 2007 bottling. Fine Drams'
2005 page has incorrect Auchroisk/1995 structured fields; its title and exact
photograph show Aultmore 2005. The Whisky Exchange's corresponding 2005/2016
listing corroborates the release.

[Master of Malt's Discovery 10-year-old](https://www.masterofmalt.com/whiskies/aultmore/aultmore-10-year-old-discovery-gordon-macphail-whisky/)
and [Whisky-Online](https://www.whisky-online.com/collections/aultmore-distillery/products/aultmore-10-year-old-discovery-range)
provide the exact bourbon-cask label, age and strength.
[Fine Vintage's Hong Kong Whisky Festival listing](https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2023/04/HKWF_Dram_List-1.pdf)
identifies the 2021 bottling. Whisky.com and Whiskybase disagree on chill
filtration; that detail remains unknown. Retailer photographs have no verified
reuse permission and were used only for identification.

[Master of Malt's 1997/2011 listing](https://www.masterofmalt.com/whiskies/aultmore/aultmore-1997-connoisseurs-choice-gordon-and-macphail-whisky/)
has a dated bottle photograph at 43%; its structured 12-year age conflicts with
the label and is not used. [Whisky Auctioneer's 2000/2013 record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/aultmore-2000-connoisseurs-choice)
and [a contemporary tasting account](https://en.paperblog.com/an-audacious-aultmore-tasting-with-the-malt-nuts-1146861/)
establish the separate 2013 bottling at 46%.

[Liquor Kingdom's batch 18/032](https://www.liquorkingdom.com.sg/AULTMORE/AULTMORE-18-YEAR-OLD-2000-REFILL-AMERICAN-HOGSHEAD-BATCH-18-032-GORDON-MACPHAIL-CASK-STRENGTH-CONNOISSEUR-CHOICE)
has the exact 18-year-old label; [WhiskyAuction.com](https://www.whiskyauction.com/de/item/3555364)
corroborates its May 2018 bottling, strength and outturn. The retailer calls the
batch a cask number; the label distinguishes the two.
[Tyndrum's UK-exclusive cask 15601009](https://www.tyndrumwhisky.com/aultmore-2005-15yo-connoisseurs-choice-54-6.html)
provides its label and July 2021 batch details. Master of Malt's matching title
is correct, but its structured cask field incorrectly says 1000000.
[Kirsch's May 2023 announcement](https://whiskyexperts.net/neu-bei-kirsch-import-limitierter-whisky-luxus-von-gordon-macphail/)
provides original text and an exact label for the 2005/2022 17-year-old cask 306933. It also covers Private Collection releases from Glenlossie, Highland
Park, Teaninich and Longmorn. Whisky.de's indexed listing corroborates the
Aultmore; direct requests returned HTTP 403.

[Tyndrum's Saint-Joseph finish](https://www.tyndrumwhisky.com/aultmore-2009-st-joseph-casks.html)
has a clear label showing vintage 2009, age 13 and July 2023 batch 23/065. Its
prose incorrectly says distilled 2010. The label establishes three years of
wine finishing, natural colour and no chill filtration.
[The Whisky Exchange](https://www.thewhiskyexchange.com/p/72661/aultmore-2009-st-joseph-wine-finish-connoisseurs-choice)
and [Aleeks Alkohole](https://aleeksalkohole.pl/pl/p/Whisky-GM-Aultmore-2009-13yo-Guigal-Saint-Joseph-Connoisseurs-Choice-0%2C7L-45/6743)
corroborate the release. Aleeks and Darwina expose indexed facts but returned
HTTP 403 to direct requests.

[Passion for Whisky's 1989/2003](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/speyside/aultmore-whisky-distillery/36245-aultmore-1989-2003-old-map-label.html)
has an exact neck-dated label at 43%, with no age printed. It is separate from
the 2001 bottling at 40%.

[Click Whisky Auctions' cask 306928](https://www.clickwhiskyauctions.com/lot-370108/aultmore-2005-single-cask-306928-gordon-macphail-exclusive-bottled-2016)
shows the historical Exclusive label and verifies vintage 2005, bottling 2016,
and 50% strength. [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/aultmore-2005-exclusive)
identifies the Elgin shop selection and corroborates the cask and outturn.
[Its Exclusive range inventory](https://whiskyauctioneer.com/learn/explore-whisky/brands/exclusive)
covers other distilleries and selections, including Aultmore 2000 for The Kuva.
This older printed range should not be confused with exclusive editions within
the modern Connoisseurs Choice range. Click Whisky Auctions photographs are
copyrighted; no reuse permission was established.

Remaining Aultmore questions after vintage, cask-number, strength, retailer,
auction and contemporary review searches:

- The 1989/2006 Connoisseurs Choice at 43% appears in Malt Maniacs and Spirit
  Radar; an exact dated independent label is still needed.
- Reserve 1989 cask 712 at 56.4% is independently documented by Whisky
  Auctioneer. Spiritory and contemporary Malt Maniacs records support the
  2003 bottling year; its claimed 14-year age still needs a printed statement.
- Connoisseurs Choice 2005 cask 306932, 15-year-old at 58.3%, is a China-market
  collector lead without an independent commercial or producer record yet.
- Exclusive 2005 cask 306930 at 59.3% and Reserve 2005 cask 15601007 at 54.1%
  for Whiskywarehouse remain collector leads needing independent evidence.
- An American 1995/2006 11-year-old at 43% appears in a mixed auction lot;
  its printed age and relation to other 1995 releases need label comparison.

[Whisky Auctioneer's Kuva record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/aultmore-2000-exclusive)
establishes the Taiwan selection's 2000 vintage, 2016 bottling and first-fill
American oak hogshead. Outturn and age remain unknown.
[Its Reserve 1989 record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/aultmore-1989-reserve)
establishes cask 712 and its outturn; [Spiritory](https://spiritory.com/aultmore-14-years-old-1989-reserve-gordon-macphail-712)
and [Malt Maniacs](https://whisky-monitor.com/index.jsp?did=9&distilleryName=Aultmore+single+malt+scotch+distillery)
corroborate 2003 bottling. Malt Maniacs marks the age as calculated, so the
marketplace's 14-year description does not establish a printed age.

## Bladnoch

The producer archive provides exact Connoisseurs Choice labels for:

- [21/062](https://www.gordonandmacphail.com/our-whiskies/21062-cc-upper-cs-bladnoch-1988-558)
- [19/140](https://www.gordonandmacphail.com/our-whiskies/19140-cc-cs-bladnoch-1990-487-uk)
- [19/080](https://www.gordonandmacphail.com/our-whiskies/19080-cc-cs-bladnoch-1991-423-germany)
- [19/014](https://www.gordonandmacphail.com/our-whiskies/19014-cc-cs-bladnoch-1990-523-uk)
- [21/069](https://www.gordonandmacphail.com/our-whiskies/21069-cc-upper-cs-bladnoch-1990-430)
- [19/006](https://www.gordonandmacphail.com/our-whiskies/19006-cc-cs-bladnoch-1988-558-worldwide)

These cover 1988–1991 vintages bottled in 2019 and 2021. The labels establish
ages, strengths, outturns and dates. Batch 19/080 explicitly says Germany
Exclusive. Some labels give no cask number; it cannot be inferred from a batch.
Two different 1988 releases share 55.8% strength but differ in age, date,
maturation and outturn.

[Kensington Wine Market's own selection](https://www.kensingtonwinemarket.com/product/885691/g-m-cc-bladnoch-1988-kwm-cask-2107)
has a clear exact label for the 1988 33-year-old, batch 22/014. The selecting
retailer's account and label agree on the cask, bottling date, outturn and
refill sherry maturation. Its image is useful evidence; no reuse licence was
established.

Historical Connoisseurs Choice evidence includes:

- [Whisky Auctioneer's 1967 15-year-old](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1967-connoisseurs-choice-15-year-old-0)
  and [Whiskyfun's October 2010 review](https://www.whiskyfun.com/archiveoctober10-2.html).
  The age is documented, but the often-listed 1982 bottling year is calculated.
- [Whisky Auctioneer's 1975 16-year-old](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1975-connoisseurs-choice-16-year-old)
  identifies the 1991 American import. [Waddingtons](https://www.waddingtons.ca/auction/the-tom-willcock-collection-of-fine-rare-scotch-whisky-part-iv-may-14-2019/gallery/lot/7/)
  corroborates those details. The exact American label explicitly prints
  16 years; its incorrect Highland and Balblair wording explains the
  auction metadata but does not change the Bladnoch identity.
- [Whisky.Auction's 1987/1999](https://whisky.auction/auctions/lot/196182/bladnoch-1987-connoisseurs-choice)
  and [Whisky Hammer](https://www.whiskyhammer.com/item/141221/Bladnoch/Bladnoch---1987-Connoisseurs-Choice-Gordon--MacPhail.html)
  agree on the bottling year and strength. Retailer descriptions of a 12-year
  age are not sufficient to establish a printed age.
- [Whisky Auctioneer's 1988/2000](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1988-connoisseurs-choice-1)
  and [1988/2001](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1988-connoisseurs-choice-0)
  distinguish the 40% annual bottlings. [Lacy Scott & Knight](https://www.lskauctioncentre.co.uk/auction/lot/lot-652---connoisseurs-choice-royal-brackla-single-malt/?au=547&ef=&et=&g=1&ic=False&lot=322558&pn=3&pp=96&sd=1&so=0&st=&sto=0)
  independently documents the 2001 bottle.
- [Whisky.Auction's 1989/2004](https://whisky.auction/auctions/lot/136337/bladnoch-1989-connoisseurs-choice)
  agrees with [Whiskyfun's Bladnoch review index](https://www.whiskyfun.com/Bladnoch.html).
- [Whisky Auctioneer's 1984/1995](https://whiskyauctioneer.com/whisky-lot/8192541/bladnoch-1984-connoisseurs-choice)
  supplies the exact year and strength; Malt Maniacs marks its age as calculated.
- [Whisky Hammer's 1986/1998](https://www.whiskyhammer.com/item/8626/Bladnoch/Bladnoch---1986-Gordon--MacPhail-Connoisseurs-Choice.html)
  establishes a later bottling of that vintage.

For the older CASK range, [Grand Whisky Auction's 1985/1996](https://www.thegrandwhiskyauction.com/lot-550615/bladnoch-1985-gordon-macphail)
agrees with [Whiskyfun's September 2012 review](https://www.whiskyfun.com/archiveseptember12-1.html)
on the four casks and 56.8% strength. A Cannes catalogue transcribes the same
cask set as bottled in 1995; the independent exact auction and tasting records
support 1996. Grand's image server returned HTTP 403.

[Whisky Auctioneer's 1988 CASK](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1988-cask-strength)
and [Chris Goodrum's contemporary notes](https://chriswhiskyman.wordpress.com/2011/08/25/macphails-bladnoch-tasting-notes/)
agree on bottling in 2000 at 58.8%. They name casks 3151 and 3158, while
[Whiskyfun](https://www.whiskyfun.com/archiveapril08-2.html) writes 3151–3158.
The cask-number field and claimed age remain unresolved without the label;
the sources agree that this is a multiple-cask bottling. A separate undetailed
1988/2002 review at the same strength has not established a different release.
Whisky.Auction's direct page requests returned HTTP 403 in this pass, although
indexed descriptions remained accessible.

[The Whisky Barrel's 1984/1994](https://www.thewhiskybarrel.com/products/bladnoch-1984-connoisseurs-choice-1994)
shows the dated neck label and no printed age.
[Whisky.Auction's 1986/1996](https://whisky.auction/auctions/lot/74306/bladnoch-1986)
and [The Whisky Exchange](https://www.thewhiskyexchange.com/p/80094/bladnoch-1986-bot1996-connoisseurs-choice)
agree on that earlier bottling. An age-bearing American export is a separate
lead requiring comparison; a calculated age should not be copied to this label.

[Whisky Auctioneer's 1987 cask 4200](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1987-cask-strength)
establishes the 1999 single-cask CASK release. Its age is described differently
by tasting databases and remains unknown without a printed statement.
[Its 1991 Reserve record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1991-reserve)
establishes the 2003 release from cask 3143; [Malt Maniacs](https://www.whisky-monitor.com/index.jsp?did=19)
independently records its strength and outturn, marking age as calculated.

[Scotch Whisky Auctions' 1987 CASK](https://www.scotchwhiskyauctions.com/auctions/219-the-170th-auction/829621-bladnoch-1987-gordon--macphail-cask-strength/)
provides the exact label and July 1998 bottling details. [Whisky.Auction](https://whisky.auction/auctions/lot/15630/bladnoch-1987-gordon-macphail)
corroborates casks 4193 and 4194 and strength; the Italian importer does not
establish separate liquid. The auction's accompanying Connoisseurs Choice box
does not override the bottle's printed CASK label.

[Whisky Magazine's 1991 review](https://whiskymag.com/tastings/18-gordonmacphail/)
has a photograph of the historical green CASK label at 54.8%, explicitly
marked non-chill filtered. [Cheffins' catalogue](https://www.the-saleroom.com/en-gb/auction-catalogues/cheffinsfineart/catalogue-id-srche10309/pdfexport)
identifies the March 2004 bottling and casks 3150 and 3151. The review explicitly
identifies it as having no age statement.

[Whisky-Maniac's Reserve 1989](https://www.whisky-maniac.de/p/bladnoch-1989-2016-refill-bourbon-barrel-cask-1297-gordon-und-macphail-gm-reserve-label)
provides an exact Kirsch Whisky Import label and details of the 2016 bottling
from refill bourbon barrel 1297. The retailer explicitly states natural colour,
no chill filtration, single cask and cask strength. Its prose gives 27 years,
but a printed age was not established. No image reuse permission was found.

[Malt Fascination's contemporary 1993/2009 review](https://maltfascination.com/2010/08/31/bladnoch-1993-2009/)
identifies the Van Wees Reserve selection. [Whisky Auctioneer's exact lot](https://whiskyauctioneer.com/whisky-lot/8200559/bladnoch-1993-reserve)
corroborates cask 778, outturn and year, but contradicts itself with both bourbon
and refill sherry hogshead descriptions. Maturation remains unknown; a printed
age was not established by the surviving exact lot.

[Cannes' March 2013 catalogue, lot 73](https://www.cannesauction.com/pdf/get/catalogs/85/vin130317.pdf)
independently identifies the 1986/1997 Spirit of Scotland release at 40%, sold
alongside a different 1988 Connoisseurs Choice bottle. The two rows must not
be conflated. Collector listings corroborate the Spirit of Scotland identity.

[Passion for Whisky's 1987/2000](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/lowlands/bladnoch-whisky-distillery/36476-bladnoch-1987-2000-old-map-label.html)
and [Whisky Auctioneer](https://whiskyauctioneer.com/whisky-lot/7039731/bladnoch-1987-connoisseurs-choice)
establish the later 40% bottling. Passion for Whisky returned HTTP 403 to the
direct page request in this pass; its indexed product details remained readable.
[Steinfels' catalogue, lots 1083–1084](https://www.steinfelsweine.ch/wp-content/uploads/2022/02/403-Katalog_pdf.pdf)
and [Whisky Auctioneer's 1988 record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1988-connoisseurs-choice)
establish the 2002 Connoisseurs Choice release at 40%. This is not the
unresolved CASK review carrying a 2002 date at 58.8%.

For the 1991 vintage, [Whisky Auctioneer's 2004 bottle](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1991-connoisseurs-choice)
and [Viskikonttori's first-hand review](https://viskikonttori.com/2015/01/27/bladnoch-19912004-gordon-macphail-40/)
establish a 40% Connoisseurs Choice release. This must not be confused with
the age-stated 13-year-old at 46% reviewed by Whisky Advocate.
[Whisky.Auction's 2005 bottle](https://whisky.auction/auctions/lot/199564/bladnoch-1991)
is another 40% release. Its March date differs from the December date in
Malt Maniacs' contemporary refill-American-cask entry and a private sale
listing. The year is established, but a bottling month and any split into
separate within-year releases require exact back-label comparison.
[The Whisky Exchange's 2007 bottle](https://www.thewhiskyexchange.com/p/87065/bladnoch-1991-bot2007-connoisseurs-choice)
and [Master of Malt's half bottle](https://www.masterofmalt.com/whiskies/bladnoch-1991-35cl-whisky/)
agree on that later 40% release; bottle size alone does not justify a separate
record. The Exchange specifies refill bourbon maturation.

[Mark Littler's 1984/1993](https://shop.marklittler.com/products/bladnoch-1984-9-year-old-bottled-in-1993)
has a clear exact label. Despite the retailer's nine-year title, no age is
printed. The neck-dated year agrees with [The Whisky Exchange](https://www.thewhiskyexchange.com/p/65855/bladnoch-1984-bot1993-connoisseurs-choice).
[Whisky Auctioneer's 1985 CASK](https://whiskyauctioneer.com/learn/explore-whisky/bottles/bladnoch-1985-cask-strength)
identifies the 1995 release from casks 4081–4083 at 58%. Its exact label shows
no age, despite a nine-year field in the auction record and a ten-year miniature
retailer listing. Those calculated descriptions do not justify separate age
variants. The public Whisky Auctioneer image host was accessible even when
web-page requests failed; no photograph reuse permission was established.

[The Whisky Shop's Bladnoch auction inventory](https://www.whiskyshop.com/auctions/ended?manufacturer=Bladnoch&region%5B0%5D=Japan&region%5B2%5D=Speyside&region%5B3%5D=Lowland&region%5B4%5D=Islay&vintage%5B0%5D=1975&vintage%5B1%5D=1984&vintage%5B3%5D=1986)
identifies its February 2023 lot A64640 as the 1975 13-year-old Connoisseurs
Choice at 40%. Bonhams' March 2016 whisky-sale catalogue independently lists
the same age/vintage combination. The exact bottling year remains unknown.
This is distinct from the 16-year-old American release and the 55% Intertrade
selection.

Remaining Bladnoch questions after searches by vintage, strength, cask, range,
importer, retailer, auction and contemporary review:

- The existing vaguely named 1993 Connoisseurs Choice record has no strength,
  bottling year or source reference that identifies an annual release. Its
  Brand and exact identity require review before assigning it to one of the
  documented 2009, 2014, 2015 or 2016 bottlings.
- The 1975 13-year-old Intertrade at 55% has conflicting outturns of 216 and
  218 in first-hand tasting sources; its branding needs an exact label.
- American age-bearing 1984 and 1986 exports need comparison with the
  European labels before deciding whether they are separate releases.
- The 1986/1997 Connoisseurs Choice lead in a contemporary Dutch tasting list
  needs an exact dated label; it must not be confused with Spirit of Scotland.
- Within-year 1991/2005 bottlings and the undetailed 1988/2002 CASK review need
  the label comparisons described above. No duplicate was assumed.
- Unprinted ages, unspecified cask numbers and disputed maturation remain
  unknown on otherwise identified releases.

## Ardmore sources and conflicts

The [producer's Ardmore archive](https://www.gordonandmacphail.com/our-whiskies/distilleries/ardmore)
covers recent Connoisseurs Choice, Distillery Labels and Private Collection,
but does not establish the historical set. Its [1997 UK batch 19/021](https://www.gordonandmacphail.com/our-whiskies/19021-cc-cs-ardmore-1997-583-uk)
has an exact label establishing the 21-year age and February 2019 bottling.
Subsequent direct producer-page and image requests returned 403; indexed
producer pages remained readable. Do not retry blocked resources.

For the modern Connoisseurs Choice releases, useful exact sources are:

- [Passion for Whisky's 1995 cask 7883](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/speyside/ardmore-whisky-distillery/33929-ardmore-26-years-1995-2021-7883-cask-strength.html)
  and [producer batch 21/132](https://www.gordonandmacphail.com/our-whiskies/21132-cc-cs-ardmore-1995-527)
  agree on the release. The retailer's Speyside category is wrong; the
  producer identifies Ardmore as Highland.
- The [producer's 1994 batch 21/031 sheet](https://www.gordonandmacphail.com/product-pdf-document/?product=13266)
  explicitly supplies the age, cask, outturn and January 2021 bottling date.
- [Fine Spirits Auction's 1997 batch 19/073](https://www.finespirits.auction/fr/prix-spi/183277------Bouteille-Highlands-Ardmore-21-years-1997-Gordon-MacPhail-Batch-n19-073-One-of-248-bottled-2019-Ambre.jsp)
  identifies cask 900670 and the age; the [producer](https://www.gordonandmacphail.com/our-whiskies/19073-cc-cs-ardmore-1997-543-europe)
  supplies the strength and maturation. The auction's general distillery
  history misclassifies the region; its exact bottle facts are separable.
- [Passion for Whisky's 1987 30-year-old](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/Speyside/ardmore-whisky-distillery/31073-ardmore-30-years-1987-2018-cask-strength.html)
  and [Whisky Auctioneer](https://whiskyauctioneer.com/lot/5024161/ardmore-1987-gordon-and-macphail-30-year-old-batch-18065)
  establish batch 18/065. The batch is not a cask number.
- [The Mellow Wines' 1998 22-year-old](https://www.themellowwines.com/GM_connoisseurs_choice_ardmore_1998_22%E5%B9%B4)
  provides the exact cask and bottling details matching [producer batch 21/044](https://www.gordonandmacphail.com/our-whiskies/21044-cc-cs-ardmore-1998-555).
- [Kensington's first-hand 1997 24-year-old article](https://www.kensingtonwinemarket.com/blog/11862/kensington-wine-market-s-2023-whisky-calendar-uber-edition-day-20-g-m-ardmore-1997-24-year-old)
  supplies cask and filtration facts matching [producer batch 21/222](https://www.gordonandmacphail.com/our-whiskies/21222-cc-cs-ardmore-1997-552).
  Its linked shop page incorrectly puts 1998 in the structured vintage
  field; the producer, article and product title agree on 1997.

[Norfolk's 1994 26-year-old](https://norfolkwineandspirits.com/shop/pre-order-gordon-macphail-connoisseurs-choice-cask-strength-ardmore-1994-aged-26-years-refill-american-hh-53-1-abv/)
corroborates [producer batch 21/147](https://www.gordonandmacphail.com/our-whiskies/21147-cc-cs-ardmore-1994-531).
Its cask number and outturn remain unconfirmed independently of collector
entries. [Salty Breeze's September 2019 first-hand review](https://saltybreezetw.blogspot.com/2019/09/blog-post_30.html)
identifies the T.S.M.C. ninth-anniversary selection at 47.8%, matching
[producer batch 19/074](https://www.gordonandmacphail.com/our-whiskies/19074-cc-cs-ardmore-1997-478).
The review gives its age and outturn; it does not identify a cask number.
Do not expand T.S.M.C. into a company name without evidence.

[Whisky-Online's 1994 28-year-old](https://www.whisky-online.com/products/ardmore-1994-2023-28-year-old-connoisseurs-choice-cask-strength)
and [Still Spirit](https://www.stillspirit.com/products/ardmore-29-year-old-1994-gordon-macphail-connoisseurs-choice)
identify cask 10894 as a UK exclusive. Still Spirit's URL says 29 years,
but its current title and the other retailer agree on 28. A collector's
batch-number lead still needs direct corroboration.

For Distillery Labels, the [producer's 2003 page](https://www.gordonandmacphail.com/our-whiskies/distillery-labels-from-ardmore-distillery-2003)
and [Fine Drams' 2003/2022 bottle](https://www.finedrams.com/ardmore-2003-bottled-2022-distillery-labels-gordon-macphail.html)
establish the vintage, bottling year and strength. Fine Drams wrongly names
The Ultimate Whisky Company in its bottler field; its title and the producer
establish Gordon & MacPhail. Its filtration and colour fields are explicit.
[Fine Drams' 2008/2023 bottle](https://www.finedrams.com/ardmore-2008-bottled-2023-distillery-labels-gordon-macphail.html)
and [WhiskeyOnline](https://whiskeyonline.co.nz/products/gordon-macphail-ardmore-2008-2023-46-700ml)
confirm the later vintage. Retailer-calculated ages are not printed age
statements. Existing sourced photographs have no recorded reuse licence;
no new upload permission was established.

The producer separately documents the [1999 vintage bottled in 2019](https://www.gordonandmacphail.com/our-whiskies/august-2019-dl-ardmore-1999-43-ww)
and [2000 vintage bottled in 2019](https://www.gordonandmacphail.com/our-whiskies/august-2019-dl-ardmore-2000-43-wwusa)
at 43%. [Whisky Auctioneer's 1999/2018 record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1999-distillery-labels),
[Malt Fascination's first-hand review](https://maltfascination.com/2022/09/20/ardmore-1999-2018-43-gordon-macphail/)
and specialist retailers independently document the earlier bottling. Its
auction photographs were inspected; no printed age was established.
The later 2000/2021 bottling is at 46%, corroborated by [Kensington](https://www.kensingtonwinemarket.com/product/870958/),
which explicitly gives natural colour and non-chill filtration.

The [1990 batch 18/098 producer page](https://www.gordonandmacphail.com/our-whiskies/18098-cc-cs-ardmore-1990-522)
says American hogshead, while [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1990-connoisseurs-choice-27-year-old)
and a Japanese first-hand label transcription say bourbon barrel. Maturation
needs exact label comparison. Searches of historical auction, retailer and
tasting archives also surface licensed 1977 and 1981 bottlings, older Reserve
selections and retailer casks. These require individual reconciliation;
modern producer coverage is not a complete Ardmore inventory.

[Whisky Auctioneer's Spiritual Home sixth release](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1996-connoisseurs-choice-24-year-old-spiritual-home-6th)
has a readable exact label confirming batch 21/077 and the March 2021
bottling. Its age, cask, filtration and colour statements are printed.
[The 1991 Reserve cask 6161](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1991-reserve-0)
has a readable label showing 2004, with no age statement. Its auction
record gives the outturn. No maturation was established for that exact cask.

For the 1981 vintage, [Whisky.Auction's 1994 bottle](https://whisky.auction/auctions/lot/182118/ardmore-1981)
and [Whisky-Online's history](https://live.whisky-onlineauctions.com/pages/product-history-page?mproduct=ardmore-1981-1994-gordon-macphail&mproductId=6914329149604)
establish the earlier 40% release. [Whisky Hammer's 1995 bottle](https://www.whiskyhammer.com/item/3604/Ardmore/Ardmore---1981-Gordon--Macphail.html)
is corroborated by [Alternative Whisky Academy's contemporary page](https://o69iay0p.awa.dk/whisky/ardmore/index.htm)
and Malt Maniacs. The Academy page is indexed but failed to open directly.
Its miniature and half-bottle listings do not alone establish extra releases.
No modern range was assigned retrospectively to these licensed bottlings.

The [1990 cask 12274 contemporary collector entry](https://whisky-monitor.com/index.jsp?did=5&distilleryName=Ardmore+single+malt+scotch+distillery)
uses an estimated bottling year. Searches by cask, vintage and strength
found no stronger independent exact label. Its existing unknown bottling
year, age and series were preserved. The producer's inaccessible 1994
cask 10897 page still needs independent release evidence. The [2009 cask
21607302 producer record](https://www.gordonandmacphail.com/our-whiskies/cc-ardmore-2009-21607302-1)
confirms the vintage, October 2024 bottling, strength, range and first-fill
sherry hogshead. Its printed age, batch and outturn still need a readable
exact label; collector-only details were omitted.

[Whisky Magazine's 1987 review](https://whiskymag.com/tastings/7-gordonmacphail/)
explicitly identifies the 2001 bottling at 40%, without an age statement;
[The Whisky Vault](https://www.thewhiskyvault.com/ardmore-1987-gordon--macphail-2001-bottling-with-box-22339-p.asp)
corroborates it. The same magazine's [1985 review](https://whiskymag.com/tastings/6-gordonmacphail/)
is the 1999 release. [Whiskyfun's July 2004 review](https://www.whiskyfun.com/ArchiveJuly04.html#290704)
identifies a separate 1985/2000 bottle at 40% and explicitly discusses its
reduced strength. Chris Whiskyman's 43% description was not used for this
40% record. The [1981/1997 auction history](https://live.whisky-onlineauctions.com/pages/product-history-page?mproduct=ardmore-1981-1997-gordon-macphail&mproductId=7227740258468)
is corroborated by [Diving for Pearls](https://www.divingforpearlsblog.com/2016_10_10_archive.html?m=0).
The review's arithmetic age and speculative maturation were not treated as
label statements.

[Whisky Auctioneer's Spiritual Home eleventh release](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-2008-connoisseurs-choice-13-year-old?v=5169158)
provides a label showing the 2008 vintage, printed age, 2022 bottling,
refill bourbon barrel and filtration/colour statements. The photograph's
cask and batch numbers are too blurred to transcribe confidently.

Fine Drams documents the [1995/2012](https://www.finedrams.com/ardmore-1995-bottled-2012-gordon-macphail-distillery-labels.html)
and [1996/2013](https://www.finedrams.com/ardmore-1996-bottled-2013-gordon-macphail-distillery-labels.html)
Distillery Labels releases, including colour and filtration statements.
The [1996/2013 auction photograph](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1996-0)
prints both years without an age. [Master Quill](https://masterquill.com/2018/03/19/ardmore-1996-2014-43-gordon-macphail-distillery-label-refill-sherry-hogsheads/)
and [The Whisky Exchange](https://www.thewhiskyexchange.com/p/34829/ardmore-1996-bot2014-gordon-macphail)
independently distinguish the following year's 1996 bottling. Filtration and
colour were not carried from one year's release into another without evidence.

[Scotch Whisky Auctions' Kirsch anniversary lot](https://www.scotchwhiskyauctions.com/auctions/131-the-93rd-auction/269808-ardmore-1995-gordon--macphail-kirsch-whisky-40th-anniversary-bottling/)
and [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1995-exclusive)
agree on the 1995/2016 Exclusive selection, its cask and outturn. The inspected
label has vintage and bottling years but no printed age; the auction's
calculated age was omitted. [Whisky-Online's 1990/2003 bottle](https://www.whisky-online.com/products/ardmore-1990-2003-cask-strength)
has the older green CASK label and explicitly states non-chill filtration.
Its retail age is absent from the inspected label. [The Grand Whisky Auction](https://www.thegrandwhiskyauction.com/lot-100887/ardmore-1990-cask-strength-gordon-macphail/auction-13)
corroborates the two refill bourbon barrels, bottling year and strength.

For Distillery Labels 1998/2018, [Fine Drams](https://www.finedrams.com/ardmore-1998-bottled-2018-gordon-macphail-distillery-labels.html)
agrees with [Just Whisky](https://www.just-whisky.co.uk/product/ardmore-1998-2018-gm-distillery-labels-1449573)
and contemporary tasting records. The [1991/2006 CASK](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1991-cask-strength)
and [1991/2007 CASK](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1991-cask-strength-0)
auction labels confirm the green presentation and filtration statement;
[The Whisky Exchange's 2006 record](https://www.thewhiskyexchange.com/p/5956/ardmore-1991-cask-strength-gordon-macphail)
also explicitly excludes colouring. Their ages in auction and retail headings
are calculated, not printed. [Fine Drams' 2002/2016 record](https://www.finedrams.com/ardmore-14-year-old-2002-cask-935-936-938-gordon-macphail-cask-strength.html)
has a readable later Cask Strength label with three cask numbers, exact
dates, refill sherry hogsheads, natural colour and filtration statements.
Its retail age is likewise absent from the label.

For the 1990/2005 CASK release, [Whiskyfun's February 2007 review](https://www.whiskyfun.com/archivefebruary07-2.html#270207)
includes the old CASK photograph; [Sylvie's 2015 catalog](https://www.sylvies.be/Downloads/veiling181.pdf)
independently corroborates the two casks and bottling year. Do not confuse it
with the 1990/2003 release at the same strength. [Fine Drams' Reserve 1997 cask 900669](https://www.finedrams.com/ardmore-15-year-old-1997-gordon-macphail-reserve-whisky.html)
has a readable Van Wees label with both years, cask, outturn and strength,
but no age. Its prose confirms the maturation and production statements.

The separate [Van Wees cask 900665 retailer record](https://whiskyaby.com/products/ardmore-1997-gm-reserve-sc-full-bottle)
has an inspected exact label. Its strength and outturn agree with the
[Whisky Train's 2014 tasting](https://www.whiskytrain.nl/journaal/boomgaardproeverij-2014)
and [Viskikonttori's first-hand record](https://viskikonttori.com/tag/gordon-macphail/).
Whisky Train says it was chill filtered, conflicting with collector flags;
filtration remains unknown. No colour or cask-strength statement was inferred
from the high ABV. [Whisky Auctioneer's 1993 Van Wees cask](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1993-reserve)
agrees with World Wine & Whisky's indexed listing on the bottling year,
cask, strength and outturn. The collector record calls its age calculated;
no printed age was established.

[Clos des Millésimes' 2000/2021 release](https://www.closdesmillesimes.com/25357-whisky-da-escocia-ardmore---21-anos---2000---gordon---macphail---engarrafado-2021---57-10.html)
provides a readable front label: batch 21/130, printed age, outturn, cask,
bottling date and La Maison du Whisky selection. It explicitly prints
natural colour, non-chill filtration and cask strength. Whiskyfun calls it
Conquête, while the bottle's selection line names La Maison du Whisky.
[Whiskyfun's May 2018 tasting](https://www.whiskyfun.com/2018/Ardmore-turn.html)
independently documents the HNWS Taiwan 1999/2017 Exclusive cask. Its small
label photograph confirms the range but cannot establish a printed age;
production flags available only in collector records were omitted.

[Whisky-Online's own 1993 Exclusive](https://www.whisky-online.com/products/ardmore-1993-whisky-online-exclusive-html)
has a readable label confirming the vintage, bottling year, cask and strength.
Its printed title has no age; the retailer's age is calculated. The selector's
prose documents the refill bourbon barrel, natural cask strength and outturn.
The same retailer's [1997/2019 Connoisseurs Choice record](https://www.whisky-online.com/products/ardmore-1997-2019-21-year-old-connoisseurs-choice-cask-strength)
now identifies cask 900662 in its title. Its batch 19/021, age, strength and
outturn match the producer record, establishing additional facts for that
release rather than another bottle.

[Kensington Wine Market's 1997 cask 5564](https://kensingtonwinemarket.com/product/102261/g-m-cc-ardmore-1997-kwm-cask-5564)
provides a readable exact label with batch 23/185, age 25, bottling date
14 September 2023, 232 bottles and refill sherry hogshead. The label and
selector's prose both say 50.3%; [Whiskyfun's April 2026 review](https://www.whiskyfun.com/2026/Ardmore-Times-Four.html)
says 50.1%. The exact label takes precedence. It also explicitly states cask
strength, non-chill filtration and no added colour. No image reuse permission
was established.

For the 1998/2016 Distillery Labels release, [Master of Malt](https://www.masterofmalt.com/whiskies/ardmore/admore-1998-bottled-2016-gordon-and-macphail-whisky/),
[The Whisky Exchange](https://www.thewhiskyexchange.com/p/49229/ardmore-1998-bot2016-gm-distillery-labels)
and [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1998)
agree on the years, strength and range. [Chris Whiskyman's contemporary tasting](https://chriswhiskyman.wordpress.com/category/scotch-whisky-a-g/ardmore/page/2/)
identifies refill sherry hogsheads and also documents a 2017 bottling that
still needs independent reconciliation.

[Lot-Art's archived Bukowskis lot](https://www.lot-art.com/auction-lots/Ardmore-1991-Gordon-and-MacPhail-Ardnamurchan-AD1214-CK427-and-Aultmore-1989-16-Years-Douglas-Laing/1715194-ardmore_1991_gordon-17.6.26-bukowski)
records the 1991/2008 Reserve as a selection of twelve first-fill bourbon
barrels, with dates and outturn. Whisky Auctioneer's related-bottle inventory
independently corroborates the years, cask ranges and strength. This is not
a single cask, and the collector record explicitly calls its age calculated.
[Fine Drams' 1998/2015 Van Wees Reserve](https://www.finedrams.com/ardmore-17-year-old-1998-gordon-macphail-reserve-whisky.html)
includes an exact label with no age statement and explicit prose on filtration
and colour. [European Whisky Auctions](https://europeanwhiskyauctions.com/lots/10962/ardmore-1998)
corroborates cask, outturn and bottling code.

[Sellmaier's Germany Exclusive](https://sellmaier-vinothek.de/index.php/spirituosen/whisky-unabhaengige-abfueller/ardmore-exclusively-for-germany-gordon-macphail-detail)
provides an inspected cask 5559 label and explicit colour/filtration statements;
[The Highland Herold issue 32](https://highland-herold-files.s3.amazonaws.com/documents/TheHighlandHerold_32.pdf)
records its contemporary release, barrel type and outturn. For Maltclan's
sixth club bottling, [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1997-exclusive-clubbotteling-6)
provides the exact label and [Sylvie's 2022 catalog](https://www.sylvies.be/Downloads/veiling226.pdf)
independently supplies maturation, dates and outturn. The label's spelling is
“Clubbotteling 6”; no age is printed. Collector-only production flags remain
unknown.

[WhiskyAuction.com's Viking Line cask 900658](https://whiskyauction.com/item/4155105)
records the 1998 vintage, December 2015 bottling, exact cask, strength and
refill American hogshead. Its outturn and production flags still lack
independent verification. Viking Line's [2026 fair list](https://www.vikingline.se/globalassets/documents/market_specific/sweden/theme-cruises/whisky-fair/cinderella-whisky-fair-2026-prislista-4mars2026.pdf)
also documents a different 55.8% release; its collector-reported cask 900669,
2017 bottling and outturn need an exact independent label.

For Binny's 1998 cask 5587, [My Annoying Opinions](https://myannoyingopinions.com/2016/03/04/ardmore-16-98-binnys/)
is a contemporary owner record with an inspected Exclusive label.
[Diving for Pearls](https://www.divingforpearlsblog.com/2017/01/a-brief-history-of-ardmore-distillery.html)
corroborates its age, dates, cask, strength and colour/filtration statements.
The latter page returned HTTP 429 when opened; indexed facts remained
available and the block was not retried. Collector-only outturn remains
unknown.

[Symposion's January 2024 release announcement](https://www.symposionhot.com/2024/01/31/connoisseurs-choice-briljerar-igen/)
provides the exact cask 5566 label, batch 23/186 and full release details.
Its country allocation is smaller than the full outturn; do not confuse the
two. [Kirsch's April 2021 announcement](https://whiskyexperts.net/pr-kirsch-import-praesentiert-liebhaber-abfuellungen-von-gordon-macphail/)
provides the exact batch 21/039 label and production facts. Its heading says
1997/2020, but both its detailed text and label give 18 January 2021.
[Words of Whisky](https://wordsofwhisky.com/ardmore-glenturret-gordon-macphail/)
independently corroborates age, vintage, cask and strength.

[TOModera's 1998 Cask Strength review](https://tomoderawhisky.wordpress.com/2020/04/20/3-ardmore-reviews/)
includes an exact brown-label photograph stating natural colour and
non-chill filtration, but no age. Its 2018 bottling at 53.5% is corroborated
by [Regional Wines' contemporary tasting](https://www.regionalwines.co.nz/blogs/news/best-of-the-best-2018).
Review headings disagree between 19 and 20 years; neither is treated as an
age statement. Cask number, outturn and single-cask status remain unknown.

[Whisky Magazine's 1990 record](https://whiskymag.com/tastings/8-gordonmacphail/)
explicitly identifies the 2004 bottling as having no age statement.
[Whisky-Online](https://www.whisky-online.com/products/ardmore-1990-2004-gordon-macphail)
and [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1990)
corroborate it; Chris Whiskyman's contemporary notes identify refill bourbon
casks. [Whisky.Auction's 1991/2007 record](https://whisky.auction/auctions/lot/182391/ardmore-1991)
agrees with Chris's bourbon-cask tasting at 43%. Retail ages are calculated,
not established printed statements.

[Whisky Auctioneer’s 1981/1996 record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-1981-2)
identifies the licensed 40% release separately from its adjacent bottling years.
For [Ardmore 1990/2006 at Scotch Whisky Auctions](https://www.scotchwhiskyauctions.com/auctions/69-the-38th-auction/38805-ardmore-1990-gm/),
the inspected label says 43%, despite the auction text saying 40%.
[Onversneden’s contemporary tasting](https://onversneden.com/2011/03/03/ardmore-1990-gordon-macphail/)
and [Whiskywahn](https://whiskywahn.de/?page_id=5989) corroborate 43% and the bottling year.

The 1987 vintage has two independently documented 2003 releases.
[Whisky.Auction](https://whisky.auction/auctions/lot/35164/ardmore-1987) and
[The Spirit Specialist](https://www.spiritspecialist.com/product/gm-distillery-labels-ardmore-1987-bottled-2003-40-70cl)
identify the 40% licensed bottling. [Whiskyfun’s November 2004 tasting](https://www.whiskyfun.com/ArchiveNovember04-1.html#061104)
and [Caves Damiani’s February 2004 tasting](https://www.caves-damiani.com/club-de-whisky/club-whisky-degustations-2004/)
identify the 45% La Maison du Whisky selection. Whiskyfun’s exact photograph
shows its distinct label; neither release establishes an age statement.

[Azca Auctions](https://www.azcaauctions.com/auction/lot/203-ardmore-1977/?lot=1679&sd=1),
[Whisky Hammer](https://www.whiskyhammer.com/item/136547/Ardmore/Ardmore---1977-Gordon-and-MacPhail.html)
and [The Whisky Exchange](https://www.thewhiskyexchange.com/p/67472/ardmore-1977-bot1990s-gordon-macphail)
agree on the licensed 1977 vintage at 40%. They do not establish an exact
bottling year; collector dates and calculated ages remain unverified.

[The Whisky Store’s 2013 catalog](https://www.whisky.de/fileadmin/web_data/01download/katalog/k2013.pdf)
and [Talking About Whisky’s owner tasting](https://www.talkingaboutwhisky.de/2018/05/02/smwc-clubtasting-jahrgang-1993/)
identify the 1993/2011 licensed release at 43%. The latter treats age as an
estimate and bourbon maturation as tentative; neither is adopted as an
established fact.

[Master Quill’s contemporary Reserve cask 5747 review](https://masterquill.com/2012/11/02/ardmore-17yo-19932010-56-2-gordon-macphail-reserve-first-fill-bourbon-barrel-5747-244-bottles/)
provides an inspected bottle photograph and identifies the 2010 Van Wees
selection, strength, first-fill bourbon barrel and outturn. Its heading’s
17 years is calculated; the label uses the 1993 vintage. Production flags
remain unknown. [Whisky Auctioneer’s 2002 Cask Strength record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/ardmore-2002-cask-strength)
provides an exact brown-label image for the 2017 bottling from casks 939 and
940 at 56.7%. The label confirms natural colour and non-chill filtration;
it does not state the auction’s calculated age of 14 years.

[The Whisky Exchange’s 1993 bottling](https://www.thewhiskyexchange.com/p/14354/ardmore-1993-gordon-macphail)
and [OneBid’s exact auction record](https://onebid.pl/pl/alkohole-ardmore-1993/2438813)
independently establish the separate 2008 licensed release at 43%.
[Whisky Lady](https://whiskylady.co/2024/04/16/bmc-indie-ardmore/) confirms tasting
that vintage and strength but only guesses the bottling year, so its year
and approximate age are not independent evidence.

[K&L’s April 2011 arrival announcement](https://spiritsjournal.klwines.com/klwinescom-spirits-blog/2011/4/4/new-gordon-macphail.html)
corroborates the 1991 16-year-old cask-strength release listed with cask
6162 in [Jack Rose’s December 2024 bottle list](https://www.jackrosediningsaloon.com/s/Whiskey-Book-121524.pdf).
The latter supplies first-fill bourbon maturation, strength, bottling year
and non-chill filtration. A claimed K&L-exclusive edition, exact Series and
natural-colour status still need a legible label. K&L search HTML returned
403; indexed listings and its separate shop pages remain usable. The
[Red Hare 1991/2008 tasting](https://adventuresinwhisky.blogspot.com/2010/03/)
used a sample and does not establish whether its “Distillery Labels” attribution
means a separate release from the documented Reserve bottling. No extra
record is justified by that attribution alone.

[The Strath’s selecting-retailer page](https://www.strathliquor.com/product/ardmore-strath-20th-anniversary-gm-2003/)
provides a clear anniversary label for the 2003 cask 599 release. The
label gives refill sherry maturation and a January 2023 bottling date;
its batch prefix 22 is not the bottling year.
[K&L’s own cask 598 listing](https://shop.klwines.com/products/details/1590304)
and [Diving for Pearls’ January 2023 review](https://www.divingforpearlsblog.com/2023/01/)
identify the distinct 17-year-old 2003 selection and batch 21/178. The
small retailer photograph was inspected, but its fine-print colour
statement could not be read reliably.

[Whisky-Online’s 1987 35-year-old page](https://www.whisky-online.com/products/ardnmore-1987-2022-35-year-old-connoisseurs-choice-cask-strength)
provides a legible cask 2898 photograph, including batch 23/018 and a
December 2022 bottling date. Its age, outturn, maturation and production
statements agree with the detailed retailer text and [Whic](https://whic.de/ardmore-1987-2022-35-jahre-refill-american-hogshead-no-2898-connoisseurs-choice-gordon-macphail.html).

Ardmore leads still needing independent evidence include the 1994 cask
10890 for La Maison du Whisky, 1990 cask 2994, and 2004 cask 1099 for
Whiskywarehouse’s anniversary. Exact-cask and vintage/strength searches
found collector or price-aggregator listings but no independent bottle
record for those details. The 2004 release at 55.7% likewise remains
collector-only. These are open questions, not evidence that the releases
did not exist.

## Glenlossie source coverage

The producer archive identifies modern Connoisseurs Choice batches
[24/112](https://www.gordonandmacphail.com/our-whiskies/connoisseurs-choice-from-glenlossie-distillery-2008-24-112),
[22/091](https://www.gordonandmacphail.com/our-whiskies/22091-glenlossie-distillery-1997-573),
[21/007](https://www.gordonandmacphail.com/our-whiskies/21007-cc-upper-cs-glenlossie-1988-496)
and [19/136](https://www.gordonandmacphail.com/our-whiskies/19136-cc-cs-glenlossie-1998-562-row).
Its pages provide strength, bottling dates and maturation; missing age,
cask and outturn details require the exact label or corroborating sources.
The indexed 19/136 text remains available even when opening its page fails.

[Whisky-Online’s cask 6777 page](https://www.whisky-online.com/products/glenlossie-2008-2024-16-year-old-gordon-macphail-connoisseurs-choice-single-cask-6777)
has a clear label establishing the UK selection, batch and full release
facts. [Fine Drams’ cask 3795 page](https://www.finedrams.com/glenlossie-24-year-old-1997-cask-3795-connoisseurs-choice-gordon-macphail.html)
likewise supplies an inspected label, corroborated by [The Whisky Exchange](https://www.thewhiskyexchange.com/p/71133/glenlossie-1997-24-year-old-connisseurs-choice).
[Dom Whisky’s 1988 record](https://sklep-domwhisky.pl/product-eng-25727-Glenlossie-32-year-old-D-1988-B-2021-Connoisseurs-Choice-49-6-0-7l.html)
identifies batch 21/007 and its cask and outturn. A Sotheby’s lot mirrored
at [Lot-Art](https://www.lot-art.com/auction-lots/Glenlossie-Gordon-and-MacPhail-Connoisseurs-Choice-Cask-Strength-32-Year/188-glenlossie_gordon-26.6.26-sotheby)
misstates January 1 rather than the producer’s January 27; natural-colour
status remains unverified.
[Highland Herold 47](https://highland-herold-files.s3.amazonaws.com/documents/TheHighlandHerold_47.pdf)
independently records the 1998 cask and outturn; [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/glenlossie-1998-gordon-and-macphail-20-year-old-batch-19136)
confirms the age and batch. Colour remains unknown.

For Private Collection, the [producer’s 1975 page](https://www.gordonandmacphail.com/our-whiskies/pc-glenlossie-1975-476),
[Abbey Whisky](https://www.abbeywhisky.com/products/glenlossie-44-year-old-1975-cask-2907-private-collection-aw02787),
[The Whisky Exchange](https://www.thewhiskyexchange.com/p/49889/glenlossie-1975-44-year-old-private-collection)
and [Tyndrum](https://www.tyndrumwhisky.com/glenlossie-1975-44yo-private-collection-47-6.html)
agree on cask 2907 at 47.6%. [Whisky-Online](https://www.whisky-online.com/products/glenlossie-1975-2019-44-year-old-gordon-macphail-private-collection)
misstates 52.4%, despite matching the other identity details; use the
producer’s strength. The retailer independently documents no added colour
and no chill filtration.
The [1982 cask 3398 retailer record](https://www.whisky-online.com/collections/glenlossie-distillery/products/glenlossie-1982-2022-40-year-old-gordon-macphail-private-collection-single-cask-3398),
[Whisky Vault](https://www.thewhiskyvault.com/glenlossie-1982-40-year-old-gordon--macphails-private-collection---cask-3398-26601-p.asp)
and Kirsch’s May 2023 announcement agree on the 40-year-old release.
WhiskyExperts’ retrieved page states that automated collection requires
written permission; do not continue scraping that site. Its images have
not been reused.

The historical inventory extends well beyond the producer archive.
[Whiskyfun’s Glenlossie index](https://www.whiskyfun.com/Glenlossie.html)
and [Malt Maniacs](https://www.whisky-monitor.com/index.jsp?did=59) identify
older Connoisseurs Choice, CASK, Reserve and Rare Old releases. Their
estimated years and calculated ages must be separated from label facts.
The 1972 CASK release and further 1938, 1968–1972 and 1974–1978
Connoisseurs Choice variants remain to be reconciled. Intertrade and Sestante attributions need exact
label evidence to determine Brand and bottler correctly.

The 1968 Connoisseurs Choice age statements are separate releases.
[Whisky Auctioneer's 11-year-old lot](https://whiskyauctioneer.com/whisky-lot/5010275/glenlossie-1968-gordon-and-macphail-11-year-old)
has an inspected black label printing the vintage, age and 70 imperial
proof, equivalent to 40% ABV. [Bonhams' 2016 catalog, lot 439](https://images3.bonhams.com/original?src=Images%2Flive%2F2016-10%2F24%2FS-23354-0-1.pdf)
confirms the 12-year-old at 40%; [Fine Liquors](https://fineliquors.com/products/godron-macphail-connoisseurs-choice-1968-glenlossie-12-year-no-box)
corroborates the age and vintage. Whisky-Online auction histories identify
[14-year-old](https://live.whisky-onlineauctions.com/pages/product-history-page?mproduct=glenlossie-1968-14-year-old-connoisseurs-choice&mproductId=6916978016420)
and [17-year-old](https://live.whisky-onlineauctions.com/pages/product-history-page?mproduct=glenlossie-1968-17-year-old-gordon-macphail-connoisseurs-choice&mproductId=6920537211044)
releases, corroborated by Whiskyfun's firsthand reviews. The Whisky
Exchange's 17-year-old description incorrectly says ten years, repeated
by Malthound; use the matching auction records. No bottling years have
been established for these age statements.

The 1961 Rare Old vintage spans several bottlings. [McTear's 2014 lot](https://www.mctears.co.uk/auction/lot/lot-791---glenlossie-1961-rare-old-single-speyside-malt/?au=622&ef=&et=&g=-1&ic=False&lot=88080&pn=8&pp=25&sd=1&so=0&st=&sto=0)
and [Whisky Shop lot A114348](https://www.whiskyshop.com/auctions/a114348-glenlossie-1961-gordon-macphail-rare-old)
agree on 1996 and 40%. [Just Whisky](https://www.just-whisky.co.uk/product/glenlossie-1961-2002-gm-rare-old-1462741)
and [a Japanese firsthand account](https://sarichiiiii.blog.fc2.com/blog-entry-826.html)
confirm 2002 at 40%. [Master of Malt](https://www.masterofmalt.com/whiskies/glenlossie-1961-whisky/),
[Grand Whisky Auction](https://www.thegrandwhiskyauction.com/lot-621046/glenlossie-1961-rare-old-2007-gordon-macphail)
and Whiskyfun confirm 2007 at 43%; Whiskyfun supplies refill sherry
maturation. Whisky Antique's title instead says 40%, so it is not a
reliable strength source for the 2007 bottle.
[Whisky-Online's 2015 auction](https://live.whisky-onlineauctions.com/pages/product-history-page?mproduct=glenlossie-1961-2008-rare-old-gordon-macphail&mproductId=6916389142692)
and [Whisky Hammer lot 250463](https://www.whiskyhammer.com/item/250463/Glenlossie/Glenlossie---1961-Gordon--MacPhail-Rare-Old.html)
explicitly identify 2008 at 42.7%. Its maturation remains unverified beyond
collector listings. Do not turn calculated ages into age statements:
Whisky Marketplace even combines a 41-year age with 1961/1996 dates.
No permission to reuse the source photographs has been established.

The pre-war [1938 43-year-old auction lot](https://whiskyauctioneer.com/whisky-lot/5023030/glenlossie-1938-gordon-and-macphail-43-year-old)
is corroborated by [Christie's](https://www.christies.com/en/lot/lot-1156332),
which independently records the vintage, age and 40% strength. The
bottling year is unverified. Collector leads for 42- and 48-year-old
1938 releases still need primary evidence; exact-age searches did not
find corroborating auction or retailer records.
[The Whisky Exchange's 1974/1997 page](https://www.thewhiskyexchange.com/p/24943/glenlossie-1974-bot1997-connoisseurs-choice)
and Whiskyfun's June 2004 review identify that Connoisseurs Choice release.
The retailer only guesses sherry maturation from colour; leave it unknown.
[Whisky.Auction's 1974/1999 lot](https://whisky.auction/auctions/lot/199509/glenlossie-1974-connoisseurs-choice)
and [Passion for Whisky](https://www.passionforwhisky.com/en/whisky/scotch-whisky/single-malt-whisky/Speyside/glenlossie-whisky-distillery/36266-glenlossie-1974-1999-old-map-label.html)
confirm a later bottling at the same strength.
[Whisky Magazine's 1975 tasting](https://whiskymag.com/tastings/7-connoisseurs-choice/)
explicitly records no age statement, 40% and bottling in 2001;
[Whisky.Auction](https://whisky.auction/auctions/lot/176476/glenlossie-1975-connoisseurs-choice)
corroborates the identity. Malt Maniacs' age is calculated, not stated.

Master of Malt distinguishes the [1978 bottled 2005](https://www.masterofmalt.com/whiskies/glenlossie/glenlossie-1978-bottled-2005-connoisseurs-choice-gordon-and-macphail-whisky/)
and [1978 bottled 2007](https://www.masterofmalt.com/whiskies/glenlossie-1978-whisky/)
Connoisseurs Choice releases at 46%.
[Whiskyfun's April 2014 review](https://www.whiskyfun.com/archiveapril14-2.html)
provides refill sherry maturation for the former; the retailer explicitly
describes refill sherry hogsheads for the latter. [My Annoying Opinions](https://myannoyingopinions.com/2020/06/03/glenlossie-29-1978-gordon-macphail/)
reviews a sample of the 46% Connoisseurs Choice, not Reserve cask 1814;
its bourbon description does not establish maturation against the retailer.
[Passion for Whisky's Reserve cask 1814](https://www.passionforwhisky.com/en/scotch-whisky/single-malt-whisky/Speyside/glenlossie-whisky-distillery/30581-glenlossie-1978-2007-1814.html)
records 58.8%, 2007 and the outturn. [Meijboom's firsthand 2008 tasting](https://www.whiskymonitor.nl/nicodistalfag.htm)
independently identifies first-fill sherry butt maturation.
The same firsthand archive corroborates the 1975/2001 Reserve cask 2909
at 55%. Its [July 2024 tasting report](https://www.whiskymonitor.nl/nieuws76.htm)
has an inspected exact label confirming those facts. The review’s 26 years
is absent from the label; maturation, outturn and treatment flags remain unknown.
No permission to reuse its photograph has been established.

[Fine Drams' 2008 cask 6775](https://www.finedrams.com/glenlossie-9-year-old-2008-cask-6775-gordon-macphail-cask-strength.html)
has an inspected label confirming the Cask Strength range, 61.7%,
first-fill sherry butt, natural colour and no chill filtration. It prints
dates and vintage but no age; the retailer's nine years is calculated.
The bottle dates are June 17, 2008 and July 11, 2017. The photograph is
watermarked and no reuse permission has been established.

[The Whisky Exchange's 1971 record](https://www.thewhiskyexchange.com/p/25221/glenlossie-1971-bot1980s-connoisseurs-choice)
and [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/glenlossie-1971-connoisseurs-choice)
confirm Connoisseurs Choice at 40%, but do not establish the exact year.
Collector leads describe 1989, 1990 and 1991 bottlings; these need label
reconciliation before creating potentially duplicate records.
The existing 1978 cask 1815 is described by [Jack Rose's 2013 menu](https://static.urbandaddy.com/uploads/assets/file/pdfs/137043daab04fa0b389b88be27a3cba5.pdf)
as Reserve, bottled 2005 at 46%. TapHunter appears to repeat the menu;
an independent exact-bottle source remains desirable. Do not use
Connoisseurs Choice collector record WB14433 as evidence for cask 1815.

[Whisky Auctioneer's 1973 Private Collection page](https://whiskyauctioneer.com/learn/explore-whisky/bottles/glenlossie-1973-gordon-and-macphail-private-collection)
provides refill sherry hogshead maturation. Its inspected front label
prints bottled 2022 and 49.9%; [M&P's importer listing](https://wina-mp.pl/pl/produkt/gordonmacphail-glenlossie-1973-499-07-private-collection)
corroborates the vintage, range and strength. Age 48, cask 3951 and outturn
88 remain collector-only details. Exact-cask and retailer searches did
not independently establish them; no source image has been reused.

For the earlier 46% Connoisseurs Choice range, [Whisky Auctioneer's
1995/2013 entry](https://whiskyauctioneer.com/learn/explore-whisky/bottles/glenlossie-1995-gordon-and-macpahil-bottled-2013)
confirms first-fill sherry hogshead maturation. [Whisky Store's record](https://www.whisky.com/whisky-database/details/glenlossie-9.html)
corroborates the identity and links its own tasting, but the editable
community treatment fields have not independently established colour
and filtration. Fine Drams provides inspected labels and producer-attributed
maturation descriptions for [1998/2014](https://www.finedrams.com/glenlossie-1998-bottled-2014-connoisseurs-choice-gordon-macphail.html)
and [1997/2014](https://www.finedrams.com/glenlossie-1997-bottled-2014-connoisseurs-choice-gordon-macphail.html).
The former combines a refill sherry butt and hogshead; the latter combines
a refill sherry hogshead and first-fill sherry butt. Both are explicitly
natural colour and not chill filtered, and neither is single cask.
The labels do not print the calculated ages used on some bar menus.

[The Whisky Exchange's 2004/2016 record](https://www.thewhiskyexchange.com/p/39959/glenlossie-2004-connoisseurs-choice),
[Master of Malt](https://www.masterofmalt.com/whiskies/glenlossie/glenlossie-2004-bottled-2016-connoisseurs-choice-gordon-and-macphail-whisky/)
and [The Whisky Barrel](https://www.thewhiskybarrel.com/products/glenlossie-2004-connoisseurs-choice)
agree on the release; The Whisky Exchange supplies natural colour and
no chill filtration and the retailers agree on refill sherry hogsheads.
Master of Malt also establishes [1982/2008](https://www.masterofmalt.com/whiskies/glenlossie/glenlossie-1982-connoisseurs-choice-gordon-and-macphail-whisky/)
and [1993/2012](https://www.masterofmalt.com/whiskies/glenlossie/glenlossie-1993-connoisseurs-choice-gordon-and-macphail-whisky/)
at 46%. [Sylvie's January 2015 catalog, lot 1274](https://www.sylvies.be/Downloads/veiling175.pdf)
corroborates the latter's dates. The 1982 refill-sherry and 1993 mixed-cask
claims still need primary corroboration; [Fassstark's firsthand 1993 review](https://www.fassstark.de/t23205f124-Glenlossie-Connoisseurs-Choice-GM.html)
is a useful lead, but the detailed header links a collector record.
No reusable exact photograph has been established for these releases.

[The Whisky Exchange’s 1969 18-year-old entry](https://www.thewhiskyexchange.com/p/2364/glenlossie-1969-18-year-old-connoisseurs-choice)
explicitly confirms Connoisseurs Choice, 40% and no colouring. It does not
establish a bottling year. [The Rare Malt’s Van Wees listing](https://www.theraremalt.com/products/gordon-macphail-glenlossie-22-year-old-1988-for-van-wees-cask-3664)
has a readable Reserve label showing vintage 1988, bottling year 2010,
cask 3664, 52% and the Van Wees selection. The retailer’s calculated age
is absent from that label; maturation and outturn remain unverified.
Neither site's image reuse permission has been established.

[Sylvie’s October 2022 catalog, lot 1271](https://www.sylvies.be/Downloads/veiling226.pdf)
and [Whisky Auctioneer’s Maltclan lot](https://whiskyauctioneer.com/whisky-lot/8198436/glenlossie-2000-reserve)
provide matching indexed details for Glenlossie 2000/2013 Reserve cask
7514 at 54%. These also identify the Maltclan selection and refill sherry
hogshead. Direct access to the PDF returned 403; the auction page failed
both web open and browser navigation. Label inspection remains outstanding.

Older import listings need particular care: the 1970 16-year-old Sestante
decanter appears at 43%, while a collector lead assigns 40% to a Gordon &
MacPhail version. The 1972 16-year-old at 57.7% appears with both Sestante
and Gordon & MacPhail Original CASK labels. Brand and same-liquid questions
remain open; these are not yet grounds for separate records.

[Whisky Situation’s 1972/1991 miniature](https://whiskysituation.co.uk/collections/whisky/products/glenlossie-1972-gordon-macphail-connoisseurs-choice-old-map-label-speyside-single-malt-scotch-whisky-1991-5cl-miniature)
confirms Connoisseurs Choice and 40%, with an inspected label confirming the
vintage and strength. Its bottling year agrees with [Best of Wines’ full-size
listing](https://bestofwines.com/whisky/scotland/speyside/glenlossie/glenlossie-connoisseurs-choice-old-map-label-gordon-macphail-connoisseurs-choice-old-map-label-1972.htm).
[The Grand Whisky Auction](https://www.thegrandwhiskyauction.com/lot-742066/glenlossie-1974-connoisseurs-choice-1994-gordon-macphail/)
and [The Whisky Shop](https://www.whiskyshop.com/auctions/a100515-glenlossie-1974-gordon-macphail-connoissuers-choice)
independently confirm the 1974/1994 Connoisseurs Choice at 40%. Retailer
calculated ages and the US 19-year wording need label reconciliation before
adding an age or treating them as different liquids. Photograph reuse
permission remains unestablished.

[L.A. Whiskey Society’s January 2009 review](https://www.lawhiskeysociety.com/whiskey/676/Glenlossie-1988-Gordon-and-MacPhail-)
identifies the D&M Wines Glenlossie 1988 selection at 56.3%, cask 3661.
Its small but readable label confirms bottled 2007 and does not print an
age. [Jack Rose’s October 2024 inventory](https://embed-rech-01.dialog.cm/jackrosediningsaloon/docs/whiskey_book_10.11.24)
independently identifies the exact cask and explicitly records cask strength
and no chill filtration. Skinner’s indexed sale 2853T identifies Reserve;
the auction page could not be opened. The repeatedly reported age of 18
is not yet established as a label statement. Maturation, outturn and
natural colour remain unknown; the copyrighted society photograph has
not been reused.

## Images

The producer's [terms](https://www.gordonandmacphail.com/terms-conditions)
require permission to reuse images and text. Public availability does not
establish permission to upload photographs to Peated. Exact producer images
can help identify a release, but reuse remains unresolved without permission.
Do not substitute another cask's image or copy tasting prose.

## Coverage still to establish

The producer archive alone does not prove the full historical set. Older
licensed bottlings, CASK, Book of Kells, Secret Stills, The MacPhail's
Collection, Spirit of Scotland, house blends, importer releases and private
selections require independent reconciliation. Packaging changes, miniatures,
and export sizes alone do not establish different liquids. Distilleries
attributed to secret-source releases need evidence beyond collector guesses.
