## Context

Peated stores Pass, Sip, or Savor on tasting rows. The repository also contains
an unlaunched 100-point tasting path, but no member scores exist to migrate. A
user can create several tastings for the same Bottle. External publication
reviews use a different table and can store both a native score and an old
normalized score.

The new model gives each action one purpose. A tasting records a pour and can
have a band. A member review records one current Bottle opinion and has a
100-point score. Permitted external 100-point reviews join member reviews in the
Bottle score.

## Goals / Non-Goals

**Goals:**

- Give tastings one optional five-band rating.
- Give each member one editable 100-point review per Bottle.
- Preserve existing tasting history without inventing new values.
- Remove the unused 100-point tasting path. No member score data needs to move.
- Calculate one median score from member reviews and permitted external
  reviews.
- Keep field names clear in the database schema and public API.

**Non-Goals:**

- Converting Pass, Sip, or Savor into the five bands.
- Converting stars, ten-point scores, letter grades, or other external scales
  into 100-point scores.
- Combining review scores with tasting bands.
- Adding review drafts, versions, reviewer levels, weights, or moderation for
  member reviews.
- Adding review comments, likes, notifications, or main activity-feed cards.
- Removing historical rating columns in this change.

## Decisions

### Tastings use bands; member reviews use scores

Add `ratingBand` to `tasting`. New tasting writes can set one band or no band. They
cannot write Pass, Sip, Savor, or a 100-point score.

Add `member_review` with these fields:

```text
id
bottle_id
created_by_id
score
notes
created_at
updated_at
```

The table has one row per `(bottle_id, created_by_id)`. `score` is a whole
number from 0 through 100. `notes` is optional. Saving another review for the
same member and Bottle updates that row.

Privacy controls display only. Every valid member review score contributes to
the member score count, median, minimum, and maximum, regardless of the
member's privacy setting. Review text and member attribution follow the same
visibility rules as tasting text. A viewer who cannot see a private member's
tastings also cannot see that member's review row, name, or notes. The member
and other permitted viewers can see the review under the existing rules.
Reviews do not become public by default.

This model is smaller than a shared rating table. It also avoids a hidden
current-rating record. A tasting remains an event, while a review remains a
Bottle-level opinion.

### Use clear application names for historical tasting fields

Give the historical tasting fields clear names in the Drizzle schema and
generated migration:

```ts
ratingBand; // SQL: rating_band
legacySimpleRating; // SQL: legacy_simple_rating
legacyStarRating; // SQL: legacy_star_rating
```

New code reads and writes only `ratingBand` on tastings. Historical serializers can
still display the old values. Remove the empty tasting score column and the
unused Simple/Advanced user preference in the generated migration.

Keep the five band keys, ranges, and score lookup in one shared server constant
used by both the server and web app. Do not repeat the range cuts in forms,
summaries, or recommendation code.

The migration must rename `rating` to `legacy_simple_rating` and
`rating_legacy` to `legacy_star_rating`. It must preserve the stored values
instead of dropping and recreating the columns. Keep a short comment beside
each Drizzle field:

- `legacySimpleRating` stores historical Pass/Sip/Savor values. It is read-only
  and excluded from current summaries.
- `legacyStarRating` stores historical 0-5 values. It is read-only and excluded
  from current summaries.

These comments state the ownership rule. Do not add a TODO for a later rename.

The member review field is simply `score`. No extra type field is needed.

### Preserve only the rating data that exists

Pass, Sip, Savor, and historical star values remain on their tasting rows under
clear legacy names. They remain readable on historical tastings but do not
enter new summaries.

Do not convert these values into bands or reviews. There are no member
100-point scores, so do not add temporary data-copy code.

### External reviews that count stay in their current table

Use `externalReview` and `externalReviewArticle` in application code, schemas,
serializers, and API routes. Use the `externalReviews` API group and
`/external-reviews` paths. Reserve `memberReview` for reviews written by Peated
members. Keep the shipped SQL table names `review` and `review_article`; changing
those physical names adds migration risk without making application code clearer.

An external review contributes to the Bottle score only when all of these are
true:

- It is visible on the public Bottle page.
- Its source permits score display.
- It is assigned to an active Bottle.
- Its native scale is exactly 100.
- Its native value is a whole number from 0 through 100.

