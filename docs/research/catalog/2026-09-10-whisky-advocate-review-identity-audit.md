# Whisky Advocate review identity audit

Date: 2026-09-10

Status: Source-wide duplicate and multi-review audit complete. Production
cleanup applied; unresolved evidence and API constraints are recorded below.

## Scope

This audit covers every active Whisky Advocate external review and every Bottle
currently attached to one of those reviews. It treats review assignment, Bottle
references, public aliases, and Bottle attributes as separate decisions. A name
mismatch or repeated review title is a review candidate, not proof that an
attachment is wrong.

Production changes are recorded below by bounded repair batch. Each batch used
stable IDs, exact preflight reads, evidence-backed writes, and post-write API
verification.

## Initial production inventory

The source-wide inventory used the authenticated production API and paged all
Whisky Advocate external reviews in stable name order.

| Measure                                           | Count |
| ------------------------------------------------- | ----: |
| Reviews                                           | 7,285 |
| Reviews attached to a Bottle                      | 5,165 |
| Reviews without a Bottle                          | 2,120 |
| Distinct attached Bottles                         | 4,636 |
| Bottles with more than one Whisky Advocate review |   418 |
| Reviews on those multi-review Bottles             |   947 |
| Repeated `(review name, Bottle)` groups           |    74 |
| Reviews in those repeated-name groups             |   189 |

## Post-repair snapshot

The final source read still contains hidden legacy rows because review history
is preserved. Active counts exclude reviews that were hidden and unassigned.

| Measure                                                | Count |
| ------------------------------------------------------ | ----: |
| Source rows, including hidden history                  | 7,285 |
| Active reviews attached to a Bottle                    | 5,003 |
| Reviews without an active Bottle assignment            | 2,282 |
| Distinct Bottles with an active Whisky Advocate review | 4,800 |
| Bottles with more than one active review               |   196 |
| Repeated `(review name, Bottle)` groups                |    41 |
| Active exact-URL duplicate groups                      |     0 |

The attached-review count fell while the distinct-Bottle count rose because
duplicate copies were unassigned and reviews for different releases were moved
from shared generic records to exact Bottles. A repeated product review is not
treated as a duplicate merely because its title matches an older review. The
retained same-name clusters have different source URLs and represent a later
editorial review, a market-strength variant, or an unresolved identity where
the evidence is not strong enough to split it.

The 74 repeated-name groups contain 115 reviews beyond the first review in each
group. This is a triage count only. Some publications can legitimately review
the same ongoing product more than once.

### Reviews by creation year

| Year | All reviews | Attached reviews |
| ---- | ----------: | ---------------: |
| 2023 |         478 |               51 |
| 2024 |       6,424 |            4,757 |
| 2026 |         383 |              357 |

### Attached reviews per Bottle

| Reviews | Bottles |
| ------: | ------: |
|       1 |   4,218 |
|       2 |     363 |
|       3 |      39 |
|       4 |       4 |
|       5 |       6 |
|       6 |       1 |
|       7 |       2 |
|      11 |       1 |
|      13 |       1 |
|      14 |       1 |

## Confirmed example

Bottle 13980, `George T. Stagg 15-year-old (2018 Buffalo Trace Antique
Collection)`, has 14 attached Whisky Advocate reviews. Only review 2356 names
the exact 2018 release in its source URL. The other 13 reviews use 12 generic
`George T. Stagg` names and one `George T. Stagg 15-year-old` name across
different source articles.

Two broad legacy references caused those assignments:

| Reference ID | Reference                   |
| -----------: | --------------------------- |
|        15313 | George T. Stagg             |
|        23653 | George T. Stagg 15-year-old |

The exact canonical reference, ID 1890, names the 2018 Bottle. Detaching and
ignoring the two broad references unassigned the 13 wrong reviews while
preserving review 2356.

The completed first repair batch:

- Preserved review 2356 on Bottle 13980.
- Unassigned the 13 reviews whose names did not establish the 2018 release.
- Unassigned and ignored broad references 15313 and 23653.
- Set Bottle 13980 to release year 2018, 62.45% ABV, cask strength, and Buffalo
  Trace Distillery entity 483.

Buffalo Trace's 2018 release announcement confirms that this is the 2018
Antique Collection release, made from barrels filled in spring 2003 and bottled
at 124.9 proof. Its current Peated record has no release year, strength, or
distiller link. An evidence-backed Bottle repair would set `releaseYear` to
2018, `abv` to 62.45, `caskStrength` to true, and add Buffalo Trace Distillery
entity 483 as its distiller. The producer describes the release as unfiltered,
but that wording should not be converted to Peated's more specific
`nonChillFiltered` field without confirming the filtration method.

## Completed production batches

### Buffalo Trace Antique Collection

