# Simple Rating System (Pass/Sip/Savor)

## Overview

Peated's current tasting rating is a three-point whisky-themed choice. The
system keeps the decision quick while preserving an unrated tasting as a valid
record.

Each tasting rates one selected, independently complete Bottle. Users never
rate a BottleGroup or an unspecified release family. A related-release page may
display a group summary derived from member Bottle activity, but it still
creates no group-owned tasting.

## The Scale

### Pass (`-1`)

Would not drink again.

### Sip (`1`)

Enjoyable; would have occasionally.

### Savor (`2`)

Excellent; would seek out.

### No rating (`null`)

The tasting is recorded without a rating.

## Recording A Tasting

1. The user selects a Bottle.
2. The tasting form keeps that Bottle fixed.
3. The user chooses Pass, Sip, Savor, or leaves the tasting unrated.
4. The server validates the active Bottle and stores its `bottleId` with the
   tasting.

The form does not submit BottleGroup identity, a representative Bottle, or a
Bottle/BottleRelease pair.

## Rating Summaries

### Bottle Summary

A Bottle summary uses only tastings assigned directly to that Bottle.
Related-release activity is not folded into the Bottle's own score.

### Related-Release Summary

A BottleGroup summary queries raw tastings across its active member Bottle ids
and counts each row once. It does not:

- own generic or direct group tastings;
- choose the representative as an activity destination; or
- sum materialized Bottle totals.

The group summary is presentation for “similar bottles” or “other releases,”
not another rating identity.

### Counts

- `totalTastings` includes rated and unrated tastings.
- Pass/Sip/Savor counts, percentages, and the average use rated tastings only.
- A Bottle or group with no rated tastings has zero percentages and a null
  average.

## Historical Ratings

The migration to Pass/Sip/Savor preserved the original five-star value in
`rating_legacy` and converted the active rating:

- `<= 2.0` became Pass;
- `> 2.0` and `<= 4.0` became Sip;
- `> 4.0` became Savor.

Current tasting writes use only Pass/Sip/Savor. The retained legacy value is
historical data, not a second live rating choice.

## User Interface

- `SimpleRatingInput` provides the tasting-form selector.
- `SimpleRatingDisplay` renders one tasting's choice.
- `SimpleRatingStats` renders aggregate distribution and percentages.
- Bottle lists may use the stored average for sorting or a compact indicator.
- Bottle pages show Bottle-owned statistics; related-release pages may show the
  member-derived group summary separately.

## Identity And Migration Notes

- `tasting.bottleId` is authoritative.
- A retained `releaseId` column may exist temporarily as migration evidence,
  but live rating reads, writes, and aggregates ignore it.
- Parent-only historical tastings remain on the retained general Bottle.
- Release-specific historical tastings move to the Bottle recorded by the
  durable release-promotion mapping.
- BottleRelease cleanup remains backup- and approval-gated; it is not required
  for direct-Bottle rating behavior.

## Accessibility

Rating controls must expose text labels and selected state without relying on
emoji or color alone. Keyboard and screen-reader users must be able to choose
or clear a rating.
