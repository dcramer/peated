# Glen Ord catalog, 19 October 2026

Status: **completed evidence-backed catalog pass**, covering official releases and independent bottlers. All inventoried records and discovered leads have a disposition. This does not establish that every historical bottling has been found; unsupported identities and conflicting facts remain unresolved.

## Results

- **19 missing releases created** and **401 existing Bottle records updated**.
- **7 Series created**, **4 official Series descriptions added**, **1 brand created**, and **2 entity website links updated**.
- **5 ambiguous import references unassigned**, with exact retailer matches preserved.
- **446 records verified** against the final expected state. There were no unexpected differences, merges or deletions.
- **48 existing in-scope Bottle images inspected**. No new images uploaded because reusable permissions were not established.

The starting inventory contained 427 unique records: 425 found through Glen Ord’s distiller relationship and two additional records found by name. Three finished blends were outside the marketed Glen Ord scope and preserved. One incorrectly attributed James Eadie record was corrected to Linkwood with its ID preserved. Nineteen additions bring the complete worklist to 446 records. Ten existing records retain unresolved identities or conflicting source facts.

[added-releases.csv](added-releases.csv) lists the new releases with public links. [changes.csv](changes.csv) records 478 verified Bottle mutation events: 19 creates and 459 updates, including repeated updates to the same record. [worklist.csv](worklist.csv) gives the disposition of every record; [release-review.csv](release-review.csv) gives per-release findings and sources. Unknown facts were retained when evidence did not support a change.

[related-changes.csv](related-changes.csv) records entity and Series writes. The new Series are Cadenhead Club (1318), Cadenhead Single Cask (1319), Malts of Scotland Special Range (1320), Acla Classic (1321), Hidden Spirits Highproof (1322), Whisky-Time Oldtimer Collection (1323), and Scotch Universe Alien Edition (1324). Scottish Castles brand 367661 was created. Glen Ord entity 242 and Singleton entity 1426 now link to the producer’s visitor site.

## Evidence and verification

Every starting record’s edit context, aliases and complete import-reference list was read. All starting Bottle groups contained one Bottle. Each change was checked against a fresh production read and fetched again after writing; renames were followed by alias/reference checks. The final pass fetched every one of the 446 records and compared changed and preserved catalog fields, relationships and original group IDs. [verification.csv](verification.csv) records the results. No code was changed; validation used authenticated API reads rather than application tests.

Final Series membership checks found three Epicurean Odyssey, three Gourmand, four Reserve Collection and three Forgotten Drop releases. New Series membership was also checked. The original “Oh my darling” alias on SMWS 77.74 remains present. [reference-changes.csv](reference-changes.csv) records the five reference unassignments and consumer checks.

Research used producer archives and announcements, readable labels, exact auction lots, retailers, contemporary reviews and first-party bar menus. Searches covered Ord/Glenordie, Singleton’s Asian and travel-retail ranges, hand fills, Rare Malts, Special Releases, managers’ bottlings, Prima & Ultima and independent bottlers. Collector search snippets were discovery leads, not sufficient evidence for writes. Source access failures were recorded; blocked sites were not bypassed.

Detailed family reviews:

- [Official Glen Ord and Singleton](official-review.md)
- [Cadenhead and Signatory](cadenhead-signatory-review.md)
- [Scotch Malt Whisky Society](smws-review.md)
- [The Ultimate](ultimate-review.md)
- [Douglas Laing family](douglas-laing-review.md)
- [James Eadie](james-eadie-review.md)
- [Càrn Mòr and Malts of Scotland](carn-mor-malts-of-scotland-review.md)
- [Rattray, Blackadder, Hart, Berry and Thompson](rattray-blackadder-hart-berry-thompson-review.md)
- Smaller independent bottlers: [first](small-bottlers-first-review.md), [second](small-bottlers-second-review.md), [third](small-bottlers-third-review.md), [fourth](small-bottlers-fourth-review.md), [fifth](small-bottlers-fifth-review.md).

## Conflicts and unanswered questions

- 13994: Singleton 14 lacks ABV and dates. It may represent Special Releases
  2018 (49862), but its current identity does not prove this. No merge.
- 18436: Mackillop's Choice 1983, 21 years, lacks ABV and a distiller
  relationship. An import reference mentions 43%, but exact independent
  supporting evidence has not been found. Existing facts preserved.
- 67603: SMWS 77.7 is stored as 1987/17 years/58.3%/2005; collector discovery
  instead points to 1985/13 years/53.4%/1998, “Jam Roly Poly.” An exact label is
  required before changing identity facts. No inferred correction.
- SMWS 77.4, 77.5 and 77.6 remain possible missing releases. Exact labels resolved 77.40 and 77.46, which were created and verified.
  Code, subtitle, producer regional archives, auction and general searches
  have not yet supplied sufficient exact evidence for creation.