Bottle 13980 now retains only the exact 2018 George T. Stagg review, ID 2356.
Bottle 13981 now retains only the exact 2018 William Larue Weller review, ID 2357. Broad legacy references 15313, 23653, 18018, and 23523 are unassigned,
ignored, and marked `human_approved`. Both Bottles now have their verified 2018
release year, strength, cask-strength flag, and Buffalo Trace Distillery link.

### Four Roses Limited Edition Small Batch

The generic Bottle 44010 had 11 Whisky Advocate reviews spanning the 2010,
2012-2017, 2019, 2020, and 2022 annual releases, including the separate 2017 Al
Young 50th Anniversary release. The audit:

- corrected existing Bottles 44911-44919;
- created reviewed Bottles 56569 (2010), 56570 (2017 Al Young), and 56571
  (2024);
- moved 17 exact year references to the matching release;
- unassigned and ignored ambiguous reference 24327, `Four Roses Small Batch
2012 Release`;
- reassigned all 11 reviews to the exact release Bottles.

Postflight reads show no Whisky Advocate reviews left on Bottle 44010 and one
review on each reviewed annual Bottle. The annual Bottles use the stable product
name, with release year, ABV, cask strength, and non-chill filtration stored as
attributes. Bottle 44913 uses the marketed `125th Anniversary` edition and
Bottle 56570 uses `Al Young 50th Anniversary`.

### Angel's Envy Cask Strength

The generic Bottle 44007 had six Whisky Advocate reviews spanning the 2012,
2014, 2015, 2017, 2018, and 2019 annual releases. The audit:

- corrected annual Bottles 44881-44890 plus the attached 2020 Bottle 13284 and
  2026 Bottle 45337;
- moved 15 year-specific references from Bottle 44007 to the matching annual
  Bottle;
- reassigned all six misplaced reviews to Bottles 44885-44890;
- preserved the already-correct 2020 and 2026 review assignments.

Postflight reads show no Whisky Advocate reviews left on Bottle 44007 and one
review on each of the six repaired historical release Bottles. The 2022 and
2023 records use the producer's `11th Edition` and `12th Edition` names; the
2026 record uses `15th Edition`. `nonChillFiltered` remains unknown because the
producer says `unfiltered`, which does not establish the narrower field.

### Talisker 30-year-old

Bottle 5197 had five Whisky Advocate reviews for materially different releases.
The audit:

- kept review 5550 on the 45.8% full-time-range Bottle 5197 and added its
  missing Talisker distiller link;
- created reviewed Bottle 56572 for the 2022 release at 48.5% ABV and an
  outturn of 3,200 bottles;
- corrected the cask-strength flag on existing Special Releases Bottles 4853
  (2010, 57.3%), 5115 (2007, 50.7%), and 49830 (2006, 51.9%);
- reassigned reviews 362, 6513, 7329, and 7697 to those exact releases.

Postflight reads show one Whisky Advocate review on each intended Bottle. The
two broad references remain with Bottle 5197 because they describe the ongoing
45.8% product rather than a specific annual release. Existing exact Special
Releases references remain unchanged. Bottle 56572 has no imported aliases or
references to preserve.

### Four Roses Limited Edition Single Barrel

Generic Bottle 44016 had five Whisky Advocate reviews for the 2009 and
2011-2014 annual releases. The audit:

- normalized the shared product name and added Four Roses Distillery as the
  distiller across the existing seven-Bottle group;
- corrected Bottles 44959-44963 with their reviewed release year, age, ABV,
  single-cask, cask-strength, and non-chill-filtration facts;
- moved reference 11956, which names the 2008 `120th Anniversary` release, to
  Bottle 44964;
- moved reference 26108, which names the 2011 12-year-old release, to Bottle
  44961;
- reassigned all five reviews to Bottles 44959-44963.

Postflight reads show no Whisky Advocate reviews left on Bottle 44016 and one
review on each intended annual Bottle. The generic canonical reference remains
on Bottle 44016; the two release-specific references are `human_approved` on
their exact Bottles.

### Writers' Tears Cask Strength

Generic Bottle 44023 had five annual Whisky Advocate reviews for 2018-2021 and
2023, while the related 2022 review was unmatched. The audit:

- corrected existing Bottles 44992-44995 as the producer's 8th through 11th
  annual editions, including the wrong 2016 release year stored on the 2018
  Bottle;
- created reviewed Bottles 56573 and 56574 for the 12th (2022) and 13th (2023)
  editions;
- set each annual Bottle's verified ABV, release year, outturn, cask-strength
  and non-chill-filtration flags, and American oak bourbon-barrel maturation;
- moved exact 2018 references 26215 and 26268 from the generic Bottle to Bottle
  44992;
- assigned all six reviews, including the previously unmatched 2022 article,
  to their exact annual Bottles.

Postflight reads show no Whisky Advocate reviews left on Bottle 44023 and one
review on every annual Bottle from 2018 through 2023. The generic canonical
reference remains on Bottle 44023; both exact 2018 references are
`human_approved` on Bottle 44992.

