# Gordon & MacPhail Series audit — 22 October 2026

Production catalog repair for Gordon & MacPhail, Entity **E5645**, prompted by
missing important Series and the 2026 Dram Takers Collection Volume 2 presenter.
This audit reconciles named ranges and identified release sets. It does not claim
to identify every historical Gordon & MacPhail bottling or certify every fact on
unchanged records.

## Results

- Created **49 Bottles**, B67938–B67979 and B67981–B67987.
- Updated **84 existing Bottles**, including missing Series relationships,
  incorrect range assignments, names containing structured facts, and supported
  corrections to release details.
- Created **three Series**: Mr George Legacy (S1327), Private Collection Ultra
  (S1328), and Archive Exclusive (S1329).
- Updated descriptions for **nine existing Series**.
- Merged **S1144 into S1009** after explicit user approval, moving one additional
  existing Bottle, B64237. The retired Series ID resolves to S1009.
- Recorded **12 unresolved Bottle questions**. No Bottle merges or deletions
  were performed.

The initial read found 689 results by Brand, 700 by Bottler, and 704 by name. The
combined inventory contained 704 distinct records. All result pages were read
before writes. The final inventory snapshot and initial search-only records
contain 765 distinct IDs: 49 created, 84 updated, 618 unchanged, 12 unresolved,
and two out of scope. Other catalog work added records during this audit; those
additions are included where observed and are not counted as this audit's work.
Counts are dated snapshots, not live totals.
The later approved Series merge moved B64237 without resolving its disputed
release details, so its inventory disposition remains `unresolved`. Including
that move, 85 existing Bottles were changed.

The missing data was real: whole release sets were absent; some range names were
stored only in `edition`; Heritage and Heritage Collection were mixed; and
Recollection had two Series records. This establishes catalog defects, not the
specific backfill job or code path that caused them.

## Release sets reconciled

