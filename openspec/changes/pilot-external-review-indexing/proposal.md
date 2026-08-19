## Why

Peated has enough catalog identity to become a useful review index, but its
current external-review model assumes one scored bottle per URL and cannot
represent multi-bottle articles, native score scales, authors, dates, or short
attributed summaries. The first pilot should prove that an approved publisher
archive can be indexed accurately and send readers to the canonical article
without republishing the review.

## What Changes

- Add a `review_article` record that owns canonical article metadata and can
  contain several Bottle reviews.
- Preserve each publisher's native score and scale; continue exposing a
  normalized 0-100 value where current consumers require it.
- Store a short Peated-generated summary with source and model provenance, but
  do not persist or display full publisher article text or photography.
- Require an explicit approved acquisition and display policy before a source
  can fetch articles, generate summaries, or publish reviews.
- Add one vertical pilot for up to two approved publishers, with WhiskyNotes
  preferred for archive ingestion and Dramface preferred for ongoing and
  multi-bottle ingestion.
- Display pilot reviews on Bottle pages with publisher, reviewer, date, native
  score, short attributed summary, and a prominent canonical link.
- Migrate existing external reviews to the review-article model without
  changing current public review availability.
- Exclude critic consensus, release-news aggregation, publisher self-service,
  copied excerpts, and generalized arbitrary-site crawling from this pilot.

## Capabilities

### New Capabilities

- `external-review-indexing`: Permission-gated ingestion, storage, Bottle
  matching, and referral-oriented display of review articles and their Bottle
  reviews.

### Modified Capabilities

None.

## Impact

- Changes the external-review database schema and internal ingestion boundary.
- Replaces the one-URL-per-review assumption used by the Whisky Advocate job
  while preserving its existing review rows and public behavior.
- Adds source policy, article ingestion, summary generation, and Bottle-page
  presentation across `apps/server` and `apps/web`.
- Requires a publisher agreement or other explicitly approved policy before a
  pilot source is enabled in production.