### Ardbeg Supernova

Generic Bottle 44025 had Whisky Advocate reviews for the 2009, 2010, and 2019
Supernova releases, while the 2014 and 2015 reviews were already attached to
their exact release Bottles. The audit:

- reassigned review 7126 to the 2009 `Stellar Release` Bottle 4865, review 6727
  to `SN 2010` Bottle 45001, and review 1692 to `SN 2019` Bottle 45004;
- preserved the correct 2014 and 2015 assignments on Bottles 45002 and 45003;
- set non-chill filtration on all five releases, and set cask strength on the
  2009, 2010, and 2019 releases where the sources explicitly establish it;
- detached and ignored references 27587, 27011, and 27012, which repeated the
  same release label twice, while preserving useful exact aliases.

Postflight reads show no Whisky Advocate reviews left on Bottle 44025 and one
review on each intended release Bottle. The broad canonical reference remains
on the generic Bottle, and every useful release-specific reference remains on
its exact Bottle.

### The Irishman Vintage Cask

Generic Bottle 44031 had three Whisky Advocate reviews for the 2019, 2020, and
2021 annual releases. Exact release Bottles 45021-45023 already existed, but
their names repeated the release label twice and their release facts were
mostly empty. The audit:

- corrected Bottles 45021-45023 as the producer's 11th (2019), 12th (2020),
  and 13th (2021) editions;
- set each release's verified ABV, outturn, cask-strength and non-chill-
  filtration flags, and first-fill bourbon-cask maturation;
- reassigned reviews 1731, 1325, and 819 to those exact release Bottles;
- detached and ignored malformed canonical references 4208-4210, which
  repeated each release label twice;
- created exact canonical-name references 32494-32496 and preserved the useful
  legacy year aliases.

A fresh source-level review read shows all three review IDs on the intended
release Bottles and none on Bottle 44031. The first per-Bottle postflight reads
returned stale empty cache entries for the targets, so those responses are not
being used as evidence of review absence.

### Thomas H. Handy Sazerac

Bottle 16768 represented the 2013 Buffalo Trace Antique Collection release but
had seven earlier Whisky Advocate reviews attached through the broad references
`Thomas H. Handy` and `Thomas H. Handy Sazerac`. A source-wide search also found
related reviews that were unmatched or already assigned to later exact Bottles.
The audit:

- identified one review for every annual release from 2006 through 2020;
- corrected the existing 2013, 2017, 2018, 2019, and 2020 Bottles;
- created reviewed Bottles 56575-56584 for the 2006-2012 and 2014-2016
  releases;
- set each release's verified year, age, ABV, cask-strength flag, and Buffalo
  Trace Distillery link;
- reassigned all 15 reviews to their exact annual Bottles;
- detached and ignored broad references 23205 and 22687, while preserving
  useful exact aliases;
- added exact canonical-name references 32497-32511 for the annual Bottles.

A fresh source-level review read shows exactly one of the 15 reviews on each
intended release Bottle. The Whisky Advocate 2015 article identifies the release
year but prints 64.96% ABV; the contemporary release announcement establishes
the actual 126.9 proof, so Bottle 56583 records 63.45% ABV.

### Kilchoman 100% Islay

Generic Bottle 44008 had seven Whisky Advocate reviews spanning the inaugural
2011 bottling and the 3rd, 4th, 7th, 8th, 9th, and 10th annual editions. The
audit:

- corrected the eleven existing Bottles for the 1st through 11th Editions with
  their stable product name, marketed edition, and evidence-backed release
  facts;
- removed inferred ages and a singular vintage from releases whose vatting did
  not support them;
- corrected the 4th Edition to the producer's 50% ABV despite Whisky Advocate's
  article printing 59%;
- reassigned all seven reviews to their exact annual Bottles;
- moved 21 edition-specific references from generic Bottle 44008 to their exact
  release Bottles;
- detached and ignored references 4114-4116 because they preserved the old bad
  age or vintage facts.

Postflight reads show the seven reviews on seven exact release Bottles. Bottle
44008 retains only its generic canonical and source-approved references. The
source-specific release references are now `human_approved`; correct historical
aliases remain attached to their exact Bottles.

### Four Roses Single Barrel

Generic Bottle 428 had five Whisky Advocate reviews: four exact 50% Single
Barrel bottlings and one 9-year, 59.4% OBSF Private Selection for Maisano's Fine
Wine and Spirits. The audit:

- corrected Bottle 428 to 50% ABV, not cask strength, and added the Four Roses
  Distillery link;
- created reviewed Bottles 56585-56588 for Barrels 19-6J, 29-50, 55-6F, and
  87-6L;
- created reviewed Bottle 56589 for the Maisano's OBSF Private Selection;
- used the four barrel codes as both the structured cask number and visible
  release label so the exact Bottles remain distinguishable;
