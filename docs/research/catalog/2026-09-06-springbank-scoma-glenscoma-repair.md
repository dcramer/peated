# Springbank SCOMA and Glenscoma record repair — September 6, 2026

This production repair reviewed the four legacy Springbank records bottled by
SCOMA or its historic Glenscoma label: `B0531`, `B0736`, `B3624`, and `B3902`.
Two uniquely identified records were updated. Two other records could not be
identified because their saved names and incorrect ages did not distinguish the
marketed releases.
After confirming that the unresolved records had no tastings, collection users,
prices, reviews, images, or aliases, both unsupported placeholders were deleted
with explicit approval. No Bottle was created or merged.

- SCOMA's search-indexed
  [1991/2021 30-year-old page](https://www.scoma.de/en/springbank-30-years-1991-2021-sherry-cask-finish.html),
  which returned 404 during the live check, and the readable label on the exact
  [retailer listing](https://www.nicks.com.au/products/1991-scoma-springbank-30-year-old-single-malt-scotch-whisky-500ml)
  established `B0531` as the 30-year-old cask 222 release: SCOMA Brand and
  bottler, Springbank distillery, 1991 vintage, 2021 bottling, single oloroso
  sherry cask finish, 47.2% ABV, and 226 bottles. The label and producer page do
  not state cask strength, so that field remains unknown. The retailer prose
  incorrectly calls 222 the bottle count; the readable label shows it is the
  cask number and separately states 226 bottles.
- The exact [Whiskybase record](https://www.whiskybase.com/whiskies/whisky/73504/springbank-1995-gs)
  and the readable label on a retailer's
  [cask 42 listing](https://www.whisky-maniac.de/p/springbank-1995-2015-glenscoma-refill-port-cask-42)
  established `B3902` as the SCOMA 20-year-old 1995/2015 single refill Port
  cask release at 53% ABV, with 537 bottles. Its label says the whisky spent 5
  years in Campbeltown and 15 years on Islay. The old 25-year shared age was
  cleared, and the unsupported cask-strength field remains unknown.
- SCOMA's company Entity `E366480` received the label-proven short name `SCOMA`
  and now fills the Brand and bottler relationships for both resolved Bottles.
  Historic Glenscoma Entity `E5212` was not merged or renamed.
- `B0736` was deleted because its saved reference, “Springbank 1993 Gs,” is not
  unique, and the stored 10-year age matches no SCOMA or Glenscoma release
  found. Candidates include the
  [12-year-old cask 7](https://www.whiskybase.com/whiskies/whisky/60127/springbank-1993-gs)
  and two different 24-year-old 2018 releases documented by
  [SCOMA](https://www.scoma.de/de/springbank-1993-2018-24-jahre-refill-sherry-cask.html)
  and [Whiskybase](https://www.whiskybase.com/whiskies/whisky/115980/springbank-1993-gs).
  Its public ID is reserved by a tombstone, and reference 12815 is now
  unassigned.
- `B3624` was deleted because the saved “Single Sherry Cask” name could mean
  either the 22-year-old cask 334 documented by
  [SCOMA](https://www.scoma.de/de/springbank-22-jahre-1993-2015-dark-sherry-cask.html)
  and [Whiskybase](https://www.whiskybase.com/whiskies/whisky/73501/springbank-1993-gs),
  or the [23-year-old cask 335](https://www.whiskybase.com/whiskies/whisky/86980/springbank-1993-gs).
  Its stored 27-year age matches neither. Its public ID is reserved by a
  tombstone, and reference 14231 is now unassigned.
- Whiskybase's [Glenscoma inventory](https://www.whiskybase.com/whiskies/bottler/77432/whiskies)
  was used to check the wider historical release set and the ambiguous names.
  In these records, `Gs` is Whiskybase's bottler abbreviation rather than a
  marketed Bottle name. SCOMA's own page identifies SCOMA as the independent
  bottler and says the name is also known as Glenscoma. Exact source and
  retailer images had no stated reuse permission, so no Bottle image was copied.
