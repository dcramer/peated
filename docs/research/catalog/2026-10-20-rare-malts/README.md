# Rare Malts Selection catalog review — 20 October 2026

Production target: `https://api.peated.com`, Brand **E366603 Rare Malts
Selection**, owned by **E5558 Diageo**. This review covers the official
1995–2005 range, including European, US, South African and miniature packaging.
Bottle size and box variations do not create separate releases.

## Coverage and inventory

The starting catalog contained **102 Bottles**. The independent inventory found
**95 supported distillery/vintage/age/strength combinations**, all already
represented in Peated. Nine further reported combinations remain disputed:
five have existing records and four do not. No supported missing Bottle was
found, so none was created. After the approved Dufftown duplicate merge, the
Brand has **101 active Bottles**.

The inventory uses [Ulf Buxrud's collection and observations](https://www.buxrud.se/raremalt.htm),
the [Whisky.Auction label guide and release chronology](https://magazine.whisky.auction/how-to/how-to-read-a-rare-malts-selection-label/),
and [Whisky Auctioneer's range history](https://whiskyauctioneer.com/learn/explore-whisky/brands/rare-malts-selection).
Exact auction lots and the readable labels on existing Peated images were used
to check identifying facts. Buxrud's supported collection and doubtful
observations were kept separate. These sources do not prove that every
historically marketed variation has been discovered.

All pages of the Brand, Entity relationship, name search, 37 stored distiller
relationships and reference search were fetched. This produced 3,990 distinct
related Bottle records and 336 references containing “Rare Malts”. The five
unrelated results from the name search were excluded. Other distillers' releases
with matching age, vintage and strength were checked for misplaced Brand links;
none was established as an additional official Rare Malts release.

The work list is [bottles.csv](bottles.csv). It includes every starting Bottle,
four unmatched doubtful leads and three unofficial 2016 releases. The separate
[references.csv](references.csv) records the decision for every starting assigned
reference. [changes.csv](changes.csv) records before/after values and evidence
for Bottle and Brand edits. These are curated research records, not raw API
exports.

## Changes

- Updated **24 Bottles**. Thirteen names now follow the labels, eight release
  months distinguish release from bottling, three disputed bottling years were
  cleared, and B63827 gained its supported 1997 bottling and release year.
- Set E366603 to `discontinued`. Its Brand kind, Diageo ownership, Scottish
  origin and 1995 establishment year were already consistent with the sources.
  Its description was retained. No separate active official website or
  geographic site was established for this discontinued Brand.
- Unassigned **61 unsafe import references**: 17 names too broad to distinguish
  releases, 41 generated names whose rounded strength differs from the label,
  and three 1972/22-year Brora names assigned to a 1975/20-year Bottle. The 41
  generated names were also marked ignored to prevent repeated automatic
  matching. The other 20 remain unresolved.
- No public aliases, Series, images or new Bottles were added. One confirmed Dufftown duplicate was merged with explicit user approval,
  preserving B49692 and redirecting B63827. Its retailer listing moved with it.

The individual Bottle edits are:

| IDs                          | Change                                                           | Evidence                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B49666                       | `Blair Athol 1975 27-year-old` → `Blair Athol`                   | [Exact Whisky Shop lot](https://www.whiskyshop.com/auctions/a14033-blair-athol-1975-27-year-old-rare-malts), label                                                                               |
| B5428                        | Name → `Clynelish`                                               | [1972/22/58.95 lot](https://www.scotchwhiskyauctions.com/auctions/126-the-88th-auction/232404-rare-malts-clynelish-1972-22-year-old-75cl/), label                                                |
| B49682                       | Name → `Clynelish`                                               | [1972/22/58.64 Sotheby's lot](https://www.sothebys.com/en/buy/auction/2023/finest-whisky-whiskey-2/clynelish-rare-malts-22-year-old-58-64-abv-1972-1), label                                     |
| B49683                       | Name → `Clynelish`                                               | [1972/23/57 South African lot](https://whisky.auction/auctions/lot/121701/clynelish-1972-23-year-old), label                                                                                     |
| B49684                       | Name → `Clynelish`                                               | [1972/23/57.1 Sotheby's lot](https://www.sothebys.com/en/buy/auction/2026/finest-rarest-whisky-2/clynelish-rare-malts-23-year-old-57-1-abv-1972-1), label                                        |
| B49685                       | Name → `Clynelish`                                               | [1972/24/61.3 lot](https://whisky.auction/auctions/lot/189497/clynelish-1972-24-year-old), label                                                                                                 |
| B5412                        | Name → `Clynelish`                                               | [1974/23/59.1 Australian lot](https://www.australianwhiskyauctions.com.au/lot-191007/clynelish-1974-23-year-old-rare-malts-selection), label; ignore its prose typo in the age                   |
| B5443                        | `Glenesk` → `Hillside`                                           | [1970/25/61.1 lot](https://www.scotchwhiskyauctions.com/auctions/151-the-110th-auction/393258-rare-malts-hillside-1970-25-year-old-75cl/), label                                                 |
| B49707                       | `Glenesk` → `Hillside`                                           | [1969/25/61.9 Christie's lot](https://onlineonly.christies.com/s/christies-wine-online-nyc-collection-rare-whisky/hillside-glenesk-distillery-25-year-old-1969-92/25942), label                  |
| B49708                       | `Glenesk` → `Hillside`                                           | [1970/25/60.1 lot](https://whisky.auction/auctions/lot/103197/hillside-1970-25-year-old), label                                                                                                  |
| B49709                       | `Glenesk` → `Hillside`                                           | [1971/25/62 Bonhams catalog](https://images1.bonhams.com/original?src=Images%2Flive%2F2017-11%2F24%2FS-24095-0-1.pdf), label                                                                     |
| B49692, B63827               | Name → `Dufftown-Glenlivet`; B63827 bottling/release year → 1997 | [Exact 1975/21/54.8 lot](https://whisky.auction/auctions/lot/189496/dufftown-glenlivet-1975-21-year-old), both stored labels, release chronology                                                 |
| B5256, B5272, B49729, B49733 | 2004 release month: April → October                              | Buxrud's contemporary note explicitly distinguishes April bottling from October UK release                                                                                                       |
| B5220, B5218, B49713, B5232  | 2005 release month: April → October                              | Buxrud's final October UK release note; its Glen Mhor vintage typo is rejected in favor of the 1976 label                                                                                        |
| B49715, B5455, B49734        | Bottling year: 1995 → unknown                                    | Buxrud states these early Millburn and St. Magdalene releases were bottled at least a year before the spring 1995 launch. Exact earlier years conflict across sources. Release year remains 1995 |

## Field review

The 95 supported combinations were compared against age, vintage, exact ABV,
the featured distillery and visible natural-cask-strength labels. All existing
images were inspected. Different strengths remain separate, including small
differences such as 60.02%, 60.75% and 61.12%. Stored `single_malt`, official
Brand and distiller relationships were retained. Official producer bottlings
have no independent Bottler. There is no evidenced subrange requiring a Series
under the Rare Malts Selection Brand; the Brand's Series list is empty.

Edition, single-cask status, maturation, cask number, natural color and malt
phenol measurements remain unknown unless already supported. “Natural cask
strength” does not establish natural color or lack of chill filtration. The
two previously reviewed Glen Ord filtration values were retained; see the
[Glen Ord review](../2026-10-19-glen-ord/README.md). No inference was made from
tasting notes or image color. Missing descriptions were not filled with
repeated facts or speculative production details.

The eight existing 6,000-bottle outturns were retained. Supporting checks:
[Auchroisk 1974/28](https://www.spiritradar.com/whisky-db/auchroisk-1974-rare-malts-selection-28yo-56.8-percent-700ml/),
[Banff 1982/21](https://www.amshop.de/en/Banff-1982-21-Years-Single-Malt-Scotch-Whisky-Rare-Malts-Selection-Cask-Strength-57-1--Vol-.html),
[Bladnoch 1977/23](https://europeanwhiskyauctions.com/lots/22481/bladnoch-1977),
[Blair Athol 1975/27](https://hedonism.co.uk/products/blair-athol-27-year-old-rare-malts-1975),
[Brora 1977/24 catalog](https://cdn.polyauction.com.hk/public-default/auction/sale/xiang-gang-bao-li-2019nian-chun-pai-zhen-xi-wei-shi-ji-ji-gan-yi-shuang_6034f161-930e-4533-b674-b59104604017.pdf),
[Glen Albyn 1975/26](https://europeanwhiskyauctions.com/lots/20434/glen-albyn-1975-26-years-old),
[Linkwood 1974/30](https://whisky.auction/auctions/lot/215847/linkwood-1974-30-year-old),
and [Rosebank 1981/20](https://www.whiskybase.com/whiskies/whisky/248/rosebank-1981).
These are supporting secondary catalog claims, not a newly established producer
batch ledger. No other outturn was inferred from bottle numbers or maximum case
counts.

Other stored release months were preserved where no stronger evidence proved
them wrong. Many match label bottling months, so they should not be treated as
independently confirmed release dates. Existing packaging-specific 1995/1996
dates also need care. Neither age arithmetic nor an auction date establishes an
exact bottling or release year.

## Remaining identity questions

| Record or lead                                     | Final decision and evidence gap                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B63827 and B49692, Dufftown-Glenlivet 1975/21/54.8 | Merged B63827 into B49692 after explicit user approval. Both labels and the exact lot identify the same release. The old ID resolves to B49692 and Master of Malt listing 12057961 moved. Both had zero tastings and review scores. The survivor retains distiller E366568; no Entity merge was performed with E258. |
| B49739 and B49670, Brora 1975/20/59.1              | Possible duplicate, unresolved. The former has 1995 dates and no image; the latter has 1996 dates and an exact label. Buxrud lists US 1995 and European 1996 packaging. This does not settle whether the dates describe distinct marketed releases or inconsistent dates. No merge.                                  |
| B49741, Caol Ila 1977/21/63.1                      | Preserve unresolved. Exact-name, ABV and alternate decimal searches found collector observations, not an exact readable label or auction lot proving this variant. The established 1978/20/61.3 release cannot substitute for it.                                                                                    |
| B49742, Dallas Dhu 1970/24/58                      | Preserve unresolved. Buxrud marks it doubtful. Exact searches did not establish it alongside the supported 59.91%, 60.54% and 60.6% releases.                                                                                                                                                                        |
| B49744, Linkwood 1974/22/61.2                      | Preserve unresolved. Exact searches return lists or the supported **23-year-old** release. No readable 22-year label was established; do not silently change its age or merge it.                                                                                                                                    |
| B49745, Millburn 1975/18/58.5                      | Preserve unresolved. Buxrud observations, whisky-book snippets and a French tasting discussion mention it, but no exact label/auction evidence was established. Keep separate from the supported 58.9% version.                                                                                                      |
| B49746, St. Magdalene 1971/23/59                   | Preserve unresolved. Buxrud and a Whiskypedia excerpt report it; exact searches did not establish a readable label. The supported 1970/23/58.1 and 58.43 releases do not prove this one.                                                                                                                             |
| Brora 1972/22/54.9; no current Bottle              | Do not create. Exact quoted and alternate-name searches did not establish it. Earlier Brora research rejected this lead; existing references are already unassigned.                                                                                                                                                 |
| Brora 1972/22/59.1; no matching current Bottle     | Do not create. Exact searches found the 1975/20/59.1 release or unrelated later Broras. Three references wrongly pointing to that 1975 Bottle were unassigned.                                                                                                                                                       |
| Brora 1974/20/57.5; no current Bottle              | Do not create. Buxrud lists a doubtful observation and exact searches did not confirm it. Earlier Brora research rejected this lead; references remain unassigned.                                                                                                                                                   |
| Glen Ord 1972/23/62.43; no current Bottle          | Do not create. The [previous Glen Ord audit](../2026-10-19-glen-ord/README.md) and current source comparison identify confusion with Glendullan. No exact Glen Ord label was found.                                                                                                                                  |

Unresolved searches used exact distillery/vintage/age/strength combinations,
decimal comma and decimal point variants, Rare Malts and Rare Malts Selection,
auction catalogs, collector lists and whisky-book excerpts. The
[earlier Brora audit](../2026-09-07-brora.md) was checked before reconsidering
previously rejected records. A reported release without usable evidence was
not converted into a production fact.

Caol Ila 1983/33/56.6, Lagavulin 1976/40/51.2 and Talisker 1976/40/45.7 from
Shanghai in 2016 are **out of scope**. Buxrud distinguishes the organizer's
promotional bottles from the official discontinued Rare Malts range. Later
collector lists that include them do not establish an official revival.

## Images and provenance

**96 starting Bottles had images; all 96 lacked a source page and license.**
Every populated image was inspected against its Bottle identity. This confirms
what is pictured, not who owns the image or whether Peated may reuse it.
Existing assets were retained without inventing attribution. B49672's bottle
shows Brora 24 years, but the accompanying box shows 21 years; the image needs
a correctly paired replacement. B49711 has a collection watermark. Several
others are small thumbnails.

The six without images are the five disputed existing records and Brora
B49739. Searches did not establish exact reusable images for the disputed
records. B49739 also needs its relationship to B49670 settled before choosing
an image. Exact commercial auction photos were found for supported releases,
but no permission to republish them was established. Whisky.Auction displays
an all-rights-reserved footer; its [terms](https://whisky.auction/terms-and-conditions)
did not establish a reusable license. Searches for Creative Commons Rare Malts
bottle images did not find exact usable replacements. No image was uploaded.
The Brand has no Entity images; no appropriate reusable Brand/site photo was
established, and a product shot or logo was not substituted.

Image provenance was unresolved for all 96 inspected assets. After the merge,
95 active Bottles have images and six still lack them. An API asset
link in the work list records the label inspected; it is not a canonical source
page or reuse authorization.

## References and verification

The initial 330 assigned references were checked against the inventory. No
public Bottle aliases existed. Correct historical import names were retained
as references rather than exposed as public aliases. Six references for
previously rejected Brora leads were already unassigned and remained so.

Three ambiguous references are protected by the API because they equal a
current canonical Bottle full name: **10004** (`Rare Malts Selection Brora`,
B49670), **9997** (`Rare Malts Selection Caol Ila`, B5426), and **10193**
(`Rare Malts Selection Mortlach`, B49720). These remain unresolved catalog
matching risks. No unsupported name suffix or direct database edit was used to
evade that constraint.

The pre-write consumer search found 11 visible Rare Malts prices and no
external reviews with Rare Malts in their name. None used an exact reference
name selected for correction. The API correction route also protects imported
consumers assigned to a different Bottle. Hidden imports are not exposed by
the listing endpoint, so their absence is not claimed.

Every mutation used the authenticated production API and the live full OpenAPI
schema. Bottle reads checked the original ID, identifying fields, dates and
update timestamp before writing; reference corrections checked both the
assigned Bottle and ignored state. Every changed record was read again and its
expected fields compared. No code tests apply to these production data edits.
Final readback details and the approved merge are recorded in
[verification.md](verification.md).

Source access limits: 76 automated Whisky.Auction search requests returned
HTTP 403 and were stopped; those failed requests are not exact-lot evidence.
Whisky Auctioneer also rejected a command-line page fetch. Readable indexed
pages, normal web results and exact accessible lots were used instead. The
[Fine Spirits table](https://blog.finespirits.auction/img/news/RARE%20MALTS%20SELECTION%20-%20EN.pdf)
contains conflicting/transposed facts and was used only for leads. No source
access restriction was bypassed.
