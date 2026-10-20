# SMWS Glen Ord review

Reviewed every existing Glen Ord SMWS record, codes 77.1 through 77.78 where
represented, against UK and US producer archives, regional producer pages,
contemporary tasting records, exact auctions and readable labels. The complete
UK public archive response and all seven US product sitemaps yielded 28 relevant
product pages, covering 25 distinct releases. They are not complete historical
archives. Japanese and Taiwanese producer pages supplied 77.44 and 77.77.
Individual findings and exact sources are in [release-review.csv](release-review.csv).

The producer's [whisky policy](https://smws.co.nz/our-whisky) establishes that its
single-cask whiskies are bottled without water, colouring or filtration. The
[July 2026 outturn](https://smws.shorthandstories.com/July-Outturn-26/) also
expressly describes the long-standing no-colour/no-chill-filtration policy.
These statements support filling unknown cask-strength, natural-colour and
non-chill-filtered fields on the identified single-cask releases.

[Unfiltered issue 41](https://www.smws.ca/assets/covers/Unfiltered-2018-4-issue-41-1.pdf)
dates the 26 Malts collection to 2005. Exact Sotheby's and Scotch Whisky Auctions
collection inventories identify 77.10 and 77.11. Both belong to the existing
SMWS-owned 26 Malts Series 1303. The 50cl packaging does not create another Bottle.
Flavour profiles and distillery code 77 were not invented as product Series.

## Corrections and source problems

- The US producer pages label a number as **USA allocation**. Only the global
  count printed on the exact label was used as outturn. Counts and vintage
  years were added where missing; maturation was clarified from producer text.
- 77.69's “Exclusive to February Packages” is a website promotion absent from
  its label. Removed from the stable product name.
- 77.73's UK structured product metadata says57.0%; its label says57.4%.
  The earlier correction to57.4% is retained.
- 77.75's readable label says138 bottles, not108. Its finish is an Oloroso
  barrique; generic STR metadata does not replace that detail.
- 77.7 has incompatible collector identities:1987/17/58.3%/2005 and
  1985/13/53.4% “Jam roly poly”. No independent label resolved the discrepancy.
- 77.15: contemporary Whisky-news tasting says54.5%, a collector lead54.4%.
  ABV remains unknown. 77.41: auction metadata61.8% conflicts with stored61.4%;
  auction image access failed406 and exact name/strength searches did not
  establish a correction. Existing strength remains flagged.
- 77.45: a contemporary event report59.8% conflicts with the owner's59.6%
  tasting entry. Preserve stored59.6%. 77.54's auction description says60.1%
  despite its own59% title, and refill despite a contemporary first-fill review.
- 77.63: owner says hogshead, auction says barrel. Existing barrel retained
  pending a readable exact label. 77.26's owner review transposes264 to246;
  exact auction supports264. Review, auction and image-file dates were not
  treated as release or bottling dates.
- US77.71 is labelled “Serial thriller”; a UK title lead “Oat so sticky” was
  not added without producer evidence. Existing77.74 “Oh my darling” alias
  remains. No ambiguous import reference was assigned.

## Missing-release search

- **77.46 Relaxation therapy**: created from the bar's own readable front
  labels at [Union Jack](https://unionjackwhiskykarte.wordpress.com/2026/07/07/_smws-77-46/).
  They show15 years,57.7%,23April2002,202 bottles and refill bourbon barrel.
  Its web text says bottled2015, inconsistent with the label's age and vintage;
  that date was not copied. Live exact code and name searches found no existing
  record before creation.
- **77.4**: code,1984/60.3%, Glen Ord and auction variants found only a
  collector lead for1995. No independently supported create.
- **77.5 Champagne on a summer day**: code, subtitle,1985/13/53.5% and
  regional searches did not find independent exact evidence. Left unresolved.
- **77.6 An alfresco malt**: code, subtitle,1985/13/54.8% and auction searches
  likewise found only collector evidence. Left unresolved.
- **77.40 New carpet in a sweetie shop**: created after finding a readable
  [retailer label](https://caskcartel.com/products/glen-ord-smws-society-cask-no-77-40-2003-12-year-old-whisky-700ml).
  It shows 12 years, 61.9%, 17 April 2003, 276 bottles and refill bourbon
  hogshead. A separate 2017 owner's account confirms code, age and distillery.
  Earlier code/name/regional searches had found only collector evidence;
  the exact label resolved the identity. No bottling date was inferred.

## Images and access

All26 stored SMWS images were visually inspected. Twenty-five exact producer
page matches were established from UK and US product pages, and their canonical
page URLs saved in the research record. The API rejects imageSourceUrl in a
Bottle PATCH as read-only; existing production provenance remains unchanged. The77.9
Whisky Situation source was already canonical. Existing images were preserved;
no source granted reuse permission for new uploads. The bar's77.46 photographs
were used to read its label, not republished. Australian archive requests
returned403 and were not bypassed. Whiskybase remained discovery-only through
search snippets; its pages and images were not collected.

No merger, deletion or new public-name alias was made. Missing dates, cask
facts and counts remain unknown unless the individual source proves them.
