# External Review Sources

Use this guide to add, publish, stop, or remove an external review source. Read
[External Reviews](../features/external-reviews.md), the
[Scraper Runtime](../../apps/server/src/scraper/README.md), and the
[source research](../research/external-review-source-audit-2026-08.md) first.

## Add A Source

1. Check the publisher's current robots rules and public terms. Define the exact
   pages, request pattern, and limits. Do not work around a block or rate limit.
2. Add the source through the scraper runtime. Follow its registration, request,
   checkpoint, and test rules.
3. Run it locally against current public pages. Check its status, request count,
   cursor, and emitted items.
4. Deploy the source unpublished. Run it once and review the hidden sample in
   Admin → Scrapers. Check extraction accuracy, Bottle matches, and Sentry.
5. Record the reviewed sample and administrator approval. Publish only when the
   sample has no known wrong public Bottle match and extraction errors are
   understood.

The adapter must not access the database, select a Bottle, decide visibility,
or call a model. The shared sink owns those actions. Emit an item before saving
its next checkpoint so replay remains safe. A malformed review page must fail;
do not skip it as a non-review.

Keep source-specific URLs, limits, schedules, and parsing rules in the registry,
adapter, and tests. Do not copy them into this guide.

## Set Up Review Scores

In Admin → Sites → the source's settings, open **Review scores**. Moderators
can change these settings for built-in and configured review sources.

1. Read the current scoring guide and compare reviews of the same exact bottles.
   Check low, middle, and high scores. Agreement between reviewers is not proof
   that a comparison is right. See the [source comparisons and recommended settings](../research/review-score-conversion-pilot-2026-09.md).
2. Choose whether the site's scores should count. Publication is independent.
   Until reviewed, existing whole-number scores out of 100 keep counting.
3. To include scores, enter the scale, guide link, reason, and matching score
   table. No comparison is preselected. Add separate date ranges if the guide
   changed; a review with no date cannot use a date-limited table.
4. Preview the original and estimated scores, why each score is included or
   left out, and the before-and-after scores for sample Bottles. The preview
   shows up to 20 recent reviews and 10 affected Bottles, not every review. Check the full scale
   separately; don't enable only high scores because those were easier to check.
5. Save after reviewing the preview. Saving preserves original scores and queues
   an update of all affected Bottle and BottleGroup summaries. If someone else
   saved changes first, preview again. If scores do not finish updating, check
   worker errors, then preview and save again.

A 5-point or 10-point scale does not by itself justify multiplying the score.
The source's guide must support the comparison. Leave scores out when the
comparison is uncertain. Review original 100-point sites by the same standard.

## Stop Clip Generation

Set `EXTERNAL_REVIEW_CLIPS_ENABLED=false` to stop all clip model calls for cost
control or an operational problem. Review collection continues, and existing
clips remain stored. There are no source-specific model permissions.

## Stop A Source

Stop publication first. The reviews disappear from public pages but remain
available to administrators. Pause a database-configured source through its
administrator route. Disable a code-owned registry target in code. Keep stored
reviews while checking the source, Bottle matches, and request behavior.

## Remove A Source

Remove collection code only after publication is off and requests are stopped.
Keep the source and review records unless an approved data-removal plan explains
their replacement, links, and audit history. Remove stored data only through a
separate reviewed migration.
