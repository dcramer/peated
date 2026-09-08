## Why

Peated has enough catalog identity to become a useful review index, but its
current external-review model assumes one scored bottle per URL and cannot
represent multi-bottle articles, native score scales, authors, or dates. The
first pilot should prove that a publisher archive can be indexed accurately
and send readers to the canonical article without republishing the review.

## What Changes

- Add a `review_article` record that owns canonical article metadata and can
  contain several Bottle reviews.
- Preserve each publisher's native score and scale; continue exposing a
  normalized 0-100 value where current consumers require it.
- Require explicit approval before Peated publishes reviews from a source.
- Add one vertical pilot for up to two publishers, with WhiskyNotes for archive
  ingestion and the existing Whisky Advocate source for a bounded second
  pilot. Keep Dramface as a later multi-bottle candidate.
- Display pilot reviews on Bottle pages with publisher, reviewer, date, native
  score, and a prominent canonical link.
- Migrate existing external reviews to the review-article model without
  changing current public review availability.
- Exclude critic consensus, release-news aggregation, publisher self-service,
  copied excerpts, and generalized arbitrary-site crawling from this pilot.

## Capabilities

### New Capabilities

- `external-review-indexing`: Ingestion, storage, Bottle matching, publication
  approval, and referral-oriented display of review articles and their Bottle
  reviews.

### Modified Capabilities

None.

## Impact

- Changes the external-review database schema and internal ingestion boundary.
- Replaces the one-URL-per-review assumption used by the Whisky Advocate job
  while preserving its existing review rows and public behavior.
- Adds publication approval, article ingestion, and Bottle-page presentation
  across `apps/server` and `apps/web`.
- Requires current robots and terms checks before a pilot source is enabled in
  production.