| Range or release set                    | Result                                | Evidence and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Dram Takers Collection Volume 1     | 6 of 6                                | [Producer collection page](https://www.gordonandmacphail.com/the-dram-takers-collections) and [2025 distributor announcement](https://whiskyexperts.net/neu-bei-kirsch-import-signatory-vintage-100-proof-single-grain-millstone-single-malts-mars-und-akkeshi-sowie-the-dram-takers-collection-vol-1/).                                                                                                                                                                     |
| The Dram Takers Collection Volume 2     | 6 of 6                                | Supplied 2026 producer presenter, detailed pages 5–10, and the producer collection page.                                                                                                                                                                                                                                                                                                                                                                                     |
| The Dram Takers, individual releases    | 10 of 10 on the current producer page | [Producer standalone list](https://www.gordonandmacphail.com/the-dram-takers). S427 has 25 records in the audited snapshot: both six-bottle volumes, these ten, a separately evidenced Glen Grant 1954, and two existing historical Clynelish records. The current page is not a complete historical list.                                                                                                                                                                   |
| Mr George Legacy                        | 5 of 5                                | [Producer's five-edition list](https://www.gordonandmacphail.com/legacy). Created the missing Series and first two editions; reused the existing third, fourth, and fifth.                                                                                                                                                                                                                                                                                                   |
| Generations                             | 5 of 5                                | [Producer release history](https://www.gordonandmacphail.com/our-whiskies/ranges/generations): 2010 Mortlach 70, 2011 and 2012 Glenlivet 70, 2015 Mortlach 75, and 2021 Glenlivet 80. The two Glenlivet 70 editions are separately marketed releases; [Christie's exact second-release record](https://onlineonly.christies.com/s/fine-rare-wines-spirits-online-festive-edition/gordon-macphail-generations-glenlivet-70-year-old-505/203852) corroborates the distinction. |
| Private Collection Ultra                | 4 of 4                                | [Producer prestige page](https://www.gordonandmacphail.com/prestige), [producer booklet mirror](https://www.scribd.com/document/264682435/Gordon-Macphail-Private-Collection-Ultra), and [exact four-bottle set](https://www.thewhiskyexchange.com/p/26611/gordon-macphail-private-collection-ultra-4-bottle-set).                                                                                                                                                           |
| 125th Anniversary                       | 4 of 4                                | [Producer prestige page](https://www.gordonandmacphail.com/prestige). Existing Coleburn, Glencraig, Mosstowie, and Glenury Royal records repaired.                                                                                                                                                                                                                                                                                                                           |
| Connoisseurs Choice Heritage Collection | 5 of 5                                | [Producer collection](https://www.gordonandmacphail.com/connoisseurs-choice-heritage-collection). Kept separate from the standalone Heritage range.                                                                                                                                                                                                                                                                                                                          |
| Connoisseurs Choice Heritage            | 2 of 2 identified standalone releases | [Producer Heritage page](https://www.gordonandmacphail.com/connoisseurs-choice-1968-longmorn): Longmorn 1968 and Talisker 1987.                                                                                                                                                                                                                                                                                                                                              |
| Vintage Moments                         | 5 of 5                                | [Producer's five selections with Sir Kenny Dalglish](https://www.gordonandmacphail.com/vintage-moments-in-partnership-with-sir-kenny-dalglish).                                                                                                                                                                                                                                                                                                                              |
| Anniversary Releases                    | 4 of 4 on the producer list           | [Producer list](https://www.gordonandmacphail.com/anniversary-series): Glen Grant 1976, Longmorn 1966, Miltonduff 1986, and Linkwood 1996.                                                                                                                                                                                                                                                                                                                                   |
| Artistry in Oak                         | 1 of 1                                | [Producer Glenlivet 85 release](https://www.gordonandmacphail.com/artistry-in-oak-85-years-old-whisky).                                                                                                                                                                                                                                                                                                                                                                      |
| Archive Exclusive                       | 3 identified releases                 | [G&M retail range](https://retail-gordonandmacphail.com/collections/archive-exclusive). Existing Glen Grant 1950 and Glenlivet 1967/1979 records assigned to the new Series. Historical exhaustiveness is not established.                                                                                                                                                                                                                                                   |

Recollection was checked beyond the current producer page. The
[2022 announcement](https://whiskyexperts.net/gordon-macphail-veroeffentlicht-recollection-series-seltene-whiskys-aus-geschlossenen-schottischen-destillerien/)
establishes the first release and regional selections. The
[2023 announcement](https://whiskyexperts.net/gordon-macphail-veroeffentlicht-zweite-recollection-serie-mit-18-whiskys-aus-lost-distilleries/)
lists 18 second-series whiskies. Seventeen are correctly assigned to edition #2;
the Port Ellen record remains unresolved because the same cask is presented in
both the 2023 and [current third-series material](https://www.gordonandmacphail.com/the-recollection).
The current third series has all six records in S1009 after the approved merge.
S1009 contains 29 records overall; retired S1144 resolves to it. Port Ellen's
edition and outturn conflict remains unresolved.

## Historical and core range coverage

The audit compared the [current range list](https://www.gordonandmacphail.com/our-whiskies/ranges),
[producer vault](https://www.gordonandmacphail.com/our-whiskies/our-vault), dated
announcements, historical distributor material, and exact retailer and auction
records against the production inventory. Coverage includes mid-century vintages,
2010–2026 prestige releases, older core and export labels, Japan-exclusive labels,
and regional Recollection selections encountered during the search.

Core and historical ranges retained include Connoisseurs Choice, Distillery
Labels, Discovery, Private Collection, Speymalt, Spirit of Scotland, Cask,
Reserve, Cask Strength, Rare Old, Rare Vintage, Centenary Reserve, Exclusive,
and The MacPhail's Collection. Sources and snapshot counts for all 27 observed
Series (26 active after the merge) are
in [series.csv](series.csv). These large or historical ranges are not finite
release sets; their existence and the identified missing assignments were checked
without claiming every past release has been cataloged.

The named-distillery MacPhail's Collection is distinct from MacPhail's undisclosed
distillery whisky. The former reached seven records under G&M S1225, using exact
label evidence and the [2017 distributor catalog](https://vinogvin.dk/images/design/upload/Minimesse%20generisk%20katalog_2017.pdf).
One Glenturret record under E1165/S1215 remains unresolved. An old producer URL
containing `the-macphails-collection` now presents the undisclosed-distillery
product, so its path alone does not prove range identity.

“No change” in [inventory.csv](inventory.csv) means the existing relationship was
retained and no supported correction was identified in this audit. It does not
mean every fact, image, or historical label on that record was independently
certified. The two CRN57° records are out of scope because they belong to The
Cairn's separate brand and bottler.

## Evidence conflicts and remaining work

- **Series merge completed:** the user explicitly approved merging S1144,
  “The Recollection Series,” into S1009, “Recollection Series.” Both belong to
  E5645. The API moved B64237, preserved its Bottle and Group IDs, and retired
  S1144 with a link to S1009. The target's membership is exactly its former 28
  Bottle IDs plus B64237. This organizational merge does not settle the Bottle's
  disputed edition or outturn.
- **Port Ellen B64237:** producer material places cask 290 in both the second and
  third Recollection series. Its current product page gives 60 bottles, while
  the existing record has 181. The existing facts were preserved pending evidence
  of the marketed-release boundary.
- **Potential Bottle duplicates:** B62660/B61334 (North Port) and B62524/B61328
  (Longmorn) need exact cask and bottling-year evidence before any merge.
- **Historical artwork:** Book of Kells artwork alone does not establish
  membership in modern The Dram Takers. Three old releases were left unresolved
  rather than assigned by visual resemblance.
- **Other uncertain identities:** a 1943 Glenlivet at 40%, the Glenturret above,
  two sparse 1993 records, and overlapping Balblair/Glenrothes labels need exact
  release evidence. [unresolved.csv](unresolved.csv) lists all 12 records, the
  unanswered question, and sources or searches tried.

The supplied file is
`01825_GM_The_Dram_Takers_Collection_Sales_Presenter_2026 (2).pdf`. Its cover and
the six detailed product pages establish Volume 2; the Volume 1 wording on page
2 is inconsistent. The “100 sets” claim was not copied into each Bottle's
outturn. Likewise, Vintage Moments' set count was not treated as individual
bottle outturn.

The current Recollection page has headings whose years conflict with linked
product details, including Convalmore and Glenlochy. Exact product evidence took
precedence over those headings. Existing imported reference text was retained
even when it conflicts with the stronger producer evidence used for a correction.

## Images, preserved data, and verification

No images were uploaded. Exact producer images were found, but the
[producer's reuse terms](https://www.gordonandmacphail.com/terms-conditions),
section 3.4, require written permission for online or software reuse. No such
permission was established. Existing image URLs, source URLs, and license fields
were preserved; missing images and unproven existing image rights remain gaps.

All production operations used the authenticated `pnpm cli api` client against
`https://api.peated.com`, using the live API schema. Each changed existing Bottle
was re-fetched before writing. Only supported, evidence-backed fields were sent.
Every created or updated Bottle was fetched afterward; checks covered requested
facts, Brand, Bottler, distillers, Series, editions, and shared identity details.
Aliases and the IDs, full text, and assignments of existing import references
were compared before and after. Existing image metadata was also compared.
The changed Series descriptions and new Series were fetched and checked.

After the approved merge, both Series IDs returned S1009 with 29 releases, the
old membership list was empty, and the target contained exactly the expected
29 Bottle IDs. B64237's facts, aliases, image metadata, and full import-reference
record were preserved. Its generated description and description source were
cleared by the existing `updateBottle` rule that invalidates generated text after
a Series change. This expected API effect was checked against the owning code
and recorded in `changes.csv`; no new description was invented.

No existing Bottle IDs were retired, and no tastings, ownership, user records,
or history were intentionally altered. The existing G&M Entity description,
website, country, address, and unknown status were retained. Concurrent additions
were rechecked and reused when encountered instead of creating another record.
Code tests were not run because this work changed production catalog data and
research files, not application code.

## Audit files

- [changes.csv](changes.csv): all 134 changed Bottles, including the membership
  change caused by the approved Series merge, final identifying fields, exact
  changed fields, and evidence links.
- [inventory.csv](inventory.csv): each observed Bottle ID and its disposition.
- [series.csv](series.csv): all 27 observed Series, evidence, snapshot counts,
  and the completed merge.
- [unresolved.csv](unresolved.csv): the 12 specific identity or evidence questions.

Raw API responses, request files, downloaded sources, and credentials are not
included in this research record.