The old normalized `review.rating` value never contributes. Call that field
`legacyNormalizedScore` in application code and remove it from new public score
displays. New imports must not calculate or write it. Keep the SQL column only
for historical rows, with a TODO for its later removal.

Manual external-review writes must store the publication's displayed value,
scale, and label. They must not require or create a normalized 100-point value.

Each permitted external review contributes once. We will not add publication or
reviewer deduplication in this change.

### Store simple Bottle summaries

Add these stored summary fields to Bottle and BottleGroup:

```text
median_score
min_score
max_score
member_score_count
external_score_count
tasting_band_counts
```

`tasting_band_counts` is a JSON object with the five fixed band keys. Its total is the
sum of those values and does not need another stored column. The total score
count is `member_score_count + external_score_count`, so it also does not need
another stored column.

Keep the shipped `avg_rating` and `rating_stats` SQL columns as legacy data in
the first release. Name them `legacySimpleRatingAverage` and
`legacySimpleRatingStats` in application code, place a read-only comment beside
them, and stop using them in new API responses and sorting. The unused advanced score
summary columns can be replaced by the clearly named median fields because they
contain no member score data.

The existing Bottle statistics worker remains the owner of these fields. It
reads member reviews, permitted external reviews, and new tasting bands in one
query. BottleGroup summaries use the same records from active member Bottles.

### Use the median and keep the three sources visible

The score is the median of member review scores and permitted external review
scores. For an even count, use the lower of the two middle scores. The median is
null until the combined score count reaches 20. The minimum and maximum are
also null below that limit. Bottles below the limit sort after Bottles with a
visible score.

The API returns the member and external counts separately. Band counts include
new tasting bands only. Point scores never increase a band count.

### Keep the display plain

When fewer than 20 scores count, hide the score area completely. Do not show a
dash, zero, or estimated score. The empty state can link to the Bottle review
form.

Show band counts from Mediocre through Unicorn in that fixed order. Whenever a
band name appears, show its range. Do not print the distribution as a
percentage, stars, or a five-point score. Exact spacing, colors, and small-screen
layout stay with the web components and are not fixed by this plan.

### Keep the write paths separate

The tasting form always offers the five bands. The Bottle review form always
offers the 100-point score and optional notes. Remove the Simple/Advanced
profile preference and do not add a switch between the forms.

Tasting changes and member review changes ask the existing Bottle statistics
job to recalculate the Bottle after the main write succeeds. External review
imports, reassignment, visibility changes, and score-display policy changes
must do the same for affected Bottles. A policy change that affects many
Bottles queues them in small batches.

### Bottle merges keep one member review

When two Bottles merge, move their member reviews to the surviving Bottle. If
the same member reviewed both Bottles, keep the review with the latest
`updated_at`; use the larger review ID to break a tie. This treats the newest
review as the member's current opinion and satisfies the one-review rule.

### Recommendations use the top tasting bands

The current recommendation route finds Bottles enjoyed by the same members who
chose Savor. Replace Savor with Outstanding or Unicorn. Continue counting each
member once for each Bottle. Member review scores and external reviews do not
enter recommendations in this change.

## Risks / Trade-offs

- **Several tastings from one member add several band counts.** This is
  intentional because band counts describe pours, not unique members. UI copy
  must call them tastings or pours.
- **External score policy changes can affect many Bottles.** Recalculate them
  in small batches instead of blocking the policy update.
- **Historical simple-rating columns remain for a time.** Clear names and
  ownership comments keep new code away from them. A later change can remove
  them.
- **New band summaries and recommendations start sparse.** This is expected
  because old Pass/Sip/Savor values are not converted. Historical tastings
  remain readable.

## Migration Plan

1. Add the band, member review, and new Bottle summary fields with a generated
   migration. Rename the two existing historical tasting rating columns without
   changing their data, add their ownership comments, and remove the empty
   tasting score and unused rating preference.
2. Deploy code that writes bands and member reviews and calculates the new
   summaries.
3. Recalculate every active Bottle and BottleGroup so permitted external scores
   populate the new fields.
4. Compare external score counts with public reviews that meet the score rules.
5. Switch the web UI, API fields, sorting, and public documentation to the new
   model.

## Open Questions

None. Limiting each publication to one score and removing historical
simple-rating data are separate future decisions.
