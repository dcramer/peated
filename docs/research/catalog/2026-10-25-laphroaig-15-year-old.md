# Laphroaig 15-year-old bottlings — October 25, 2026

Where to find facts about Laphroaig 15-year-old from its 1985 launch to the
2026 relaunch, and how to tell its bottlings apart. The identity rule this
follows is in "Who Is The Brand, Series, And Bottler" in
`docs/architecture/whisky-identity-model.md`, next to "A different package does
not make a different Bottle."

## The bottlings

| Bottling                          | Label and size                                   | Strength | Sources                                                           |
| --------------------------------- | ------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| 1980s UK                          | `Unblended Islay Malt`, red `15`, 75cl, tin      | 40%      | Whisky Vault, The Whisky Exchange, whisky.auction, Whiskynotes    |
| 1980s export (Italy and others)   | `Unblended Islay Malt`, 75cl, tin                | 43%      | Whisky Auctioneer, Rhum & Whisky, Whiskybase lists                |
| 1990s–2009 core                   | `Single Islay Malt`, 70cl (75cl in some markets) | 43%      | Scotch Whisky Auctions lots, The Whisky Exchange, Wikimedia photo |
| 1994 Cancer Relief Macmillan Fund | Presentation bottle, numbered, 254 bottles, 70cl | 43%      | whisky.auction lot 152524                                         |
| 2015 200th Anniversary            | 70cl, 72,000 bottles                             | 43%      | Whisky Auctioneer, Whiskey Reviewer                               |
| 2026 core relaunch                | 70cl, non-chill-filtered, American oak           | 46%      | Master of Malt, The Whisky World, ReserveBar, The Whisky Wire     |

## Where the facts live

- The label is the best source. The 1980s label reads
  `Unblended Islay Malt Scotch Whisky`; later labels read `Single Islay Malt`.
- [Whisky Auctioneer](https://whiskyauctioneer.com/lot/6130541/laphroaig-15-year-old-1980s-cinzano-import)
  titles the Italian bottle `Laphroaig 15 Year Old 1980s / Cinzano Import`.
- [Rhum & Whisky](https://rhumandwhisky.com/eng/product/laphroaig-15-yo-1980s-cinzano-import-75cl-43)
  lists the Cinzano import as 1980s, 75cl, 43%.
- [The Whisky Vault](https://www.thewhiskyvault.com/laphroaig-15-year-old-unblended-uk-eighties-bottling-with-tin-5750-p.asp)
  describes the UK bottle as `Unblended`, 75cl, 40%, pre-Royal Warrant, with a
  red `15` and a tin.
- [whisky.auction lot 68637](https://whisky.auction/auctions/lot/68637/laphroaig-15-year-old)
  (75cl, 40%, bottled 1980s) and
  [Whiskynotes](https://www.whiskynotes.be/?p=48450) (40%, late 1980s) confirm
  the UK strength.
- Whiskybase user lists show `15-year-old Unblended Islay Malt Scotch Whisky`
  at 750 ml in both 43% and 40%.
- [whisky.auction lot 152524](https://whisky.auction/auctions/lot/152524/laphroaig-15-year-old)
  describes the Macmillan bottle: a cask signed by the Prince of Wales in June
  1994, numbered out of 254, for the `Cancer Relief Macmillan Fund`. That was
  the charity's name from the 1980s until it became Macmillan Cancer Relief.
- [Master of Malt](https://www.masterofmalt.com/whiskies/laphroaig/laphroaig-15-year-old-whisky/)
  describes the 2026 bottle: permanent, American oak, 46%, no chill
  filtration. [The Whisky Wire](https://thewhiskywire.com/2026/07/14/laphroaig-relaunches-its-15-year-old-single-malt/)
  dates the announcement to July 2026.

## Access limits

- The Whisky Exchange and Astor Wines serve a Cloudflare bot check to fetch
  tools and to agent-browser. Their search snippets are leads only. The Whisky
  Exchange has pages for mid-1980s (75cl, 43%), late-1980s (75cl, 40%),
  1980s, and 1990s (70cl, 43%) bottlings: `/p/49982`, `/p/3400`, `/p/19945`,
  `/p/81944`, `/p/11506`.
- Master of Malt returns 429 to fetch tools; agent-browser reads it.
- Scotch Whisky Auctions and whisky.auction lot pages fetch normally.

## Traps

- "1985" in auction and retailer text is the expression's launch year. Do not
  store it as the bottling or release year of any bottle.
- Store listings titled only `Laphroaig 15-year-old` in 2026 are the 46%
  relaunch, not the 43% core bottle. That plain title is too general to be a
  Bottle reference.
- Strength separates the UK bottle (40%) from the export bottle (43%).
- The importer strip (`Importato da Francesco Cinzano`) only marks the market.
  It goes in a Bottle reference, not the edition or the bottler.
- A 75cl bottle at 43% with a tube, sold as "discontinued", is a 1990s–2000s
  core bottle for a 75cl market, not a 1980s bottle.
- Rue Pinard's product pages and blog are sales copy. Their claim that the
  Cinzano bottle has a screw cap is unconfirmed.
- Retailer and auction photos of these bottles carry no reuse grant.

## Unknowns

- One undated source says the label went from a red `15` to red and white in
  the early 1990s, then black in the late 1990s. No source shows whether the
  wording or strength changed with it.
- A Grand Whisky Auction lot is titled `Friends of Laphroaig 90s` (70cl, 43%).
  The page does not say whether the label prints that name or whether it is a
  separate release.
- Whether other importers' strip labels exist for the 43% `Unblended` bottle.
- No dated producer source covers the years each label was in use.