- reassigned all five reviews and moved the four barrel-specific references;
- added exact canonical-name references 32514-32517 and a canonical-name
  reference for the Maisano's selection.

Postflight reads show no Whisky Advocate reviews left on Bottle 428 and one on
each exact Bottle. The generic references remain on Bottle 428; the cask-specific
references are `human_approved` on their matching Bottles.

### Yellowstone Limited Edition

Generic Bottle 44017 had five Whisky Advocate reviews for the 2015, 2016,
2018, 2019, and 2020 annual releases. Exact release Bottles 44965-44969 already
existed, but their display names repeated the release label and most release
facts were empty. The audit:

- normalized each release to the stable product name `Limited Edition` and a
  bare-year edition, except the marketed `2020 Armagnac Cask-Finished` edition;
- recorded only evidence-backed age, ABV, blend or finish, release year,
  single-cask status, and known outturn facts;
- left the distiller unknown because the early editions used sourced blends and
  the reviewed articles do not establish every component's distiller;
- reassigned reviews 3796, 3123, 2321, 1597, and 1029 to Bottles 44965-44969;
- moved five release-specific references off generic Bottle 44017;
- detached and ignored malformed references 4152, 4153, 26558, 26559, and 4154,
  whose names repeated their release labels.

Postflight source-level reads show the five reviews on their exact annual
Bottles and no Whisky Advocate reviews left on Bottle 44017. Active specific
references point to the matching annual releases; Bottle 44017 retains only the
generic canonical reference.

### Malloy Hall

Bottle 55947 had five attached Whisky Advocate rows, but they represented four
products and one duplicate import. The source also contained duplicate rows for
the Bourbon, Peated, and Sherry Cask Edition article URLs. The audit:

- created Entity 366923 for the verified producer, The Distillery at
  Lambertville, using its producer site, New Jersey location, and address;
- linked that distillery to the existing Peated and Sherry Cask Edition Bottles;
- created reviewed Bottles 56591-56593 for Malloy Hall American Single Malt,
  Rye, and Bourbon at the reviewed 43% ABV;
- added the review-supported bourbon-and-sherry maturation to the American
  Single Malt and the reviewed 45 PPM malt fact to Peated;
- detached and ignored ambiguous reference 32129, `Malloy Hall, 43%`, because
  Whisky Advocate used that same title for three different products;
- kept the newer review rows with extracted text and exact article identity,
  assigning reviews 10567, 10583, and 10639 to the American Single Malt, Rye,
  and Bourbon Bottles;
- retained reviews 10646 and 10569 on Peated and Sherry Cask Edition;
- detached and hid older skeletal duplicate rows 8951, 9030, and 8953; and
- added unambiguous 43% references for the three newly created Bottles.

Postflight source-level reads show one attached review for each of the five
products. The three duplicate rows remain as detached history rather than being
deleted. Active references no longer map the ambiguous `Malloy Hall, 43%` name
to Peated.

### Springbank 14-year-old 2011 single casks

Generic Bottle 735 had four Whisky Advocate reviews for separate casks in a
2011 U.S.-market release set. Each review named a distinct sherry type and cask
number. The audit:

- added the missing Springbank distillery link to the 14-year-old Bottle family;
- created reviewed Bottles 56594-56597 for Amontillado #305, Fino #265,
  Manzanilla #259, and Oloroso #268;
- recorded the four exact ABVs, 1996 vintage, 2011 bottling and release year,
  full-term sherry-cask maturation, and single-cask and cask-strength facts;
- recorded supported outturns of 524 bottles for #305 and 546 each for #259 and
  #268, leaving #265 unknown; and
- moved references 22523, 22524, 22899, and 23052 to their exact Bottles and
  added clean canonical-name references 32523-32526.

The reference corrections propagated all four reviews to the exact cask
Bottles. A fresh source-level read shows one review on each and none on generic
Bottle 735.

### Tomatin Cù Bòcan archive releases

Bottle 1012 had the core Cù Bòcan review plus the 1988, 1989, and Bourbon
limited releases. Three other archive-release reviews were unmatched. Tomatin's
own archive identifies all seven products and their release facts. The audit:

- corrected core Bottle 1012 to 46% ABV, NAS, natural color, non-chill-filtered,
  and its bourbon, sherry, and North American virgin-oak maturation;
- renamed and corrected Bottle 4180 as Cù Bòcan Sherry;
- created reviewed Bottles 56598-56602 for the 1988, 1989, 2005 Vintage,
  Bourbon, and Virgin Oak releases;
- recorded the producer's ABVs, cask-strength and single-cask status, cask
  makeup, vintage years, natural-color and filtration facts, and known
  outturns;
- moved four wrongly attached references from Bottle 1012 and resolved three
  previously unassigned references; and
- added clean canonical-name references 32527-32532.

