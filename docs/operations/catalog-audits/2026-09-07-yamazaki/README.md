# Yamazaki catalog audit

This directory contains the durable results of the Yamazaki production catalog
audit completed on September 7, 2026. The audit covered current and historical
Yamazaki releases, including named ranges, annual editions, private releases,
The Cask of Yamazaki, Suntory Single Cask Whisky, SMWS releases, and The Owner's
Cask.

This is a point-in-time record, not a claim that every private Yamazaki cask
ever bottled has surviving public evidence. Re-fetch every Bottle before using
an ID or fact in a later production workflow.

## Results

- The audit created 353 intended Bottle records: 233 Owner's Casks and 120 other
  Yamazaki releases.
- It applied 14 evidence-backed corrections to existing Bottles and uploaded 2
  exact, reusable licensed images.
- Sixty-six candidate payloads already resolved to live Bottles and were
  skipped.
- Every changed Bottle was re-fetched. Final reconciliation matched all 233
  Owner's Cask casks and all 186 other candidate identities.
- One transient OCR duplicate remains pending explicit merge approval:
  `B55209` (`IO70047`) is the same marketed release as canonical `B54418`
  (`1O70047`).
- The correct regular Yamazaki no-age-statement image is on `B51072`. The
  wrong copy remains on `B51688` because the production Bottle-image API has
  no removal operation.

## Files

### `evidence.md`

The evidence file preserves exact source pages, coverage, conflicts, unresolved
questions, image reuse findings, and the chronological production notes from
the audit. It includes intermediate counts to show how the work list changed;
use the final execution section for completed counts.

The archive deliberately excludes API responses, downloaded images, access
tokens, and temporary request payloads. Source URLs remain evidence, not
authority for future writes. Later catalog work must still follow Catalog
Maintenance and the Whisky Identity Model.
