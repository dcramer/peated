# Whisky Auctioneer catalog audit

This directory contains the durable results of a one-time catalog audit that
started on September 2, 2026. The audit compared a public Whisky Auctioneer
snapshot with the Peated production catalog.

This is a point-in-time mapping. It is not a scraper, a live feed, or a claim
that either catalog is complete. Peated IDs can later redirect after a merge.
Re-fetch a Bottle before using an archived mapping in a production workflow.

## Results

- The review inventory contained 835 rows.
- The consolidated result file contains 724 rows for 717 distinct audit rows.
- The audit added 210 Bottle rows and skipped 376 unresolved rows.
- Another 138 rows matched, reconciled, or documented existing Bottles.
- The captured upstream snapshot contained 4,542 lots across 25 pages and
  3,271 distinct titles.
- The normalized source map contains 930 relationships for 924 distinct lot
  IDs.

See `summary.json` for exact counts and SHA-256 hashes of both CSV files.

## Files

### `audit-results.csv`

This is the final human-readable audit ledger. Each row records the upstream
audit row, the result, the Peated ID or possible ID, fields left blank, the
decision reason, and evidence URLs.

Some audit rows appear more than once when one generic upstream title resolved
to several distinct releases. The `source_urls` field uses `|` to separate
multiple URLs.

### `whisky-auctioneer-lot-map.csv`

This is the normalized join file for future upstream work. Each row contains a
Whisky Auctioneer lot ID and one audit relationship. A lot can appear more than
once if it informed more than one audit row or result.

Use `mapping_kind` carefully:

- `final_evidence` means the source URL appears in the final audit result.
  `peated_ids` contains only IDs from an added or verified existing result.
- `review_lead_only` means the source URL helped locate a candidate but was not
  used as final URL-level evidence for a Peated mapping.
- `possible_peated_ids` contains unresolved candidates. Do not treat these as
  matches.

Rows without `peated_ids` do not establish an upstream-to-Peated mapping. A
`final_evidence` row can have no Peated ID when the audit skipped the release.

## Deliberate exclusions

The archive does not contain the raw 4,542-lot snapshot, downloaded bottle
images, API responses, access tokens, or transient runner state. These files
were not needed for a durable catalog join and would add stale or sensitive
operational data to the repository.

Source URLs remain in the CSV files for provenance. They do not grant matching
authority by themselves. Future catalog writes must still follow the Catalog
Maintenance workflow and Whisky Identity Model.
