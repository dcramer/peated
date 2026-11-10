# K&L Wine Merchants auction source check — 2026-11-10

This records what we checked on K&L's public auction pages before building the
`klwines` auction source. It is not legal approval. Source selection follows
the scraper's
[public-facts collection policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts),
not a search for explicit permission.

## Access

- Both `www.klwines.com` and `shop.klwines.com` answered every direct request
  with a Cloudflare managed check, including robots.txt. Pages also load
  DataDome. We did not get past either check by hand. Production requests go
  through PeatedBot, which signs with Cloudflare Web Bot Auth and falls back to
  Firecrawl only under the
  [blocked websites policy](../policies/blocked-websites.md). Every request
  the source makes is a plain GET, so the fallback can carry it.
- Robots: the archived `shop` robots.txt (January 2025) allows `/`. The
  archived `www` robots.txt (December 2025) does not block `/products/auctions`
  or `/auctions/`.
- **Terms risk.** K&L's terms (archived 2026-07-20,
  `shop.klwines.com/company/termsandconditions`) forbid using "robots, spiders,
  or other automated means to access, monitor, or copy material on the
  Website" without prior written consent. This is a direct clause about
  automated access, stronger than the Scotch Whisky Auctions republication
  clauses. The owner decided on 2026-11-10 to build the source anyway. It stays
  manual-only, and this clause is the first thing to revisit if K&L objects.

## Pages

The owner supplied saved copies of the pages below; the Wayback Machine had
older copies of the same shapes. Both are Next.js pages whose facts sit in the
`__NEXT_DATA__` script, so they survive a Firecrawl raw-HTML read.

**Spirits auction list** —
`www.klwines.com/products/auctions?filters=sv2_dflt-stock-all!110$eq$Spirits$True$`.
Filter `110 = Spirits` limits it to spirits; `dflt-stock-all` ("Include Out Of
Stock Items") keeps closed lots on the list. The `product-search` query holds
48 `records[].record` per page and `totalRecordsFound`. On 2026-11-10 there
were 1,195 open spirits lots and 1,767 with closed lots, so only the most
recent closed batch (October 31) was still listed. Results must be collected
within about two weeks of a batch closing.

Each record has `sku`, `itemName`, `lotVintagePrefix`, `productType`,
`varietal`, `lotItemCount`, `containerType`, `imageUrl` (on
`cdn.klwines.com`), `winningBidAmount`, `numberBids`, `auctionStartDT`,
`auctionEndDT`, `originalAuctionEndDT` (UTC), and `auctionStatus`. It has no
strength: `alcoholContent` is always 0.

- `auctionStatus` is `Active`, `Order_Complete` (sold; `winningBidAmount` is
  the hammer price), or `Ended_No_Win` (unsold, no bids; `winningBidAmount` is
  only the starting price).
- K&L sells in batches. Every lot in a batch starts on one day and ends on one
  day, with closings ten minutes apart from 9:40 AM Pacific (October 15–31 and
  November 1–14, 2026). A late bid extends that lot by two minutes and sets
  `originalAuctionEndDT`. There is no auction id.
- `varietal` is K&L's own category: Bourbon, Rye, Malt, Scotch, Irish,
  Canadian, and "Whisk(e)y - Other" for whisky, and Tequila, Cognac, Armagnac,
  Rum, Vodka, Gin, Brandy, and others for the rest. Japanese single malts are
  filed as Malt.
- The pager is script-only buttons. The page-2 URL was not yet confirmed when
  this was written.

**Lot page** — `www.klwines.com/auctions/bidding/<sku>`. The `GetAuctionContext`
query has `Lot` with `SKU`, `LotName`, `Status`, start and end times (Pacific,
no zone), bid amounts, `BuyerPremiumPercent` (10%), `LotDescription`, and
`LotItems[]`, each with `Quantity`, `BottleSize` (e.g. "750 ml"), `Condition`
(e.g. "Original box. Bottled 2024. 119 Proof."), `Provenance`, and `Country`.
A logged-out page carries the same data, so no account is needed.

## Decisions (owner, 2026-11-10)

- Group lots into auctions by original closing day in Pacific time. The lot
  key is the SKU.
- Read every single-bottle whisky lot page during collection, so the first
  match has the page's size and stated facts.
- Use K&L's `varietal` to skip non-whisky lots before reading their pages.

## What is kept

Lot SKU, title, link, photo link, size, the item's condition note, stated
proof and bottling year, state, end time, current bid, and the sold or unsold
outcome. Descriptions, tasting notes, reviews, provenance, and bidder details
are not kept. K&L's vintage field is not stored as a fact, because K&L uses it
for distillation, release, and batch years alike; it stays in the title.