- Ultimate 800316: producer history puts it under January 2019; collector
  discovery says 2020. Stored eight-year age is preserved and dates remain
  unknown pending an exact label. Casks 800295 and 800303 remain leads.
- Singleton 32 (67329): vintage claims 1974 and 1975 conflict. Vintage stays
  unknown. Old Singleton 35 (67330) has conflicting 2008–2010 release claims;
  existing 2009 is preserved pending stronger evidence.
- Additional hand fills have batch/cask ambiguities: 7156; 2022/001; 2/2023;
  3/2024; 2025/004; cask 449; and 05/26. Different fill dates alone do not
  establish different releases. No speculative records created.
- Historical Glen Cawdor 1964 Samaroli may contain Glen Ord, but the distillery
  attribution is not established. Do not create it as Glen Ord on that basis.
- Provenance DMG4243, DMG5207 and DMG7188; Signatory 3451, 3475, 3468, 3457
  and 3477; and Creative Whisky GO002 are discovery leads needing exact
  sources. Signatory “8914, 1998, ten years, 2006” is internally inconsistent.

## Source errors and identity traps

- A Rare Malts summary wrongly suggests Glen Ord 1972. The corresponding
  release is Glendullan 1972, supported by
  [Ulf Buxrud's list](https://www.buxrud.se/raremalt.htm) and
  [Whisky.Auction's label guide](https://magazine.whisky.auction/how-to/how-to-read-a-rare-malts-selection-label/).
- Whiskyfun lists Singleton Epicurean 40 at 55.4%; the
  [producer](https://www.diageorareandexceptional.com/us/the-singleton-epicurean-odyssey-series)
  confirms 45.9%. Its Maltbarn “2021/2021” and Old Particular cask “1260”
  entries also require exact-source checks rather than blind copying.
- Master of Malt's Signatory cask 3473 page says a twelve-year 1998 vintage
  was bottled in 1998. That bottling year is impossible and is not evidence.
- Thompson Bros.' “Error 502 Bad Gateway” is a real range, documented by an
  [exact bottle review](https://www.dramface.com/all-reviews/thompsons-glen-ord-12-502).
  It must not be removed as an apparent scraper error.
- James Eadie's producer archive has a Glen Ord heading above The Peacock's
  Linkwood image. Exact label and retailer evidence establish Linkwood.
  Bottle 67422 was corrected to distiller 145 with its ID preserved; no merge
  or deletion was performed.
- The API rejects a Bottle name equal to its Brand. This prevents direct
  normalization of some age-only official expressions without inventing a
  product name. Their existing names are preserved.

## Additional discovery decisions

[final-discovery-leads.csv](final-discovery-leads.csv) records the final missing-release search results. The producer menu prints 55.1% on page 2 and 55.4% on page 4 for an eleven-year hand fill; no separate 55.1% record was created. Exact auction evidence corroborates 55.4%, and two independent bar menus corroborate a 55.5% release. Cask numbers and dates remain unknown where not supported.

Exact evidence resolved the Sansibar Retirement Batch, Sansibar for Hon Spirit, Samaroli for Stefano Core, Liquid Library 54.2%, SMWS 77.40 and 77.46, and other additions listed in added-releases.csv. Berry cask 124, Cooper’s Choice eight-year 1999, King of Still 62.4%, Howard Cai HG560, Creative Regions c223, Acredyke 1970 and Singleton Unité remain leads requiring stronger identification. Earlier family-specific unresolved leads remain in their review documents; they were not silently discarded.

## Aliases, references and images

The starting public alias “Oh my darling” on SMWS 77.74 (15768) remains supported by the [US Society page](https://smwsa.com/products/ride-the-flavour-wave-1). Broad age-only Singleton 15, 18, 38 and 40 references and a broad Ultimate 2011 reference fit multiple releases. References 12685, 19355, 28293, 19778 and 19779 were unassigned and verified. Exact price records retained supported Bottle assignments.

Fifty starting records had images; two belonged to the excluded blends. All 48 remaining stored images were visually inspected and are consistent with the visible release identity. Some small or angled images cannot verify every label field. [image-review.csv](image-review.csv) records those limits. An image matching the release does not establish source ownership or permission. Existing images were preserved; no uploads were made.

The distillery image records a CC BY-SA 2.0 source, [Richard Webb’s Glen Ord photograph](https://commons.wikimedia.org/wiki/File:Glen_Ord_Distillery_-_geograph.org.uk_-_5980707.jpg). The stored photograph shows the distillery driveway and chimney. The Commons original could not be fetched, so the exact source match remains unconfirmed. No image change was made.