Reference propagation assigned the three previously unmatched reviews as well
as correcting the attached reviews. A fresh source-level read shows all seven
articles on seven exact Bottles, one review each.

### Aggregate verification

Some cached Bottle score aggregates lagged behind the initial repair batches,
so the audit did not use them to verify review identity. Final counts come from
direct, source-wide review assignments. Review and BottleReference updates now
queue Bottle-stat recomputation for affected Bottles.

## Cause

The retired importer in Git commit `be07f0e24` removed a trailing ABV from the
publisher's product title, deduplicated observations by that shortened Bottle
name within a run, and upserted records using source, name, and score rather than
the article URL. Distinct annual releases could therefore collapse onto one
name, and same-score articles could overwrite each other.

The current Whisky Advocate adapter keeps the article URL as its stable source
key and no longer removes the ABV. Legacy assignments remain. A current risk
also remains when several distinct articles publish the same title: a broad
BottleReference can cause later articles to reuse the first bad match.

## Source-wide cleanup rounds

After the named release-family batches above, the remaining source was audited
in stable alphabetical pages. The review covered every exact-URL duplicate,
every Bottle with more than one attached Whisky Advocate review, and the Bottle
references and attributes implicated by those groups. Single-review records
were included in the inventory and checked for obvious title/reference
conflicts. Facts were added only when the review URL, producer material, or an
exact existing catalog record established them.

The cleanup included these recurring failure modes:

- 165 exact source-URL duplicate groups. The older copy in each group is hidden
  and unassigned. Two groups became visible again when a later identity repair
  brought their copies onto the same Bottle; Fuji Single Malt review 9059 and
  Johnnie Walker Blue Label review 8984 were then hidden and unassigned too.
- Broad references attached to a specific release. Examples include standard
  Jameson on Bow Street 18, standard Heaven's Door on its 10-year-old release,
  standard Maker's Mark on the 2020 SE4 x PR5 release, and standard Old
  Forester on the 150th Anniversary Batch 03 Bottle.
- Different annual or batch releases collapsed together. Repaired families
  include Aberfeldy 18, 15 Stars First West, Ardbeg, Caol Ila Unpeated,
  GlenAllachie Cask Strength, Jameson Bow Street, Midleton Very Rare, Sazerac
  18, Springbank Cask Strength, Tamdhu Batch Strength, Reservoir Year II, and
  Writers' Tears Cask Strength.
- Standard and finished products collapsed together. Repaired examples include
  Green Spot, Knappogue Castle 12, Glen Scotia 10, Macallan Estate Reserve,
  OOLA Three Shores, Sons of Liberty Battle Cry and Uprising, Tomatin French
  Oak, and Overeem Sherry Matured Cask Strength.
- Generic and single-cask records collapsed together. Repaired examples include
  Four Roses Single Barrel releases, Lark LD126, Ranger Creek barrel 503,
  Wild Turkey Kentucky Spirit barrel 98, and Port Charlotte PC7 cask 1215.
- Product-name artifacts copied into Bottle names. Corrected examples include
  Highland Queen Majesty, Johnnie Walker Blue Label Ghost & Rare Brora,
  Reference Series I, Seagram's V.O., and Fuji Single Blended Whisky.

The later alphabetical rounds created exact reviewed Bottles B56621-B56667 as
needed and reused existing exact Bottles whenever possible. They repaired or
reassigned reviews and references for Aberfeldy, Ballantine's, Black Velvet,
Auchentoshan, Balcones, Bowmore, Buffalo Trace, Canadian Mist, Compass Box,
Craigellachie, Cutty Sark, Dewar's, Dunville's, Fuji, George Dickel,
Glenmorangie, Glen Scotia, Glenlivet, Glendalough, Hard Truth, Heaven's Door,
Highland Queen, Jameson, Kilchoman, Knappogue Castle, Last Mountain, Longrow,
Lot No. 40, MacNair's, Maker's Mark, Mars, Masterson's, Midleton, Nikka,
Oban, Old Forester, OOLA, Overeem, Pendleton, Port Charlotte, Reference
Series, Reservoir, Royal Salute, Sazerac, Seagram's, Sons of Liberty,
Springbank, Stalk & Barrel, Stauning, Talisker, Tamdhu, The Antiquary, The
Black Grouse, The Famous Grouse, The Last Drop, Timorous Beastie, Tomatin,
Wild Turkey, and Woodford Reserve.

Post-write source reads caught one cross-release Oban assignment and the two
remaining active duplicate URLs. Those were corrected before the final
snapshot. Focused reads then confirmed that each duplicate URL has one active
review and one hidden, unassigned historical row.

## Unresolved records

- Bottle merges 43966 into 55983 (Old Fitzgerald) and 43944 into 44279 (Widow
  Jane) returned HTTP 500. Their records were left unchanged after the failed
  requests; the writes were not replayed blindly.
