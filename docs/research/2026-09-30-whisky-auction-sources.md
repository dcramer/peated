# Whisky auction source check — 2026-09-30

This is a bounded check of public collection surfaces, not legal approval.
Accessible pages and robots rules do not grant a reuse licence. No source is
activated by this audit.

## Scotch Whisky Auctions

Checked the public [auction index](https://www.scotchwhiskyauctions.com/auctions/),
[183rd auction](https://www.scotchwhiskyauctions.com/auctions/232-the-183rd-auction/),
its final page (`?page=233`), [terms](https://www.scotchwhiskyauctions.com/terms/),
and [robots file](https://www.scotchwhiskyauctions.com/robots.txt).

The index exposes numeric event keys in auction paths. Lot paths include a
different numeric lot key and titles. Public tiles expose displayed lot numbers
and explicit sold amounts. The 183rd auction showed 4,645 lots across 233 pages
with 20 rows on normal pages. `#nextpage` supplies the next page number and is
absent on the final page. A `perpage=500` GET parameter did not increase the
page size; the collector does not rely on it.

Structural selectors checked in returned HTML: `.auctions a.auction`, the
auction heading under `#lotswrap`, `#lots a.lot`, `h4` titles, `h6` lot numbers,
`[id^=info_]` result text, and `#nextpage` pagination. The explicit sold marker
is `Sold for £…`. A highest or winning bid alone does not prove a sale. The
source's buyer terms distinguish the lot price from premiums and taxes, and
the checked detail page's winning bid agreed with its sold tile amount.

An older public detail page returned a closed winning-bid box while a cached
reader showed older live labels. The collector uses explicit result evidence,
not a bid label or a cached page's implication of sale. There was no currently
open auction available in the check. Live-heading handling needs a fresh open
auction verification before activation. Date-only closing headings are not
converted into invented precise deadlines or sale times.

The robots file excluded `/cmsplus/`, not the checked public auction paths.
The checked terms forbid automated bidding specifically. No general collection
prohibition was found in the checked terms, but they also assert copyright.
That is not affirmative permission for automated aggregation or republication.
An operator must settle permitted use before enabling the target.

The code starts disabled with no automatic interval and a 120-request/hour
limit. Two similarly sized auctions need roughly 466 listing requests, plus
discovery and robots checks. At that pace a full run can take almost 4 hours.
Capacity must be measured before choosing an interval; hourly full scans are
not supported by that budget. Initial scope retains normalized facts and source
links, not source prose, photographs, bids, or member details.

## Other checked candidates

- [Whisky Hammer](https://www.whiskyhammer.com/previous-auctions): the public
  archive exposed stable event paths such as `/auction/past/auc-136/`, but the
  attempted event/lot reads returned 403. No bypass was attempted. It is not
  implemented.
- [Whisky Auctioneer](https://whiskyauctioneer.com/): a checked lot's hammer
  price required sign-in. Public-only collection would have to retain an
  unknown price when it is not published publicly. It is not implemented.

These checks do not establish that either alternative allows scraping. A new
source needs its own current terms, robots, identifiers, and result audit.
