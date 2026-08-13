## Why

Store scrapers can already receive authoritative structured Bottle facts, but
store-price ingestion discards them and pays image extraction to rediscover
them. The classifier's shared web allowance can then be exhausted by discovery
queries before it verifies an exact source page, increasing cost while making
false `no_match` outcomes more likely.

## What Changes

- Let store-price inputs carry normalized provider-owned Bottle facts through a
  strict `sourceBottleIdentity` contract and persist them with the listing.
- Seed price classification from those facts so image extraction remains a
  fallback instead of mandatory work.
- Let complete, conflict-free scraper facts satisfy the auto-create evidence
  gate when the classifier reports no unresolved identity risk.
- Preserve Douglas Laing's structured vendor, product type, ABV, age/cask
  markers, and finish wording without inferring a bottler or release year.
- Bound Firecrawl to at most two search queries and one independently reserved
  basic-proxy page read per classifier run.
- Allow the reserved page read to inspect the submitted `reference.url` as well
  as a discovered result.

## Capabilities

### New Capabilities

- `cost-bounded-bottle-evidence`: Normalized scraper facts and separately
  bounded discovery/verification evidence for Bottle classification.

### Modified Capabilities

None.

## Impact

- `StorePriceInputSchema`, `store_price`, price ingestion, and price matching.
- Douglas Laing scraper parsing and regression fixtures.
- Bottle-classifier web tools, default configuration, tests, and architecture
  documentation.
- One additive nullable JSONB database column.