- Canonical BottleReference 25932 names New Riff Winter Whiskey Bottled in Bond
  Malted Oat and Chocolate Malt but remains on Bottle 13110 because canonical
  references cannot be reassigned through the supported update API. Review
  10627 and noncanonical exact reference 32184 are correctly assigned to Bottle 56655.
- Re-reviews and market-strength variants were retained when the source showed
  different editorial pages but did not provide enough evidence to decide
  whether Peated should use separate Bottle variants. Examples include
  Laphroaig 15-year-old 200th Anniversary at 40% and 43%, Royal Brackla at 40%
  and 46%, and older regional-strength reviews of ongoing products.

## Preventive code changes

- An explicit unpublished source record now hides legacy reviews whose content
  hash is absent. Grandfathering applies only when no publication record
  exists. This keeps the unpublished Whisky Advocate source out of public
  scores without deleting its history.
- The BottleReference repair path queues score-stat recomputation for both its
  old and new Bottles. This prevents stale review totals after manual identity
  repairs.

## Safety state

Whisky Advocate has an explicit unpublished review-source record and no active
schedule. Its latest manual run failed after emitting 218 observations. The
publication guard was corrected so an explicit unpublished record also
hides legacy migrated articles whose content hash is absent. This suppresses
their public display and score contribution without deleting review history.

## Review procedure

The audit used this procedure for the initial 4,636 attached Bottles:

1. Inventory every attached Whisky Advocate article, exact BottleReference,
   public Bottle alias, canonical Bottle field, Series link, and image source.
2. Identify the marketed release from the article URL and available publisher
   metadata. Confirm release facts with a producer or other independent source
   when the article does not establish them.
3. Classify each article as a confirmed exact match, confirmed wrong match, or
   unresolved. Do not infer identity from title similarity alone.
4. For a confirmed wrong match, detach the article before changing the broad
   reference that caused it. Re-identify it only when evidence supports an
   existing or newly created exact Bottle.
5. Change aliases and Bottle attributes only from direct evidence. Do not copy
   attributes from one annual release to another.
6. Preview every write batch with stable review, Bottle, alias, and reference
   IDs. Verify the same records through the production API after the write.

The cleanup uses the existing authenticated Bottle, alias, reference, and
external-review API routes. Each bounded batch is recorded in this audit before
it is applied.

## Sources

