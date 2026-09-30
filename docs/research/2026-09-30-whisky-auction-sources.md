# Whisky auction source check — 2026-09-30

This is a bounded check of public collection surfaces, not legal approval.
Source selection follows the scraper's
[responsible public-facts collection policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts),
not a search for explicit permission. No source is activated by this audit.

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
auction verification before automatic collection. Date-only closing headings are not
converted into invented precise deadlines or sale times.

The robots file excluded `/cmsplus/`, not the checked public auction paths.
The checked terms forbid automated bidding specifically. Rechecking the terms
also found broad restrictions under "Availability" on redistribution and
republication, and under "Links to this website" on linking without written
consent. The initial audit missed those clauses. Record them as source-specific
risks for factual discovery and referral; do not label the source as granting
permission or treat an affirmative licence as the collection prerequisite.

The initial implementation shipped disabled. The manual rollout enables the
target without an automatic interval and retains the 120-request/hour limit.
Two similarly sized auctions need roughly 466 listing requests, plus
discovery and robots checks. At that pace a full run can take almost 4 hours.
Capacity must be measured before choosing an interval; hourly full scans are
not supported by that budget. Initial scope retains normalized facts and source
links, not source prose, photographs, bid histories, or member details.

The rollout check used `PeatedBot/1.0 (+https://peated.com/bot)` for five
public GET requests: robots, discovery, the 183rd auction's first and final
pages, and the 182nd auction's first page. Requests were at least 30 seconds
apart. The actual adapter parser returned event keys `232` and `231`, closed
lots with sold results, and a null next page on page 233. The first page had
20 tiles and 19 supported single-bottle lots; the final page had 5. No sign-in,
photographs, descriptions, or member data were needed. This was a bounded
parser check, not a completed production run or live-auction verification.

## Other checked candidates

- [Whisky Hammer](https://www.whiskyhammer.com/previous-auctions): the public
  archive exposed stable event paths such as `/auction/past/auc-136/`, but the
  attempted event/lot reads returned 403. No bypass was attempted. It is not
  implemented.
- [Whisky Auctioneer](https://whiskyauctioneer.com/): a checked lot's hammer
  price required sign-in. Public-only collection would have to retain an
  unknown price when it is not published publicly. It is not implemented.

These checks establish access limits, not permission. A new source needs its
own current robots, terms, request-capacity, identifier, and result checks under
the public-facts policy. Explicit permission is not part of that checklist.
