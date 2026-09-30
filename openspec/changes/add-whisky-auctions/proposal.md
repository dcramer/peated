## Why

Members need to discover whisky currently offered at auction and see previous sale results for the same Peated Bottle. Retailer prices cannot represent individual auction occurrences, closing deadlines, unsold lots, or corrected hammer prices.

## What Changes

- Store auction events, individual lots, and append-only result revisions with stable source identifiers.
- Resolve lots to complete Bottle records using accepted references, the Bottle classifier, and reviewed assignments.
- Show live availability and past results on Bottle pages; distinguish stale availability, current bids, hammer prices, and aftersales.
- Allow members to watch a Bottle for in-app auction availability alerts with durable duplicate prevention.
- Collect auctions through the existing scraper runtime and preserve history when lots close or are relisted.
- Keep single-bottle lots, original currencies, source evidence, and unknown facts explicit.

## Capabilities

### New Capabilities

- `whisky-auctions`: Auction occurrence identity, collection, Bottle matching, availability, result history, and member alerts.

### Modified Capabilities

None. Auction collection extends the scraper runtime without changing existing source semantics.

## Impact

Server database schema and generated migrations, auction ingestion and matching, scraper sources and sinks, worker jobs, public auction and private watch APIs, notification serialization, Bottle detail UI, focused integration tests, and auction architecture/source documentation. No production migration or source activation is part of local implementation.