- [Buffalo Trace Distillery's 2018 Antique Collection announcement](https://cms.buffalotracedistillery.com/wp-content/uploads/2025/11/BTD20Sept201820201820Antique20Collection20201820News20Release.pdf)
- [Buffalo Trace Distillery's George T. Stagg release archive](https://www.buffalotracedistillery.com/our-brands/george-t-stagg/george-t-stagg-bourbon/)
- [Four Roses Limited Edition release archive](https://www.fourrosesbourbon.com/bourbon/limited-edition)
- [Four Roses 2016 Limited Edition Small Batch](https://www.fourrosesbourbon.com/blog/2016-limited-edition-small-batch)
- [Angel's Envy Cask Strength archive](https://www.angelsenvy.com/us/en/whiskeys/cask-strength/)
- [Angel's Envy 2022 Cask Strength Bourbon](https://www.angelsenvy.com/us/en/whiskeys/cask-strength/11th-edition-port-wine-cask/)
- [Angel's Envy 2023 Cask Strength Bourbon](https://www.angelsenvy.com/us/en/whiskeys/cask-strength/12th-edition-port-wine-cask/)
- [Angel's Envy 2026 Cask Strength Bourbon](https://www.angelsenvy.com/us/en/whiskeys/cask-strength/15th-edition-cask-strength-bourbon/)
- [Talisker 30 Year Old producer page](https://www.malts.com/en-us/products/talisker-30-year-old-single-malt-scotch-whisky)
- [Whisky Advocate's 2022 Talisker 30-year-old review](https://whiskyadvocate.com/Talisker-30-year-old-48-5)
- [Whisky Advocate's 2012 Talisker 30-year-old review](https://whiskyadvocate.com/Talisker-30-year-old-45-8)
- [Whisky Advocate's 2010 Talisker 30-year-old review](https://whiskyadvocate.com/Talisker-30-year-old-57-3)
- [Whisky Advocate's 2007 Talisker 30-year-old review](https://whiskyadvocate.com/Talisker-30-year-old-50-7)
- [2006 Talisker 30-year-old release details](https://www.htfw.com/talisker-natural-cask-strength-single-malt-scotch-30-year-old-whisky)
- [Four Roses 2014 Limited Edition Single Barrel announcement](https://www.fourrosesbourbon.com/blog/four-roses-new-limited-edition-single-barrel-is-a-toast-to-fans)
- [Four Roses 2011 Limited Edition Single Barrel details](https://whiskeyapostle.com/2012/01/four-roses-limited-edition-single-barrel-2011/)
- [Four Roses 2012 Limited Edition Single Barrel details](https://whiskeyapostle.com/2012/07/four-roses-2012-limited-edition-single-barrel/)
- [Four Roses 2013 Limited Edition Single Barrel details](https://whiskeyapostle.com/2013/09/four-roses-2013-limited-edition-single-barrel/)
- [Four Roses 2009 Limited Edition Single Barrel details](https://chuckcowdery.blogspot.com/2009/04/we-preview-2009-four-roses-single.html)
- [Writers' Tears Cask Strength 2018](https://www.walshwhiskey.com/1332/2018-writers-tears-cask-strength-whiskey-2/)
- [Writers' Tears Cask Strength 2019](https://www.walshwhiskey.com/1354/bernard-walsh-releases-cask-strength-2019/)
- [Writers' Tears Cask Strength 2020](https://www.walshwhiskey.com/1732/writers-tears-cask-strength-2020/)
- [Writers' Tears Cask Strength 2021](https://www.walshwhiskey.com/1873/2021-writers-tears-cask-strength/)
- [Writers' Tears Cask Strength 2022](https://www.walshwhiskey.com/2049/cask-strength-whiskey-writers-tears-2022/)
- [Writers' Tears Cask Strength 2023](https://www.walshwhiskey.com/2103/writers-tears-cask-strength-2023/)
- [Ardbeg's release history](https://www.ardbeg.com/en-gb/pages/history)
- [Whisky Advocate's 2009 Ardbeg Supernova review](https://whiskyadvocate.com/Ardbeg-Supernova-58-9)
- [Whisky Advocate's 2010 Ardbeg Supernova review](https://whiskyadvocate.com/Ardbeg-Supernova-2010-Release-60-1)
- [Whisky Advocate's 2019 Ardbeg Supernova review](https://whiskyadvocate.com/Ardbeg-Supernova-2019-Release-53-8)
- [Ardbeg Supernova 2009 release details](https://www.whiskynotes.be/2009/ardbeg/ardbeg-supernova/)
- [Ardbeg Supernova 2010 release details](https://www.diffordsguide.com/beer-wine-spirits/1816/ardbeg-supernova-2010)
- [Ardbeg Supernova 2014 release details](https://www.whiskybase.com/market/whisky/263115)
- [Ardbeg Supernova 2015 announcement](https://m.drinksint.com/news/fullstory.php/aid/5579/Ardbeg_Supernova_flavoured_from_space.html)
- [Ardbeg Supernova 2019 release details](https://www.caskers.com/ardbeg-supernova-single-malt-scotch-whisky-2019-edition/)
- [The Irishman Vintage Cask 2019](https://www.walshwhiskey.com/1357/vintage-cask-2020/)
- [The Irishman Vintage Cask 2020](https://www.walshwhiskey.com/1379/vintage-cask-2020-the-irishman/)
- [The Irishman Vintage Cask 2021](https://www.walshwhiskey.com/1866/walsh-whiskey-releases-the-2021-13th-edition-of-the-irishman-vintage-cask/)
- [Buffalo Trace Antique Collection](https://www.buffalotracedistillery.com/brands/buffalo-trace-antique-collection/)
- [Thomas H. Handy release history](https://lostcargo.com/article/history-of-the-buffalo-trace-antique-collection-which-whiskeys-were-included-each-year/)
- [Thomas H. Handy release-year reference](https://dewinespot.co/blogs/news/btac-thomas-h-handy-release-year-cheat-sheet)
- [Buffalo Trace's 2015 Antique Collection release details](https://www.distillerytrail.com/blog/buffalo-trace-distillery-releases-2015-antique-collection-whiskeys-90-to-138-proof/)
- [Whisky Advocate's 2020 Buffalo Trace Antique Collection review](https://whiskyadvocate.com/the-2020-buffalo-trace-antique-collection-reviewed-scores)
- [Kilchoman Inaugural 100% Islay](https://www.kilchomandistillery.com/our-whisky/inaugural-100-islay/)
- [Kilchoman 100% Islay 2nd Edition announcement](https://www.kilchomandistillery.com/distillery-news/2nd-edition-100-islay-release/)
- [Kilchoman 100% Islay 3rd Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-3rd-edition/)
- [Kilchoman 100% Islay 4th Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-4th-edition/)
- [Kilchoman 100% Islay 5th Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-5th-edition/)
- [Kilchoman 100% Islay 6th Edition archive](https://www.kilchomandistillery.com/our-whisky/2010-100-islay/)
- [Kilchoman 100% Islay 7th Edition announcement](https://www.kilchomandistillery.com/distillery-news/7th-edition-100-islay-available-worldwide-from-monday-1st-may/)
- [Kilchoman 100% Islay 8th Edition](https://www.kilchomandistillery.com/our-whisky/100-islay-8th-edition/)
- [Kilchoman 100% Islay 9th Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-9th-edition/)
- [Kilchoman 100% Islay 10th Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-10th-edition/)
- [Kilchoman 100% Islay 11th Edition announcement](https://www.kilchomandistillery.com/distillery-news/100-islay-11th-edition-has-been-released/)
- [Four Roses current Single Barrel specifications](https://www.fourrosesbourbon.com/buy)
- [Four Roses on OBSF in Private Selection Single Barrel](https://www.fourrosesbourbon.com/blog/our-fourth-rose-is-expanding-to-new-states)
- [Whisky Advocate's Four Roses Maisano's OBSF review](https://whiskyadvocate.com/Four-Roses-Single-Barrel-59-4)
- [Whisky Advocate's Four Roses Barrel 19-6J review](https://whiskyadvocate.com/Four-Roses-Single-Barrel-Barrel-N19-6J-50)
- [Whisky Advocate's Four Roses Barrel 29-50 review](https://whiskyadvocate.com/Four-Roses-Single-Barrel-Barrel-N29-50-50)
- [Whisky Advocate's Four Roses Barrel 55-6F review](https://whiskyadvocate.com/Four-Roses-Single-Barrel-Barrel-N55-6F-50)
- [Whisky Advocate's Four Roses Barrel 87-6L review](https://whiskyadvocate.com/Four-Roses-Single-Barrel-Barrel-N87-6L-50)
- [Whisky Advocate's Yellowstone 2015 review](https://whiskyadvocate.com/Yellowstone-Limited-Edition-2015-Release-52-5)
- [Yellowstone 2015 release details](https://bourbonblog.com/2015/08/07/yellowstone-bourbon-limited-edition-2015/)
- [Yellowstone 2016 release details](https://modernthirst.com/2016/12/07/yellowstone-limited-edition-2016-bourbon-review/)
- [Yellowstone 2018 release details](https://www.breakingbourbon.com/tnt/2018-yellowstone-limited-edition-bourbon)
- [Limestone Branch's 2019 blend description](https://limestonebranch.com/guide-to-whiskey-grains/)
- [Yellowstone 2019 release details](https://whiskeyreviewer.com/2019/11/yellowstone-limited-edition-bourbon-review-2019-111919/)
- [Limestone Branch's 2020 Armagnac-finished release](https://limestonebranch.com/2020-yellowstone-limited-edition-bourbon-armagnac/)
- [Limestone Branch's 2022 annual-release announcement](https://limestonebranch.com/press-release-yellowstone-2022-limited-edition/)
- [The Distillery at Lambertville](https://lambertvilledistillery.com/)
- [Whisky Advocate's Malloy Hall Peated review](https://whiskyadvocate.com/Malloy-Hall-Peated-43)
- [Whisky Advocate's Malloy Hall American Single Malt review](https://whiskyadvocate.com/Malloy-Hall-2025-43)
- [Whisky Advocate's Malloy Hall Rye review](https://whiskyadvocate.com/Malloy-Hall-Rye-43)
- [Whisky Advocate's Malloy Hall Bourbon review](https://whiskyadvocate.com/Malloy-Hall-43)
- [Whisky Advocate's Malloy Hall Sherry Cask Edition review](https://whiskyadvocate.com/Malloy-Hall-Sherry-Cask-Edition-43)
- [Whisky Advocate's Springbank 14-year-old Amontillado #305 review](https://whiskyadvocate.com/Springbank-14-year-old-Amontillado-Cask-N305-55-4)
- [Whisky Advocate's Springbank 14-year-old Fino #265 review](https://whiskyadvocate.com/Springbank-14-year-old-Fino-Cask-N265-55-3)
- [Whiskybase's Springbank 14-year-old Amontillado #305 record](https://www.whiskybase.com/whiskies/whisky/24498/springbank-14-year-old?language=en)
- [Whiskybase's Springbank 14-year-old Manzanilla #259 record](https://www.whiskybase.com/whiskies/whisky/24497/springbank-14-year-old?language=en)
- [Whiskybase's Springbank 14-year-old Oloroso #268 record](https://www.whiskybase.com/whiskies/whisky/24499/springbank-14-year-old?language=en)
- [Springbank 1996 Amontillado #305 release details](https://flaskfinewines.com/en-sg/products/springbank-1996-single-amontillado-cask-14-year-old-305-750ml)
- [Tomatin's Cù Bòcan archive collection](https://tomatin.com/cu-bocan/archive-collection/)
- [Tomatin's current Cù Bòcan collection](https://tomatin.com/cu-bocan/the-whisky/)
- [Tomatin's Cù Bòcan Signature specifications](https://tomatin.com/shop/cu-bocan/signature/)
- Peated production API reads made on 2026-09-10 for Whisky Advocate review,
  Bottle, Entity, alias, reference, source-publication, schedule, and run state.
- Peated Git commit `be07f0e24`, containing the retired importer behavior.
